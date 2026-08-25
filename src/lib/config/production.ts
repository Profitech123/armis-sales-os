const requiredProductionVariables = [
  "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID", "CRON_SECRET",
] as const;

export function validateProductionConfiguration(env: Record<string, string | undefined>) {
  const missing = requiredProductionVariables.filter((name) => !env[name]?.trim());
  const unsafe: string[] = [];
  if (env.NEXT_PUBLIC_USE_MOCK_DATA === "true") unsafe.push("NEXT_PUBLIC_USE_MOCK_DATA must be false");
  for (const flag of ["CRM_SYNC_ENABLED","AI_TRANSCRIPT_ANALYSIS_ENABLED","FIREFLIES_FORWARDING_ENABLED","EXPLEE_AUTOGTM_ENABLED","GTM_PROMPT_AI_ENABLED"] as const) if (env[flag] !== "false") unsafe.push(`${flag} must remain false for Phase 1`);
  if (env.NEXT_PUBLIC_APP_URL?.startsWith("http://")) unsafe.push("NEXT_PUBLIC_APP_URL must use HTTPS");
  return { valid: missing.length===0&&unsafe.length===0, missing, unsafe };
}
