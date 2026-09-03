import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSequentialSupabaseStub } from "./helpers/query-stub";

const requireApiActor = vi.fn();
vi.mock("@/lib/auth/authorization", () => ({ requireApiActor }));

function request(entity: string, q = "", extra: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/exports/core");
  url.searchParams.set("entity", entity);
  if (q) url.searchParams.set("q", q);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return new Request(url);
}

describe("core CSV export authorization", () => {
  beforeEach(() => requireApiActor.mockReset());

  it("returns 401 without ever querying the database when unauthenticated", async () => {
    requireApiActor.mockResolvedValue({ error: "Unauthorized", status: 401 });
    const { GET } = await import("@/app/api/exports/core/route");
    const response = await GET(request("accounts"));
    expect(response.status).toBe(401);
  });

  it("rejects an unsupported entity before any query is built", async () => {
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase: { from: vi.fn() } });
    const { GET } = await import("@/app/api/exports/core/route");
    const response = await GET(request("tenders"));
    expect(response.status).toBe(422);
  });
});

describe("core CSV export batching", () => {
  beforeEach(() => requireApiActor.mockReset());

  it("excludes archived accounts and paginates by id with a deterministic gt() cursor", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${String(i).padStart(5, "0")}`, name: `Account ${i}`, industry: null, website: null, owner_user_id: "owner", updated_at: "2026-01-01T00:00:00Z" }));
    const second = [{ id: "id-01000", name: "Last account", industry: null, website: null, owner_user_id: "owner", updated_at: "2026-01-01T00:00:00Z" }];
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([
      { data: first, error: null },
      { data: second, error: null },
    ]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    const response = await GET(request("accounts"));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.split("\r\n")).toHaveLength(1 + first.length + second.length);
    expect(callsPerQuery).toHaveLength(2);
    expect(callsPerQuery[0].some((c) => c.method === "is" && c.args[0] === "archived_at")).toBe(true);
    expect(callsPerQuery[1].some((c) => c.method === "gt" && c.args[0] === "id" && c.args[1] === "id-00999")).toBe(true);
  });

  it("does not filter archived_at for opportunities or activities", async () => {
    const { supabase: opportunitiesSupabase, callsPerQuery: oppCalls } = createSequentialSupabaseStub([{ data: [], error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase: opportunitiesSupabase });
    const { GET } = await import("@/app/api/exports/core/route");
    await GET(request("opportunities"));
    expect(oppCalls[0].some((c) => c.method === "is")).toBe(false);
  });

  it("applies the stage filter to an opportunities export, matching the pipeline listing's filter", async () => {
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([{ data: [], error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    await GET(request("opportunities", "", { stage: "negotiation" }));
    expect(callsPerQuery[0]).toEqual(expect.arrayContaining([{ method: "eq", args: ["stage", "negotiation"] }]));
  });

  it("ignores a stage filter for entities other than opportunities", async () => {
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([{ data: [], error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    await GET(request("accounts", "", { stage: "negotiation" }));
    expect(callsPerQuery[0].some((c) => c.method === "eq" && c.args[0] === "stage")).toBe(false);
  });

  it("stops requesting further batches once a short page is returned", async () => {
    const partial = Array.from({ length: 3 }, (_, i) => ({ id: `id-${i}`, kind: "task", subject: `Task ${i}`, priority: "normal", status: "open", due_at: null, reminder_at: null, account_id: null, contact_id: null, opportunity_id: null, owner_user_id: "owner", assignee_user_id: "owner", updated_at: "2026-01-01T00:00:00Z" }));
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([{ data: partial, error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    const response = await GET(request("activities"));
    expect(response.status).toBe(200);
    expect(callsPerQuery).toHaveLength(1);
  });

  it("marks the response truncated once the safety cap is reached, without leaking the probe row into the CSV body", async () => {
    const fullBatch = (offset: number) => Array.from({ length: 1000 }, (_, i) => ({ id: `id-${String(offset + i).padStart(6, "0")}`, name: `Account ${offset + i}`, industry: null, website: null, owner_user_id: "owner", updated_at: "2026-01-01T00:00:00Z" }));
    const batches = Array.from({ length: 20 }, (_, batchIndex) => ({ data: fullBatch(batchIndex * 1000), error: null }));
    // A 21st response for the boundary probe: at least one more row exists beyond the cap.
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([...batches, { data: [{ id: "id-020000", name: "Overflow account", industry: null, website: null, owner_user_id: "owner", updated_at: "2026-01-01T00:00:00Z" }], error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    const response = await GET(request("accounts"));
    expect(response.headers.get("x-export-truncated")).toBe("true");
    expect(callsPerQuery).toHaveLength(21);
    const probeCall = callsPerQuery[20];
    expect(probeCall.some((c) => c.method === "limit" && c.args[0] === 1)).toBe(true);
    expect(probeCall.some((c) => c.method === "gt" && c.args[0] === "id" && c.args[1] === "id-019999")).toBe(true);
    const body = await response.text();
    expect(body.split("\r\n")).toHaveLength(1 + 20000);
    expect(body).not.toContain("Overflow account");
    // A response header is invisible on a plain download link, so truncation
    // must also be visible in the one place a user will actually see it: the
    // filename they end up with in their downloads folder.
    expect(response.headers.get("content-disposition")).toBe("attachment; filename=armis-accounts-truncated-at-20000-rows.csv");
  });

  it("does not mark truncated when the dataset lands exactly on the 20,000-row cap", async () => {
    const fullBatch = (offset: number) => Array.from({ length: 1000 }, (_, i) => ({ id: `id-${String(offset + i).padStart(6, "0")}`, name: `Account ${offset + i}`, industry: null, website: null, owner_user_id: "owner", updated_at: "2026-01-01T00:00:00Z" }));
    const batches = Array.from({ length: 20 }, (_, batchIndex) => ({ data: fullBatch(batchIndex * 1000), error: null }));
    // The boundary probe finds nothing further: exactly 20,000 rows exist, no more.
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([...batches, { data: [], error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    const response = await GET(request("accounts"));
    expect(response.headers.get("x-export-truncated")).toBeNull();
    expect(callsPerQuery).toHaveLength(21);
    const body = await response.text();
    expect(body.split("\r\n")).toHaveLength(1 + 20000);
    expect(response.headers.get("content-disposition")).toBe("attachment; filename=armis-accounts.csv");
  });

  it("surfaces a data access failure without leaking database error details", async () => {
    const { supabase } = createSequentialSupabaseStub([{ data: null, error: { code: "42501", message: "secret internal detail" } }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    const response = await GET(request("contacts"));
    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("DATA_ACCESS_FAILED");
    expect(body).not.toContain("secret internal detail");
  });
});

describe("core CSV export formula-injection protection", () => {
  beforeEach(() => requireApiActor.mockReset());

  it("neutralizes a spreadsheet formula in an exported field", async () => {
    const rows = [{ id: "id-1", name: "=HYPERLINK(\"http://evil\",\"click\")", industry: null, website: null, owner_user_id: "owner", updated_at: "2026-01-01T00:00:00Z" }];
    const { supabase } = createSequentialSupabaseStub([{ data: rows, error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    const response = await GET(request("accounts"));
    const body = await response.text();
    expect(body).toContain("\"'=HYPERLINK(");
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("sanitizes ilike wildcards out of the search term before querying", async () => {
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([{ data: [], error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    await GET(request("accounts", "50%_off"));
    expect(callsPerQuery[0].some((c) => c.method === "ilike" && c.args[1] === "%50off%")).toBe(true);
  });

  it("quotes a contacts search term containing a comma so the multi-column or() filter is not split", async () => {
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([{ data: [], error: null }]);
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, supabase });
    const { GET } = await import("@/app/api/exports/core/route");
    await GET(request("contacts", "Smith, Jane (VP)"));
    const orCall = callsPerQuery[0].find((c) => c.method === "or");
    expect(orCall?.args[0]).toBe('first_name.ilike."%Smith, Jane (VP)%",last_name.ilike."%Smith, Jane (VP)%",email.ilike."%Smith, Jane (VP)%"');
  });
});
