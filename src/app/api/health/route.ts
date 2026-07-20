import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const checks: Record<string, string> = { application: "ok" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) checks.database = "not_configured";
  else {
    const { error } = await supabase.from("opportunities").select("id", { head: true, count: "exact" }).limit(1);
    checks.database = error ? "degraded" : "ok";
  }
  const healthy = checks.application === "ok" && !Object.values(checks).includes("degraded");
  return Response.json({ status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503 });
}
