import { describe, expect, it, vi } from "vitest";
import { createSupabaseStub } from "./helpers/query-stub";

const createSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => createSupabaseServerClient() }));

const validId = "11111111-1111-4111-8111-111111111111";

describe("crm-details UUID guards", () => {
  it("returns null for a non-UUID account id without querying the database", async () => {
    const from = vi.fn();
    createSupabaseServerClient.mockResolvedValue({ from });
    const { getAccountDetail } = await import("@/lib/data/crm-details");
    expect(await getAccountDetail("not-a-uuid")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns null for a non-UUID contact id without querying the database", async () => {
    const from = vi.fn();
    createSupabaseServerClient.mockResolvedValue({ from });
    const { getContactDetail } = await import("@/lib/data/crm-details");
    expect(await getContactDetail("../../etc/passwd")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns an empty list for a non-UUID actor id without querying the database", async () => {
    const from = vi.fn();
    createSupabaseServerClient.mockResolvedValue({ from });
    const { listAssignableUsers } = await import("@/lib/data/crm-details");
    expect(await listAssignableUsers("not-a-uuid", "admin")).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("crm-details embed disambiguation", () => {
  it("hints the opportunity_contacts and nested opportunities embeds by exact FK constraint name", async () => {
    // Regression: opportunity_contacts has two FKs each to contacts and to
    // opportunities (a simple one plus a composite ownership-transfer one),
    // so an un-hinted embed is ambiguous to PostgREST and fails at query
    // time against a real database — see tests/opportunity-detail-embed.test.ts
    // for the full explanation.
    const { supabase, calls } = createSupabaseStub({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(supabase);
    const { getContactDetail } = await import("@/lib/data/crm-details");
    await getContactDetail(validId);
    const selectCall = calls.find((c) => c.method === "select");
    const selectArg = selectCall?.args[0] as string;
    expect(selectArg).toContain("opportunity_contacts!opportunity_contacts_contact_id_fkey(");
    expect(selectArg).toContain("opportunities!opportunity_contacts_opportunity_id_fkey(");
  });
});

describe("crm-details error wrapping", () => {
  it("wraps a raw Supabase account query error instead of leaking it directly", async () => {
    const { supabase } = createSupabaseStub({ data: null, error: { code: "42501", message: "permission denied for table accounts" } });
    createSupabaseServerClient.mockResolvedValue(supabase);
    const { getAccountDetail } = await import("@/lib/data/crm-details");
    await expect(getAccountDetail(validId)).rejects.toThrow("Unable to load account: permission denied for table accounts");
  });

  it("wraps a raw Supabase contact query error instead of leaking it directly", async () => {
    const { supabase } = createSupabaseStub({ data: null, error: { code: "42501", message: "permission denied for table contacts" } });
    createSupabaseServerClient.mockResolvedValue(supabase);
    const { getContactDetail } = await import("@/lib/data/crm-details");
    await expect(getContactDetail(validId)).rejects.toThrow("Unable to load contact: permission denied for table contacts");
  });

  it("wraps a raw Supabase error from listAssignableUsers instead of leaking it directly", async () => {
    const { supabase } = createSupabaseStub({ data: null, error: { code: "42501", message: "permission denied for table profiles" } });
    createSupabaseServerClient.mockResolvedValue(supabase);
    const { listAssignableUsers } = await import("@/lib/data/crm-details");
    await expect(listAssignableUsers(validId, "admin")).rejects.toThrow("Unable to load assignable users: permission denied for table profiles");
  });
});
