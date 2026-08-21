import type { Metadata } from "next";
import Link from "next/link";
import { completeActivity, createActivity } from "@/app/actions/sales";
import { requirePageActor } from "@/lib/auth/authorization";
import { listAccounts, listActivities } from "@/lib/data/sales-workflows";
import { listOpportunities } from "@/lib/data/opportunities";

export const metadata: Metadata = { title: "Activities", description: "Tasks, follow-ups, calls, notes, and customer actions." };

export default async function ActivitiesPage() {
  const actor = await requirePageActor();
  const [activities, accounts, opportunities] = await Promise.all([listActivities(), listAccounts(), listOpportunities()]);
  return (
    <main className="app-shell"><div className="container">
      <header className="page-header"><div><p className="mono">Daily execution</p><h1 className="page-title">Activities &amp; <span className="marker">Follow-ups</span></h1><p className="subtitle">Track the next action against the customer and opportunity records that give it context.</p></div></header>
      <form className="card form-grid form-grid-wide" action={createActivity}><h2>Add activity</h2><label>Type<select name="kind" defaultValue="task"><option value="task">Task</option><option value="follow_up">Follow-up</option><option value="call">Call</option><option value="email">Email</option><option value="note">Note</option></select></label><label>Subject<input name="subject" required maxLength={240} /></label><label>Due<input name="dueAt" type="datetime-local" /></label><label>Account<select name="accountId" defaultValue=""><option value="">No account</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>Opportunity<select name="opportunityId" defaultValue=""><option value="">No opportunity</option>{opportunities.filter((item) => item.id).map((item) => <option value={item.id} key={item.id}>{item.account} — {item.opportunity}</option>)}</select></label><label className="field-span">Details<textarea name="details" rows={3} maxLength={4000} /></label><button className="button dark" type="submit">Add activity</button></form>
      <section><div className="section-title"><span className="mono">01</span><h2>Activity register</h2></div>{activities.length === 0 ? <div className="empty-state"><h2>No activities yet</h2><p>Add the first task or follow-up above.</p></div> : <div className="stack">{activities.map((activity) => <article className="card row-card" id={`activity-${activity.id}`} key={activity.id}><span className="chip blue">{activity.kind.replace("_", " ")}</span><div><h3>{activity.subject}</h3><p>{activity.details ?? "No additional details."}</p><p className="mono">{activity.accountName ?? "No account"} · {activity.dueAt ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.dueAt)) : "No due date"}</p></div><div className="card-actions">{activity.opportunityId && <Link className="button" href={`/deals/${activity.opportunityId}`}>Open deal</Link>}{activity.status !== "completed" && activity.ownerUserId === actor.id && <form action={completeActivity}><input type="hidden" name="id" value={activity.id} /><button className="button dark" type="submit">Complete</button></form>}<span className={`chip ${activity.status === "completed" ? "green" : "orange"}`}>{activity.status.replace("_", " ")}</span></div></article>)}</div>}</section>
    </div></main>
  );
}
