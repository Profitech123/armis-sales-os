"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApiActor } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

const accountSchema = z.object({
  name: z.string().trim().min(1).max(200),
  industry: optionalText(120),
  website: z.string().trim().url().max(500).refine((value) => value.startsWith("https://") || value.startsWith("http://"), "Website must use HTTP or HTTPS").or(z.literal("")).transform((value) => value || null),
});

const contactSchema = z.object({
  accountId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100),
  email: z.string().trim().email().or(z.literal("")).transform((value) => value ? value.toLowerCase() : null),
  phone: optionalText(60),
  jobTitle: optionalText(120),
  relationshipRole: optionalText(120),
});

const opportunitySchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  stage: z.string().trim().min(1).max(80),
  valueAmount: z.coerce.number().nonnegative(),
  probability: z.coerce.number().int().min(0).max(100),
  expectedCloseDate: z.string().date().or(z.literal("")).transform((value) => value || null),
  nextStep: optionalText(500),
});
const opportunityUpdateSchema = opportunitySchema.omit({ accountId: true }).extend({ id: z.string().uuid() });

const activitySchema = z.object({
  kind: z.enum(["task", "follow_up", "call", "email", "note"]),
  subject: z.string().trim().min(1).max(240),
  details: optionalText(4000),
  accountId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  opportunityId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  dueAt: z.string().datetime({ local: true }).or(z.literal("")).transform((value) => value ? new Date(value).toISOString() : null),
});

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function audit(actorId: string, entityType: string, entityId: string, action: string, afterData: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("audit_log").insert({ actor_user_id: actorId, entity_type: entityType, entity_id: entityId, action, after_data: afterData });
}

export async function createAccount(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const parsed = accountSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/accounts?error=invalid_account");
  const { data, error } = await auth.supabase.from("accounts").insert({ owner_user_id: auth.user.id, ...parsed.data }).select("id").single();
  if (error || !data) { logger.error("account.create_failed", { actorId: auth.user.id, code: error?.code }); redirect("/accounts?error=create_failed"); }
  await audit(auth.user.id, "account", data.id, "created", parsed.data);
  revalidatePath("/accounts"); revalidatePath("/");
  redirect("/accounts?created=account");
}

export async function createContact(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const parsed = contactSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/accounts?error=invalid_contact");
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("contacts").insert({ owner_user_id: auth.user.id, account_id: input.accountId, first_name: input.firstName, last_name: input.lastName, email: input.email, phone: input.phone, job_title: input.jobTitle, relationship_role: input.relationshipRole }).select("id").single();
  if (error || !data) { logger.error("contact.create_failed", { actorId: auth.user.id, code: error?.code }); redirect("/accounts?error=create_failed"); }
  await audit(auth.user.id, "contact", data.id, "created", { accountId: input.accountId, email: input.email });
  revalidatePath("/accounts");
  redirect("/accounts?created=contact");
}

export async function createOpportunity(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const parsed = opportunitySchema.safeParse(values(formData));
  if (!parsed.success) redirect("/pipeline?error=invalid_opportunity");
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("opportunities").insert({ owner_user_id: auth.user.id, account_id: input.accountId, owner_name: auth.actor.displayName ?? auth.actor.email, name: input.name, stage: input.stage, value_amount: input.valueAmount, probability: input.probability, expected_close_date: input.expectedCloseDate, next_step: input.nextStep }).select("id").single();
  if (error || !data) { logger.error("opportunity.create_failed", { actorId: auth.user.id, code: error?.code }); redirect("/pipeline?error=create_failed"); }
  await audit(auth.user.id, "opportunity", data.id, "created", { accountId: input.accountId, stage: input.stage });
  revalidatePath("/pipeline"); revalidatePath("/");
  redirect(`/deals/${data.id}`);
}

export async function updateOpportunity(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const parsed = opportunityUpdateSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/pipeline?error=invalid_opportunity");
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("opportunities").update({ name: input.name, stage: input.stage, value_amount: input.valueAmount, probability: input.probability, expected_close_date: input.expectedCloseDate, next_step: input.nextStep }).eq("id", input.id).select("id").maybeSingle();
  if (error || !data) { logger.warn("opportunity.update_denied", { actorId: auth.user.id, opportunityId: input.id }); redirect(`/deals/${input.id}?error=update_failed`); }
  await audit(auth.user.id, "opportunity", data.id, "updated", { stage: input.stage, probability: input.probability, nextStep: input.nextStep });
  revalidatePath(`/deals/${data.id}`); revalidatePath("/pipeline"); revalidatePath("/");
  redirect(`/deals/${data.id}?updated=opportunity`);
}

export async function createActivity(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const parsed = activitySchema.safeParse(values(formData));
  if (!parsed.success) redirect("/activities?error=invalid_activity");
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("activities").insert({ owner_user_id: auth.user.id, kind: input.kind, subject: input.subject, details: input.details, account_id: input.accountId, opportunity_id: input.opportunityId, due_at: input.dueAt }).select("id").single();
  if (error || !data) { logger.error("activity.create_failed", { actorId: auth.user.id, code: error?.code }); redirect("/activities?error=create_failed"); }
  await audit(auth.user.id, "activity", data.id, "created", { kind: input.kind, dueAt: input.dueAt });
  revalidatePath("/activities"); revalidatePath("/");
  redirect("/activities?created=activity");
}

export async function completeActivity(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/sign-in");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/activities?error=invalid_activity");
  const { data, error } = await auth.supabase.from("activities").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) { logger.warn("activity.complete_denied", { actorId: auth.user.id, activityId: id.data }); redirect("/activities?error=update_failed"); }
  await audit(auth.user.id, "activity", data.id, "completed", { status: "completed" });
  revalidatePath("/activities"); revalidatePath("/");
}
