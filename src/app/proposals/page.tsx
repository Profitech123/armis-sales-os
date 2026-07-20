import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { listProposals } from "@/lib/data/proposals";

const statusTone: Record<string, string> = {
  draft: "",
  pending: "orange",
  approved: "green",
  changes_requested: "orange",
  rejected: "red",
};

export default async function ProposalsPage() {
  const proposals = await listProposals();

  return (
    <main className="app-shell">
      <div className="container">
        <Link className="back-link mono" href="/"><ArrowLeft size={14} /> Control Center</Link>
        <header className="page-header">
          <div>
            <p className="mono">Proposal workspace</p>
            <h1 className="page-title">All <span className="marker">Proposals</span></h1>
            <p className="subtitle">Every proposal in flight, with version and approval status.</p>
          </div>
        </header>

        {proposals.length === 0 ? (
          <div className="empty-state">
            <h2>No proposals yet</h2>
            <p>Proposals will appear here once created against an opportunity.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Opportunity</th><th>Version</th><th>Status</th><th>Submitted</th><th /></tr></thead>
              <tbody>
                {proposals.map((proposal) => (
                  <tr key={proposal.id}>
                    <td><strong>{proposal.title}</strong></td>
                    <td>{proposal.opportunityName ?? "—"}</td>
                    <td>v{proposal.version}</td>
                    <td><span className={`chip ${statusTone[proposal.status]}`}>{proposal.status.replace("_", " ")}</span></td>
                    <td>{proposal.submittedAt ? new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short" }).format(new Date(proposal.submittedAt)) : "—"}</td>
                    <td><Link className="icon-link" href={`/proposals/${proposal.id}`}><ArrowUpRight size={16} /></Link></td>
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
