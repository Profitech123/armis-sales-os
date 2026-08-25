import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStub, type StubCall } from "./helpers/query-stub";

const createSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

const VALID_ID = "11111111-1111-4111-8111-111111111111";

function findCall(calls: StubCall[], method: string) {
  return calls.filter((c) => c.method === method);
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_ID, owner_user_id: "owner", account_id: "account-1", name: "Acme deal", owner_name: "Seller",
    stage: "qualification", value_amount: 1000, probability: 10, expected_close_date: null, next_step: null,
    health_score: 50, attention: null, updated_at: "2026-01-01T00:00:00Z", accounts: { name: "Acme" },
    ...overrides,
  };
}

describe("listOpportunitiesPage", () => {
  beforeEach(() => {
    createSupabaseServerClient.mockReset();
    vi.unstubAllEnvs();
  });

  it("does not filter archived_at (opportunities have no archive column) and orders by updated_at desc with an id tiebreak by default", async () => {
    const { listOpportunitiesPage } = await import("@/lib/data/opportunities");
    const { supabase, calls } = createSupabaseStub({ data: [baseRow()], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    const result = await listOpportunitiesPage({});
    expect(findCall(calls, "is")).toHaveLength(0);
    expect(findCall(calls, "order").map((c) => c.args)).toEqual([
      ["updated_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it("rejects an invalid sort value and falls back to updated_desc", async () => {
    const { listOpportunitiesPage } = await import("@/lib/data/opportunities");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listOpportunitiesPage({ sort: "drop table opportunities" as any });
    expect(findCall(calls, "order").map((c) => c.args[0])).toEqual(["updated_at", "id"]);
  });

  it("applies the stage filter", async () => {
    const { listOpportunitiesPage } = await import("@/lib/data/opportunities");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listOpportunitiesPage({ stage: "negotiation" });
    expect(findCall(calls, "eq")).toEqual([{ method: "eq", args: ["stage", "negotiation"] }]);
  });

  it("quotes a name_asc cursor value so a reserved character does not break the or() filter", async () => {
    const { listOpportunitiesPage, opportunitiesCursorSchema } = await import("@/lib/data/opportunities");
    const { encodeCursor } = await import("@/lib/data/pagination");
    const trickyName = "Acme, Inc. (APAC)";
    expect(opportunitiesCursorSchema.safeParse({ name: trickyName, id: VALID_ID }).success).toBe(true);
    const cursor = encodeCursor({ name: trickyName, id: VALID_ID });
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listOpportunitiesPage({ sort: "name_asc", cursor });
    const orFilter = findCall(calls, "or")[0]?.args[0] as string;
    expect(orFilter).toBe(`name.gt."Acme, Inc. (APAC)",and(name.eq."Acme, Inc. (APAC)",id.gt.${VALID_ID})`);
  });

  it("ignores a tampered cursor and returns the first page", async () => {
    const { listOpportunitiesPage } = await import("@/lib/data/opportunities");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listOpportunitiesPage({ cursor: "not-a-real-cursor" });
    expect(findCall(calls, "or")).toHaveLength(0);
  });

  it("emits a nextCursor only when more rows exist beyond the page limit", async () => {
    const { listOpportunitiesPage } = await import("@/lib/data/opportunities");
    const rows = Array.from({ length: 3 }, (_, i) => baseRow({ id: `1111111${i}-1111-4111-8111-11111111111${i}`, name: `Deal ${i}` }));
    const { supabase } = createSupabaseStub({ data: rows, error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    const result = await listOpportunitiesPage({ limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("propagates a data access failure instead of swallowing it", async () => {
    const { listOpportunitiesPage } = await import("@/lib/data/opportunities");
    const { supabase } = createSupabaseStub({ data: null, error: { code: "500", message: "db down" } });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await expect(listOpportunitiesPage({})).rejects.toThrow(/Unable to load opportunities/);
  });
});
