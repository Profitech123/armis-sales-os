"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInPage() {
  async function signIn() {
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email openid profile offline_access", redirectTo },
    });
    if (error) throw error;
  }

  return <main className="app-shell"><div className="container"><section className="intelligence compact-intelligence"><p className="mono">Secure workspace</p><h2>Sign in with your Microsoft work account.</h2><p>Access is authenticated through Microsoft Entra ID and Supabase Auth.</p><button className="button" type="button" onClick={signIn}>Continue with Microsoft</button></section></div></main>;
}
