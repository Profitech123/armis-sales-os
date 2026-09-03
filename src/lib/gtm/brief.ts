import { z } from "zod";

const shortText = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max);
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export const gtmBriefInputSchema = z.object({
  productService: shortText("Product or service", 200),
  targetIndustries: shortText("Target industry", 500),
  geographies: shortText("Geography", 500),
  companyProfile: shortText("Company profile", 1200),
  buyerRoles: shortText("Buyer roles", 800),
  painPoints: shortText("Pain points", 1600),
  exclusions: optionalText(1000),
  leadQuantity: z.coerce.number().int().min(1).max(500),
});

export type GtmBriefInput = z.infer<typeof gtmBriefInputSchema>;

export type StructuredLeadSearchBrief = {
  version: 1;
  objective: string;
  idealCustomerProfile: {
    industries: string[];
    geographies: string[];
    companyProfile: string;
  };
  buyerPersona: { roles: string[]; painHypotheses: string[] };
  exclusions: string[];
  requestedLeadCount: number;
  searchPrompt: string;
  generationMode: "local_template";
};

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

export function buildStructuredLeadSearchBrief(input: GtmBriefInput): StructuredLeadSearchBrief {
  const industries = splitList(input.targetIndustries);
  const geographies = splitList(input.geographies);
  const roles = splitList(input.buyerRoles);
  const pains = splitList(input.painPoints);
  const exclusions = splitList(input.exclusions);
  const objective = `Find ${input.leadQuantity} qualified leads for ${input.productService}.`;
  const clauses = [
    objective,
    `Target industries: ${industries.join(", ")}.`,
    `Target geographies: ${geographies.join(", ")}.`,
    `Company profile: ${input.companyProfile}.`,
    `Prioritize buyer roles: ${roles.join(", ")}.`,
    `Look for organizations likely experiencing: ${pains.join("; ")}.`,
    exclusions.length ? `Exclude: ${exclusions.join("; ")}.` : "Do not add unverified exclusions.",
    "Return evidence for every hard filter and keep near matches separate from qualified leads.",
  ];

  return {
    version: 1,
    objective,
    idealCustomerProfile: { industries, geographies, companyProfile: input.companyProfile },
    buyerPersona: { roles, painHypotheses: pains },
    exclusions,
    requestedLeadCount: input.leadQuantity,
    searchPrompt: clauses.join(" "),
    generationMode: "local_template",
  };
}

