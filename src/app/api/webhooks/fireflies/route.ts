import { createHash, timingSafeEqual } from "node:crypto";

function validSecret(request: Request) {
  const expected = process.env.FIREFLIES_WEBHOOK_SECRET;
  const supplied = request.headers.get("x-armis-webhook-secret");
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!validSecret(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json();
  const transcriptId = typeof payload?.transcriptId === "string" ? payload.transcriptId : null;
  if (!transcriptId) return Response.json({ error: "Missing transcriptId" }, { status: 422 });
  const target = process.env.N8N_FIREFLIES_WEBHOOK_URL;
  if (!target) return Response.json({ accepted: true, queued: false, reason: "n8n_not_configured" }, { status: 202 });
  const response = await fetch(target, { method: "POST", headers: { "content-type": "application/json", "x-armis-webhook-secret": process.env.N8N_WEBHOOK_SECRET ?? "" }, body: JSON.stringify(payload) });
  return Response.json({ accepted: response.ok, status: response.status }, { status: response.ok ? 202 : 502 });
}
