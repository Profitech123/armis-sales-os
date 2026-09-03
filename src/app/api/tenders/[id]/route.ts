import { z } from "zod";
import { requireApiActor } from "@/lib/auth/authorization";
import { actorError, apiError, dataAccessError } from "@/lib/api/responses";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError("INVALID_REQUEST", 400);

  const auth = await requireApiActor();
  if ("error" in auth) return actorError(auth);

  const { data, error } = await auth.supabase
    .from("tenders")
    .select("*,accounts(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) return dataAccessError("api.tender.read_failed", { code: error.code });
  if (!data) return apiError("NOT_FOUND", 404);
  return Response.json({ data });
}
