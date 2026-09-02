import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const secret = "fireflies-transcript-timeout-test-secret";
const profileId = "33333333-3333-4333-8333-333333333333";

/**
 * Regression coverage: the Fireflies GraphQL transcript fetch must carry a
 * bounded AbortSignal timeout. Without one, a hung Fireflies response can
 * leave the caller's webhook_events row stuck in "processing" until the
 * platform's own function timeout kills the request.
 */
vi.mock("@/lib/supabase/admin", () => {
  const webhookEvents = new Map<string, { status: string }>();
  const fakeAdmin = {
    from(table: string) {
      if (table === "webhook_events") {
        return {
          insert: (row: { external_event_id: string; status: string }) => {
            if (webhookEvents.has(row.external_event_id)) return Promise.resolve({ error: { code: "23505" } });
            webhookEvents.set(row.external_event_id, { status: row.status });
            return Promise.resolve({ error: null });
          },
          select: () => ({ eq: () => ({ eq: (_col: string, id: string) => ({ maybeSingle: () => Promise.resolve({ data: webhookEvents.get(id) ?? null }) }) }) }),
          update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        };
      }
      if (table === "profiles") return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: profileId }, error: null }) }) }) };
      // Reject right after the transcript fetch, before analysis, so this
      // test only needs to observe the fetch call — same trick as
      // tests/webhook-security.integration.test.ts's "simulated mid-pipeline crash".
      if (table === "meetings") return { upsert: () => ({ select: () => ({ single: () => Promise.reject(new Error("simulated mid-pipeline crash")) }) }) };
      throw new Error(`unexpected table in fake admin client: ${table}`);
    },
  };
  return { createSupabaseAdminClient: () => fakeAdmin };
});

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

describe("Fireflies transcript fetch timeout", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("passes a bounded AbortSignal timeout to the Fireflies GraphQL fetch", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    vi.stubEnv("AI_TRANSCRIPT_ANALYSIS_ENABLED", "true");
    vi.stubEnv("FIREFLIES_FORWARDING_ENABLED", "false");
    vi.stubEnv("FIREFLIES_API_KEY", "synthetic-fireflies-key");

    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { transcript: { sentences: [{ text: "hello", speaker_name: "A" }] } } }), { status: 200 }),
    );

    // No transcriptText in the payload, so runAnalysisPipeline must call
    // fetchFirefliesTranscript() rather than skip straight to analysis.
    const body = JSON.stringify({ transcriptId: "timeout-check-transcript", hostEmail: "seller@example.com" });
    await POST(signedRequest(body));

    expect(fetchSpy).toHaveBeenCalledWith("https://api.fireflies.ai/graphql", expect.objectContaining({ signal: expect.anything() }));
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    const [ms] = timeoutSpy.mock.calls[0] as [number];
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(60_000);
  });
});
