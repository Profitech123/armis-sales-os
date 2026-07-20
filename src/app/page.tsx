import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { metrics, priorities } from "@/lib/mock-data";
import { listOpportunities } from "@/lib/data/opportunities";

export default async function HomePage() {
  const deals = await listOpportunities();
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
            <p>Updated Mon 20 Jul 2026</p><p>Last sync 07:02 GST</p><p>12 sources healthy</p><p>3 actions need review</p>
            <button className="button" type="button"><RefreshCw size={13} /> Sync report</button>
          </aside>
        </header>

        <section className="intelligence">
          <p className="mono">01 — One thing to act on today</p>
          <h2>Get the <span className="highlight">DEWA Smart Library concept proposal</span>, robotics shortlist and commercial assumptions approved and sent today.</h2>
          <p>The opportunity is active, but the proposal milestone is overdue by two days. Resolve the Microsoft architecture input and confirm partner responsibilities before sending.</p>
          <div className="card-actions"><Link className="button" href="/pipeline">Open pipeline <ArrowUpRight size={15} /></Link><button className="button">Review proposal</button><button className="button">Explain recommendation</button></div>
        </section>

        <section><div className="section-title"><span className="mono">02</span><h2>Operating position</h2></div><div className="grid grid-3">{metrics.map((metric) => <article className="card metric" key={metric.label}><p className="mono">{metric.label}</p><strong>{metric.value}</strong><p>{metric.note}</p></article>)}</div></section>

        <section><div className="section-title"><span className="mono">03</span><h2>Priority action queue</h2></div><div className="grid grid-3">{priorities.map((item) => <article className="card" key={item.title}><div className="chips">{item.labels.map((label) => <span className={`chip ${item.tone}`} key={label}>{label}</span>)}</div><h3>{item.title}</h3><p>{item.body}</p><p><strong>Recommended:</strong> {item.action}</p><div className="card-actions"><button className="button dark">Open</button><button className="button">Draft reply</button><button className="button">Escalate</button></div></article>)}</div></section>

        <section><div className="section-title"><span className="mono">04</span><h2>Active pipeline</h2></div><div className="table-wrap"><table><thead><tr><th>Account</th><th>Opportunity</th><th>Owner</th><th>Stage</th><th>Value</th><th>Probability</th><th>Close</th><th>Next step</th><th>Health</th></tr></thead><tbody>{deals.map((deal) => <tr key={`${deal.account}-${deal.opportunity}`}><td><strong>{deal.account}</strong>{deal.attention && <div className="chips"><span className="chip orange">{deal.attention}</span></div>}</td><td>{deal.id ? <Link href={`/deals/${deal.id}`}><strong>{deal.opportunity}</strong></Link> : deal.opportunity}</td><td>{deal.owner}</td><td>{deal.stage}</td><td>{deal.value}</td><td>{deal.probability}%</td><td>{deal.closeDate}</td><td>{deal.nextStep}</td><td>{deal.health >= 75 ? <CheckCircle2 size={18} /> : <Clock3 size={18} />} {deal.health}/100</td></tr>)}</tbody></table></div><div className="card-actions"><Link className="button dark" href="/pipeline">Open full pipeline</Link></div></section>

        <p className="footer-note mono">Supabase-backed when configured · Microsoft Entra sign-in available at /sign-in</p>
      </div>
    </main>
  );
}
