"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireApiActor } from "@/lib/auth/authorization";
import { buildStructuredLeadSearchBrief, gtmBriefInputSchema } from "@/lib/gtm/brief";
import { scoreStagedLead, type StagedLeadInput } from "@/lib/gtm/lead-processing";
import { logger } from "@/lib/observability/logger";

const idSchema = z.string().uuid();
const dispatchUrlSchema = z.string().url().refine((value) => value.startsWith("https://"));

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createGtmBrief(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const parsed = gtmBriefInputSchema.safeParse(formValues(formData));
  if (!parsed.success) redirect("/gtm?error=invalid_brief");
  const structuredBrief = buildStructuredLeadSearchBrief(parsed.data);
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("gtm_briefs").insert({
    owner_user_id: auth.user.id,
    product_service: input.productService,
    target_industries: input.targetIndustries,
    geographies: input.geographies,
    company_profile: input.companyProfile,
    buyer_roles: input.buyerRoles,
    pain_points: input.painPoints,
    exclusions: input.exclusions,
    lead_quantity: input.leadQuantity,
    structured_brief: structuredBrief,
  }).select("id").single();
  if (error || !data) {
    logger.error("gtm.brief_create_failed", { actorId: auth.user.id, code: error?.code });
    redirect("/gtm?error=create_failed");
  }
  revalidatePath("/gtm");
  redirect(`/gtm?brief=${data.id}`);
}

export async function approveGtmBrief(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/gtm?error=invalid_brief");
  const { data, error } = await auth.supabase.from("gtm_briefs")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id.data).eq("status", "draft").select("id").maybeSingle();
  if (error || !data) redirect("/gtm?error=approval_failed");
  revalidatePath("/gtm");
  redirect(`/gtm?brief=${id.data}&approved=true`);
}

export async function dispatchApprovedGtmBrief(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/gtm?error=invalid_brief");
  if (process.env.EXPLEE_AUTOGTM_ENABLED !== "true") redirect(`/gtm?brief=${id.data}&error=dispatch_disabled`);

  const target = dispatchUrlSchema.safeParse(process.env.N8N_EXPLEE_GTM_WEBHOOK_URL);
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!target.success || !secret) redirect(`/gtm?brief=${id.data}&error=dispatch_not_configured`);
  const { data: brief, error: briefError } = await auth.supabase.from("gtm_briefs")
    .select("id,structured_brief,status")
    .eq("id", id.data).eq("status", "approved").maybeSingle();
  if (briefError || !brief) redirect(`/gtm?brief=${id.data}&error=brief_not_approved`);

  const body = JSON.stringify({ version: 1, briefId: brief.id, searchBrief: brief.structured_brief });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  try {
    const response = await fetch(target.data, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-armis-webhook-timestamp": timestamp,
        "x-armis-webhook-signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("downstream_rejected");
  } catch {
    logger.warn("gtm.dispatch_failed", { actorId: auth.user.id, briefId: id.data });
    redirect(`/gtm?brief=${id.data}&error=dispatch_failed`);
  }
  const { error } = await auth.supabase.from("gtm_briefs")
    .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
    .eq("id", id.data).eq("status", "approved");
  if (error) redirect(`/gtm?brief=${id.data}&error=dispatch_state_failed`);
  revalidatePath("/gtm");
  redirect(`/gtm?brief=${id.data}&dispatched=true`);
}

function syntheticLeads(briefId: string, structured: ReturnType<typeof buildStructuredLeadSearchBrief>): StagedLeadInput[] {
  const suffix = briefId.slice(0, 8);
  const industries = structured.idealCustomerProfile.industries;
  const geographies = structured.idealCustomerProfile.geographies;
  const roles = structured.buyerPersona.roles;
  return ["Northstar", "Crescent", "Harbor"].map((name, index) => ({
    companyName: `${name} Example ${index + 1}`,
    companyDomain: `${name.toLowerCase()}-${suffix}.example.com`,
    industry: industries[index % Math.max(industries.length, 1)] ?? "Synthetic industry",
    geography: geographies[index % Math.max(geographies.length, 1)] ?? "Synthetic geography",
    contactName: `Synthetic Buyer ${index + 1}`,
    contactTitle: roles[index % Math.max(roles.length, 1)] ?? "Synthetic buyer role",
    contactEmail: `buyer-${suffix}-${index + 1}@example.com`,
    evidence: ["Synthetic company-profile match", "Synthetic buyer-role match", "No external data used"],
  }));
}

export async function generateSyntheticGtmResults(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/gtm?error=invalid_brief");
  const { data: brief } = await auth.supabase.from("gtm_briefs")
    .select("id,structured_brief,status").eq("id", id.data).in("status", ["approved", "results_ready"]).maybeSingle();
  if (!brief) redirect(`/gtm?brief=${id.data}&error=brief_not_approved`);
  const { count } = await auth.supabase.from("gtm_lead_candidates")
    .select("id", { head: true, count: "exact" }).eq("brief_id", id.data).eq("source", "synthetic");
  if ((count ?? 0) > 0) redirect(`/gtm?brief=${id.data}&error=synthetic_already_generated`);

  const candidates = syntheticLeads(id.data, brief.structured_brief).map((lead, index) => {
    const result = scoreStagedLead(lead);
    return {
      owner_user_id: auth.user.id,
      brief_id: id.data,
      source: "synthetic",
      external_id: `synthetic:${id.data}:${index + 1}`,
      company_name: lead.companyName,
      company_domain: lead.companyDomain,
      industry: lead.industry,
      geography: lead.geography,
      contact_name: lead.contactName,
      contact_title: lead.contactTitle,
      contact_email: lead.contactEmail,
      evidence: lead.evidence,
      score: result.score,
      score_breakdown: result.dimensions,
    };
  });
  const { error } = await auth.supabase.from("gtm_lead_candidates").insert(candidates);
  if (error) {
    logger.error("gtm.synthetic_results_failed", { actorId: auth.user.id, briefId: id.data, code: error.code });
    redirect(`/gtm?brief=${id.data}&error=synthetic_failed`);
  }
  await auth.supabase.from("gtm_briefs").update({ status: "results_ready" }).eq("id", id.data);
  revalidatePath("/gtm");
  redirect(`/gtm?brief=${id.data}&synthetic=true`);
}

export async function reviewGtmLead(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const parsed = z.object({ id: idSchema, decision: z.enum(["approved", "rejected"]) }).safeParse(formValues(formData));
  if (!parsed.success) redirect("/gtm?error=invalid_review");
  const { data, error } = await auth.supabase.from("gtm_lead_candidates")
    .update({ review_status: parsed.data.decision, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.id).eq("review_status", "pending").select("id").maybeSingle();
  if (error || !data) redirect("/gtm?error=review_failed");
  revalidatePath("/gtm");
}

