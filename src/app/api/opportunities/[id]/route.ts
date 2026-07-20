import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  stage: z.string().trim().min(1).max(80).optional(),
  value_amount: z.number().nonnegative().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close_date: z.string().date().nullable().optional(),
  next_step: z.string().trim().max(500).nullable().optional(),
  health_score: z.number().int().min(0).max(100).optional(),
  attention: z.string().trim().max(80).nullable().optional(),
});

async function context(idPromise: Promise<{ id: string }>) {
  const { id } = await idPromise;
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid opportunity id", status: 400 } as const;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured", status: 503 } as const;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Unauthorized", status: 401 } as const;
  return { id, supabase } as const;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context(params);
  if ("error" in ctx) return Response.json({ error: ctx.error }, { status: ctx.status });
  const parsed = updateInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  const { data, error } = await ctx.supabase.from("opportunities").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", ctx.id).select().single();
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context(params);
  if ("error" in ctx) return Response.json({ error: ctx.error }, { status: ctx.status });
  const { error } = await ctx.supabase.from("opportunities").delete().eq("id", ctx.id);
  return error ? Response.json({ error: error.message }, { status: 400 }) : new Response(null, { status: 204 });
}
