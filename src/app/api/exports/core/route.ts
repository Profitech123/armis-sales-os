import { z } from "zod";
import { requireApiActor } from "@/lib/auth/authorization";
import { actorError, apiError, dataAccessError } from "@/lib/api/responses";
import { csvCell } from "@/lib/exports/csv";
import { quoteFilterValue, sanitizeSearchTerm } from "@/lib/data/pagination";

const querySchema = z.object({ entity: z.enum(["accounts", "contacts", "opportunities", "activities"]), q: z.string().trim().max(80).default(""), stage: z.string().trim().max(40).optional() });

const EXPORT_BATCH_SIZE = 1000;
// Safety cap on rows returned in one export response. Exceeding it sets the
// `x-export-truncated: true` response header; callers needing the full data
// set beyond this cap should narrow the `q` filter and export in segments.
const EXPORT_MAX_ROWS = 20000;

const entityHeaders = {
  accounts: ["id", "name", "industry", "website", "owner_user_id", "updated_at"],
  contacts: ["id", "first_name", "last_name", "email", "phone", "job_title", "relationship_role", "account_id", "owner_user_id", "updated_at"],
  opportunities: ["id", "name", "stage", "value_amount", "probability", "expected_close_date", "next_step", "account_id", "owner_user_id", "updated_at"],
  activities: ["id", "kind", "subject", "priority", "status", "due_at", "reminder_at", "account_id", "contact_id", "opportunity_id", "owner_user_id", "assignee_user_id", "updated_at"],
} as const;

type Entity = keyof typeof entityHeaders;
type ExportRow = Record<string, unknown>;

// The CSV must be a deterministic, complete snapshot rather than a silent
// top-N sample, so rows are fetched in fixed-size keyset batches ordered by
// the primary key (a stable total order) rather than one unbounded query.
function sortForDisplay(entity: Entity, rows: ExportRow[]): ExportRow[] {
  const str = (value: unknown) => String(value ?? "");
  if (entity === "accounts") return [...rows].sort((a, b) => str(a.name).localeCompare(str(b.name)) || str(a.id).localeCompare(str(b.id)));
  if (entity === "contacts") return [...rows].sort((a, b) => str(a.last_name).localeCompare(str(b.last_name)) || str(a.first_name).localeCompare(str(b.first_name)) || str(a.id).localeCompare(str(b.id)));
  if (entity === "opportunities") return [...rows].sort((a, b) => str(b.updated_at).localeCompare(str(a.updated_at)) || str(b.id).localeCompare(str(a.id)));
  return [...rows].sort((a, b) => {
    if (a.due_at == null && b.due_at != null) return 1;
    if (a.due_at != null && b.due_at == null) return -1;
    return str(a.due_at).localeCompare(str(b.due_at)) || str(a.id).localeCompare(str(b.id));
  });
}

export async function GET(request: Request) {
  const auth = await requireApiActor();
  if ("error" in auth) return actorError(auth);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ entity: url.searchParams.get("entity"), q: url.searchParams.get("q") ?? "", stage: url.searchParams.get("stage") ?? undefined });
  if (!parsed.success) return apiError("INVALID_REQUEST", 422, parsed.error.flatten());
  const { entity, q, stage } = parsed.data;
  const headers = entityHeaders[entity] as readonly string[];
  const pattern = `%${sanitizeSearchTerm(q)}%`;
  const quotedPattern = quoteFilterValue(pattern);
  const { supabase } = auth;

  function buildBatch(cursorId: string | null, limit: number) {
    let query = supabase.from(entity).select(headers.join(",")).order("id", { ascending: true }).limit(limit);
    if (entity === "accounts" || entity === "contacts") query = query.is("archived_at", null);
    if (q) {
      if (entity === "contacts") query = query.or(`first_name.ilike.${quotedPattern},last_name.ilike.${quotedPattern},email.ilike.${quotedPattern}`);
      else if (entity === "activities") query = query.ilike("subject", pattern);
      else query = query.ilike("name", pattern);
    }
    if (entity === "opportunities" && stage) query = query.eq("stage", stage);
    if (cursorId) query = query.gt("id", cursorId);
    return query;
  }

  const rows: ExportRow[] = [];
  let cursorId: string | null = null;
  let truncated = false;
  for (;;) {
    const { data, error } = await buildBatch(cursorId, EXPORT_BATCH_SIZE);
    if (error) return dataAccessError("api.core_export_failed", { actorId: auth.user.id, entity, code: error.code });
    const batch = (data ?? []) as unknown as ExportRow[];
    rows.push(...batch);
    if (batch.length < EXPORT_BATCH_SIZE) break;
    if (rows.length >= EXPORT_MAX_ROWS) {
      // A full final batch landing exactly on the cap is ambiguous — probe for
      // one more row so an exact-N-row dataset isn't mislabeled as truncated.
      const probeCursor = String((batch.at(-1) as ExportRow).id);
      const probe = await buildBatch(probeCursor, 1);
      if (probe.error) return dataAccessError("api.core_export_failed", { actorId: auth.user.id, entity, code: probe.error.code });
      truncated = ((probe.data ?? []) as unknown as ExportRow[]).length > 0;
      break;
    }
    cursorId = String((batch.at(-1) as ExportRow).id);
  }

  // Enforce the cap as a hard ceiling on the response, independent of how
  // EXPORT_BATCH_SIZE happens to divide into EXPORT_MAX_ROWS.
  const cappedRows = truncated ? rows.slice(0, EXPORT_MAX_ROWS) : rows;
  const ordered = sortForDisplay(entity, cappedRows);
  const csv = [headers.map(csvCell).join(","), ...ordered.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\r\n");
  // A response header alone is invisible to a user who triggered this export
  // via a plain download link, so truncation is also surfaced in the saved
  // filename itself — the one place guaranteed to be visible after download.
  const filename = truncated ? `armis-${entity}-truncated-at-${EXPORT_MAX_ROWS}-rows.csv` : `armis-${entity}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=${filename}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...(truncated ? { "x-export-truncated": "true" } : {}),
    },
  });
}
