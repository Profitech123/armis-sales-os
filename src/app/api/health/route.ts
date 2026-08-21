import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import { apiError } from "@/lib/api/responses";

export async function GET() {
  const headersList = await headers();
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  const auth = headersList.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return apiError("UNAUTHORIZED", 401);
  }

  const checks: Record<string, string> = { application: "ok" };
  const supabase = createSupabaseAdminClient();
  if (!supabase) checks.database = "not_configured";
  else {
    const { error } = await supabase.from("crm_sync_state").select("enabled", { head: true, count: "exact" }).limit(1);
    checks.database = error ? "degraded" : "ok";
  }
  const healthy = checks.application === "ok" && checks.database === "ok";
  if (!healthy) logger.warn("health.degraded", { database: checks.database ?? null });
  return Response.json({ status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503 });
}
