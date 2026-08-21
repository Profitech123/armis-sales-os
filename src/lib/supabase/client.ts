import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey } from "@/lib/supabase/keys";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseAnonKey();
  if (!url || !key) throw new Error("Supabase public environment variables are not configured.");
  return createBrowserClient(url, key);
}
