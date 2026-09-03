import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { apiError } from "@/lib/api/responses";
import { normalizeDomain, scoreStagedLead, stagedLeadSchema } from "@/lib/gtm/lead-processing";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const maxPayloadBytes = 1024 * 1024;
const replayWindowMs = 5 * 60 * 1000;
const resultSchema = z.object({
  version: z.literal(1),
  batchId: z.string().min(1).max(200),
  briefId: z.string().uuid(),
  leads: z.array(stagedLeadSchema.extend({ externalId: z.string().min(1).max(300) })).min(1).max(500),
});

function validSignature(request: Request, rawBody: string) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const timestamp = request.headers.get("x-armis-webhook-timestamp");
  const supplied = request.headers.get("x-armis-webhook-signature")?.replace(/^sha256=/, "");
  if (!secret || !timestamp || !supplied || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > replayWindowMs) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const actual = Buffer.from(supplied, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (process.env.EXPLEE_AUTOGTM_ENABLED !== "true") return apiError("NOT_FOUND", 404);
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxPayloadBytes) return apiError("PAYLOAD_TOO_LARGE", 413);
  let rawBody: string;
  try { rawBody = await request.text(); } catch { return apiError("INVALID_REQUEST", 400); }
  if (Buffer.byteLength(rawBody, "utf8") > maxPayloadBytes) return apiError("PAYLOAD_TOO_LARGE", 413);
  if (!validSignature(request, rawBody)) return apiError("UNAUTHORIZED", 401);
  let input: unknown;
  try { input = JSON.parse(rawBody); } catch { return apiError("INVALID_REQUEST", 400); }
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return apiError("INVALID_REQUEST", 422, parsed.error.flatten());

  const admin = createSupabaseAdminClient();
  if (!admin) return apiError("SERVICE_UNAVAILABLE", 503);
  const payload = parsed.data;
  const { data: brief, error: briefError } = await admin.from("gtm_briefs")
    .select("id,owner_user_id,status")
    .eq("id", payload.briefId)
    .in("status", ["approved", "dispatched", "results_ready"])
    .maybeSingle();
  if (briefError) return apiError("DATA_ACCESS_FAILED", 500);
  if (!brief) return apiError("NOT_FOUND", 404);

  const { error: eventError } = await admin.from("gtm_ingestion_events").insert({
    batch_id: payload.batchId,
    brief_id: payload.briefId,
    status: "processing",
    candidate_count: payload.leads.length,
  });
  if (eventError) {
    if (eventError.code !== "23505") return apiError("DATA_ACCESS_FAILED", 500);

    // batch_id already exists: either a genuine duplicate delivery, or a
    // previous attempt that failed and n8n is now retrying with the same
    // batchId. Only reclaim rows still marked "failed" for retry, mirroring
    // the Fireflies webhook's retry-reclaim logic (src/app/api/webhooks/fireflies/route.ts).
    const { data: existing } = await admin.from("gtm_ingestion_events").select("status").eq("batch_id", payload.batchId).maybeSingle();
    if (existing?.status === "processed") return Response.json({ accepted: true, candidateCount: 0, duplicate: true }, { status: 202 });
    if (existing?.status !== "failed") return apiError("REPLAY_REJECTED", 409);

    const { data: claimedRetry } = await admin
      .from("gtm_ingestion_events")
      .update({ status: "processing", candidate_count: payload.leads.length, error_code: null, processed_at: null })
      .eq("batch_id", payload.batchId)
      .eq("status", "failed")
      .select("batch_id")
      .maybeSingle();
    if (!claimedRetry) return apiError("REPLAY_REJECTED", 409);
  }

  try {
    const { data: existing, error: existingError } = await admin.from("gtm_lead_candidates")
      .select("company_domain,contact_email,external_id")
      .eq("owner_user_id", brief.owner_user_id);
    if (existingError) throw new Error("existing_lookup_failed");
    const domains = new Set((existing ?? []).map((row) => row.company_domain).filter(Boolean));
    const emails = new Set((existing ?? []).map((row) => row.contact_email).filter(Boolean));
    const externalIds = new Set((existing ?? []).map((row) => row.external_id).filter(Boolean));

    const unseenLeads = payload.leads.filter((lead) => {
      if (externalIds.has(lead.externalId)) return false;
      externalIds.add(lead.externalId);
      return true;
    });
    const rows = unseenLeads.map((lead) => {
      const domain = normalizeDomain(lead.companyDomain);
      const duplicate = Boolean(domain && domains.has(domain)) || Boolean(lead.contactEmail && emails.has(lead.contactEmail));
      if (domain) domains.add(domain);
      if (lead.contactEmail) emails.add(lead.contactEmail);
      const scored = scoreStagedLead({ ...lead, companyDomain: domain });
      return {
        owner_user_id: brief.owner_user_id,
        brief_id: payload.briefId,
        source: "explee",
        external_id: lead.externalId,
        company_name: lead.companyName,
        company_domain: domain,
        industry: lead.industry,
        geography: lead.geography,
        contact_name: lead.contactName,
        contact_title: lead.contactTitle,
        contact_email: lead.contactEmail,
        evidence: lead.evidence,
        score: scored.score,
        score_breakdown: scored.dimensions,
        validation_status: duplicate ? "duplicate" : "valid",
      };
    });
    if (rows.length > 0) {
      const { error: insertError } = await admin.from("gtm_lead_candidates").insert(rows);
      if (insertError) throw new Error("candidate_insert_failed");
    }
    await admin.from("gtm_briefs").update({ status: "results_ready" }).eq("id", payload.briefId);
    await admin.from("gtm_ingestion_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("batch_id", payload.batchId);
    return Response.json({ accepted: true, candidateCount: rows.length }, { status: 202 });
  } catch {
    await admin.from("gtm_ingestion_events").update({ status: "failed", error_code: "ingestion_failed", processed_at: new Date().toISOString() }).eq("batch_id", payload.batchId);
    logger.error("gtm.ingestion_failed", { briefId: payload.briefId, batchId: payload.batchId });
    return apiError("DATA_ACCESS_FAILED", 500);
  }
}
