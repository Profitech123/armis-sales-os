import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";

export type ApprovalStatus = "draft" | "pending" | "approved" | "changes_requested" | "rejected";

export type ProposalSection = { title: string; body: string };
export type ProposalContent = { sections: ProposalSection[] };

export type ProposalListItem = {
  id: string;
  title: string;
  version: number;
  status: ApprovalStatus;
  opportunityId: string;
  opportunityName: string | null;
  submittedAt: string | null;
};

export type ProposalDetail = ProposalListItem & { content: ProposalContent };

type ProposalRow = {
  id: string;
  title: string;
  version: number;
  status: ApprovalStatus;
  submitted_at: string | null;
  opportunity_id: string;
  opportunities: { name: string } | { name: string }[] | null;
};

function mapProposalRow(row: ProposalRow): ProposalListItem {
  const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
  return {
    id: row.id,
    title: row.title,
    version: row.version,
    status: row.status,
    opportunityId: row.opportunity_id,
    opportunityName: opportunity?.name ?? null,
    submittedAt: row.submitted_at,
  };
}

function parseContent(value: unknown): ProposalContent {
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { sections?: unknown }).sections)
  ) {
    return value as ProposalContent;
  }
  return { sections: [] };
}

export async function listProposals(): Promise<ProposalListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("proposals")
    .select("id,title,version,status,submitted_at,opportunity_id,opportunities(name)")
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(`Unable to load proposals: ${error.message}`);
  return ((data ?? []) as ProposalRow[]).map(mapProposalRow);
}

export async function getProposal(id: string): Promise<ProposalDetail | null> {
  if (!z.string().uuid().safeParse(id).success) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new SupabaseNotConfiguredError();

  const { data, error } = await supabase
    .from("proposals")
    .select("id,title,version,status,submitted_at,opportunity_id,content,opportunities(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load proposal: ${error.message}`);
  if (!data) return null;

  const row = data as ProposalRow & { content: unknown };
  return { ...mapProposalRow(row), content: parseContent(row.content) };
}
