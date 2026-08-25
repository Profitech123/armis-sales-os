import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildStructuredLeadSearchBrief, gtmBriefInputSchema } from "@/lib/gtm/brief";
import { normalizeDomain, scoreStagedLead } from "@/lib/gtm/lead-processing";

describe("GTM prompt workflow", () => {
  const input = {
    productService: "Synthetic security service",
    targetIndustries: "Banking, Healthcare",
    geographies: "UAE; Saudi Arabia",
    companyProfile: "Enterprise organizations with regulated operations",
    buyerRoles: "CISO, CIO",
    painPoints: "Identity sprawl; audit readiness",
    exclusions: "Existing customers, competitors",
    leadQuantity: 25,
  };

  it("validates and converts guided inputs into an inspectable search brief", () => {
    const parsed = gtmBriefInputSchema.parse(input);
    const brief = buildStructuredLeadSearchBrief(parsed);
    expect(brief.idealCustomerProfile.industries).toEqual(["Banking", "Healthcare"]);
    expect(brief.buyerPersona.roles).toEqual(["CISO", "CIO"]);
    expect(brief.requestedLeadCount).toBe(25);
    expect(brief.generationMode).toBe("local_template");
    expect(brief.searchPrompt).toContain("Existing customers");
  });

  it("bounds lead quantity and required targeting inputs", () => {
    expect(gtmBriefInputSchema.safeParse({ ...input, leadQuantity: 501 }).success).toBe(false);
    expect(gtmBriefInputSchema.safeParse({ ...input, buyerRoles: "" }).success).toBe(false);
  });

  it("normalizes and scores staged leads with visible dimensions", () => {
    const lead = {
      companyName: "Synthetic Company",
      companyDomain: "https://www.synthetic.example.com/path",
      industry: "Banking",
      geography: "UAE",
      contactName: "Synthetic Buyer",
      contactTitle: "CISO",
      contactEmail: "buyer@example.com",
      evidence: ["Synthetic fit", "Synthetic role", "No external data"],
    };
    expect(normalizeDomain(lead.companyDomain)).toBe("synthetic.example.com");
    expect(scoreStagedLead(lead)).toMatchObject({ score: 100 });
  });
});

describe("GTM database contract", () => {
  const migration = readFileSync("supabase/migrations/20260822000002_gtm_lead_workflow.sql", "utf8");

  it("uses approved-identity RLS and keeps ingestion events private", () => {
    expect(migration).toContain("app_private.current_user_is_approved()");
    expect(migration).toContain("alter table public.gtm_briefs enable row level security");
    expect(migration).toContain("alter table public.gtm_lead_candidates enable row level security");
    expect(migration).toContain("revoke all on public.gtm_ingestion_events from anon, authenticated");
  });

  it("does not contain a pipeline import or opportunity foreign key", () => {
    expect(migration).not.toContain("insert into public.opportunities");
    expect(migration).not.toContain("opportunity_id");
  });
});

