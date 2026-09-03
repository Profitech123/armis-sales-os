import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react";
import { listOpportunities } from "@/lib/data/opportunities";
import { listActivities } from "@/lib/data/sales-workflows";
import { requirePageActor } from "@/lib/auth/authorization";

export default async function HomePage() {
  const actor = await requirePageActor();
  const [deals, activities] = await Promise.all([listOpportunities(), listActivities({ openOnly: true, limit: 6 })]);
  const overdue = activities.filter((activity) => activity.dueAt && new Date(activity.dueAt).getTime() < Date.now());
  return (
    <main className="app-shell">
      <div className="container">
        <header className="header-grid">
          <div>
            <p className="mono">Armis Middle East · AI Sales Operating System</p>
            <h1 className="title">Sales OS <span className="marker">Control Center</span></h1>
            <p className="subtitle">The operating layer behind Armis sales execution. It understands the pipeline, meetings, commitments, proposals and tenders—and keeps the organization ready to act.</p>
          </div>
          <aside className="sync-panel mono">
            <p>Active as {actor.displayName ?? actor.email}</p><p>{deals.length} visible opportunities</p><p>{activities.length} open activities</p><p>{overdue.length} overdue</p>
          </aside>
        </header>

        <section className="intelligence">
          <p className="mono">01 — One thing to act on today</p>
          <h2>{overdue.length > 0 ? <>Resolve <span className="highlight">{overdue.length} overdue follow-up{overdue.length === 1 ? "" : "s"}</span> before advancing the pipeline.</> : <>Keep every opportunity moving with a <span className="highlight">clear next action</span>.</>}</h2>
          <p>{activities.length > 0 ? "The activity queue is repository-backed and ordered by due date." : "No open activities are recorded. Add the next customer or internal follow-up."}</p>
          <div className="card-actions"><Link className="button" href="/activities">Open activities <ArrowUpRight size={15} /></Link><Link className="button" href="/pipeline">Review pipeline</Link></div>
        </section>

        <section><div className="section-title"><span className="mono">02</span><h2>Operating position</h2></div><div className="grid grid-3"><article className="card metric"><p className="mono">Visible pipeline</p><strong>{deals.length}</strong><p>Authorized opportunities in the repository.</p></article><article className="card metric"><p className="mono">Open activities</p><strong>{activities.length}</strong><p>Tasks and follow-ups awaiting action.</p></article><article className="card metric"><p className="mono">Overdue</p><strong>{overdue.length}</strong><p>Open activities past their due time.</p></article></div></section>

        <section><div className="section-title"><span className="mono">03</span><h2>Priority action queue</h2></div>{activities.length === 0 ? <div className="empty-state"><h2>No open activities</h2><p>Add a task or follow-up to establish the daily queue.</p><Link className="button dark" href="/activities">Add activity</Link></div> : <div className="grid grid-3">{activities.map((item) => <article className="card" key={item.id}><div className="chips"><span className={`chip ${item.status === "completed" ? "green" : item.dueAt && new Date(item.dueAt).getTime() < Date.now() ? "red" : "blue"}`}>{item.kind.replace("_", " ")}</span></div><h3>{item.subject}</h3><p>{item.details ?? "No additional details."}</p><p><strong>Due:</strong> {item.dueAt ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.dueAt)) : "Not set"}</p><div className="card-actions"><Link className="button dark" href="/activities">Open activity</Link>{item.opportunityId && <Link className="button" href={`/deals/${item.opportunityId}`}>Open deal</Link>}</div></article>)}</div>}</section>

        <section><div className="section-title"><span className="mono">04</span><h2>Active pipeline</h2></div><div className="table-wrap"><table><caption className="sr-only">Active sales opportunities</caption><thead><tr><th>Account</th><th>Opportunity</th><th>Owner</th><th>Stage</th><th>Value</th><th>Probability</th><th>Close</th><th>Next step</th><th>Health</th></tr></thead><tbody>{deals.map((deal) => <tr key={`${deal.account}-${deal.opportunity}`}><td><strong>{deal.account}</strong>{deal.attention && <div className="chips"><span className="chip orange">{deal.attention}</span></div>}</td><td>{deal.id ? <Link href={`/deals/${deal.id}`}><strong>{deal.opportunity}</strong></Link> : deal.opportunity}</td><td>{deal.owner}</td><td>{deal.stage}</td><td>{deal.value}</td><td>{deal.probability}%</td><td>{deal.closeDate}</td><td>{deal.nextStep}</td><td>{deal.health >= 75 ? <CheckCircle2 size={18} /> : <Clock3 size={18} />} {deal.health}/100</td></tr>)}</tbody></table></div><div className="card-actions"><Link className="button dark" href="/pipeline">Open full pipeline</Link></div></section>

        <p className="footer-note mono">Supabase-backed when configured · Open access, no sign-in required</p>
      </div>
    </main>
  );
}
