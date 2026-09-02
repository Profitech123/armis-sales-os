import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStub, type StubCall } from "./helpers/query-stub";

const requireApiActor = vi.fn();
vi.mock("@/lib/auth/authorization", () => ({ requireApiActor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVITY_ID = "22222222-2222-4222-8222-222222222222";

function findCall(calls: StubCall[], method: string) {
  return calls.filter((c) => c.method === method);
}

function baseFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    id: "", kind: "task", subject: "Call the client", details: "", priority: "normal", status: "open",
    accountId: "", contactId: "", opportunityId: "", dueAt: "", reminderAt: "", cancellationReason: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) fd.set(key, value);
  return fd;
}

describe("saveActivity assignee preservation", () => {
  beforeEach(() => requireApiActor.mockReset());

  it("does not touch assignee_user_id when editing an activity without an explicit assigneeId", async () => {
    // Regression: a manager reassigns a task away from its owner via assign_activity.
    // The owner then edits an unrelated field (e.g. marks it complete) through the
    // regular activity form, which never exposes an assignee field. That save must
    // not silently revert the assignment back to the owner.
    const { supabase, calls } = createSupabaseStub({ data: [{ id: ACTIVITY_ID }], error: null });
    requireApiActor.mockResolvedValue({ user: { id: OWNER_ID }, supabase });
    const { saveActivity } = await import("@/app/actions/crm");
    const formData = baseFormData({ id: ACTIVITY_ID, version: "3", status: "completed" });
    const result = await saveActivity({ ok: false, message: "" }, formData);
    expect(result.ok).toBe(true);
    const updateCall = findCall(calls, "update")[0];
    expect(updateCall).toBeDefined();
    const updatePayload = updateCall.args[0] as Record<string, unknown>;
    expect("assignee_user_id" in updatePayload).toBe(false);
  });

  it("sets assignee_user_id to an explicit assigneeId when one is supplied on edit", async () => {
    const assigneeId = "33333333-3333-4333-8333-333333333333";
    const { supabase, calls } = createSupabaseStub({ data: [{ id: ACTIVITY_ID }], error: null });
    requireApiActor.mockResolvedValue({ user: { id: OWNER_ID }, supabase });
    const { saveActivity } = await import("@/app/actions/crm");
    const formData = baseFormData({ id: ACTIVITY_ID, version: "1", assigneeId });
    await saveActivity({ ok: false, message: "" }, formData);
    const updatePayload = findCall(calls, "update")[0].args[0] as Record<string, unknown>;
    expect(updatePayload.assignee_user_id).toBe(assigneeId);
  });

  it("defaults assignee_user_id to the creator when creating a new activity without an assigneeId", async () => {
    const { supabase, calls } = createSupabaseStub({ data: [{ id: ACTIVITY_ID }], error: null });
    requireApiActor.mockResolvedValue({ user: { id: OWNER_ID }, supabase });
    const { saveActivity } = await import("@/app/actions/crm");
    const formData = baseFormData();
    await saveActivity({ ok: false, message: "" }, formData);
    const insertPayload = findCall(calls, "insert")[0].args[0] as Record<string, unknown>;
    expect(insertPayload.assignee_user_id).toBe(OWNER_ID);
    expect(insertPayload.owner_user_id).toBe(OWNER_ID);
  });

  it("reports an RLS-style rejection as a conflict instead of silently succeeding", async () => {
    // If RLS now correctly rejects the edit (activity reassigned outside the
    // owner's management chain), the update returns no row rather than an error.
    const { supabase } = createSupabaseStub({ data: [], error: null });
    requireApiActor.mockResolvedValue({ user: { id: OWNER_ID }, supabase });
    const { saveActivity } = await import("@/app/actions/crm");
    const formData = baseFormData({ id: ACTIVITY_ID, version: "1" });
    const result = await saveActivity({ ok: false, message: "" }, formData);
    expect(result.ok).toBe(false);
    expect(result.conflict).toBe(true);
  });
});
