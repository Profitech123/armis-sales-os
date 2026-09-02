import { z } from "zod";
import { requireApiActor } from "@/lib/auth/authorization";
import { actorError, apiError, dataAccessError } from "@/lib/api/responses";
import { clampLimit, decodeCursor, encodeCursor, quoteFilterValue, sanitizeSearchTerm } from "@/lib/data/pagination";

const opportunityInput = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  valueAmount: z.number().nonnegative(),
  expectedCloseDate: z.string().date().nullable().optional(),
  nextStep: z.string().trim().max(500).nullable().optional(),
});

const listQuery=z.object({q:z.string().trim().max(80).default(""),stage:z.string().trim().max(40).optional(),limit:z.coerce.number().int().min(1).max(100).default(25),cursor:z.string().max(500).optional(),sort:z.enum(["updated_desc","name_asc"]).default("updated_desc")});
const cursorSchema=z.object({updated_at:z.string().datetime({offset:true}).optional(),name:z.string().max(200).optional(),id:z.string().uuid()});

export async function GET(request:Request) {
  const auth = await requireApiActor();
  if ("error" in auth) return actorError(auth);
  const url=new URL(request.url);const parsed=listQuery.safeParse(Object.fromEntries(url.searchParams));if(!parsed.success)return apiError("INVALID_REQUEST",422,parsed.error.flatten());
  const input=parsed.data;const cursor=decodeCursor(cursorSchema,input.cursor);if(input.cursor&&!cursor)return apiError("INVALID_REQUEST",400,{cursor:"Invalid cursor"});
  const limit=clampLimit(input.limit);
  let query=auth.supabase.from("opportunities").select("id,owner_user_id,account_id,name,owner_name,stage,value_amount,probability,expected_close_date,next_step,health_score,attention,updated_at,accounts(name)").limit(limit+1);
  if(input.q)query=query.ilike("name",`%${sanitizeSearchTerm(input.q)}%`);if(input.stage)query=query.eq("stage",input.stage);
  if(input.sort==="name_asc"){query=query.order("name").order("id");if(cursor?.name){const value=quoteFilterValue(cursor.name);query=query.or(`name.gt.${value},and(name.eq.${value},id.gt.${cursor.id})`);}}else{query=query.order("updated_at",{ascending:false}).order("id",{ascending:false});if(cursor?.updated_at)query=query.or(`updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`);}
  const { data, error } = await query;if(error)return dataAccessError("api.opportunities.read_failed", { code: error.code });const page=(data??[]).slice(0,limit);const last=page.at(-1);const nextCursor=(data?.length??0)>limit&&last?encodeCursor(input.sort==="name_asc"?{name:last.name,id:last.id}:{updated_at:last.updated_at,id:last.id}):null;
  return Response.json({ data:page,meta:{limit,sort:input.sort,nextCursor} });
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
    owner_name: auth.actor.displayName ?? auth.actor.email, stage: "qualification", value_amount: input.valueAmount,
    probability: 10, expected_close_date: input.expectedCloseDate,
    next_step: input.nextStep,
  }).select().single();
  return error
    ? dataAccessError("api.opportunity.create_failed", { actorId: auth.user.id, code: error.code })
    : Response.json({ data }, { status: 201 });
}
