import { requirePageActor } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAppRole, type AppRole } from "@/lib/auth/roles";

export type AdminUser = { id: string; email: string; displayName: string | null; role: AppRole };

export async function listUsersForAdmin(): Promise<AdminUser[]> {
  await requirePageActor(["admin"]);
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("profiles").select("id,email,display_name,role").order("email");
  if (error) throw new Error(`Unable to load users: ${error.message}`);
  return (data ?? []).filter((row): row is typeof row & { role: AppRole } => isAppRole(row.role)).map((row) => ({ id: row.id, email: row.email, displayName: row.display_name, role: row.role }));
}
