import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clampLimit, decodeCursor, encodeCursor, quoteFilterValue, sanitizeSearchTerm, type Page } from "@/lib/data/pagination";

export type { Page };

export type AccountListItem = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  contactCount: number;
  opportunityCount: number;
  ownerUserId: string;
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
  contactId: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  reminderAt: string | null;
  recordVersion: number;
  cancellationReason: string | null;
  assigneeUserId: string;
};

export async function listAccounts(): Promise<AccountListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("accounts")
    .select("id,owner_user_id,name,industry,website,contacts(count),opportunities(count)")
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(`Unable to load accounts: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    industry: row.industry,
    website: row.website,
    contactCount: row.contacts?.[0]?.count ?? 0,
    opportunityCount: row.opportunities?.[0]?.count ?? 0,
    ownerUserId: row.owner_user_id,
  }));
}

export type AccountsSort = "name_asc" | "updated_desc";
export const accountsCursorSchema = z.object({ name: z.string().max(200).optional(), updated_at: z.string().datetime({ offset: true }).optional(), id: z.string().uuid() });

export async function listAccountsPage(options: { q?: string; sort?: AccountsSort; cursor?: string; limit?: number } = {}): Promise<Page<AccountListItem>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { data: [], nextCursor: null };
  const sort: AccountsSort = options.sort === "updated_desc" ? "updated_desc" : "name_asc";
  const limit = clampLimit(options.limit);
  const cursor = decodeCursor(accountsCursorSchema, options.cursor);
  let query = supabase
    .from("accounts")
    .select("id,owner_user_id,name,industry,website,updated_at,contacts(count),opportunities(count)")
    .is("archived_at", null)
    .limit(limit + 1);
  if (options.q) query = query.ilike("name", `%${sanitizeSearchTerm(options.q)}%`);
  if (sort === "name_asc") {
    query = query.order("name").order("id");
    if (cursor?.name) { const value = quoteFilterValue(cursor.name); query = query.or(`name.gt.${value},and(name.eq.${value},id.gt.${cursor.id})`); }
  } else {
    query = query.order("updated_at", { ascending: false }).order("id", { ascending: false });
    if (cursor?.updated_at) query = query.or(`updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load accounts: ${error.message}`);
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(sort === "name_asc" ? { name: last.name, id: last.id } : { updated_at: last.updated_at, id: last.id }) : null;
  return {
    data: page.map((row) => ({
      id: row.id,
      name: row.name,
      industry: row.industry,
      website: row.website,
      contactCount: row.contacts?.[0]?.count ?? 0,
      opportunityCount: row.opportunities?.[0]?.count ?? 0,
      ownerUserId: row.owner_user_id,
    })),
    nextCursor,
  };
}

export async function listContacts(): Promise<ContactListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contacts")
    .select("id,account_id,first_name,last_name,email,phone,job_title,relationship_role,accounts(name)")
    .is("archived_at", null)
    .order("last_name");
  if (error) throw new Error(`Unable to load contacts: ${error.message}`);
  return (data ?? []).map(mapContactRow);
}

export type ContactsSort = "name_asc" | "updated_desc";
export const contactsCursorSchema = z.object({ last_name: z.string().max(100).optional(), updated_at: z.string().datetime({ offset: true }).optional(), id: z.string().uuid() });

export async function listContactsPage(options: { q?: string; accountId?: string; sort?: ContactsSort; cursor?: string; limit?: number } = {}): Promise<Page<ContactListItem>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { data: [], nextCursor: null };
  const sort: ContactsSort = options.sort === "updated_desc" ? "updated_desc" : "name_asc";
  const limit = clampLimit(options.limit);
  const cursor = decodeCursor(contactsCursorSchema, options.cursor);
  let query = supabase
    .from("contacts")
    .select("id,account_id,first_name,last_name,email,phone,job_title,relationship_role,updated_at,accounts(name)")
    .is("archived_at", null)
    .limit(limit + 1);
  if (options.accountId) query = query.eq("account_id", options.accountId);
  if (options.q) {
    const pattern = quoteFilterValue(`%${sanitizeSearchTerm(options.q)}%`);
    query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`);
  }
  if (sort === "name_asc") {
    query = query.order("last_name").order("id");
    if (cursor?.last_name) { const value = quoteFilterValue(cursor.last_name); query = query.or(`last_name.gt.${value},and(last_name.eq.${value},id.gt.${cursor.id})`); }
  } else {
    query = query.order("updated_at", { ascending: false }).order("id", { ascending: false });
    if (cursor?.updated_at) query = query.or(`updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load contacts: ${error.message}`);
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(sort === "name_asc" ? { last_name: last.last_name, id: last.id } : { updated_at: last.updated_at, id: last.id }) : null;
  return { data: page.map(mapContactRow), nextCursor };
}

function mapContactRow(row: { id: string; account_id: string; first_name: string; last_name: string; email: string | null; phone: string | null; job_title: string | null; relationship_role: string | null; accounts: { name: string } | { name: string }[] | null }): ContactListItem {
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
}

const activitySelect = "id,owner_user_id,assignee_user_id,kind,subject,details,due_at,reminder_at,status,priority,record_version,cancellation_reason,account_id,contact_id,opportunity_id,accounts(name),opportunities(name)";

