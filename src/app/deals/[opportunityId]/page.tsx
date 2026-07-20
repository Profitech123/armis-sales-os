import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getOpportunity } from "@/lib/data/opportunities";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";

export default async function DealPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = await params;

  let deal;
  try {
    deal = await getOpportunity(opportunityId);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return (
        <main className="app-shell">
          <div className="container">
            <Link className="back-link mono" href="/pipeline"><ArrowLeft size={14} /> Pipeline</Link>
            <div className="empty-state">
              <h2>Supabase is not configured</h2>
              <p>Connect a Supabase project to view live opportunity data.</p>
            </div>
          </div>
        </main>
      );
    }
    throw error;
  }

  if (!deal) notFound();

  return (
    <main className="app-shell">
      <div className="container">
        <Link className="back-link mono" href="/pipeline"><ArrowLeft size={14} /> Pipeline</Link>
        <header className="deal-header">
          <div>
            <p className="mono">{deal.account} · Owner: {deal.owner}</p>
            <h1 className="title">{deal.account} <span className="marker">{deal.opportunity}</span></h1>
            <p className="subtitle">{deal.value} · {deal.probability}% probability · {deal.stage} · Expected close {deal.closeDate}</p>
          </div>
          <div className="score-card"><span className="mono">Opportunity health</span><strong>{deal.health}</strong><span>/100</span></div>
        </header>

        <section className="intelligence"><p className="mono">Next step</p><h2>{deal.nextStep}</h2>{deal.attention && <p>Flagged: {deal.attention}</p>}</section>

        <div className="workspace-grid">
          <div className="workspace-main">
            <section>
              <div className="section-title"><span className="mono">01</span><h2>Related meetings</h2></div>
              {deal.meetings.length === 0 ? (
                <div className="empty-state"><h2>No meetings recorded</h2><p>Meetings linked to this opportunity will appear here.</p></div>
              ) : (
                <div className="stack">
                  {deal.meetings.map((meeting) => (
                    <Link className="card row-card" href={`/meetings/${meeting.id}`} key={meeting.id}>
                      <span className="number" />
                      <p>{meeting.title}</p>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section>
              <div className="section-title"><span className="mono">02</span><h2>Related proposals</h2></div>
              {deal.proposals.length === 0 ? (
                <div className="empty-state"><h2>No proposals yet</h2><p>Proposals created against this opportunity will appear here.</p></div>
              ) : (
                <div className="stack">
                  {deal.proposals.map((proposal) => (
                    <Link className="card row-card" href={`/proposals/${proposal.id}`} key={proposal.id}>
                      <span className="number" />
                      <p>{proposal.title} · v{proposal.version} · {proposal.status.replace("_", " ")}</p>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
