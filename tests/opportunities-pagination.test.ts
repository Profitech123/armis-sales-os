import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStub, type StubCall } from "./helpers/query-stub";

const requireApiActor = vi.fn();
vi.mock("@/lib/auth/authorization", () => ({ requireApiActor }));

function findCall(calls: StubCall[], method: string) {
  return calls.filter((c) => c.method === method);
}

function request(params: Record<string, string>) {
  const url = new URL("http://localhost/api/opportunities");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url);
}

describe("opportunities GET pagination", () => {
  beforeEach(() => requireApiActor.mockReset());

  it("quotes a name_asc cursor value so a reserved character does not break the or() filter", async () => {
    const { encodeCursor } = await import("@/lib/data/pagination");
    const trickyName = "Acme, Inc. (APAC)";
    const cursor = encodeCursor({ name: trickyName, id: "11111111-1111-4111-8111-111111111111" });
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, actor: { role: "seller" }, supabase });
    const { GET } = await import("@/app/api/opportunities/route");
    const response = await GET(request({ sort: "name_asc", cursor }));
    expect(response.status).toBe(200);
    const orFilter = findCall(calls, "or")[0]?.args[0] as string;
    expect(orFilter).toBe('name.gt."Acme, Inc. (APAC)",and(name.eq."Acme, Inc. (APAC)",id.gt.11111111-1111-4111-8111-111111111111)');
  });

  it("rejects a cursor that fails schema validation instead of applying it", async () => {
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    requireApiActor.mockResolvedValue({ user: { id: "actor" }, actor: { role: "seller" }, supabase });
    const { GET } = await import("@/app/api/opportunities/route");
    const response = await GET(request({ cursor: "not-a-real-cursor" }));
    expect(response.status).toBe(400);
    expect(findCall(calls, "or")).toHaveLength(0);
  });
});
