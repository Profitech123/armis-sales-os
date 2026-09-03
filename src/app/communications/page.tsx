import Link from "next/link";
import { ArrowUpRight, Clock3, Mail, MessageSquareReply, ShieldAlert } from "lucide-react";
import { listCommunications, type CommunicationItem } from "@/lib/data/communications";
import { requirePageActor } from "@/lib/auth/authorization";

function QueueCard({ item }: { item: CommunicationItem }) {
  return (
    <article className="card queue-card">
      <div className="chips">
        <span className={`chip ${item.tone}`}>{item.age}</span>
        <span className="chip">Needs action</span>
      </div>
      <p className="mono">{item.account}</p>
      <h3>{item.subject}</h3>
      <p>{item.body}</p>
      <p><strong>Recommended:</strong> {item.action}</p>
      <div className="card-actions">
        <button className="button dark" type="button" disabled aria-disabled="true">Open context <ArrowUpRight size={14} /></button>
        <button className="button" type="button" disabled aria-disabled="true"><MessageSquareReply size={14} /> Draft reply</button>
        <button className="button" type="button" disabled aria-disabled="true"><ShieldAlert size={14} /> Escalate</button>
      </div>
    </article>
  );
}

function ageInHours(age: string): number {
  const match = age.match(/(\d+)\s*(day|hour)/i);
  if (!match) return 0;
  const value = Number(match[1]);
  return match[2].toLowerCase() === "day" ? value * 24 : value;
}

function oldestOpenItemLabel(items: CommunicationItem[]): string {
  if (items.length === 0) return "—";
  const hours = Math.max(...items.map((item) => ageInHours(item.age)));
  return hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`;
}

export default async function CommunicationsPage() {
  await requirePageActor();
  const { needsReply, urgent, waiting } = await listCommunications();
  const oldest = oldestOpenItemLabel([...needsReply, ...urgent, ...waiting]);

  return (
    <main className="app-shell">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="mono">Operational workspace · Communications</p>
            <h1 className="page-title">Action <span className="marker">Queue</span></h1>
            <p className="subtitle">Customer, partner and internal communications ranked by urgency, business impact and commitment risk.</p>
          </div>
          <div className="header-actions">
            <Link className="button" href="/">Today</Link>
            <Link className="button" href="/pipeline">Pipeline</Link>
            <button className="button dark" type="button" disabled aria-disabled="true"><Mail size={15} /> Compose</button>
          </div>
        </header>

        <section className="metric-strip">
          <div><span className="mono">Needs reply</span><strong>{needsReply.length}</strong></div>
          <div><span className="mono">Urgent</span><strong>{urgent.length}</strong></div>
          <div><span className="mono">Waiting</span><strong>{waiting.length}</strong></div>
          <div><span className="mono">Oldest open item</span><strong>{oldest}</strong></div>
        </section>

        <section className="queue-grid">
          <div>
            <div className="column-heading"><MessageSquareReply size={18} /><h2>Needs reply</h2></div>
            <div className="stack">{needsReply.map((item) => <QueueCard item={item} key={item.subject} />)}</div>
          </div>
          <div>
            <div className="column-heading"><ShieldAlert size={18} /><h2>Urgent</h2></div>
            <div className="stack">{urgent.map((item) => <QueueCard item={item} key={item.subject} />)}</div>
          </div>
          <div>
            <div className="column-heading"><Clock3 size={18} /><h2>Waiting</h2></div>
            <div className="stack">{waiting.map((item) => <QueueCard item={item} key={item.subject} />)}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
