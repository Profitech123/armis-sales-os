import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new SupabaseNotConfiguredError();
  return supabase;
}

export type AccountDetail = { id:string;owner_user_id:string;name:string;industry:string|null;website:string|null;archived_at:string|null;record_version:number;created_at:string;updated_at:string;contacts:{id:string;first_name:string;last_name:string;email:string|null;job_title:string|null;archived_at:string|null}[];opportunities:{id:string;name:string;stage:string;value_amount:number;expected_close_date:string|null}[];activities:{id:string;kind:string;subject:string;status:string;priority:string;due_at:string|null;created_at:string}[] };
export type ContactDetail = { id:string;owner_user_id:string;account_id:string;first_name:string;last_name:string;email:string|null;phone:string|null;job_title:string|null;relationship_role:string|null;archived_at:string|null;record_version:number;created_at:string;updated_at:string;accounts:{id:string;name:string}|null;activities:{id:string;kind:string;subject:string;status:string;priority:string;due_at:string|null;created_at:string}[];opportunity_contacts:{opportunity_id:string;role:string;opportunities:{id:string;name:string;stage:string}|null}[] };

export async function getAccountDetail(id: string): Promise<AccountDetail|null> {
  if (!isUuid(id)) return null;
  const supabase = await client();
  const { data, error } = await supabase.from("accounts")
    .select("id,owner_user_id,name,industry,website,archived_at,record_version,created_at,updated_at,contacts(id,first_name,last_name,email,job_title,archived_at),opportunities(id,name,stage,value_amount,expected_close_date),activities(id,kind,subject,status,priority,due_at,created_at)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load account: ${error.message}`);
  return data as AccountDetail|null;
}

export async function getContactDetail(id: string): Promise<ContactDetail|null> {
  if (!isUuid(id)) return null;
  const supabase = await client();
  const { data, error } = await supabase.from("contacts")
    .select("id,owner_user_id,account_id,first_name,last_name,email,phone,job_title,relationship_role,archived_at,record_version,created_at,updated_at,accounts(id,name),activities(id,kind,subject,status,priority,due_at,created_at),opportunity_contacts!opportunity_contacts_contact_id_fkey(opportunity_id,role,opportunities!opportunity_contacts_opportunity_id_fkey(id,name,stage))")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load contact: ${error.message}`);
  return data as ContactDetail|null;
}

export async function listAssignableUsers(actorId: string, role: string) {
  if (!isUuid(actorId)) return [];
  const supabase = await client();
  if (role === "admin") {
    const { data, error } = await supabase.from("profiles").select("id,email,display_name,role").order("email");
    if (error) throw new Error(`Unable to load assignable users: ${error.message}`);
    return data ?? [];
  }
  if (role !== "manager") return [];
  const { data: memberships, error } = await supabase.from("team_memberships").select("member_user_id,profiles!team_memberships_member_user_id_fkey(id,email,display_name,role)").eq("manager_user_id", actorId);
  if (error) throw new Error(`Unable to load assignable users: ${error.message}`);
  return (memberships ?? []).flatMap((row) => Array.isArray(row.profiles) ? row.profiles : row.profiles ? [row.profiles] : []);
}
