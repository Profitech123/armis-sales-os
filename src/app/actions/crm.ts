"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireApiActor } from "@/lib/auth/authorization";
import { activityKinds, activityPriorities, activityStatuses, opportunityLossReasons, opportunityStages } from "@/lib/crm/catalog";
import type { MutationState } from "@/lib/crm/mutation-state";

const text = (max: number) => z.string().trim().max(max);
const optionalUuid = z.string().uuid().or(z.literal("")).transform((value) => value || null);
const optionalDateTime = z.string().datetime({ local: true }).or(z.literal("")).transform((value) => value ? new Date(value).toISOString() : null);

function invalid(result: z.SafeParseError<unknown>): MutationState {
  return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
}

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }
function errorMessage(error: { message?: string; code?: string } | null) {
  if (error?.message?.includes("version_conflict") || error?.code === "40001") return { ok: false, conflict: true, message: "This record changed after you opened it. Refresh and review the latest values before saving again." };
  return { ok: false, message: "The change could not be saved. Try again or contact an administrator with the time of this attempt." };
}

const accountEditSchema = z.object({
  id: z.string().uuid(), version: z.coerce.number().int().positive(), name: text(200).min(1), industry: text(120),
  website: z.string().trim().url("Enter a valid URL.").or(z.literal("")), archived: z.enum(["true", "false"]),
});

export async function updateAccount(_previous: MutationState, formData: FormData): Promise<MutationState> {
  const auth = await requireApiActor(["seller", "manager", "admin"]); if ("error" in auth) return { ok: false, message: "Your session is not authorized." };
  const parsed = accountEditSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed);
  const input = parsed.data;
  const duplicate = await auth.supabase.from("accounts").select("id").ilike("name", input.name).neq("id", input.id).is("archived_at", null).limit(1);
  if (duplicate.data?.length) return { ok: false, message: "An active account with this name already exists.", fieldErrors: { name: ["Use the existing account or choose a distinct name."] } };
  const { data, error } = await auth.supabase.from("accounts").update({ name: input.name, industry: input.industry || null, website: input.website || null, archived_at: input.archived === "true" ? new Date().toISOString() : null, record_version: input.version + 1 }).eq("id", input.id).eq("record_version", input.version).select("id").maybeSingle();
  if (error || !data) return error ? errorMessage(error) : { ok: false, conflict: true, message: "This record changed. Refresh before saving." };
  revalidatePath(`/accounts/${input.id}`); revalidatePath("/accounts");
  return { ok: true, message: input.archived === "true" ? "Account archived." : "Account saved." };
}

const contactEditSchema = z.object({
  id: z.string().uuid(), version: z.coerce.number().int().positive(), accountId: z.string().uuid(), firstName: text(100).min(1), lastName: text(100),
  email: z.string().trim().email("Enter a valid email.").or(z.literal("")), phone: text(60), jobTitle: text(120), relationshipRole: text(120), archived: z.enum(["true", "false"]),
});

export async function updateContact(_previous: MutationState, formData: FormData): Promise<MutationState> {
  const auth = await requireApiActor(["seller", "manager", "admin"]); if ("error" in auth) return { ok: false, message: "Your session is not authorized." };
  const parsed = contactEditSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed);
  const input = parsed.data; const normalizedEmail = input.email.toLowerCase() || null;
  if (normalizedEmail) {
    const duplicate = await auth.supabase.from("contacts").select("id").eq("email", normalizedEmail).neq("id", input.id).is("archived_at", null).limit(1);
    if (duplicate.data?.length) return { ok: false, message: "An active contact with this email already exists.", fieldErrors: { email: ["Open the existing contact instead."] } };
  }
  const { data, error } = await auth.supabase.from("contacts").update({ account_id: input.accountId, first_name: input.firstName, last_name: input.lastName, email: normalizedEmail, phone: input.phone || null, job_title: input.jobTitle || null, relationship_role: input.relationshipRole || null, archived_at: input.archived === "true" ? new Date().toISOString() : null, record_version: input.version + 1 }).eq("id", input.id).eq("record_version", input.version).select("id").maybeSingle();
  if (error || !data) return error ? errorMessage(error) : { ok: false, conflict: true, message: "This record changed. Refresh before saving." };
  revalidatePath(`/contacts/${input.id}`); revalidatePath(`/accounts/${input.accountId}`); revalidatePath("/accounts");
  return { ok: true, message: input.archived === "true" ? "Contact archived." : "Contact saved." };
}

