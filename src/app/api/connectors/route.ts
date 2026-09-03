import { requireApiActor } from "@/lib/auth/authorization";
import { listConnectorStatuses } from "@/lib/data/connectors";
import { actorError, dataAccessError } from "@/lib/api/responses";

export async function GET() {
  const auth = await requireApiActor(["admin"]);
  if ("error" in auth) return actorError(auth);
  try {
    const data = await listConnectorStatuses({ includePrivilegedActivity: true });
    return Response.json({ data });
  } catch {
    return dataAccessError("api.connectors.read_failed", { actorId: auth.user.id });
  }
}
