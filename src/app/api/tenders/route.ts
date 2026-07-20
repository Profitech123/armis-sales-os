import { authenticatedClient } from "@/lib/api/auth";

export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.supabase
    .from("tenders")
    .select("*,accounts(name)")
    .order("due_at", { ascending: true });
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ data });
}