const transitionSchema = z.object({ id: z.string().uuid(), version: z.coerce.number().int().positive(), stage: z.enum(opportunityStages.map((item) => item.key) as [string, ...string[]]), lossReason: z.enum(opportunityLossReasons.map((item) => item[0]) as [string, ...string[]]).or(z.literal("")) });
export async function transitionOpportunity(_previous: MutationState, formData: FormData): Promise<MutationState> {
  const auth = await requireApiActor(["seller", "manager", "admin"]); if ("error" in auth) return { ok: false, message: "Your session is not authorized." };
  const parsed = transitionSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed);
  if (parsed.data.stage === "closed_lost" && !parsed.data.lossReason) return { ok: false, message: "Choose a loss reason.", fieldErrors: { lossReason: ["A loss reason is required to close an opportunity as lost."] } };
  const { error } = await auth.supabase.rpc("transition_opportunity", { target_id: parsed.data.id, expected_version: parsed.data.version, target_stage: parsed.data.stage, target_loss_reason: parsed.data.lossReason || null, correlation: crypto.randomUUID() });
  if (error) return errorMessage(error);
  revalidatePath(`/deals/${parsed.data.id}`); revalidatePath("/pipeline"); revalidatePath("/"); return { ok: true, message: "Opportunity stage updated." };
}

const opportunityEditSchema = z.object({
  id: z.string().uuid(), version: z.coerce.number().int().positive(), name: text(200).min(1), valueAmount: z.coerce.number().nonnegative(),
  expectedCloseDate: z.string().date().or(z.literal("")).transform((value) => value || null), nextStep: text(500),
});

export async function updateOpportunityDetails(_previous: MutationState, formData: FormData): Promise<MutationState> {
  const auth = await requireApiActor(["seller", "manager", "admin"]); if ("error" in auth) return { ok: false, message: "Your session is not authorized." };
  const parsed = opportunityEditSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed);
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("opportunities").update({ name: input.name, value_amount: input.valueAmount, expected_close_date: input.expectedCloseDate, next_step: input.nextStep || null, record_version: input.version + 1 }).eq("id", input.id).eq("record_version", input.version).select("id").maybeSingle();
  if (error || !data) return error ? errorMessage(error) : { ok: false, conflict: true, message: "This opportunity changed. Refresh before saving." };
  revalidatePath(`/deals/${input.id}`); revalidatePath("/pipeline"); revalidatePath("/");
  return { ok: true, message: "Opportunity saved." };
}

const opportunityContactSchema = z.object({ opportunityId: z.string().uuid(), contactId: z.string().uuid(), role: text(80).min(1) });

export async function linkOpportunityContact(_previous: MutationState, formData: FormData): Promise<MutationState> {
  const auth = await requireApiActor(["seller", "manager", "admin"]); if ("error" in auth) return { ok: false, message: "Your session is not authorized." };
  const parsed = opportunityContactSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed);
  const input = parsed.data;
  const { error } = await auth.supabase.from("opportunity_contacts").insert({ opportunity_id: input.opportunityId, contact_id: input.contactId, owner_user_id: auth.user.id, role: input.role });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "This contact is already linked to the opportunity." };
    return { ok: false, message: "Could not link this contact. You must own both the contact and the opportunity." };
  }
  revalidatePath(`/deals/${input.opportunityId}`); revalidatePath(`/contacts/${input.contactId}`);
  return { ok: true, message: "Contact linked to opportunity." };
}

