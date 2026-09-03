import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/explee/route";

describe("Explee result webhook", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is unavailable while AutoGTM is disabled", async () => {
    vi.stubEnv("EXPLEE_AUTOGTM_ENABLED", "false");
    const response = await POST(new Request("http://localhost/api/webhooks/explee", { method: "POST", body: "{}" }));
    expect(response.status).toBe(404);
  });

  it("rejects unsigned results when the integration flag is enabled", async () => {
    vi.stubEnv("EXPLEE_AUTOGTM_ENABLED", "true");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "synthetic-test-secret");
    const response = await POST(new Request("http://localhost/api/webhooks/explee", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("accepts a valid signature before checking unavailable storage", async () => {
    vi.stubEnv("EXPLEE_AUTOGTM_ENABLED", "true");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "synthetic-test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const body = JSON.stringify({ version: 1, batchId: "synthetic-batch", briefId: "11111111-1111-4111-8111-111111111111", leads: [{ externalId: "lead-1", companyName: "Synthetic Company", companyDomain: "synthetic.example.com", industry: "Banking", geography: "UAE", contactName: null, contactTitle: "CISO", contactEmail: null, evidence: ["Synthetic evidence"] }] });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", "synthetic-test-secret").update(`${timestamp}.${body}`).digest("hex");
    const response = await POST(new Request("http://localhost/api/webhooks/explee", { method: "POST", headers: { "x-armis-webhook-timestamp": timestamp, "x-armis-webhook-signature": `sha256=${signature}` }, body }));
    expect(response.status).toBe(503);
  });
});

