/**
 * Returns the Supabase publishable/anon key, preferring the newer
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY name while falling back to the
 * legacy NEXT_PUBLIC_SUPABASE_ANON_KEY for backwards-compatibility.
 */
export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
