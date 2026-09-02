"use client";

import { useActionState } from "react";
import { resolveFlash, type FlashParams } from "@/lib/ui/flash";
import { needsCurrentValueOption } from "@/lib/ui/form-options";

export function FlashBanner({ params }: { params: FlashParams }) {
  const flash = resolveFlash(params);
  if (!flash) return null;
  return <div className={`form-feedback ${flash.tone === "success" ? "success" : "error"}`} role={flash.tone === "success" ? "status" : "alert"}>{flash.message}</div>;
}
import { assignActivity, linkOpportunityContact, reassignOpportunity, saveActivity, transitionOpportunity, updateAccount, updateContact, updateOpportunityDetails } from "@/app/actions/crm";
import { activityKinds, activityPriorities, activityStatuses, opportunityLossReasons, opportunityStages } from "@/lib/crm/catalog";
import { initialMutationState } from "@/lib/crm/mutation-state";

function Feedback({ state }: { state: typeof initialMutationState }) {
  if (!state.message) return null;
  return <div className={`form-feedback ${state.ok ? "success" : "error"}`} role={state.ok ? "status" : "alert"} tabIndex={-1}>{state.message}</div>;
}
function FieldError({ state, name }: { state: typeof initialMutationState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <span className="field-error" id={`${name}-error`}>{message}</span> : null;
}
const describedBy = (state: typeof initialMutationState, name: string) => state.fieldErrors?.[name] ? `${name}-error` : undefined;

function currentValueOption(id: string | null | undefined, list: { id: string }[], label: string) {
  if (!id || !needsCurrentValueOption(id, list)) return null;
  return <option value={id}>{label}</option>;
}

export function AccountEditForm({ account, editable }: { account: { id: string; name: string; industry: string | null; website: string | null; archived_at: string | null; record_version: number }; editable: boolean }) {
  const [state, action, pending] = useActionState(updateAccount, initialMutationState);
  if (!editable) return <p className="notice-card card">You have manager visibility for this account. Only its owner can edit it.</p>;
  return <form className="card form-grid" action={action} noValidate><h2>Account details</h2><Feedback state={state} /><input type="hidden" name="id" value={account.id} /><input type="hidden" name="version" value={account.record_version} /><label>Account name<input name="name" required maxLength={200} defaultValue={account.name} aria-invalid={Boolean(state.fieldErrors?.name)} aria-describedby={describedBy(state,"name")} /><FieldError state={state} name="name" /></label><label>Industry<input name="industry" maxLength={120} defaultValue={account.industry ?? ""} /></label><label>Website<input name="website" type="url" defaultValue={account.website ?? ""} aria-invalid={Boolean(state.fieldErrors?.website)} aria-describedby={describedBy(state,"website")} /><FieldError state={state} name="website" /></label><label>Status<select name="archived" defaultValue={account.archived_at ? "true" : "false"}><option value="false">Active</option><option value="true">Archived</option></select></label><button className="button dark" disabled={pending}>{pending ? "Saving…" : "Save account"}</button></form>;
}

export function ContactEditForm({ contact, accounts, editable }: { contact: { id:string; account_id:string; first_name:string; last_name:string; email:string|null; phone:string|null; job_title:string|null; relationship_role:string|null; archived_at:string|null; record_version:number; accounts?: {id:string;name:string}|null }; accounts: {id:string;name:string}[]; editable:boolean }) {
  const [state, action, pending] = useActionState(updateContact, initialMutationState);
  if (!editable) return <p className="notice-card card">You have manager visibility for this contact. Only its owner can edit it.</p>;
  return <form className="card form-grid form-grid-wide" action={action} noValidate><h2>Contact details</h2><Feedback state={state} /><input type="hidden" name="id" value={contact.id} /><input type="hidden" name="version" value={contact.record_version} /><label>Account<select name="accountId" defaultValue={contact.account_id}>{currentValueOption(contact.account_id, accounts, contact.accounts?.name ? `${contact.accounts.name} (archived)` : "Current account (archived)")}{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>First name<input name="firstName" required defaultValue={contact.first_name} aria-invalid={Boolean(state.fieldErrors?.firstName)} aria-describedby={describedBy(state,"firstName")} /><FieldError state={state} name="firstName" /></label><label>Last name<input name="lastName" defaultValue={contact.last_name} /></label><label>Email<input name="email" type="email" defaultValue={contact.email ?? ""} aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={describedBy(state,"email")} /><FieldError state={state} name="email" /></label><label>Phone<input name="phone" defaultValue={contact.phone ?? ""} /></label><label>Job title<input name="jobTitle" defaultValue={contact.job_title ?? ""} /></label><label>Relationship role<input name="relationshipRole" defaultValue={contact.relationship_role ?? ""} /></label><label>Status<select name="archived" defaultValue={contact.archived_at ? "true" : "false"}><option value="false">Active</option><option value="true">Archived</option></select></label><button className="button dark" disabled={pending}>{pending ? "Saving…" : "Save contact"}</button></form>;
}

export function OpportunityEditForm({ opportunity }: { opportunity: { id:string; version:number; name:string; valueAmount:number; expectedCloseDate:string|null; nextStep:string } }) {
  const [state, action, pending] = useActionState(updateOpportunityDetails, initialMutationState);
  return <form className="card form-grid form-grid-wide" action={action} noValidate><h2>Opportunity details</h2><Feedback state={state}/><input type="hidden" name="id" value={opportunity.id}/><input type="hidden" name="version" value={opportunity.version}/><label>Name<input name="name" required maxLength={200} defaultValue={opportunity.name} aria-invalid={Boolean(state.fieldErrors?.name)} aria-describedby={describedBy(state,"name")}/><FieldError state={state} name="name"/></label><label>Value (AED)<input name="valueAmount" type="number" min="0" step="0.01" required defaultValue={opportunity.valueAmount}/></label><label>Expected close<input name="expectedCloseDate" type="date" defaultValue={opportunity.expectedCloseDate ?? ""}/></label><label className="field-span">Next step<textarea name="nextStep" maxLength={500} rows={2} defaultValue={opportunity.nextStep}/></label><button className="button dark" disabled={pending}>{pending?"Saving…":"Save opportunity"}</button></form>;
}

export function OpportunityContactForm({ opportunityId, contacts }: { opportunityId:string; contacts:{id:string;name:string}[] }) {
  const [state, action, pending] = useActionState(linkOpportunityContact, initialMutationState);
  if (!contacts.length) return null;
  return <form className="card form-grid" action={action} noValidate><h2>Link stakeholder</h2><Feedback state={state}/><input type="hidden" name="opportunityId" value={opportunityId}/><label>Contact<select name="contactId" required defaultValue=""><option value="" disabled>Select contact</option>{contacts.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Role<input name="role" required maxLength={80} placeholder="e.g. Decision maker" aria-invalid={Boolean(state.fieldErrors?.role)} aria-describedby={describedBy(state,"role")}/><FieldError state={state} name="role"/></label><button className="button" disabled={pending}>{pending?"Linking…":"Link contact"}</button></form>;
}

export function ActivityAssignForm({ id, version, assigneeId, users }: { id:string; version:number; assigneeId:string; users:{id:string;email:string;display_name:string|null}[] }) {
  if (!users.length) return null;
  return <form className="inline-assign-form" action={assignActivity}><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><label className="sr-only" htmlFor={`assignee-${id}`}>Reassign activity</label><select id={`assignee-${id}`} name="assigneeId" defaultValue={assigneeId}>{users.map(u=><option value={u.id} key={u.id}>{u.display_name ?? u.email}</option>)}</select><button className="button" type="submit">Reassign</button></form>;
}

export function OpportunityTransitionForm({ id, version, stage }: { id:string;version:number;stage:string }) {
  const [state, action, pending] = useActionState(transitionOpportunity, initialMutationState);
  return <form className="card form-grid" action={action}><h2>Move opportunity</h2><Feedback state={state}/><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><label>Stage<select name="stage" defaultValue={stage}>{opportunityStages.map(s=><option value={s.key} key={s.key}>{s.label} · {s.probability}%</option>)}</select></label><label>Loss reason<select name="lossReason" defaultValue="" aria-describedby={describedBy(state,"lossReason")}><option value="">Not applicable</option>{opportunityLossReasons.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select><FieldError state={state} name="lossReason"/></label><button className="button dark" disabled={pending}>{pending?"Moving…":"Apply transition"}</button></form>;
}

export function OpportunityReassignForm({ id, version, users }: {id:string;version:number;users:{id:string;email:string;display_name:string|null}[]}) {
  const [state, action, pending] = useActionState(reassignOpportunity, initialMutationState);
  if (!users.length) return null;
  return <form className="card form-grid" action={action}><h2>Reassign ownership</h2><Feedback state={state}/><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><label>New owner<select name="ownerId" required defaultValue=""><option value="" disabled>Select user</option>{users.map(u=><option value={u.id} key={u.id}>{u.display_name ?? u.email}</option>)}</select></label><button className="button" disabled={pending}>{pending?"Reassigning…":"Reassign"}</button></form>;
}

type ActivityValue={id?:string;record_version?:number;kind?:string;subject?:string;details?:string|null;priority?:string;status?:string;account_id?:string|null;contact_id?:string|null;opportunity_id?:string|null;due_at?:string|null;reminder_at?:string|null;cancellation_reason?:string|null};
export function ActivityForm({ activity={}, accounts, contacts, opportunities }: {activity?:ActivityValue;accounts:{id:string;name:string}[];contacts:{id:string;name:string}[];opportunities:{id?:string;opportunity:string}[]}) {
  const [state, action, pending] = useActionState(saveActivity, initialMutationState);
  const local=(value?:string|null)=>value?new Date(value).toISOString().slice(0,16):"";
  return <form className="card form-grid form-grid-wide" action={action} noValidate><h2>{activity.id?"Edit activity":"Add activity"}</h2><Feedback state={state}/><input type="hidden" name="id" value={activity.id??""}/>{activity.id&&<input type="hidden" name="version" value={activity.record_version}/>}<label>Type<select name="kind" defaultValue={activity.kind??"task"}>{activityKinds.map(k=><option value={k} key={k}>{k.replace("_"," ")}</option>)}</select></label><label>Subject<input name="subject" required defaultValue={activity.subject??""} aria-invalid={Boolean(state.fieldErrors?.subject)} aria-describedby={describedBy(state,"subject")}/><FieldError state={state} name="subject"/></label><label>Priority<select name="priority" defaultValue={activity.priority??"normal"}>{activityPriorities.map(p=><option value={p} key={p}>{p}</option>)}</select></label><label>Status<select name="status" defaultValue={activity.status??"open"}>{activityStatuses.map(s=><option value={s} key={s}>{s.replace("_"," ")}</option>)}</select></label><label>Due<input name="dueAt" type="datetime-local" defaultValue={local(activity.due_at)}/></label><label>Reminder<input name="reminderAt" type="datetime-local" defaultValue={local(activity.reminder_at)} aria-invalid={Boolean(state.fieldErrors?.reminderAt)} aria-describedby={describedBy(state,"reminderAt")}/><FieldError state={state} name="reminderAt"/></label><label>Account<select name="accountId" defaultValue={activity.account_id??""}><option value="">No account</option>{currentValueOption(activity.account_id, accounts, "Current account (not in this list)")}{accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>Contact<select name="contactId" defaultValue={activity.contact_id??""}><option value="">No contact</option>{currentValueOption(activity.contact_id, contacts, "Current contact (not in this list)")}{contacts.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Opportunity<select name="opportunityId" defaultValue={activity.opportunity_id??""}><option value="">No opportunity</option>{currentValueOption(activity.opportunity_id, opportunities.filter((o): o is {id:string;opportunity:string} => Boolean(o.id)), "Current opportunity (not in this list)")}{opportunities.filter(o=>o.id).map(o=><option value={o.id} key={o.id}>{o.opportunity}</option>)}</select></label><label className="field-span">Details<textarea name="details" rows={3} defaultValue={activity.details??""}/></label><label className="field-span">Cancellation reason<textarea name="cancellationReason" defaultValue={activity.cancellation_reason??""} aria-invalid={Boolean(state.fieldErrors?.cancellationReason)} aria-describedby={describedBy(state,"cancellationReason")}/><FieldError state={state} name="cancellationReason"/></label><button className="button dark" disabled={pending}>{pending?"Saving…":"Save activity"}</button></form>;
}
