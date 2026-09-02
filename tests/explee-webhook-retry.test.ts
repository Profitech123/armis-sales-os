import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const secret = "explee-retry-test-secret";
const briefId = "11111111-1111-4111-8111-111111111111";
const ownerUserId = "22222222-2222-4222-8222-222222222222";

/**
 * Regression coverage for the gtm_ingestion_events retry-reclaim fix: a batch
 * that fails once (e.g. a transient candidate-insert error) must be
 * reclaimable by a later retry carrying the same batchId, the way n8n's own
 * webhook retry would resend it — not permanently 409 forever.
 */
function createFakeAdmin() {
  const events = new Map<string, { status: string; candidate_count: number }>();
  let candidateInsertShouldFail = false;
  let candidateInsertCallCount = 0;

  const admin = {
    from(table: string) {
      if (table === "gtm_briefs") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({ maybeSingle: () => Promise.resolve({ data: { id: briefId, owner_user_id: ownerUserId, status: "approved" }, error: null }) }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === "gtm_ingestion_events") {
        return {
          insert: (row: { batch_id: string; status: string; candidate_count: number }) => {
            if (events.has(row.batch_id)) return Promise.resolve({ error: { code: "23505" } });
            events.set(row.batch_id, { status: row.status, candidate_count: row.candidate_count });
            return Promise.resolve({ error: null });
          },
          select: () => ({
            eq: (_col: string, batchId: string) => ({
              maybeSingle: () => Promise.resolve({ data: events.get(batchId) ?? null, error: null }),
            }),
          }),
          // update(patch).eq("batch_id", x) is used two ways by the route:
          //   - awaited directly, to terminally mark a batch processed/failed
          //   - chained with .eq("status", "failed").select().maybeSingle(), to
          //     conditionally reclaim a failed batch for retry
          // so the object returned from the first .eq() must be both a
          // thenable (for the direct-await case) and support a further .eq().
          update: (patch: { status: string; candidate_count?: number }) => ({
            eq: (_col1: string, batchId: string) => ({
              then: (resolve: (value: { error: null }) => void) => {
                const existing = events.get(batchId);
                if (existing) events.set(batchId, { ...existing, status: patch.status });
                resolve({ error: null });
              },
              eq: (_col2: string, requiredStatus: string) => ({
                select: () => ({
                  maybeSingle: () => {
                    const existing = events.get(batchId);
                    if (!existing || existing.status !== requiredStatus) return Promise.resolve({ data: null, error: null });
                    events.set(batchId, { status: patch.status, candidate_count: patch.candidate_count ?? existing.candidate_count });
                    return Promise.resolve({ data: { batch_id: batchId }, error: null });
                  },
                }),
              }),
            }),
          }),
        };
      }
      if (table === "gtm_lead_candidates") {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
          insert: () => {
            candidateInsertCallCount += 1;
            if (candidateInsertShouldFail) return Promise.resolve({ error: { code: "500", message: "simulated transient failure" } });
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table in fake admin client: ${table}`);
    },
    __setCandidateInsertShouldFail(value: boolean) { candidateInsertShouldFail = value; },
    __candidateInsertCallCount() { return candidateInsertCallCount; },
  };
  return admin;
}

let fakeAdmin = createFakeAdmin();
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => fakeAdmin }));

const { POST } = await import("@/app/api/webhooks/explee/route");

function signedRequest(body: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return new Request("http://localhost/api/webhooks/explee", {
    method: "POST",
    headers: { "x-armis-webhook-timestamp": timestamp, "x-armis-webhook-signature": `sha256=${signature}` },
    body,
  });
}

describe("Explee webhook ingestion-event retry handling", () => {
  afterEach(() => { vi.unstubAllEnvs(); fakeAdmin = createFakeAdmin(); });

  it("reclaims a failed batch for retry instead of permanently rejecting it", async () => {
    vi.stubEnv("EXPLEE_AUTOGTM_ENABLED", "true");
    vi.stubEnv("N8N_WEBHOOK_SECRET", secret);
    const body = JSON.stringify({
      version: 1,
      batchId: "retry-batch-1",
      briefId,
      leads: [{ externalId: "lead-1", companyName: "Retry Co", companyDomain: "retry.example.com", industry: "Banking", geography: "UAE", contactName: null, contactTitle: "CISO", contactEmail: null, evidence: ["evidence"] }],
    });

    fakeAdmin.__setCandidateInsertShouldFail(true);
    const first = await POST(signedRequest(body));
    expect(first.status).toBe(500);

    fakeAdmin.__setCandidateInsertShouldFail(false);
    const retry = await POST(signedRequest(body));
    expect(retry.status).toBe(202);
    await expect(retry.json()).resolves.toMatchObject({ accepted: true, candidateCount: 1 });
    expect(fakeAdmin.__candidateInsertCallCount()).toBe(2);
  });

  it("still rejects a genuine duplicate delivery of an already-processed batch", async () => {
    vi.stubEnv("EXPLEE_AUTOGTM_ENABLED", "true");
    vi.stubEnv("N8N_WEBHOOK_SECRET", secret);
    const body = JSON.stringify({
      version: 1,
      batchId: "processed-batch-1",
      briefId,
      leads: [{ externalId: "lead-2", companyName: "Processed Co", companyDomain: "processed.example.com", industry: "Banking", geography: "UAE", contactName: null, contactTitle: "CISO", contactEmail: null, evidence: ["evidence"] }],
    });

    const first = await POST(signedRequest(body));
    expect(first.status).toBe(202);

    const duplicate = await POST(signedRequest(body));
    expect(duplicate.status).toBe(202);
    await expect(duplicate.json()).resolves.toMatchObject({ accepted: true, duplicate: true });
    expect(fakeAdmin.__candidateInsertCallCount()).toBe(1);
  });
});
