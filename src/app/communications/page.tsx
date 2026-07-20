import Link from "next/link";
import { ArrowUpRight, Clock3, Mail, MessageSquareReply, ShieldAlert } from "lucide-react";

const needsReply = [
  {
    account: "Microsoft / DEWA",
    subject: "Architecture input required for proposal",
    age: "2 days old",
    body: "Microsoft has not yet confirmed the Copilot and SharePoint reference architecture. The revised customer proposal cannot be finalized without it.",
    action: "Escalate internally and request confirmation by 14:00 today.",
    tone: "red",
  },
  {
    account: "Emirates Group",
    subject: "Entra modernization workshop dates",
    age: "6 hours old",
    body: "The identity team requested two options for the technical workshop and a concise list of pre-read items.",
    action: "Send two workshop options and the pre-read checklist.",
    tone: "orange",
  },
];

const urgent = [
  {
    account: "DEWA",
    subject: "Smart Library proposal milestone overdue",
    age: "2 days overdue",
    body: "The concept proposal remains in internal review while the customer is expecting consolidated software and robotics scope.",
    action: "Resolve scope ownership and submit the revised version today.",
    tone: "red",
  },
  {
    account: "ENEC",
    subject: "Tender clarification deadline approaching",
    age: "48 hours remaining",
    body: "Two clarification questions remain open around certification evidence and delivery responsibility.",
    action: "Confirm partner evidence and submit clarification questions.",
    tone: "orange",
  },
];

const waiting = [
  {
    account: "Aldar",
    subject: "Business case feedback",
    age: "Waiting 5 days",
    body: "The client is reviewing the AI adoption and identity governance business case. No response has been recorded since submission.",
    action: "Follow up with the sponsor and confirm next review meeting.",
    tone: "blue",
  },
  {
    account: "AD Ports",
    subject: "Copilot Studio stakeholder list",
    age: "Waiting 3 days",
    body: "The account team is waiting for the confirmed business stakeholders before preparing the discovery brief.",
    action: "Request the stakeholder list and proposed meeting window.",
    tone: "green",
  },
];

function QueueCard({ item }: { item: (typeof needsReply)[number] }) {
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
        <button className="button dark">Open context <ArrowUpRight size={14} /></button>
        <button className="button"><MessageSquareReply size={14} /> Draft reply</button>
        <button className="button"><ShieldAlert size={14} /> Escalate</button>
      </div>
    </article>
  );
}

export default function CommunicationsPage() {
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
            <button className="button dark"><Mail size={15} /> Compose</button>
          </div>
        </header>

        <section className="metric-strip">
          <div><span className="mono">Needs reply</span><strong>7</strong></div>
          <div><span className="mono">Urgent</span><strong>3</strong></div>
          <div><span className="mono">Waiting</span><strong>6</strong></div>
          <div><span className="mono">Oldest open item</span><strong>5d</strong></div>
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
