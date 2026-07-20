import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { listMeetings } from "@/lib/data/meetings";

export default async function MeetingsPage() {
  const meetings = await listMeetings();

  return (
    <main className="app-shell">
      <div className="container">
        <Link className="back-link mono" href="/"><ArrowLeft size={14} /> Control Center</Link>
        <header className="page-header">
          <div>
            <p className="mono">Meeting intelligence</p>
            <h1 className="page-title">All <span className="marker">Meetings</span></h1>
            <p className="subtitle">Every recorded meeting with structured intelligence and evidence.</p>
          </div>
        </header>

        {meetings.length === 0 ? (
          <div className="empty-state">
            <h2>No meetings yet</h2>
            <p>Connect Fireflies or add a meeting manually to see structured intelligence here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Opportunity</th><th>Started</th><th>Sentiment</th><th>Processed</th><th /></tr></thead>
              <tbody>
                {meetings.map((meeting) => (
                  <tr key={meeting.id}>
                    <td><strong>{meeting.title}</strong></td>
                    <td>{meeting.opportunityName ?? "—"}</td>
                    <td>{new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(meeting.startedAt))}</td>
                    <td>{meeting.sentiment ?? "—"}</td>
                    <td>{meeting.processed ? "Yes" : "Pending"}</td>
                    <td><Link className="icon-link" href={`/meetings/${meeting.id}`}><ArrowUpRight size={16} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
