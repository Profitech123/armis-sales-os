import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStub, type StubCall } from "./helpers/query-stub";

const createSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const ANOTHER_ID = "22222222-2222-4222-8222-222222222222";

function findCall(calls: StubCall[], method: string) {
  return calls.filter((c) => c.method === method);
}

describe("listAccountsPage", () => {
  beforeEach(() => createSupabaseServerClient.mockReset());

  it("excludes archived accounts and orders by name with an id tiebreak by default", async () => {
    const { listAccountsPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [{ id: VALID_ID, name: "Acme", industry: null, website: null, updated_at: "2026-01-01T00:00:00Z", contacts: [{ count: 0 }], opportunities: [{ count: 0 }], owner_user_id: "owner" }], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    const result = await listAccountsPage({});
    expect(findCall(calls, "is")).toEqual([{ method: "is", args: ["archived_at", null] }]);
    expect(findCall(calls, "order").map((c) => c.args[0])).toEqual(["name", "id"]);
    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it("rejects an invalid sort value and falls back to the default", async () => {
    const { listAccountsPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listAccountsPage({ sort: "drop table accounts" as any });
    expect(findCall(calls, "order").map((c) => c.args[0])).toEqual(["name", "id"]);
  });

  it("applies the search filter through the sanitized ilike pattern", async () => {
    const { listAccountsPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listAccountsPage({ q: "50%_off" });
    expect(findCall(calls, "ilike")).toEqual([{ method: "ilike", args: ["name", "%50off%"] }]);
  });

  it("ignores a tampered cursor and returns the first page", async () => {
    const { listAccountsPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listAccountsPage({ cursor: "not-a-real-cursor" });
    expect(findCall(calls, "or")).toHaveLength(0);
  });

  it("applies a valid name_asc cursor as a keyset filter, quoted for PostgREST", async () => {
    const { listAccountsPage, accountsCursorSchema } = await import("@/lib/data/sales-workflows");
    const { encodeCursor } = await import("@/lib/data/pagination");
    const cursor = encodeCursor({ name: "Acme", id: VALID_ID });
    expect(accountsCursorSchema.safeParse({ name: "Acme", id: VALID_ID }).success).toBe(true);
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listAccountsPage({ cursor });
    expect(findCall(calls, "or")[0]?.args[0]).toBe(`name.gt."Acme",and(name.eq."Acme",id.gt.${VALID_ID})`);
  });

  it("accepts a cursor whose sort key contains PostgREST-reserved characters and quotes it safely", async () => {
    const { listAccountsPage, accountsCursorSchema } = await import("@/lib/data/sales-workflows");
    const { encodeCursor } = await import("@/lib/data/pagination");
    const trickyName = 'Acme, Inc. (APAC) "East"';
    expect(accountsCursorSchema.safeParse({ name: trickyName, id: VALID_ID }).success).toBe(true);
    const cursor = encodeCursor({ name: trickyName, id: VALID_ID });
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listAccountsPage({ cursor });
    const orFilter = findCall(calls, "or")[0]?.args[0] as string;
    expect(orFilter).toBe(`name.gt."Acme, Inc. (APAC) \\"East\\""`.concat(`,and(name.eq."Acme, Inc. (APAC) \\"East\\"",id.gt.${VALID_ID})`));
    // The quoted value must contain exactly one top-level comma pair delimiting or()'s two clauses —
    // i.e. the reserved characters inside the quoted name must not be parsed as extra clause separators.
    expect(orFilter.split(",and(")).toHaveLength(2);
  });

  it("emits a nextCursor only when more rows exist beyond the page limit", async () => {
    const { listAccountsPage } = await import("@/lib/data/sales-workflows");
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: `1111111${i}-1111-4111-8111-11111111111${i}`, name: `Account ${i}`, industry: null, website: null, updated_at: "2026-01-01T00:00:00Z", contacts: [{ count: 0 }], opportunities: [{ count: 0 }], owner_user_id: "owner" }));
    const { supabase } = createSupabaseStub({ data: rows, error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    const result = await listAccountsPage({ limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });
});

describe("listContactsPage", () => {
  beforeEach(() => createSupabaseServerClient.mockReset());

  it("excludes archived contacts and supports an account scope filter", async () => {
    const { listContactsPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listContactsPage({ accountId: ANOTHER_ID });
    expect(findCall(calls, "is")).toEqual([{ method: "is", args: ["archived_at", null] }]);
    expect(findCall(calls, "eq")).toEqual([{ method: "eq", args: ["account_id", ANOTHER_ID] }]);
  });

  it("searches across first name, last name, and email, quoted for PostgREST", async () => {
    const { listContactsPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listContactsPage({ q: "ana" });
    const orCall = findCall(calls, "or")[0];
    expect(orCall?.args[0]).toBe('first_name.ilike."%ana%",last_name.ilike."%ana%",email.ilike."%ana%"');
  });

  it("does not let a search term containing a comma or parenthesis break the or() filter into extra clauses", async () => {
    const { listContactsPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listContactsPage({ q: "Smith, Jane (VP)" });
    const orCall = findCall(calls, "or")[0]?.args[0] as string;
    expect(orCall).toBe('first_name.ilike."%Smith, Jane (VP)%",last_name.ilike."%Smith, Jane (VP)%",email.ilike."%Smith, Jane (VP)%"');
    // Exactly 3 quoted clause values — the search term's own comma/parens must stay
    // inside their quotes rather than being parsed as extra clause separators.
    expect(orCall.split('.ilike."%Smith, Jane (VP)%"')).toHaveLength(4);
  });
});

describe("listActivitiesPage", () => {
  beforeEach(() => createSupabaseServerClient.mockReset());

  it("orders by due date ascending with nulls last and an id tiebreak by default", async () => {
    const { listActivitiesPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listActivitiesPage({});
    const orderCalls = findCall(calls, "order");
    expect(orderCalls[0]).toEqual({ method: "order", args: ["due_at", { ascending: true, nullsFirst: false }] });
    expect(orderCalls[1]).toEqual({ method: "order", args: ["id", { ascending: true }] });
  });

  it("validates status and priority filters instead of passing through unknown values", async () => {
    const { activityStatuses, activityPriorities } = await import("@/lib/crm/catalog");
    expect(activityStatuses).toContain("open");
    expect(activityPriorities).toContain("urgent");
  });

  it("applies status, priority, and assignee filters", async () => {
    const { listActivitiesPage } = await import("@/lib/data/sales-workflows");
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listActivitiesPage({ status: "open", priority: "urgent", assigneeId: VALID_ID });
    expect(findCall(calls, "eq")).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["status", "open"] },
        { method: "eq", args: ["priority", "urgent"] },
        { method: "eq", args: ["assignee_user_id", VALID_ID] },
      ]),
    );
  });

  it("pages into the null-due-date tail using an AND filter rather than OR", async () => {
    const { listActivitiesPage } = await import("@/lib/data/sales-workflows");
    const { encodeCursor } = await import("@/lib/data/pagination");
    const cursor = encodeCursor({ due_at: null, id: VALID_ID });
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listActivitiesPage({ cursor });
    expect(findCall(calls, "is")).toEqual(expect.arrayContaining([{ method: "is", args: ["due_at", null] }]));
    expect(findCall(calls, "gt")).toEqual(expect.arrayContaining([{ method: "gt", args: ["id", VALID_ID] }]));
    expect(findCall(calls, "or")).toHaveLength(0);
  });

  it("pages past a dated cursor by also matching the null-due-date tail via OR", async () => {
    const { listActivitiesPage } = await import("@/lib/data/sales-workflows");
    const { encodeCursor } = await import("@/lib/data/pagination");
    const cursor = encodeCursor({ due_at: "2026-01-01T00:00:00.000Z", id: VALID_ID });
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listActivitiesPage({ cursor });
    const orCall = findCall(calls, "or")[0];
    expect(orCall?.args[0]).toContain("due_at.gt.2026-01-01T00:00:00.000Z");
    expect(orCall?.args[0]).toContain("due_at.is.null");
  });

  it("propagates a data access failure instead of swallowing it", async () => {
    const { listActivitiesPage } = await import("@/lib/data/sales-workflows");
    const { supabase } = createSupabaseStub({ data: null, error: { code: "500", message: "db down" } });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await expect(listActivitiesPage({})).rejects.toThrow(/Unable to load activities/);
  });

  it("accepts a cursor timestamp in PostgREST's real +00:00 offset format instead of silently discarding it", async () => {
    const { listActivitiesPage } = await import("@/lib/data/sales-workflows");
    const { encodeCursor } = await import("@/lib/data/pagination");
    const cursor = encodeCursor({ due_at: "2026-01-01T00:00:00+00:00", id: VALID_ID });
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    await listActivitiesPage({ cursor });
    const orCall = findCall(calls, "or")[0];
    expect(orCall?.args[0]).toContain("due_at.gt.2026-01-01T00:00:00+00:00");
  });
});

describe("getActivityById", () => {
  beforeEach(() => createSupabaseServerClient.mockReset());

  it("rejects a non-uuid id before touching the database", async () => {
    const { getActivityById } = await import("@/lib/data/sales-workflows");
    const result = await getActivityById("not-a-uuid");
    expect(result).toBeNull();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
