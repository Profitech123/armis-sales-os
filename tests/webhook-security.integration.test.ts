import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/fireflies/route";

const secret = "local-test-secret-not-a-credential";

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
