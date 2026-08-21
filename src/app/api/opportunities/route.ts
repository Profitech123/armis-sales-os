import { z } from "zod";
import { requireApiActor } from "@/lib/auth/authorization";
import { actorError, apiError, dataAccessError } from "@/lib/api/responses";

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

export async function GET() {
  const auth = await requireApiActor();
  if ("error" in auth) return actorError(auth);
  const { data, error } = await auth.supabase.from("opportunities").select("*,accounts(name)").order("updated_at", { ascending: false });
  return error ? dataAccessError("api.opportunities.read_failed", { code: error.code }) : Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) return actorError(auth);
  let payload: unknown;
  try { payload = await request.json(); } catch { return apiError("INVALID_REQUEST", 400); }
  const parsed = opportunityInput.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", 422, parsed.error.flatten());
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("opportunities").insert({
    owner_user_id: auth.user.id, account_id: input.accountId, name: input.name,
    owner_name: input.ownerName, stage: input.stage, value_amount: input.valueAmount,
    probability: input.probability, expected_close_date: input.expectedCloseDate,
    next_step: input.nextStep,
  }).select().single();
  return error
    ? dataAccessError("api.opportunity.create_failed", { actorId: auth.user.id, code: error.code })
    : Response.json({ data }, { status: 201 });
}
