export type ConnectorId = "supabase" | "microsoft" | "fireflies" | "openrouter" | "n8n" | "apify" | "vercel";

export type ConnectorDefinition = {
  id: ConnectorId;
  label: string;
  category: "Data & Auth" | "Revenue Intelligence" | "Automation" | "Enrichment" | "Infra";
  description: string;
  requiredEnvVars: string[];
  optionalEnvVars?: string[];
};

export const connectorRegistry: ConnectorDefinition[] = [
  {
    id: "supabase",
    label: "Supabase",
    category: "Data & Auth",
    description: "Postgres database, auth, and row-level security backing the app.",
    requiredEnvVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  },
  {
    id: "microsoft",
    label: "Microsoft Entra ID",
    category: "Data & Auth",
    description: "Azure AD sign-in for sellers via Supabase Auth.",
    requiredEnvVars: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID"],
  },
  {
    id: "fireflies",
    label: "Fireflies",
    category: "Revenue Intelligence",
    description: "Meeting transcript source, delivered via inbound webhook.",
    requiredEnvVars: ["FIREFLIES_WEBHOOK_SECRET"],
    optionalEnvVars: ["FIREFLIES_API_KEY"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    category: "Revenue Intelligence",
    description: "Transcript summarization and insight extraction (nvidia/nemotron-3-ultra-550b-a55b:free by default).",
    requiredEnvVars: ["OPENROUTER_API_KEY"],
  },
  {
    id: "n8n",
    label: "n8n Automation",
    category: "Automation",
    description: "Workflow relay for Fireflies transcript events.",
    requiredEnvVars: ["N8N_FIREFLIES_WEBHOOK_URL", "N8N_WEBHOOK_SECRET"],
  },
  {
    id: "apify",
    label: "Apify",
    category: "Enrichment",
    description: "Reserved for future account/contact enrichment scraping.",
    requiredEnvVars: ["APIFY_API_TOKEN"],
  },
  {
    id: "vercel",
    label: "Vercel",
    category: "Infra",
    description: "Deployment platform and cron scheduler for /api/health.",
    requiredEnvVars: [],
  },
];
