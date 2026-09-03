import { describe, expect, it, vi } from "vitest";
import { createSequentialSupabaseStub } from "./helpers/query-stub";

const createSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => createSupabaseServerClient() }));

const validId = "11111111-1111-4111-8111-111111111111";

/**
 * Regression coverage: opportunity_contacts has two foreign keys each to
 * opportunities (opportunity_id, and a composite (opportunity_id,
 * owner_user_id) added for ownership-transfer integrity) and to contacts
 * likewise. An un-hinted embed of opportunity_contacts — or contacts nested
 * inside it — is ambiguous to PostgREST and fails at query time against a
 * real database with: "Could not embed because more than one relationship
 * was found for 'opportunities' and 'opportunity_contacts'". This only
 * surfaced once a real Supabase project was provisioned; no mock or
 * no-database code path could catch it.
 */
describe("getOpportunity embed disambiguation", () => {
  it("hints the opportunity_contacts and nested contacts embeds by exact FK constraint name", async () => {
    const { supabase, callsPerQuery } = createSequentialSupabaseStub([
      { data: [{ id: validId, owner_user_id: "owner", account_id: "account", name: "Deal", owner_name: "Owner", stage: "qualification", value_amount: 0, probability: 10, expected_close_date: null, next_step: "", health_score: 50, attention: null, record_version: 1, loss_reason_key: null, accounts: { name: "Acme" }, meetings: [], proposals: [], opportunity_contacts: [] }], error: null },
      { data: [], error: null },
    ]);
    createSupabaseServerClient.mockResolvedValue(supabase);
    const { getOpportunity } = await import("@/lib/data/opportunities");

    const result = await getOpportunity(validId);
    expect(result).not.toBeNull();

    const selectCall = callsPerQuery[0]?.find((c) => c.method === "select");
    const selectArg = selectCall?.args[0] as string;
    expect(selectArg).toContain("opportunity_contacts!opportunity_contacts_opportunity_id_fkey(");
    expect(selectArg).toContain("contacts!opportunity_contacts_contact_id_fkey(");
  });
});
