import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Authentication is disabled: every caller is treated as a single fixed
 * actor resolved from the `profiles` table (preferring an admin row) via
 * the service-role client. This keeps ownership/assignment plumbing that
 * depends on a `user.id` working without a real login session.
 */
export async function authenticatedClient() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { error: "Supabase is not configured", status: 503 } as const;

  const admin = await supabase.from("profiles").select("id,email,display_name,role").eq("role", "admin").limit(1).maybeSingle();
  const profile = admin.data ?? (await supabase.from("profiles").select("id,email,display_name,role").limit(1).maybeSingle()).data;
  if (!profile) return { error: "No profile available", status: 503 } as const;

  const user: User = {
    id: profile.id,
    email: profile.email,
    app_metadata: {},
    user_metadata: { display_name: profile.display_name },
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
  };

  return { supabase, user } as const;
}
