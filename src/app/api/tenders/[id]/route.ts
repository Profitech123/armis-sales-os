import { z } from "zod";
import { authenticatedClient } from "@/lib/api/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid tender id" }, { status: 400 });

  const auth = await authenticatedClient();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.supabase
    .from("tenders")
    .select("*,accounts(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data });
}
