import { cache } from "react";
import { redirect } from "next/navigation";
import { authenticatedClient } from "@/lib/api/auth";
import { hasAnyRole, isAppRole, type AppRole } from "@/lib/auth/roles";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type CurrentActor = {
  id: string;
  email: string;
  displayName: string | null;
  role: AppRole;
};

type ApiActorAuthorization =
  | { error: string; status: number }
  | { supabase: SupabaseClient; user: User; actor: CurrentActor };

export const getCurrentActor = cache(async (): Promise<CurrentActor | null> => {
  const auth = await authenticatedClient();
  if ("error" in auth) return null;

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id,email,display_name,role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !data || !isAppRole(data.role)) return null;
  return { id: data.id, email: data.email, displayName: data.display_name, role: data.role };
});

export async function requirePageActor(allowed?: readonly AppRole[]): Promise<CurrentActor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/sign-in");
  if (allowed && !hasAnyRole(actor.role, allowed)) redirect("/?error=forbidden");
  return actor;
}

export async function requireApiActor(allowed?: readonly AppRole[]): Promise<ApiActorAuthorization> {
  const auth = await authenticatedClient();
  if ("error" in auth) return { error: auth.error ?? "Unauthorized", status: auth.status ?? 401 };

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id,email,display_name,role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !data || !isAppRole(data.role)) return { error: "Forbidden", status: 403 } as const;
  if (allowed && !hasAnyRole(data.role, allowed)) return { error: "Forbidden", status: 403 } as const;
  return {
    supabase: auth.supabase,
    user: auth.user,
    actor: { id: data.id, email: data.email, displayName: data.display_name, role: data.role as AppRole },
  };
}
