import { z } from "zod";
import type { Deal } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";
import { clampLimit, decodeCursor, encodeCursor, quoteFilterValue, sanitizeSearchTerm, type Page } from "@/lib/data/pagination";

type OpportunityRow = {
  id: string;
  owner_user_id: string;
  account_id?: string;
  name: string;
  owner_name: string;
  stage: string;
  value_amount: number;
  probability: number;
  expected_close_date: string | null;
  next_step: string | null;
  health_score: number;
  attention: string | null;
  record_version?: number;
  loss_reason_key?: string | null;
  accounts: { name: string } | { name: string }[] | null;
};

type RelatedMeetingRow = { id: string; title: string; started_at: string };
type RelatedProposalRow = { id: string; title: string; status: string; version: number };
type OpportunityContactRow = { contact_id: string; role: string; contacts: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null };

type OpportunityDetailRow = OpportunityRow & {
  meetings: RelatedMeetingRow[] | null;
  proposals: RelatedProposalRow[] | null;
  opportunity_contacts: OpportunityContactRow[] | null;
};

function mapOpportunityRow(row: OpportunityRow): Deal {
  return {
    id: row.id,
    ownerId: row.owner_user_id,
    accountId: row.account_id,
    account: Array.isArray(row.accounts) ? row.accounts[0]?.name ?? "Unassigned" : row.accounts?.name ?? "Unassigned",
    opportunity: row.name,
    owner: row.owner_name,
    stage: row.stage,
    value: new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(row.value_amount),
    valueAmount: row.value_amount,
    probability: row.probability,
    closeDate: row.expected_close_date ? new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short" }).format(new Date(row.expected_close_date)) : "TBC",
    nextStep: row.next_step ?? "Define next step",
    health: row.health_score,
    attention: row.attention ?? undefined,
  };
}

export async function listOpportunities(): Promise<Deal[]> {
  const supabase = await createSupabaseServerClient();
  const mockAllowed = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  if (mockAllowed) {
    const { deals } = await import("@/lib/mock-data");
    return deals;
  }
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("opportunities")
    .select("id,owner_user_id,account_id,name,owner_name,stage,value_amount,probability,expected_close_date,next_step,health_score,attention,accounts(name)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Unable to load opportunities: ${error.message}`);
  return ((data ?? []) as OpportunityRow[]).map(mapOpportunityRow);
}

export type OpportunitiesSort = "updated_desc" | "name_asc";
export const opportunitiesCursorSchema = z.object({ name: z.string().max(200).optional(), updated_at: z.string().datetime({ offset: true }).optional(), id: z.string().uuid() });

/**
 * The pipeline listing's cursor-paginated counterpart to listOpportunities().
 * Mirrors the same quoting/keyset pattern already used for accounts, contacts,
 * and activities so all four core listings behave consistently.
 */
export async function listOpportunitiesPage(options: { q?: string; stage?: string; sort?: OpportunitiesSort; cursor?: string; limit?: number } = {}): Promise<Page<Deal>> {
  const supabase = await createSupabaseServerClient();
  const mockAllowed = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  if (mockAllowed) {
    const { deals } = await import("@/lib/mock-data");
    let filtered = deals;
    if (options.q) { const needle = options.q.toLowerCase(); filtered = filtered.filter((d) => d.opportunity.toLowerCase().includes(needle) || d.account.toLowerCase().includes(needle)); }
    if (options.stage) filtered = filtered.filter((d) => d.stage === options.stage);
    const limit = clampLimit(options.limit);
    return { data: filtered.slice(0, limit), nextCursor: null };
  }
  if (!supabase) return { data: [], nextCursor: null };

  const sort: OpportunitiesSort = options.sort === "name_asc" ? "name_asc" : "updated_desc";
  const limit = clampLimit(options.limit);
  const cursor = decodeCursor(opportunitiesCursorSchema, options.cursor);
  let query = supabase
    .from("opportunities")
    .select("id,owner_user_id,account_id,name,owner_name,stage,value_amount,probability,expected_close_date,next_step,health_score,attention,updated_at,accounts(name)")
    .limit(limit + 1);
  if (options.q) query = query.ilike("name", `%${sanitizeSearchTerm(options.q)}%`);
  if (options.stage) query = query.eq("stage", options.stage);
  if (sort === "name_asc") {
    query = query.order("name").order("id");
    if (cursor?.name) { const value = quoteFilterValue(cursor.name); query = query.or(`name.gt.${value},and(name.eq.${value},id.gt.${cursor.id})`); }
  } else {
    query = query.order("updated_at", { ascending: false }).order("id", { ascending: false });
    if (cursor?.updated_at) query = query.or(`updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load opportunities: ${error.message}`);
  const rows = (data ?? []) as (OpportunityRow & { updated_at: string })[];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last
    ? encodeCursor(sort === "name_asc" ? { name: last.name, id: last.id } : { updated_at: last.updated_at, id: last.id })
    : null;
  return { data: page.map(mapOpportunityRow), nextCursor };
}

export type OpportunityDetail = Deal & {
  meetings: { id: string; title: string; startedAt: string }[];
  proposals: { id: string; title: string; status: string; version: number }[];
  recordVersion: number;
  lossReason: string | null;
  expectedCloseDate: string | null;
  history: { id: number; changeType: string; beforeData: Record<string, unknown> | null; afterData: Record<string, unknown> | null; createdAt: string }[];
  stakeholders: { contactId: string; role: string; name: string }[];
};

export async function getOpportunity(id: string): Promise<OpportunityDetail | null> {
  if (!z.string().uuid().safeParse(id).success) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new SupabaseNotConfiguredError();

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id,owner_user_id,account_id,name,owner_name,stage,value_amount,probability,expected_close_date,next_step,health_score,attention,record_version,loss_reason_key,accounts(name),meetings(id,title,started_at),proposals(id,title,status,version),opportunity_contacts(contact_id,role,contacts(id,first_name,last_name))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load opportunity: ${error.message}`);
  if (!data) return null;

  const row = data as OpportunityDetailRow;
  const { data: history, error: historyError } = await supabase.from("opportunity_change_history").select("id,change_type,before_data,after_data,created_at").eq("opportunity_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
  if (historyError) throw historyError;
  return {
    ...mapOpportunityRow(row),
    meetings: (row.meetings ?? []).map((m) => ({ id: m.id, title: m.title, startedAt: m.started_at })),
    proposals: (row.proposals ?? []).map((p) => ({ id: p.id, title: p.title, status: p.status, version: p.version })),
    recordVersion: row.record_version ?? 1,
    lossReason: row.loss_reason_key ?? null,
    expectedCloseDate: row.expected_close_date,
    history: (history ?? []).map((item) => ({ id: item.id, changeType: item.change_type, beforeData: item.before_data, afterData: item.after_data, createdAt: item.created_at })),
    stakeholders: (row.opportunity_contacts ?? []).map((link) => {
      const contact = Array.isArray(link.contacts) ? link.contacts[0] : link.contacts;
      return { contactId: link.contact_id, role: link.role, name: contact ? `${contact.first_name} ${contact.last_name}`.trim() : "Unknown contact" };
    }),
  };
}
