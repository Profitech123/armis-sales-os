import { requireApiActor } from "@/lib/auth/authorization";
import { actorError, dataAccessError } from "@/lib/api/responses";

export async function GET() {
  const auth = await requireApiActor();
  if ("error" in auth) return actorError(auth);
  const { data, error } = await auth.supabase
    .from("communications")
    .select("*")
    .eq("status", "open")
    .order("received_at", { ascending: false });
  return error ? dataAccessError("api.communications.read_failed", { code: error.code }) : Response.json({ data });
}
