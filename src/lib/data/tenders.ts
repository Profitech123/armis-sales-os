import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";
import type { ApprovalStatus } from "@/lib/data/proposals";

export type TenderRequirement = {
  id: string;
  requirement: string;
  type: string;
  status: string;
  owner: string;
  partner: string | null;
  dueDate: string | null;
};

export type TenderListItem = {
  id: string;
  title: string;
  reference: string | null;
  status: ApprovalStatus;
  dueAt: string | null;
  accountId: string;
  accountName: string | null;
};

export type TenderDetail = TenderListItem & { requirements: TenderRequirement[] };

type TenderRow = {
  id: string;
  title: string;
  reference: string | null;
  status: ApprovalStatus;
  due_at: string | null;
  account_id: string;
  accounts: { name: string } | { name: string }[] | null;
};

function mapTenderRow(row: TenderRow): TenderListItem {
  const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
  return {
    id: row.id,
    title: row.title,
    reference: row.reference,
    status: row.status,
    dueAt: row.due_at,
    accountId: row.account_id,
    accountName: account?.name ?? null,
  };
}

function parseRequirements(value: unknown): TenderRequirement[] {
  return Array.isArray(value) ? (value as TenderRequirement[]) : [];
}

export async function listTenders(): Promise<TenderListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("tenders")
    .select("id,title,reference,status,due_at,account_id,accounts(name)")
    .order("due_at", { ascending: true });

  if (error) throw new Error(`Unable to load tenders: ${error.message}`);
  return ((data ?? []) as TenderRow[]).map(mapTenderRow);
}

export async function getTender(id: string): Promise<TenderDetail | null> {
  if (!z.string().uuid().safeParse(id).success) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new SupabaseNotConfiguredError();

  const { data, error } = await supabase
    .from("tenders")
    .select("id,title,reference,status,due_at,account_id,requirements,accounts(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load tender: ${error.message}`);
  if (!data) return null;

  const row = data as TenderRow & { requirements: unknown };
  return { ...mapTenderRow(row), requirements: parseRequirements(row.requirements) };
}
