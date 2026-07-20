import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileCheck2, Layers3 } from "lucide-react";

const sections = ["Executive summary", "Customer context", "Proposed solution", "Scope", "Delivery model", "Partners", "Timeline", "Commercials", "Assumptions", "Exclusions"];
const reviewItems = [
  { title: "Partner responsibility not assigned", body: "Autonomous RFID inventory is included, but the delivery owner has not been confirmed.", action: "Assign PAL Robotics" },
  { title: "Microsoft architecture pending", body: "The Copilot and SharePoint reference architecture is still awaiting partner confirmation.", action: "Request confirmation" },
  { title: "Commercial assumption requires approval", body: "The current estimate excludes civil works and permanent robotics infrastructure.", action: "Approve assumption" },
];

export default function ProposalWorkspacePage() {
  return (
    <main className="app-shell">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="mono">Proposal PROP-DEWA-2026-003 · Version 1.2</p>
            <h1 className="page-title">DEWA <span className="marker">AI Smart Library</span></h1>
            <div className="chips"><span className="chip orange">Internal review</span><span className="chip">Commercial review pending</span><span className="chip green">Valid 30 days</span></div>
          </div>
          <div className="header-actions"><Link className="button" href="/deals/dewa-smart-library">Deal</Link><button className="button dark"><FileCheck2 size={15} /> Submit for approval</button></div>
        </header>

        <section className="proposal-grid">
          <aside className="card section-nav">
            <p className="mono">Document sections</p>
            {sections.map((section, index) => <button className={index === 2 ? "section-link active-section" : "section-link"} key={section}>{String(index + 1).padStart(2, "0")} · {section}</button>)}
          </aside>

          <article className="document-surface">
            <p className="mono">03 · Proposed solution</p>
            <h2>A unified future-library experience</h2>
            <p>Armis proposes an integrated AI-enabled library ecosystem that combines enterprise knowledge access, bilingual conversational assistance, RFID automation, self-service and a coordinated robotics layer.</p>
            <h3>Experience layer</h3>
            <p>A single digital front door provides employees and visitors with search, discovery, recommendations, service requests and AI-powered guidance across Arabic and English.</p>
            <h3>Automation layer</h3>
            <p>RFID gates, kiosks and inventory capabilities are connected with autonomous service, delivery and material-handling robots to reduce repetitive work and improve operational visibility.</p>
            <h3>Intelligence layer</h3>
            <p>Microsoft SharePoint, Copilot and approved enterprise AI services provide grounded access to organizational content, while analytics show usage, demand, service performance and knowledge gaps.</p>
            <div className="proposal-callout"><strong>Customer outcome</strong><p>One coherent library journey rather than a collection of disconnected technologies.</p></div>
          </article>

          <aside className="stack">
            <article className="card"><div className="column-heading"><Layers3 size={18} /><h2>Coverage</h2></div><div className="coverage-row"><span>Verified requirements</span><strong>14 / 16</strong></div><div className="coverage-row"><span>Approved claims</span><strong>9 / 11</strong></div><div className="coverage-row"><span>Partner dependencies</span><strong>3</strong></div></article>
            <article className="card"><div className="column-heading"><AlertTriangle size={18} /><h2>Review queue</h2></div><div className="stack compact">{reviewItems.map((item) => <div className="review-item" key={item.title}><span className="chip red">Requires review</span><h3>{item.title}</h3><p>{item.body}</p><button className="button">{item.action}</button></div>)}</div></article>
            <article className="card"><div className="column-heading"><CheckCircle2 size={18} /><h2>Approvals</h2></div><p>Sales review complete</p><p>Technical review in progress</p><p>Commercial review not started</p></article>
          </aside>
        </section>
      </div>
    </main>
  );
}
