import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-to-server contexts with no end-user session
 * (e.g. inbound webhooks). Bypasses RLS — never import from client components
 * or expose its results directly to the browser.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
