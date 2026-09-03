import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";

export type MeetingListItem = {
  id: string;
  title: string;
  startedAt: string;
  opportunityId: string | null;
  opportunityName: string | null;
  sentiment: string | null;
  processed: boolean;
};

export type MeetingInsight = {
  id: string;
  kind: "summary" | "buying_signal" | "risk" | "objection" | "commitment" | "decision";
  content: string;
  evidenceQuote: string | null;
  evidenceTimestampSeconds: number | null;
  confidence: number | null;
};

export type MeetingDetail = MeetingListItem & {
  transcript: string | null;
  summary: string | null;
  insights: MeetingInsight[];
};

type MeetingRow = {
  id: string;
  title: string;
  started_at: string;
  sentiment: string | null;
  processed_at: string | null;
  opportunities: { id: string; name: string } | { id: string; name: string }[] | null;
};

function mapMeetingRow(row: MeetingRow): MeetingListItem {
  const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
  return {
    id: row.id,
    title: row.title,
    startedAt: row.started_at,
    opportunityId: opportunity?.id ?? null,
    opportunityName: opportunity?.name ?? null,
    sentiment: row.sentiment,
    processed: row.processed_at !== null,
  };
}

export async function listMeetings(): Promise<MeetingListItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("meetings")
    .select("id,title,started_at,sentiment,processed_at,opportunities(id,name)")
    .order("started_at", { ascending: false });

  if (error) throw new Error(`Unable to load meetings: ${error.message}`);
  return ((data ?? []) as MeetingRow[]).map(mapMeetingRow);
}

export async function getMeeting(id: string): Promise<MeetingDetail | null> {
  if (!z.string().uuid().safeParse(id).success) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new SupabaseNotConfiguredError();

  const { data, error } = await supabase
    .from("meetings")
    .select("id,title,started_at,sentiment,processed_at,transcript,summary,opportunities(id,name)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load meeting: ${error.message}`);
  if (!data) return null;

  const { data: insightRows, error: insightError } = await supabase
    .from("meeting_insights")
    .select("id,kind,content,evidence_quote,evidence_timestamp_seconds,confidence")
    .eq("meeting_id", id)
    .order("kind", { ascending: true });

  if (insightError) throw new Error(`Unable to load meeting insights: ${insightError.message}`);

  const row = data as MeetingRow & { transcript: string | null; summary: string | null };
  return {
    ...mapMeetingRow(row),
    transcript: row.transcript,
    summary: row.summary,
    insights: (insightRows ?? []).map((insight) => ({
      id: insight.id,
      kind: insight.kind,
      content: insight.content,
      evidenceQuote: insight.evidence_quote,
      evidenceTimestampSeconds: insight.evidence_timestamp_seconds,
      confidence: insight.confidence,
    })),
  };
}
