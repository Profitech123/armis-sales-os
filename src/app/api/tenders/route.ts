import { requireApiActor } from "@/lib/auth/authorization";
import { actorError, dataAccessError } from "@/lib/api/responses";

export async function GET() {
  const auth = await requireApiActor();
  if ("error" in auth) return actorError(auth);
  const { data, error } = await auth.supabase
    .from("tenders")
    .select("*,accounts(name)")
    .order("due_at", { ascending: true });
  return error ? dataAccessError("api.tenders.read_failed", { code: error.code }) : Response.json({ data });
}
