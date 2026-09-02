import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Authentication is disabled, so there is no user session to scope
 * row-level security by. Every server-side read/write now goes through
 * the service-role client instead, matching `authenticatedClient()`.
 */
export async function createSupabaseServerClient() {
  return createSupabaseAdminClient();
}
