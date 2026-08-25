import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StructuredLeadSearchBrief } from "@/lib/gtm/brief";

export type GtmBrief = {
  id: string;
  productService: string;
  leadQuantity: number;
  status: "draft" | "approved" | "dispatched" | "results_ready" | "cancelled";
  structuredBrief: StructuredLeadSearchBrief;
  approvedAt: string | null;
  createdAt: string;
};

export type GtmLeadCandidate = {
  id: string;
  briefId: string;
  source: "synthetic" | "explee";
  companyName: string;
  companyDomain: string | null;
  industry: string | null;
  geography: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  evidence: string[];
  score: number;
  validationStatus: "valid" | "invalid" | "duplicate";
  reviewStatus: "pending" | "approved" | "rejected";
};

export async function listGtmBriefs(): Promise<GtmBrief[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gtm_briefs")
    .select("id,product_service,lead_quantity,status,structured_brief,approved_at,created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(`Unable to load GTM briefs: ${error.code}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    productService: row.product_service,
    leadQuantity: row.lead_quantity,
    status: row.status,
    structuredBrief: row.structured_brief as StructuredLeadSearchBrief,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  }));
}

export async function listGtmLeadCandidates(): Promise<GtmLeadCandidate[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gtm_lead_candidates")
    .select("id,brief_id,source,company_name,company_domain,industry,geography,contact_name,contact_title,contact_email,evidence,score,validation_status,review_status")
    .order("score", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Unable to load GTM lead candidates: ${error.code}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    briefId: row.brief_id,
    source: row.source,
    companyName: row.company_name,
    companyDomain: row.company_domain,
    industry: row.industry,
    geography: row.geography,
    contactName: row.contact_name,
    contactTitle: row.contact_title,
    contactEmail: row.contact_email,
    evidence: Array.isArray(row.evidence) ? row.evidence.filter((item): item is string => typeof item === "string") : [],
    score: row.score,
    validationStatus: row.validation_status,
    reviewStatus: row.review_status,
  }));
}

