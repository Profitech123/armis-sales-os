import { z } from "zod";

export type Page<T> = { data: T[]; nextCursor: string | null };

export function encodeCursor(value: Record<string, string | null>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T extends z.ZodTypeAny>(schema: T, value: string | undefined | null): z.infer<T> | null {
  if (!value) return null;
  try {
    const json = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const parsed = schema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function sanitizeSearchTerm(q: string): string {
  return q.replaceAll("%", "").replaceAll("_", "");
}

/**
 * PostgREST's `or()`/`and()` filter grammar treats `,`, `(`, and `)` as
 * structural separators. Any free-text value placed into a raw filter string
 * (a search term, or a sort-key value echoed back from a cursor) must be
 * quoted per the PostgREST horizontal-filtering spec, or a value containing
 * one of those characters silently breaks the filter into extra/malformed
 * clauses instead of being compared literally.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function clampLimit(value: number | undefined, fallback = 25, max = 100): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}
