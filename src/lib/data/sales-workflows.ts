import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AccountListItem = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  contactCount: number;
  opportunityCount: number;
};

export type ContactListItem = {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  relationshipRole: string | null;
};

export type ActivityListItem = {
  id: string;
  ownerUserId: string;
  kind: "task" | "follow_up" | "call" | "email" | "note";
  subject: string;
  details: string | null;
  dueAt: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  accountId: string | null;
  accountName: string | null;
  opportunityId: string | null;
  opportunityName: string | null;
};

export async function listAccounts(): Promise<AccountListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,industry,website,contacts(count),opportunities(count)")
    .order("name");
  if (error) throw new Error(`Unable to load accounts: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    industry: row.industry,
    website: row.website,
    contactCount: row.contacts?.[0]?.count ?? 0,
    opportunityCount: row.opportunities?.[0]?.count ?? 0,
  }));
}

export async function listContacts(): Promise<ContactListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contacts")
    .select("id,account_id,first_name,last_name,email,phone,job_title,relationship_role,accounts(name)")
    .order("last_name");
  if (error) throw new Error(`Unable to load contacts: ${error.message}`);
  return (data ?? []).map((row) => {
    const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    return {
      id: row.id,
      accountId: row.account_id,
      accountName: account?.name ?? "Unassigned",
      name: `${row.first_name} ${row.last_name}`.trim(),
      email: row.email,
      phone: row.phone,
      jobTitle: row.job_title,
      relationshipRole: row.relationship_role,
    };
  });
}

export async function listActivities(options: { openOnly?: boolean; limit?: number; opportunityId?: string } = {}): Promise<ActivityListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("activities")
    .select("id,owner_user_id,kind,subject,details,due_at,status,account_id,opportunity_id,accounts(name),opportunities(name)")
    .order("due_at", { ascending: true, nullsFirst: false });
  if (options.openOnly) query = query.in("status", ["open", "in_progress"]);
  if (options.opportunityId) query = query.eq("opportunity_id", options.opportunityId);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load activities: ${error.message}`);
  return (data ?? []).map((row) => {
    const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      kind: row.kind,
      subject: row.subject,
      details: row.details,
      dueAt: row.due_at,
      status: row.status,
      accountId: row.account_id,
      accountName: account?.name ?? null,
      opportunityId: row.opportunity_id,
      opportunityName: opportunity?.name ?? null,
    };
  });
}

export type SearchResult = { id: string; type: "Account" | "Contact" | "Opportunity" | "Activity"; title: string; subtitle: string | null; href: string };

export async function searchSalesRecords(rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim().slice(0, 80);
  if (query.length < 2) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const pattern = `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
  const [accounts, contactsByFirstName, contactsByLastName, contactsByEmail, opportunities, activities] = await Promise.all([
    supabase.from("accounts").select("id,name,industry").ilike("name", pattern).limit(10),
    supabase.from("contacts").select("id,first_name,last_name,email,account_id").ilike("first_name", pattern).limit(10),
    supabase.from("contacts").select("id,first_name,last_name,email,account_id").ilike("last_name", pattern).limit(10),
    supabase.from("contacts").select("id,first_name,last_name,email,account_id").ilike("email", pattern).limit(10),
    supabase.from("opportunities").select("id,name,stage").ilike("name", pattern).limit(10),
    supabase.from("activities").select("id,subject,status").ilike("subject", pattern).limit(10),
  ]);
  for (const result of [accounts, contactsByFirstName, contactsByLastName, contactsByEmail, opportunities, activities]) {
    if (result.error) throw new Error(`Unable to search records: ${result.error.message}`);
  }
  const contactRows = new Map(
    [...(contactsByFirstName.data ?? []), ...(contactsByLastName.data ?? []), ...(contactsByEmail.data ?? [])]
      .map((row) => [row.id, row] as const),
  );
  return [
    ...(accounts.data ?? []).map((row) => ({ id: row.id, type: "Account" as const, title: row.name, subtitle: row.industry, href: `/accounts#account-${row.id}` })),
    ...Array.from(contactRows.values()).slice(0, 10).map((row) => ({ id: row.id, type: "Contact" as const, title: `${row.first_name} ${row.last_name}`.trim(), subtitle: row.email, href: `/accounts#contact-${row.id}` })),
    ...(opportunities.data ?? []).map((row) => ({ id: row.id, type: "Opportunity" as const, title: row.name, subtitle: row.stage, href: `/deals/${row.id}` })),
    ...(activities.data ?? []).map((row) => ({ id: row.id, type: "Activity" as const, title: row.subject, subtitle: row.status, href: `/activities#activity-${row.id}` })),
  ];
}
