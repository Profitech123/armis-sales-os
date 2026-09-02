import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const secret = "fireflies-profile-lookup-test-secret";

/**
 * Regression coverage: a transient DB error while looking up the meeting
 * owner by host email must not be mislabeled as "no matching profile" (a
 * permanent, non-retriable-looking outcome). It should be reported as its
 * own distinct, clearly-transient reason.
 */
function createFakeAdmin() {
  const webhookEvents = new Map<string, { status: string; error: string | null }>();
  let profileLookupShouldError = false;

  const admin = {
    from(table: string) {
      if (table === "webhook_events") {
        return {
          insert: (row: { external_event_id: string; status: string }) => {
            if (webhookEvents.has(row.external_event_id)) return Promise.resolve({ error: { code: "23505" } });
            webhookEvents.set(row.external_event_id, { status: row.status, error: null });
            return Promise.resolve({ error: null });
          },
          select: () => ({
            eq: () => ({
              eq: (_col: string, id: string) => ({ maybeSingle: () => Promise.resolve({ data: webhookEvents.get(id) ?? null }) }),
            }),
          }),
          update: (patch: { status: string; error?: string | null }) => ({
            eq: () => ({
              eq: (_col: string, id: string) => {
                const existing = webhookEvents.get(id);
                if (existing) webhookEvents.set(id, { status: patch.status, error: patch.error ?? existing.error });
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(
                profileLookupShouldError
                  ? { data: null, error: { message: "simulated connection reset" } }
                  : { data: null, error: null },
              ),
            }),
          }),
        };
      }
      throw new Error(`unexpected table in fake admin client: ${table}`);
    },
    __setProfileLookupShouldError(value: boolean) { profileLookupShouldError = value; },
    __getEvent(transcriptId: string) { return webhookEvents.get(transcriptId); },
  };
  return admin;
}

let fakeAdmin = createFakeAdmin();
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => fakeAdmin }));

const { POST } = await import("@/app/api/webhooks/fireflies/route");

function signedRequest(body: string, eventId = crypto.randomUUID()) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${eventId}.${body}`).digest("hex");
  return new Request("http://localhost/api/webhooks/fireflies", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-armis-webhook-id": eventId,
      "x-armis-webhook-timestamp": String(timestamp),
      "x-armis-webhook-signature": `sha256=${signature}`,
    },
    body,
  });
}

describe("Fireflies webhook owner-profile lookup error handling", () => {
  afterEach(() => { vi.unstubAllEnvs(); fakeAdmin = createFakeAdmin(); });

  it("reports a transient profile-lookup DB error distinctly from a genuine no-match", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    vi.stubEnv("AI_TRANSCRIPT_ANALYSIS_ENABLED", "true");
    vi.stubEnv("FIREFLIES_FORWARDING_ENABLED", "false");
    fakeAdmin.__setProfileLookupShouldError(true);

    const body = JSON.stringify({ transcriptId: "profile-lookup-error-transcript", hostEmail: "seller@example.com" });
    const response = await POST(signedRequest(body, "event-1"));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ analysis: { reason: "profile_lookup_failed" } });
    expect(fakeAdmin.__getEvent("profile-lookup-error-transcript")?.error).toContain("profile lookup failed");
  });

  it("still reports a genuine no-matching-profile outcome when the lookup itself succeeds with no row", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    vi.stubEnv("AI_TRANSCRIPT_ANALYSIS_ENABLED", "true");
    vi.stubEnv("FIREFLIES_FORWARDING_ENABLED", "false");
    fakeAdmin.__setProfileLookupShouldError(false);

    const body = JSON.stringify({ transcriptId: "no-match-transcript", hostEmail: "unknown@example.com" });
    const response = await POST(signedRequest(body, "event-2"));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ analysis: { reason: "owner_not_found" } });
    expect(fakeAdmin.__getEvent("no-match-transcript")?.error).toBe("no matching profile for host email");
  });
});
