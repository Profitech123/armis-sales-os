import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured", status: 503 } as const;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: "Unauthorized", status: 401 } as const;
  return { supabase, user: data.user } as const;
}
