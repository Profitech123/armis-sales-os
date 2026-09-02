import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const secret = "local-test-secret-not-a-credential";

/**
 * Fake service-role client backing the "cross-instance replay" test below.
 * The webhook_events map is created once in this factory's closure so it
 * persists across multiple createSupabaseAdminClient() calls within a test
 * — simulating the real unique-constraint table shared by every instance,
 * as opposed to the route's per-instance in-memory replayCache.
 */
vi.mock("@/lib/supabase/admin", () => {
  const webhookEvents = new Map<string, { status: string }>();
  const profileId = "22222222-2222-4222-8222-222222222222";

  const fakeAdmin = {
    from(table: string) {
      if (table === "webhook_events") {
        return {
          insert: (row: { external_event_id: string; status: string }) => {
            if (webhookEvents.has(row.external_event_id)) {
              return Promise.resolve({ error: { code: "23505" } });
            }
            webhookEvents.set(row.external_event_id, { status: row.status });
            return Promise.resolve({ error: null });
          },
          select: () => ({
            eq: () => ({
              eq: (_col: string, id: string) => ({
                maybeSingle: () => Promise.resolve({ data: webhookEvents.get(id) ?? null }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: profileId } }) }) }) };
      }
      if (table === "meetings") {
        return { upsert: () => ({ select: () => ({ single: () => Promise.reject(new Error("simulated mid-pipeline crash")) }) }) };
      }
      throw new Error(`unexpected table in fake admin client: ${table}`);
    },
  };

  return { createSupabaseAdminClient: () => fakeAdmin };
});

const { POST } = await import("@/app/api/webhooks/fireflies/route");

function signedRequest(body: string, eventId = crypto.randomUUID(), timestamp = Math.floor(Date.now() / 1000)) {
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

describe("Fireflies webhook security", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("rejects unsigned requests", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    const response = await POST(new Request("http://localhost/api/webhooks/fireflies", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("accepts a signed request while forwarding and AI remain disabled", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    vi.stubEnv("FIREFLIES_FORWARDING_ENABLED", "false");
    vi.stubEnv("AI_TRANSCRIPT_ANALYSIS_ENABLED", "false");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const body = JSON.stringify({ transcriptId: "transcript-1", hostEmail: "seller@example.com" });
    const response = await POST(signedRequest(body));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ forwarding: "disabled", analysis: { reason: "ai_analysis_disabled" } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects replayed event identifiers", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    const body = JSON.stringify({ transcriptId: "transcript-2" });
    const eventId = crypto.randomUUID();
    expect((await POST(signedRequest(body, eventId))).status).toBe(202);
    const replay = await POST(signedRequest(body, eventId));
    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toMatchObject({ error: { code: "REPLAY_REJECTED" } });
  });

  it("rejects stale signatures and oversized payloads", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    const body = JSON.stringify({ transcriptId: "transcript-3" });
    expect((await POST(signedRequest(body, crypto.randomUUID(), Math.floor(Date.now() / 1000) - 600))).status).toBe(409);
    const oversized = signedRequest("x".repeat(256 * 1024 + 1));
    expect((await POST(oversized)).status).toBe(413);
  });

  it("blocks duplicate forwarding across a replayed transcriptId even with a different webhook id, via the DB-level guard", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    vi.stubEnv("AI_TRANSCRIPT_ANALYSIS_ENABLED", "true");
    vi.stubEnv("FIREFLIES_FORWARDING_ENABLED", "true");
    vi.stubEnv("N8N_FIREFLIES_WEBHOOK_URL", "http://n8n.example/webhook");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "n8n-secret");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const body = JSON.stringify({ transcriptId: "cross-instance-dup", hostEmail: "seller@example.com", transcriptText: "hello world" });

    // Two distinct webhook ids simulate two different instances/deliveries for
    // the same underlying transcript — the in-memory replayCache would miss
    // this (different key), so only the DB-level unique constraint on
    // webhook_events(provider, external_event_id) catches it.
    const first = await POST(signedRequest(body, crypto.randomUUID()));
    expect(first.status).toBe(202);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const second = await POST(signedRequest(body, crypto.randomUUID()));
    expect(second.status).toBe(202);
    await expect(second.json()).resolves.toMatchObject({ forwarding: "skipped_duplicate", analysis: { reason: "already_processing" } });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rate limits authenticated machine requests", async () => {
    vi.stubEnv("FIREFLIES_WEBHOOK_SECRET", secret);
    vi.stubEnv("FIREFLIES_FORWARDING_ENABLED", "false");
    const body = JSON.stringify({ transcriptId: "rate-limit-check" });
    let limited = false;
    for (let attempt = 0; attempt < 61; attempt += 1) {
      const response = await POST(signedRequest(body));
      if (response.status === 429) { limited = true; break; }
    }
    expect(limited).toBe(true);
  });
});
