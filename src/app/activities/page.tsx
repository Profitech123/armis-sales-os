import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/lib/auth/authorization";
import { activityPriorities, activityStatuses } from "@/lib/crm/catalog";
import { getActivityById, listAccounts, listActivitiesPage, listContacts, type ActivitiesSort } from "@/lib/data/sales-workflows";
import { listOpportunities } from "@/lib/data/opportunities";
import { listAssignableUsers } from "@/lib/data/crm-details";
import { ActivityAssignForm, ActivityForm, FlashBanner } from "@/components/crm-forms";
import { buildActivitiesQuery, buildActivityEditLink, type ActivitiesPageParams } from "@/lib/ui/page-links";

export const metadata: Metadata = { title: "Activities", description: "Tasks, follow-ups, reminders, calls, notes, and customer actions." };

type SearchParams = ActivitiesPageParams;

export default async function ActivitiesPage({searchParams}:{searchParams:Promise<SearchParams>}) {
  const actor=await requirePageActor();
  const canAssign=actor.role==="manager"||actor.role==="admin";
  const params=await searchParams;
  const sort:ActivitiesSort=params.sort==="updated_desc"?"updated_desc":"due_asc";
  const status=activityStatuses.includes(params.status as typeof activityStatuses[number]) ? (params.status as typeof activityStatuses[number]) : undefined;
  const priority=activityPriorities.includes(params.priority as typeof activityPriorities[number]) ? (params.priority as typeof activityPriorities[number]) : undefined;
  const [activitiesPage,accounts,contacts,opportunities,assignableUsers,selected]=await Promise.all([
    listActivitiesPage({q:params.q,status,priority,sort,cursor:params.cursor}),
    listAccounts(),listContacts(),listOpportunities(),
    canAssign?listAssignableUsers(actor.id,actor.role):Promise.resolve([]),
    params.edit?getActivityById(params.edit):Promise.resolve(null),
  ]);
  const editable=selected&&selected.ownerUserId===actor.id?selected:undefined;
  return <main className="app-shell"><div className="container"><header className="page-header"><div><p className="mono">Daily execution</p><h1 className="page-title">Activities &amp; <span className="marker">Follow-ups</span></h1><p className="subtitle">Create, prioritize, remind, reschedule, complete, reopen, or cancel work in customer context.</p></div></header>
    <FlashBanner params={params} />
    <ActivityForm activity={editable?{id:editable.id,record_version:editable.recordVersion,kind:editable.kind,subject:editable.subject,details:editable.details,priority:editable.priority,status:editable.status,account_id:editable.accountId,contact_id:editable.contactId,opportunity_id:editable.opportunityId,due_at:editable.dueAt,reminder_at:editable.reminderAt,cancellation_reason:editable.cancellationReason}:{}} accounts={accounts} contacts={contacts} opportunities={opportunities}/>
    <section>
      <div className="section-title"><span className="mono">01</span><h2>Activity register</h2></div>
      <form className="card filter-bar" action="/activities">
        <label className="sr-only" htmlFor="activities-q">Search activities</label>
        <input id="activities-q" name="q" defaultValue={params.q ?? ""} placeholder="Search subject" maxLength={80} />
        <label className="sr-only" htmlFor="activities-status">Status</label>
        <select id="activities-status" name="status" defaultValue={status ?? ""}><option value="">Any status</option>{activityStatuses.map(s=><option value={s} key={s}>{s.replace("_"," ")}</option>)}</select>
        <label className="sr-only" htmlFor="activities-priority">Priority</label>
        <select id="activities-priority" name="priority" defaultValue={priority ?? ""}><option value="">Any priority</option>{activityPriorities.map(p=><option value={p} key={p}>{p}</option>)}</select>
        <label className="sr-only" htmlFor="activities-sort">Sort</label>
        <select id="activities-sort" name="sort" defaultValue={sort}><option value="due_asc">Due date</option><option value="updated_desc">Recently updated</option></select>
        <button className="button" type="submit">Filter</button>
      </form>
      {activitiesPage.data.length===0?<div className="empty-state"><h2>No activities found</h2><p>Adjust the filter, or add the first task or follow-up above. Managers see their team’s work read-only.</p></div>:<div className="stack">{activitiesPage.data.map(activity=><article className="card row-card" id={`activity-${activity.id}`} key={activity.id}><span className={`chip ${activity.priority==="urgent"?"red":"blue"}`}>{activity.priority}</span><div><h3>{activity.subject}</h3><p>{activity.details??"No additional details."}</p><p className="mono">{activity.kind.replace("_"," ")} · {activity.accountName??"No account"} · {activity.dueAt?new Intl.DateTimeFormat("en-AE",{dateStyle:"medium",timeStyle:"short"}).format(new Date(activity.dueAt)):"No due date"}{activity.reminderAt?" · reminder set":""}</p></div><div className="card-actions">{activity.opportunityId&&<Link className="button" href={`/deals/${activity.opportunityId}`}>Open deal</Link>}{activity.ownerUserId===actor.id&&<Link className="button dark" href={buildActivityEditLink(params,activity.id)}>Edit</Link>}{canAssign&&<ActivityAssignForm id={activity.id} version={activity.recordVersion} assigneeId={activity.assigneeUserId} users={assignableUsers}/>}<span className={`chip ${activity.status==="completed"?"green":activity.status==="cancelled"?"red":"orange"}`}>{activity.status.replace("_"," ")}</span></div></article>)}</div>}
      <div className="card-actions">{params.cursor && <Link className="button" href={buildActivitiesQuery(params,{cursor:""})}>⇤ First page</Link>}{activitiesPage.nextCursor && <Link className="button" href={buildActivitiesQuery(params,{cursor:activitiesPage.nextCursor})}>Next activities →</Link>}</div>
    </section>
  </div></main>;
}
