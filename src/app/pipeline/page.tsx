import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { metrics } from "@/lib/mock-data";
import { listOpportunities } from "@/lib/data/opportunities";

export default async function PipelinePage() {
  const deals = await listOpportunities();
  return (
    <main className="app-shell">
      <div className="container">
        <Link className="back-link mono" href="/"><ArrowLeft size={14} /> Control Center</Link>
        <header className="header-grid compact-header">
          <div>
            <p className="mono">Pipeline intelligence · Updated 20 Jul 2026</p>
            <h1 className="title">Active <span className="marker">Pipeline</span></h1>
            <p className="subtitle">A management view of value, concentration, momentum and the opportunities that require intervention.</p>
          </div>
          <aside className="sync-panel mono"><p>20 active opportunities</p><p>AED 18.4M total</p><p>AED 8.9M weighted</p><button className="button">Export report</button></aside>
        </header>

        <section className="intelligence">
          <p className="mono">Pipeline reading</p>
          <h2>The largest forecast risk is concentrated in <span className="highlight">six opportunities with overdue next steps</span> and unclear procurement timelines.</h2>
          <p>DEWA has progressed into proposal preparation. Emirates Group remains strategically important but needs a confirmed technical workshop. Aldar requires a revalidation of scope and budget.</p>
        </section>

        <section>
          <div className="section-title"><span className="mono">01</span><h2>Position</h2></div>
          <div className="grid grid-3">
            {metrics.map((metric) => <article className="card metric" key={metric.label}><p className="mono">{metric.label}</p><strong>{metric.value}</strong><p>{metric.note}</p></article>)}
          </div>
        </section>

        <section>
          <div className="section-title"><span className="mono">02</span><h2>Opportunity register</h2></div>
          <div className="table-wrap">
            <table><thead><tr><th>Account</th><th>Opportunity</th><th>Stage</th><th>Value</th><th>Probability</th><th>Close</th><th>Next step</th><th>Health</th><th /></tr></thead>
              <tbody>{deals.map((deal) => <tr key={`${deal.account}-${deal.opportunity}`}><td><strong>{deal.account}</strong>{deal.attention && <div className="chips"><span className="chip orange">{deal.attention}</span></div>}</td><td>{deal.opportunity}</td><td>{deal.stage}</td><td>{deal.value}</td><td>{deal.probability}%</td><td>{deal.closeDate}</td><td>{deal.nextStep}</td><td>{deal.health}/100</td><td>{deal.id ? <Link className="icon-link" href={`/deals/${deal.id}`}><ArrowUpRight size={16} /></Link> : <span className="icon-link disabled" aria-hidden><ArrowUpRight size={16} /></span>}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
