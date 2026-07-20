import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProposal } from "@/lib/data/proposals";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";

const statusTone: Record<string, string> = {
  draft: "",
  pending: "orange",
  approved: "green",
  changes_requested: "orange",
  rejected: "red",
};

export default async function ProposalWorkspacePage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;

  let proposal;
  try {
    proposal = await getProposal(proposalId);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return (
        <main className="app-shell">
          <div className="container">
            <Link className="back-link mono" href="/proposals"><ArrowLeft size={14} /> Proposals</Link>
            <div className="empty-state">
              <h2>Supabase is not configured</h2>
              <p>Connect a Supabase project to view live proposal content.</p>
            </div>
          </div>
        </main>
      );
    }
    throw error;
  }

  if (!proposal) notFound();

  return (
    <main className="app-shell">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="mono">{proposal.title} · Version {proposal.version}</p>
            <h1 className="page-title">{proposal.opportunityName ?? proposal.title}</h1>
            <div className="chips"><span className={`chip ${statusTone[proposal.status]}`}>{proposal.status.replace("_", " ")}</span></div>
          </div>
          <div className="header-actions">
            <Link className="button" href="/proposals">All proposals</Link>
            <Link className="button dark" href={`/deals/${proposal.opportunityId}`}>Open deal</Link>
          </div>
        </header>

        <section className="proposal-grid">
          <aside className="card section-nav">
            <p className="mono">Document sections</p>
            {proposal.content.sections.map((section, index) => (
              <a className="section-link" href={`#section-${index}`} key={section.title}>{String(index + 1).padStart(2, "0")} · {section.title}</a>
            ))}
          </aside>

          <article className="document-surface">
            {proposal.content.sections.length === 0 ? (
              <p>No document content recorded for this proposal yet.</p>
            ) : (
              proposal.content.sections.map((section, index) => (
                <div id={`section-${index}`} key={section.title}>
                  <p className="mono">{String(index + 1).padStart(2, "0")} · {section.title}</p>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </div>
              ))
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
