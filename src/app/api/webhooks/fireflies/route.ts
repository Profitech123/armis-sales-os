import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { analyzeTranscript, TranscriptAnalysisError } from "@/lib/ai/transcript-analysis";
import { apiError } from "@/lib/api/responses";
import { logger } from "@/lib/observability/logger";

const maxPayloadBytes = 256 * 1024;
const replayWindowMs = 5 * 60 * 1000;
const rateLimitWindowMs = 60 * 1000;
const rateLimitMax = 60;
const replayCache = new Map<string, number>();
let rateWindow = { startedAt: 0, count: 0 };

const payloadSchema = z.object({
  transcriptId: z.string().min(1).max(200),
  title: z.string().max(500).optional(),
  hostEmail: z.string().email().optional(),
  startedAt: z.string().datetime().optional(),
  attendees: z.unknown().optional(),
  transcriptText: z.string().max(200_000).optional(),
});

function consumeRateLimit(now: number) {
  if (now - rateWindow.startedAt >= rateLimitWindowMs) rateWindow = { startedAt: now, count: 0 };
  rateWindow.count += 1;
  return rateWindow.count <= rateLimitMax;
}

function safeEqualHex(expected: string, supplied: string) {
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(supplied, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyMachineRequest(request: Request, rawBody: string, now = Date.now()) {
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET;
  const timestamp = request.headers.get("x-armis-webhook-timestamp");
  const eventId = request.headers.get("x-armis-webhook-id");
  const suppliedSignature = request.headers.get("x-armis-webhook-signature")?.replace(/^sha256=/, "");
  if (!secret || !timestamp || !eventId || !suppliedSignature) return { ok: false as const, code: "auth" as const };
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > replayWindowMs || eventId.length > 200) {
    return { ok: false as const, code: "replay" as const };
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${eventId}.${rawBody}`).digest("hex");
  if (!safeEqualHex(expected, suppliedSignature)) return { ok: false as const, code: "auth" as const };

  for (const [id, expiresAt] of replayCache) if (expiresAt <= now) replayCache.delete(id);
  const replayKey = createHash("sha256").update(eventId).digest("hex");
  if (replayCache.has(replayKey)) return { ok: false as const, code: "replay" as const };
  replayCache.set(replayKey, now + replayWindowMs);
  return { ok: true as const };
}

type AnalysisOutcome = {
  stored: boolean;
  meetingId?: string;
  insightCount?: number;
  reason?: string;
};

/**
 * Best-effort fetch of full transcript text from Fireflies' GraphQL API by id.
 * The query and sentence fields follow Fireflies' published Transcript API
 * schema. If credentials are absent or Fireflies rejects the request, analysis
 * is skipped without preventing n8n delivery.
 */
async function fetchFirefliesTranscript(transcriptId: string): Promise<string | null> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `query Transcript($id: String!) {
          transcript(id: $id) {
            sentences { text speaker_name }
          }
        }`,
        variables: { id: transcriptId },
      }),
    });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const result = z.object({
      data: z.object({
        transcript: z.object({
          sentences: z.array(z.object({ text: z.string(), speaker_name: z.string().nullable().optional() })),
        }).nullable(),
      }).optional(),
      errors: z.array(z.object({ message: z.string() })).optional(),
    }).safeParse(json);
    if (!result.success || result.data.errors?.length) return null;
    const sentences = result.data.data?.transcript?.sentences;
    if (!sentences?.length) return null;
    return sentences.map((s) => `${s.speaker_name ?? "Speaker"}: ${s.text}`).join("\n");
  } catch {
    return null;
  }
}

async function runAnalysisPipeline(payload: z.infer<typeof payloadSchema>): Promise<AnalysisOutcome> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { stored: false, reason: "supabase_not_configured" };

  const { transcriptId, title, hostEmail, startedAt, attendees, transcriptText } = payload;

  const { error: insertEventError } = await admin.from("webhook_events").insert({
    provider: "fireflies",
    external_event_id: transcriptId,
    event_type: "transcript.completed",
    payload,
    status: "processing",
  });

  if (insertEventError) {
    if (insertEventError.code === "23505") {
      const { data: existing } = await admin
        .from("webhook_events")
        .select("status")
        .eq("provider", "fireflies")
        .eq("external_event_id", transcriptId)
        .maybeSingle();
      if (existing?.status === "processed") return { stored: true, reason: "already_processed" };
      if (existing?.status !== "failed") return { stored: false, reason: "already_processing" };

      const { data: claimedRetry } = await admin
        .from("webhook_events")
        .update({ status: "processing", payload, error: null, processed_at: null })
        .eq("provider", "fireflies")
        .eq("external_event_id", transcriptId)
        .eq("status", "failed")
        .select("id")
        .maybeSingle();
      if (!claimedRetry) return { stored: false, reason: "already_processing" };
    } else {
      logger.error("webhook.storage_failed", { provider: "fireflies", code: insertEventError.code });
      return { stored: false, reason: "storage_failed" };
    }
  }

  const markEventFailed = async (error: string) => {
    await admin
      .from("webhook_events")
      .update({ status: "failed", error, processed_at: new Date().toISOString() })
      .eq("provider", "fireflies")
      .eq("external_event_id", transcriptId);
  };

  if (!hostEmail) {
    await markEventFailed("no hostEmail in payload");
    return { stored: false, reason: "owner_not_found" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", hostEmail.toLowerCase())
    .maybeSingle();

  if (!profile) {
    await markEventFailed("no matching profile for host email");
    return { stored: false, reason: "owner_not_found" };
  }

  const ownerUserId = profile.id as string;
  const transcript = transcriptText ?? (await fetchFirefliesTranscript(transcriptId));

  const { data: meeting, error: meetingError } = await admin
    .from("meetings")
    .upsert(
      {
        owner_user_id: ownerUserId,
        provider: "fireflies",
        external_id: transcriptId,
        title: title ?? "Fireflies meeting",
        started_at: startedAt ?? new Date().toISOString(),
        attendees: attendees ?? [],
        transcript: transcript ?? null,
      },
      { onConflict: "provider,external_id" },
    )
    .select("id")
    .single();

  if (meetingError || !meeting) {
    await markEventFailed(`meeting upsert failed: ${meetingError?.message ?? "unknown error"}`);
    return { stored: false, reason: "meeting_upsert_failed" };
  }

  const meetingId = meeting.id as string;

  if (!transcript) {
    await markEventFailed("no transcript text available for analysis");
    return { stored: false, meetingId, reason: "no_transcript_text" };
  }

  try {
    const analysis = await analyzeTranscript(transcript, { title: title ?? "Fireflies meeting", attendees });

    await admin
      .from("meetings")
      .update({ summary: analysis.summary, sentiment: analysis.sentiment, processed_at: new Date().toISOString() })
      .eq("id", meetingId);

    if (analysis.insights.length > 0) {
      await admin.from("meeting_insights").insert(
        analysis.insights.map((insight) => ({
          owner_user_id: ownerUserId,
          meeting_id: meetingId,
          kind: insight.kind,
          content: insight.content,
          evidence_quote: insight.evidenceQuote ?? null,
          evidence_timestamp_seconds: insight.evidenceTimestampSeconds ?? null,
          confidence: insight.confidence ?? null,
        })),
      );
    }

    const now = new Date().toISOString();
    for (const provider of ["fireflies", "openrouter"] as const) {
      await admin.from("integration_connections").upsert(
        { owner_user_id: ownerUserId, provider, status: "connected", last_synced_at: now },
        { onConflict: "owner_user_id,provider" },
      );
    }

    await admin.from("audit_log").insert({
      actor_user_id: ownerUserId,
      entity_type: "meeting",
      entity_id: meetingId,
      action: "ai_transcript_analysis",
      after_data: { summary: analysis.summary, sentiment: analysis.sentiment, insightCount: analysis.insights.length },
    });

    await admin
      .from("webhook_events")
      .update({ status: "processed", processed_at: now })
      .eq("provider", "fireflies")
      .eq("external_event_id", transcriptId);

    return { stored: true, meetingId, insightCount: analysis.insights.length };
  } catch (error) {
    const internalMessage = error instanceof TranscriptAnalysisError ? error.message : "unexpected analysis error";
    await markEventFailed(internalMessage);
    logger.error("webhook.analysis_failed", { provider: "fireflies", meetingId });
    return { stored: false, meetingId, reason: "analysis_failed" };
  }
}

export async function POST(request: Request) {
  const now = Date.now();
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxPayloadBytes) return apiError("PAYLOAD_TOO_LARGE", 413);

  let rawBody: string;
  try { rawBody = await request.text(); } catch { return apiError("INVALID_REQUEST", 400); }
  if (Buffer.byteLength(rawBody, "utf8") > maxPayloadBytes) return apiError("PAYLOAD_TOO_LARGE", 413);
  const verification = verifyMachineRequest(request, rawBody, now);
  if (!verification.ok) return verification.code === "replay" ? apiError("REPLAY_REJECTED", 409) : apiError("UNAUTHORIZED", 401);
  if (!consumeRateLimit(now)) return apiError("RATE_LIMITED", 429);

  let rawPayload: unknown;
  try { rawPayload = JSON.parse(rawBody); } catch { return apiError("INVALID_REQUEST", 400); }
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) return apiError("INVALID_REQUEST", 422, parsed.error.flatten());

  const analysis = process.env.AI_TRANSCRIPT_ANALYSIS_ENABLED === "true"
    ? await runAnalysisPipeline(parsed.data).catch((): AnalysisOutcome => ({ stored: false, reason: "analysis_failed" }))
    : { stored: false, reason: "ai_analysis_disabled" };

  if (process.env.FIREFLIES_FORWARDING_ENABLED !== "true") {
    return Response.json({ accepted: true, forwarding: "disabled", analysis }, { status: 202 });
  }
  const target = process.env.N8N_FIREFLIES_WEBHOOK_URL;
  if (!target) return apiError("SERVICE_UNAVAILABLE", 503);

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", "x-armis-webhook-secret": process.env.N8N_WEBHOOK_SECRET ?? "" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      logger.warn("webhook.forwarding_failed", { provider: "fireflies", downstreamStatus: response.status });
      return apiError("FORWARDING_FAILED", 502);
    }
    return Response.json({ accepted: true, forwarding: "completed", analysis }, { status: 202 });
  } catch {
    logger.warn("webhook.forwarding_failed", { provider: "fireflies", downstreamStatus: null });
    return apiError("FORWARDING_FAILED", 502);
  }
}
