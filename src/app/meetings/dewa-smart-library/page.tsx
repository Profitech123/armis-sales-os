import Link from "next/link";
import { CheckCircle2, FileText, Quote, Sparkles, Target } from "lucide-react";

const transcript = [
  ["10:04", "Hend", "We want one concept that brings together the digital library, AI assistance, RFID automation and the robotics layer."],
  ["10:11", "Elio", "We can structure the concept around a unified software platform and clearly assign responsibilities across Armis, Profitech and the technology vendors."],
  ["10:18", "Hend", "The important point is that this should not look like separate products. It needs to feel like one future library experience."],
  ["10:27", "Hend", "Please send the revised concept with the vendor shortlist and the Microsoft architecture included."],
];

const actions = [
  "Consolidate software and robotics scope into one customer narrative.",
  "Confirm Microsoft Copilot and SharePoint reference architecture.",
  "Assign partner responsibilities for RFID, robotics and automated storage.",
  "Submit revised concept proposal by 22 July.",
];

export default function MeetingWorkspacePage() {
  return (
    <main className="app-shell">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="mono">Meeting intelligence · 20 Jul 2026 · 10:00 GST</p>
            <h1 className="page-title">DEWA <span className="marker">Smart Library</span></h1>
            <p className="subtitle">Discovery and proposal alignment meeting · Hend Al Ali and Armis sales team.</p>
          </div>
          <div className="header-actions">
            <Link className="button" href="/deals/dewa-smart-library">Open deal</Link>
            <button className="button dark"><CheckCircle2 size={15} /> Approve summary</button>
          </div>
        </header>

        <section className="meeting-grid">
          <article className="card transcript-panel">
            <div className="column-heading"><FileText size={18} /><h2>Transcript & evidence</h2></div>
            <div className="transcript-list">
              {transcript.map(([time, speaker, text]) => (
                <div className="transcript-row" key={time}>
                  <span className="mono">{time}</span>
                  <div><strong>{speaker}</strong><p>{text}</p></div>
                </div>
              ))}
            </div>
          </article>

          <article className="card intelligence-panel-light">
            <div className="column-heading"><Sparkles size={18} /><h2>Structured intelligence</h2></div>
            <div className="insight-block"><span className="mono">Executive summary</span><p>DEWA wants a single future-library proposition combining AI knowledge services, RFID, self-service and robotics. The revised concept must present one integrated experience rather than a collection of products.</p></div>
            <div className="insight-block"><span className="mono">Customer objectives</span><ul><li>Unified visitor and employee experience</li><li>Arabic and English AI assistance</li><li>Automated inventory, sorting and delivery</li></ul></div>
            <div className="insight-block"><span className="mono">Buying signal</span><p>The customer explicitly requested a revised proposal and vendor shortlist.</p><button className="text-link"><Quote size={13} /> View evidence at 10:27</button></div>
            <div className="insight-block"><span className="mono">Open question</span><p>Commercial ownership and integration responsibility across Armis, Profitech and vendors remain unclear.</p></div>
          </article>

          <aside className="card action-panel">
            <div className="column-heading"><Target size={18} /><h2>Recommended actions</h2></div>
            <div className="stack compact">
              {actions.map((action, index) => (
                <div className="action-item" key={action}>
                  <span className="number-stamp">0{index + 1}</span>
                  <p>{action}</p>
                  <button className="button">Approve</button>
                </div>
              ))}
            </div>
            <div className="score-card">
              <span className="mono">Call score</span>
              <strong>82 / 100</strong>
              <p>Strong discovery and next-step confirmation. Improve commercial qualification and stakeholder mapping.</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
