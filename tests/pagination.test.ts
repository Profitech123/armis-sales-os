import { describe, expect, it } from "vitest";
import { z } from "zod";
import { clampLimit, decodeCursor, encodeCursor, quoteFilterValue, sanitizeSearchTerm } from "@/lib/data/pagination";

const cursorSchema = z.object({ name: z.string().optional(), id: z.string().uuid() });
const VALID_ID = "11111111-1111-4111-8111-111111111111";

describe("pagination cursor codec", () => {
  it("round-trips a valid cursor", () => {
    const encoded = encodeCursor({ name: "Acme", id: VALID_ID });
    expect(decodeCursor(cursorSchema, encoded)).toEqual({ name: "Acme", id: VALID_ID });
  });

  it("returns null for a missing cursor", () => {
    expect(decodeCursor(cursorSchema, undefined)).toBeNull();
    expect(decodeCursor(cursorSchema, "")).toBeNull();
  });

  it("returns null for a cursor that fails schema validation", () => {
    const encoded = encodeCursor({ name: "Acme", id: "not-a-uuid" });
    expect(decodeCursor(cursorSchema, encoded)).toBeNull();
  });

  it("returns null for a tampered/non-base64url cursor", () => {
    expect(decodeCursor(cursorSchema, "not valid base64url!!")).toBeNull();
  });

  it("returns null for a cursor that decodes to non-JSON", () => {
    const garbage = Buffer.from("not json", "utf8").toString("base64url");
    expect(decodeCursor(cursorSchema, garbage)).toBeNull();
  });

  it("preserves an explicit null field distinctly from an absent field", () => {
    const nullableSchema = z.object({ due_at: z.string().nullable().optional(), id: z.string().uuid() });
    const encoded = encodeCursor({ due_at: null, id: VALID_ID });
    const decoded = decodeCursor(nullableSchema, encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.due_at).toBeNull();
    expect("due_at" in (decoded ?? {})).toBe(true);
  });
});

describe("sanitizeSearchTerm", () => {
  it("strips PostgREST ilike wildcard characters", () => {
    expect(sanitizeSearchTerm("50%_off")).toBe("50off");
  });

  it("leaves ordinary search text untouched", () => {
    expect(sanitizeSearchTerm("Acme Corp")).toBe("Acme Corp");
  });
});

describe("quoteFilterValue", () => {
  it("wraps a plain value in double quotes", () => {
    expect(quoteFilterValue("Acme")).toBe('"Acme"');
  });

  it("escapes embedded double quotes", () => {
    expect(quoteFilterValue('Say "hi"')).toBe('"Say \\"hi\\""');
  });

  it("escapes a literal backslash before escaping quotes, so unescaping is unambiguous", () => {
    expect(quoteFilterValue('back\\slash "quote"')).toBe('"back\\\\slash \\"quote\\""');
  });

  it("leaves PostgREST-reserved characters (comma, parens) intact inside the quotes", () => {
    expect(quoteFilterValue("Acme, Inc. (APAC)")).toBe('"Acme, Inc. (APAC)"');
  });
});

describe("clampLimit", () => {
  it("falls back to the default when unset", () => {
    expect(clampLimit(undefined)).toBe(25);
    expect(clampLimit(undefined, 10)).toBe(10);
  });

  it("falls back to the default for NaN/non-finite input", () => {
    expect(clampLimit(Number.NaN)).toBe(25);
    expect(clampLimit(Number.POSITIVE_INFINITY)).toBe(25);
  });

  it("clamps to the maximum", () => {
    expect(clampLimit(500)).toBe(100);
    expect(clampLimit(500, 25, 50)).toBe(50);
  });

  it("clamps to a minimum of 1 and truncates decimals", () => {
    expect(clampLimit(0)).toBe(25); // falsy input hits the fallback, matching options.limit checks elsewhere
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(3.9)).toBe(3);
  });
});
