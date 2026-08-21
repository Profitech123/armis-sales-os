import type { CommunicationItem, CommunicationsQueue } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type { CommunicationItem, CommunicationsQueue };

type CommunicationCategory = "needs_reply" | "urgent" | "waiting";

type CommunicationRow = {
  account_name: string;
  subject: string;
  body: string;
  recommended_action: string;
  category: CommunicationCategory;
  tone: "red" | "orange" | "blue" | "green";
  received_at: string;
  due_at: string | null;
};

function formatAge(category: CommunicationCategory, receivedAt: string, dueAt: string | null): string {
  const now = Date.now();

  if (category === "urgent" && dueAt) {
    const diffMs = new Date(dueAt).getTime() - now;
    const overdue = diffMs < 0;
    const hours = Math.max(1, Math.round(Math.abs(diffMs) / 36e5));
    const days = Math.round(Math.abs(diffMs) / 864e5);
    if (overdue) return days >= 1 ? `${days} day${days === 1 ? "" : "s"} overdue` : `${hours} hour${hours === 1 ? "" : "s"} overdue`;
    return days >= 1 ? `${days} day${days === 1 ? "" : "s"} remaining` : `${hours} hour${hours === 1 ? "" : "s"} remaining`;
  }

  const diffMs = Math.max(0, now - new Date(receivedAt).getTime());
  const hours = Math.max(1, Math.round(diffMs / 36e5));
  const days = Math.floor(diffMs / 864e5);

  if (category === "waiting") return `Waiting ${days >= 1 ? `${days} day${days === 1 ? "" : "s"}` : `${hours} hour${hours === 1 ? "" : "s"}`}`;
  return days >= 1 ? `${days} day${days === 1 ? "" : "s"} old` : `${hours} hour${hours === 1 ? "" : "s"} old`;
}

function mapRow(row: CommunicationRow): CommunicationItem {
  return {
    account: row.account_name,
    subject: row.subject,
    body: row.body,
    action: row.recommended_action,
    tone: row.tone,
    age: formatAge(row.category, row.received_at, row.due_at),
  };
}

export async function listCommunications(): Promise<CommunicationsQueue> {
  const supabase = await createSupabaseServerClient();
  const mockAllowed = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  if (mockAllowed) {
    const { communicationsQueue } = await import("@/lib/mock-data");
    return communicationsQueue;
  }
  if (!supabase) return { needsReply: [], urgent: [], waiting: [] };

  const { data, error } = await supabase
    .from("communications")
    .select("account_name,subject,body,recommended_action,category,tone,received_at,due_at")
    .eq("status", "open")
    .order("received_at", { ascending: false });

  if (error) throw new Error(`Unable to load communications: ${error.message}`);

  const rows = (data ?? []) as CommunicationRow[];
  const queue: CommunicationsQueue = { needsReply: [], urgent: [], waiting: [] };
  for (const row of rows) {
    const item = mapRow(row);
    if (row.category === "needs_reply") queue.needsReply.push(item);
    else if (row.category === "urgent") queue.urgent.push(item);
    else queue.waiting.push(item);
  }
  return queue;
}
