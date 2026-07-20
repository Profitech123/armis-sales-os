import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const opportunityInput = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  ownerName: z.string().trim().min(1).max(120),
  stage: z.string().trim().min(1).max(80),
  valueAmount: z.number().nonnegative(),
  probability: z.number().int().min(0).max(100),
  expectedCloseDate: z.string().date().nullable().optional(),
  nextStep: z.string().trim().max(500).nullable().optional(),
});

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured", status: 503 } as const;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: "Unauthorized", status: 401 } as const;
  return { supabase, user: data.user } as const;
}

export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.supabase.from("opportunities").select("*,accounts(name)").order("updated_at", { ascending: false });
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = opportunityInput.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("opportunities").insert({
    owner_user_id: auth.user.id, account_id: input.accountId, name: input.name,
    owner_name: input.ownerName, stage: input.stage, value_amount: input.valueAmount,
    probability: input.probability, expected_close_date: input.expectedCloseDate,
    next_step: input.nextStep,
  }).select().single();
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ data }, { status: 201 });
}
