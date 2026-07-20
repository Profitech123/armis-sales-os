import Link from "next/link";
import { ArrowLeft, CalendarDays, CircleAlert, FileText, Users } from "lucide-react";

const requirements = ["AI librarian in Arabic and English", "RFID self-service and inventory automation", "Robotics for reception, delivery and material handling", "Management analytics and knowledge insights"];
const risks = [
  { title: "Proposal milestone overdue", text: "The revised concept was expected two days ago.", tone: "red" },
  { title: "Architecture input pending", text: "Microsoft reference architecture has not been confirmed.", tone: "orange" },
  { title: "Partner responsibilities unclear", text: "Software and robotics delivery boundaries require approval.", tone: "yellow" }
];

export default function DealPage() {
  return <main className="app-shell"><div className="container">
    <Link className="back-link mono" href="/pipeline"><ArrowLeft size={14}/> Pipeline</Link>
    <header className="deal-header">
      <div><p className="mono">DEAL-DEWA-2026-001 · Strategic · Owner: Elio Berberi</p><h1 className="title">DEWA <span className="marker">AI Smart Library</span></h1><p className="subtitle">AED 2.5M · 50% probability · Proposal preparation · Expected close 30 Nov 2026</p></div>
      <div className="score-card"><span className="mono">Opportunity health</span><strong>64</strong><span>/100 · Medium risk</span></div>
    </header>

    <section className="intelligence"><p className="mono">Current opportunity reading</p><h2>DEWA is seeking a unified software and robotics concept for the future library.</h2><p>The opportunity is strategically aligned, but progress depends on consolidating partner scope, confirming the Microsoft architecture and submitting the revised concept.</p><div className="card-actions"><button className="button">Review proposal</button><button className="button">Draft customer update</button><button className="button">View evidence</button></div></section>

    <div className="workspace-grid">
      <div className="workspace-main">
        <section><div className="section-title"><span className="mono">01</span><h2>Verified customer requirements</h2></div><div className="stack">{requirements.map((item,i)=><article className="card row-card" key={item}><span className="number">0{i+1}</span><p>{item}</p><span className="chip green">CONFIRMED</span></article>)}</div></section>
        <section><div className="section-title"><span className="mono">02</span><h2>Risk register</h2></div><div className="grid grid-3">{risks.map(r=><article className="card" key={r.title}><span className={`chip ${r.tone}`}>ATTENTION</span><h3>{r.title}</h3><p>{r.text}</p></article>)}</div></section>
        <section><div className="section-title"><span className="mono">03</span><h2>Recent momentum</h2></div><div className="timeline"><div><span>20 JUL</span><p>Customer requirements consolidated from latest meeting.</p></div><div><span>18 JUL</span><p>Robotics vendor shortlist completed.</p></div><div><span>15 JUL</span><p>Microsoft architecture input requested.</p></div></div></section>
      </div>
      <aside className="right-rail">
        <article className="card"><p className="mono">Next step</p><h3>Submit revised concept proposal</h3><p>Due 24 Jul 2026</p><button className="button dark">Open action</button></article>
        <article className="card"><p className="mono">Stakeholders</p><p><Users size={16}/> Hend Al Ali · Initiative owner</p><p><Users size={16}/> Microsoft · Architecture partner</p></article>
        <article className="card"><p className="mono">Commercial status</p><p><FileText size={16}/> Proposal in internal review</p><p><CalendarDays size={16}/> Follow-up overdue</p><p><CircleAlert size={16}/> 2 unresolved dependencies</p></article>
      </aside>
    </div>
  </div></main>;
}
