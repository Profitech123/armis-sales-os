import { z } from "zod";

export const stagedLeadSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  companyDomain: z.string().trim().toLowerCase().max(253).nullable(),
  industry: z.string().trim().max(160).nullable(),
  geography: z.string().trim().max(160).nullable(),
  contactName: z.string().trim().max(200).nullable(),
  contactTitle: z.string().trim().max(200).nullable(),
  contactEmail: z.string().trim().toLowerCase().email().nullable(),
  evidence: z.array(z.string().trim().min(1).max(500)).max(10),
});

export type StagedLeadInput = z.infer<typeof stagedLeadSchema>;

export function normalizeDomain(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() || null;
}

export function scoreStagedLead(lead: StagedLeadInput) {
  const dimensions = {
    companyIdentity: lead.companyName && normalizeDomain(lead.companyDomain) ? 25 : 10,
    firmographicFit: lead.industry && lead.geography ? 25 : lead.industry || lead.geography ? 12 : 0,
    buyerCoverage: lead.contactTitle ? 20 : 0,
    contactability: lead.contactEmail ? 15 : 0,
    evidenceQuality: Math.min(15, lead.evidence.length * 5),
  };
  return { score: Object.values(dimensions).reduce((sum, value) => sum + value, 0), dimensions };
}

