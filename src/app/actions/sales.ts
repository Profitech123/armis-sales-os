"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApiActor } from "@/lib/auth/authorization";
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
  valueAmount: z.coerce.number().nonnegative(),
  expectedCloseDate: z.string().date().or(z.literal("")).transform((value) => value || null),
  nextStep: optionalText(500),
});

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createAccount(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/?error=unavailable");
  const parsed = accountSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/accounts?error=invalid_account");
  const duplicate = await auth.supabase.from("accounts").select("id").ilike("name", parsed.data.name).is("archived_at", null).limit(1);
  if (duplicate.data?.length) redirect(`/accounts?error=duplicate_account&duplicate=${duplicate.data[0].id}`);
  const { data, error } = await auth.supabase.from("accounts").insert({ owner_user_id: auth.user.id, ...parsed.data }).select("id").single();
  if (error || !data) { logger.error("account.create_failed", { actorId: auth.user.id, code: error?.code }); redirect("/accounts?error=create_failed"); }
  revalidatePath("/accounts"); revalidatePath("/");
  redirect("/accounts?created=account");
}

export async function createContact(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/?error=unavailable");
  const parsed = contactSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/accounts?error=invalid_contact");
  const input = parsed.data;
  if (input.email) { const duplicate = await auth.supabase.from("contacts").select("id").eq("email", input.email).is("archived_at", null).limit(1); if (duplicate.data?.length) redirect(`/accounts?error=duplicate_contact&duplicate=${duplicate.data[0].id}`); }
  const { data, error } = await auth.supabase.from("contacts").insert({ owner_user_id: auth.user.id, account_id: input.accountId, first_name: input.firstName, last_name: input.lastName, email: input.email, phone: input.phone, job_title: input.jobTitle, relationship_role: input.relationshipRole }).select("id").single();
  if (error || !data) { logger.error("contact.create_failed", { actorId: auth.user.id, code: error?.code }); redirect("/accounts?error=create_failed"); }
  revalidatePath("/accounts");
  redirect("/accounts?created=contact");
}

export async function createOpportunity(formData: FormData) {
  const auth = await requireApiActor(["seller", "manager", "admin"]);
  if ("error" in auth) redirect("/?error=unavailable");
  const parsed = opportunitySchema.safeParse(values(formData));
  if (!parsed.success) redirect("/pipeline?error=invalid_opportunity");
  const input = parsed.data;
  const { data, error } = await auth.supabase.from("opportunities").insert({ owner_user_id: auth.user.id, account_id: input.accountId, owner_name: auth.actor.displayName ?? auth.actor.email, name: input.name, stage: "qualification", value_amount: input.valueAmount, probability: 10, expected_close_date: input.expectedCloseDate, next_step: input.nextStep }).select("id").single();
  if (error || !data) { logger.error("opportunity.create_failed", { actorId: auth.user.id, code: error?.code }); redirect("/pipeline?error=create_failed"); }
  revalidatePath("/pipeline"); revalidatePath("/");
  redirect(`/deals/${data.id}`);
}