type ActivityRow = {
  id: string; owner_user_id: string; assignee_user_id: string; kind: ActivityListItem["kind"]; subject: string; details: string | null;
  due_at: string | null; reminder_at: string | null; status: ActivityListItem["status"]; priority: ActivityListItem["priority"]; record_version: number;
  cancellation_reason: string | null; account_id: string | null; contact_id: string | null; opportunity_id: string | null;
  accounts: { name: string } | { name: string }[] | null; opportunities: { name: string } | { name: string }[] | null;
};

function mapActivityRow(row: ActivityRow): ActivityListItem {
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
    contactId: row.contact_id,
    priority: row.priority,
    reminderAt: row.reminder_at,
    recordVersion: row.record_version,
    cancellationReason: row.cancellation_reason,
    assigneeUserId: row.assignee_user_id,
  };
}

export async function listActivities(options: { openOnly?: boolean; limit?: number; opportunityId?: string } = {}): Promise<ActivityListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("activities")
    .select(activitySelect)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (options.openOnly) query = query.in("status", ["open", "in_progress"]);
  if (options.opportunityId) query = query.eq("opportunity_id", options.opportunityId);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load activities: ${error.message}`);
  return (data ?? []).map(mapActivityRow);
}

export async function getActivityById(id: string): Promise<ActivityListItem | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("activities").select(activitySelect).eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load activity: ${error.message}`);
  return data ? mapActivityRow(data) : null;
}

export type ActivitiesSort = "due_asc" | "updated_desc";
export const activitiesCursorSchema = z.object({
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
  id: z.string().uuid(),
});

export async function listActivitiesPage(options: {
  q?: string; status?: ActivityListItem["status"]; priority?: ActivityListItem["priority"]; assigneeId?: string; openOnly?: boolean;
  sort?: ActivitiesSort; cursor?: string; limit?: number;
} = {}): Promise<Page<ActivityListItem>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { data: [], nextCursor: null };
  const sort: ActivitiesSort = options.sort === "updated_desc" ? "updated_desc" : "due_asc";
  const limit = clampLimit(options.limit);
  const cursor = decodeCursor(activitiesCursorSchema, options.cursor);
  let query = supabase.from("activities").select(`${activitySelect},updated_at`).limit(limit + 1);
  if (options.q) query = query.ilike("subject", `%${sanitizeSearchTerm(options.q)}%`);
  if (options.status) query = query.eq("status", options.status);
  if (options.priority) query = query.eq("priority", options.priority);
  if (options.assigneeId) query = query.eq("assignee_user_id", options.assigneeId);
  if (options.openOnly) query = query.in("status", ["open", "in_progress"]);
  if (sort === "due_asc") {
    query = query.order("due_at", { ascending: true, nullsFirst: false }).order("id", { ascending: true });
    if (cursor && cursor.due_at !== undefined) {
      query = cursor.due_at === null
        ? query.is("due_at", null).gt("id", cursor.id)
        : query.or(`due_at.gt.${cursor.due_at},and(due_at.eq.${cursor.due_at},id.gt.${cursor.id}),due_at.is.null`);
    }
  } else {
    query = query.order("updated_at", { ascending: false }).order("id", { ascending: false });
    if (cursor?.updated_at) query = query.or(`updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load activities: ${error.message}`);
  const rows = (data ?? []) as (ActivityRow & { updated_at: string })[];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last
    ? encodeCursor(sort === "due_asc" ? { due_at: last.due_at, id: last.id } : { updated_at: last.updated_at, id: last.id })
    : null;
  return { data: page.map(mapActivityRow), nextCursor };
}

export type SearchResult = { id: string; type: "Account" | "Contact" | "Opportunity" | "Activity"; title: string; subtitle: string | null; href: string };

export async function searchSalesRecords(rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim().slice(0, 80);
  if (query.length < 2) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const pattern = `%${sanitizeSearchTerm(query)}%`;
  const [accounts, contactsByFirstName, contactsByLastName, contactsByEmail, opportunities, activities] = await Promise.all([
    supabase.from("accounts").select("id,name,industry").is("archived_at", null).ilike("name", pattern).limit(10),
    supabase.from("contacts").select("id,first_name,last_name,email,account_id").is("archived_at", null).ilike("first_name", pattern).limit(10),
    supabase.from("contacts").select("id,first_name,last_name,email,account_id").is("archived_at", null).ilike("last_name", pattern).limit(10),
    supabase.from("contacts").select("id,first_name,last_name,email,account_id").is("archived_at", null).ilike("email", pattern).limit(10),
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
    ...(accounts.data ?? []).map((row) => ({ id: row.id, type: "Account" as const, title: row.name, subtitle: row.industry, href: `/accounts/${row.id}` })),
    ...Array.from(contactRows.values()).slice(0, 10).map((row) => ({ id: row.id, type: "Contact" as const, title: `${row.first_name} ${row.last_name}`.trim(), subtitle: row.email, href: `/contacts/${row.id}` })),
    ...(opportunities.data ?? []).map((row) => ({ id: row.id, type: "Opportunity" as const, title: row.name, subtitle: row.stage, href: `/deals/${row.id}` })),
    ...(activities.data ?? []).map((row) => ({ id: row.id, type: "Activity" as const, title: row.subject, subtitle: row.status, href: `/activities#activity-${row.id}` })),
  ];
}
