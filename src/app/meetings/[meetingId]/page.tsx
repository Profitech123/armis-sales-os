import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { getMeeting } from "@/lib/data/meetings";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";

const insightLabels: Record<string, string> = {
  summary: "Executive summary",
  buying_signal: "Buying signal",
  risk: "Risk",
  objection: "Objection",
  commitment: "Commitment",
  decision: "Decision",
};

export default async function MeetingWorkspacePage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;

  let meeting;
  try {
    meeting = await getMeeting(meetingId);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return (
        <main className="app-shell">
          <div className="container">
            <Link className="back-link mono" href="/meetings"><ArrowLeft size={14} /> Meetings</Link>
            <div className="empty-state">
              <h2>Supabase is not configured</h2>
              <p>Connect a Supabase project to view live meeting intelligence.</p>
            </div>
          </div>
        </main>
      );
    }
    throw error;
  }

  if (!meeting) notFound();

  return (
    <main className="app-shell">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="mono">Meeting intelligence · {new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(meeting.startedAt))}</p>
            <h1 className="page-title">{meeting.title}</h1>
            {meeting.sentiment && <p className="subtitle">Sentiment: {meeting.sentiment}</p>}
          </div>
          <div className="header-actions">
            <Link className="button" href="/meetings">All meetings</Link>
            {meeting.opportunityId && <Link className="button dark" href={`/deals/${meeting.opportunityId}`}>Open deal</Link>}
          </div>
        </header>

        <section className="meeting-grid">
          <article className="card transcript-panel">
            <div className="column-heading"><FileText size={18} /><h2>Transcript</h2></div>
            {meeting.transcript ? <p>{meeting.transcript}</p> : <p>No transcript available yet.</p>}
          </article>

          <article className="card intelligence-panel-light">
            <div className="column-heading"><Sparkles size={18} /><h2>Structured intelligence</h2></div>
            {meeting.summary && <div className="insight-block"><span className="mono">Summary</span><p>{meeting.summary}</p></div>}
            {meeting.insights.length === 0 ? (
              <p>No structured insights recorded for this meeting.</p>
            ) : (
              meeting.insights.map((insight) => (
                <div className="insight-block" key={insight.id}>
                  <span className="mono">{insightLabels[insight.kind] ?? insight.kind}</span>
                  <p>{insight.content}</p>
                  {insight.evidenceQuote && <p><em>&ldquo;{insight.evidenceQuote}&rdquo;</em></p>}
                </div>
              ))
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
