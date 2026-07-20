import { authenticatedClient } from "@/lib/api/auth";

export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.supabase
    .from("meetings")
    .select("*,opportunities(name)")
    .order("started_at", { ascending: false });
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ data });
}
