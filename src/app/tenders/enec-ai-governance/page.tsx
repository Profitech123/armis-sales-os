import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckSquare2, Users } from "lucide-react";

const requirements = [
  ["R-001", "AI governance framework", "Mandatory", "Complete", "Elio", "—", "23 Jul"],
  ["R-002", "Security control mapping", "Mandatory", "Partial", "Technical", "Microsoft", "24 Jul"],
  ["R-003", "Reference architecture", "Mandatory", "Missing", "Solution Lead", "Microsoft", "24 Jul"],
  ["R-004", "Project methodology", "Mandatory", "Complete", "PMO", "—", "25 Jul"],
  ["R-005", "Commercial schedule", "Mandatory", "Blocked", "Commercial", "—", "27 Jul"],
];

const milestones = [
  ["Clarification deadline", "22 Jul", "2 days"],
  ["Technical review", "25 Jul", "5 days"],
  ["Commercial approval", "27 Jul", "7 days"],
  ["Final submission", "29 Jul", "9 days"],
];

export default function TenderWorkspacePage() {
  return (
    <main className="app-shell">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="mono">TENDER-ENEC-2026-001 · EOI AI-GOV-2026</p>
            <h1 className="page-title">ENEC <span className="marker">AI Governance</span></h1>
            <p className="subtitle">AI Governance and Security Services · Bid preparation · Submission due 29 July 2026.</p>
          </div>
          <div className="header-actions"><Link className="button" href="/pipeline">Pipeline</Link><button className="button dark">Open submission checklist</button></div>
        </header>

        <section className="intelligence compact-intelligence">
          <p className="mono">Submission readiness</p>
          <h2>The tender is due in <span className="highlight">9 days</span>. Six mandatory requirements remain incomplete, two require partner evidence and commercial approval has not started.</h2>
          <p>At the current completion rate, the submission is at risk. Resolve Microsoft evidence and start commercial approval within 48 hours.</p>
        </section>

        <section className="tender-grid">
          <div className="stack">
            <article className="card"><div className="column-heading"><CheckSquare2 size={18} /><h2>Compliance matrix</h2></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>Requirement</th><th>Type</th><th>Status</th><th>Owner</th><th>Partner</th><th>Due</th></tr></thead><tbody>{requirements.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === 3 ? <span className={`chip ${cell === "Complete" ? "green" : cell === "Partial" ? "orange" : "red"}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div></article>
            <div className="grid grid-3"><article className="card metric"><span className="mono">Completion</span><strong>64%</strong><p>19 of 30 requirements complete</p></article><article className="card metric"><span className="mono">Mandatory gaps</span><strong>6</strong><p>Three are currently high risk</p></article><article className="card metric"><span className="mono">Partner dependencies</span><strong>2</strong><p>Evidence still outstanding</p></article></div>
          </div>

          <aside className="stack">
            <article className="card"><div className="column-heading"><CalendarClock size={18} /><h2>Key deadlines</h2></div>{milestones.map(([name, date, remaining]) => <div className="deadline-row" key={name}><div><strong>{name}</strong><span>{date}</span></div><span className="chip orange">{remaining}</span></div>)}</article>
            <article className="card"><div className="column-heading"><Users size={18} /><h2>Ownership</h2></div><p><strong>Bid manager:</strong> Elio Berberi</p><p><strong>Technical:</strong> Solution Architecture</p><p><strong>Commercial:</strong> Finance & Sales Operations</p><p><strong>Partner:</strong> Microsoft UAE</p></article>
            <article className="card"><div className="column-heading"><AlertTriangle size={18} /><h2>Critical risks</h2></div><ul><li>Reference architecture evidence missing</li><li>Commercial approval has not started</li><li>Two clarification questions remain open</li></ul><button className="button dark">Escalate risks</button></article>
          </aside>
        </section>
      </div>
    </main>
  );
}