const reassignSchema = z.object({ id: z.string().uuid(), version: z.coerce.number().int().positive(), ownerId: z.string().uuid() });
export async function reassignOpportunity(_previous: MutationState, formData: FormData): Promise<MutationState> {
  const auth = await requireApiActor(["manager", "admin"]); if ("error" in auth) return { ok: false, message: "Only an authorized manager or administrator can reassign ownership." };
  const parsed = reassignSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed);
  const { error } = await auth.supabase.rpc("reassign_opportunity", { target_id: parsed.data.id, expected_version: parsed.data.version, target_owner: parsed.data.ownerId, correlation: crypto.randomUUID() });
  if (error) return errorMessage(error);
  revalidatePath(`/deals/${parsed.data.id}`); revalidatePath("/pipeline"); return { ok: true, message: "Opportunity ownership reassigned." };
}

const activitySchema = z.object({
  id: z.string().uuid().or(z.literal("")), version: z.coerce.number().int().positive().optional(), kind: z.enum(activityKinds), subject: text(240).min(1), details: text(4000), priority: z.enum(activityPriorities), status: z.enum(activityStatuses), accountId: optionalUuid, contactId: optionalUuid, opportunityId: optionalUuid, dueAt: optionalDateTime, reminderAt: optionalDateTime, cancellationReason: text(500),
  assigneeId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.reminderAt && !value.dueAt) ctx.addIssue({ code: "custom", path: ["reminderAt"], message: "Set a due date before adding a reminder." });
  if (value.reminderAt && value.dueAt && value.reminderAt > value.dueAt) ctx.addIssue({ code: "custom", path: ["reminderAt"], message: "Reminder must be before the due date." });
  if (value.status === "cancelled" && !value.cancellationReason) ctx.addIssue({ code: "custom", path: ["cancellationReason"], message: "Explain why this activity is cancelled." });
});

export async function saveActivity(_previous: MutationState, formData: FormData): Promise<MutationState> {
  const auth = await requireApiActor(["seller", "manager", "admin"]); if ("error" in auth) return { ok: false, message: "Your session is not authorized." };
  const parsed = activitySchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed);
  const v = parsed.data; const now = new Date().toISOString(); const payload = { kind: v.kind, subject: v.subject, details: v.details || null, priority: v.priority, status: v.status, assignee_user_id: v.assigneeId ?? auth.user.id, account_id: v.accountId, contact_id: v.contactId, opportunity_id: v.opportunityId, due_at: v.dueAt, reminder_at: v.reminderAt, completed_at: v.status === "completed" ? now : null, cancelled_at: v.status === "cancelled" ? now : null, cancellation_reason: v.status === "cancelled" ? v.cancellationReason : null };
  if (!v.id) {
    const { error } = await auth.supabase.from("activities").insert({ ...payload, owner_user_id: auth.user.id });
    if (error) return errorMessage(error);
  } else {
    const { data, error } = await auth.supabase.from("activities").update({ ...payload, record_version: (v.version ?? 0) + 1 }).eq("id", v.id).eq("record_version", v.version ?? 0).select("id").maybeSingle();
    if (error || !data) return error ? errorMessage(error) : { ok: false, conflict: true, message: "This activity changed. Refresh before saving." };
  }
  revalidatePath("/activities"); revalidatePath("/"); return { ok: true, message: v.id ? "Activity saved." : "Activity created." };
}

export async function assignActivity(formData: FormData) {
  const auth=await requireApiActor(["manager","admin"]); if("error" in auth) redirect("/activities?error=forbidden");
  const parsed=z.object({id:z.string().uuid(),assigneeId:z.string().uuid(),version:z.coerce.number().int().positive()}).safeParse(values(formData));
  if(!parsed.success) redirect("/activities?error=invalid_assignment");
  const {error}=await auth.supabase.rpc("assign_activity",{target_id:parsed.data.id,expected_version:parsed.data.version,target_assignee:parsed.data.assigneeId});
  if(error) redirect(error.code==="40001"?"/activities?error=assignment_conflict":"/activities?error=assignment_forbidden");
  revalidatePath("/activities"); redirect("/activities?updated=assignment");
}
