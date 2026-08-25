import { z } from "zod";
import { requireApiActor } from "@/lib/auth/authorization";
import { actorError, apiError, dataAccessError } from "@/lib/api/responses";

const updateInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  value_amount: z.number().nonnegative().optional(),
  expected_close_date: z.string().date().nullable().optional(),
  next_step: z.string().trim().max(500).nullable().optional(),
  health_score: z.number().int().min(0).max(100).optional(),
  attention: z.string().trim().max(80).nullable().optional(),
  expectedVersion: z.number().int().positive(),
});

async function context(idPromise: Promise<{ id: string }>) {
  const { id } = await idPromise;
  if (!z.string().uuid().safeParse(id).success) return { invalidId: true } as const;
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) return auth;
  return { id, supabase: auth.supabase, actor: auth.actor } as const;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context(params);
  if ("invalidId" in ctx) return apiError("INVALID_REQUEST", 400);
  if ("error" in ctx) return actorError(ctx);
  let payload: unknown;
  try { payload = await request.json(); } catch { return apiError("INVALID_REQUEST", 400); }
  const parsed = updateInput.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", 422, parsed.error.flatten());
  const { expectedVersion, ...changes } = parsed.data;
  const { data, error } = await ctx.supabase.from("opportunities").update({ ...changes, record_version: expectedVersion + 1, updated_at: new Date().toISOString() }).eq("id", ctx.id).eq("record_version", expectedVersion).select().maybeSingle();
  if (!error && !data) return apiError("CONFLICT", 409);
  return error
    ? dataAccessError("api.opportunity.update_failed", { actorId: ctx.actor.id, opportunityId: ctx.id, code: error.code })
    : Response.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context(params);
  if ("invalidId" in ctx) return apiError("INVALID_REQUEST", 400);
  if ("error" in ctx) return actorError(ctx);
  return apiError("INVALID_REQUEST", 405, { message: "Opportunity deletion is disabled; close it through the governed lifecycle." });
}
