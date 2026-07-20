import { z } from "zod";
import { deals as fallbackDeals, type Deal } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";

type OpportunityRow = {
  id: string;
  name: string;
  owner_name: string;
  stage: string;
  value_amount: number;
  probability: number;
  expected_close_date: string | null;
  next_step: string | null;
  health_score: number;
  attention: string | null;
  accounts: { name: string } | { name: string }[] | null;
};

type RelatedMeetingRow = { id: string; title: string; started_at: string };
type RelatedProposalRow = { id: string; title: string; status: string; version: number };

type OpportunityDetailRow = OpportunityRow & {
  meetings: RelatedMeetingRow[] | null;
  proposals: RelatedProposalRow[] | null;
};

function mapOpportunityRow(row: OpportunityRow): Deal {
  return {
    id: row.id,
    account: Array.isArray(row.accounts) ? row.accounts[0]?.name ?? "Unassigned" : row.accounts?.name ?? "Unassigned",
    opportunity: row.name,
    owner: row.owner_name,
    stage: row.stage,
    value: new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(row.value_amount),
    probability: row.probability,
    closeDate: row.expected_close_date ? new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short" }).format(new Date(row.expected_close_date)) : "TBC",
    nextStep: row.next_step ?? "Define next step",
    health: row.health_score,
    attention: row.attention ?? undefined,
  };
}

export async function listOpportunities(): Promise<Deal[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return fallbackDeals;

  const { data, error } = await supabase
    .from("opportunities")
    .select("id,name,owner_name,stage,value_amount,probability,expected_close_date,next_step,health_score,attention,accounts(name)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Unable to load opportunities: ${error.message}`);
  return ((data ?? []) as OpportunityRow[]).map(mapOpportunityRow);
}

export type OpportunityDetail = Deal & {
  meetings: { id: string; title: string; startedAt: string }[];
  proposals: { id: string; title: string; status: string; version: number }[];
};

export async function getOpportunity(id: string): Promise<OpportunityDetail | null> {
  if (!z.string().uuid().safeParse(id).success) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new SupabaseNotConfiguredError();

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id,name,owner_name,stage,value_amount,probability,expected_close_date,next_step,health_score,attention,accounts(name),meetings(id,title,started_at),proposals(id,title,status,version)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load opportunity: ${error.message}`);
  if (!data) return null;

  const row = data as OpportunityDetailRow;
  return {
    ...mapOpportunityRow(row),
    meetings: (row.meetings ?? []).map((m) => ({ id: m.id, title: m.title, startedAt: m.started_at })),
    proposals: (row.proposals ?? []).map((p) => ({ id: p.id, title: p.title, status: p.status, version: p.version })),
  };
}
