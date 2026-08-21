"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApiActor } from "@/lib/auth/authorization";
import { appRoles } from "@/lib/auth/roles";
import { logger } from "@/lib/observability/logger";

const roleChangeSchema = z.object({ userId: z.string().uuid(), role: z.enum(appRoles) });

export async function updateUserRole(formData: FormData) {
  const auth = await requireApiActor(["admin"]);
  if ("error" in auth) redirect("/sign-in");
  const parsed = roleChangeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/admin/users?error=invalid_role_change");
  if (parsed.data.userId === auth.user.id) redirect("/admin/users?error=self_role_change_blocked");
  const { error } = await auth.supabase.rpc("admin_update_user_role", {
    target_user_id: parsed.data.userId,
    target_role: parsed.data.role,
  });
  if (error) {
    logger.error("admin.role_change_failed", { actorId: auth.user.id, targetId: parsed.data.userId, code: error.code });
    const knownReason = ["self_role_change_blocked", "last_admin_blocked", "user_not_found", "approved_identity_not_found"]
      .find((reason) => error.message.includes(reason));
    redirect(`/admin/users?error=${knownReason ?? "update_failed"}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users?updated=role");
}
