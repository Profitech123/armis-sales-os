import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckSquare2 } from "lucide-react";
import { getTender } from "@/lib/data/tenders";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";

const statusTone: Record<string, string> = {
  draft: "",
  pending: "orange",
  approved: "green",
  changes_requested: "orange",
  rejected: "red",
};

const requirementTone: Record<string, string> = {
  Complete: "green",
  Partial: "orange",
  Missing: "red",
  Blocked: "red",
};

export default async function TenderWorkspacePage({ params }: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await params;

  let tender;
  try {
    tender = await getTender(tenderId);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return (
        <main className="app-shell">
          <div className="container">
            <Link className="back-link mono" href="/tenders"><ArrowLeft size={14} /> Tenders</Link>
            <div className="empty-state">
              <h2>Supabase is not configured</h2>
              <p>Connect a Supabase project to view live tender compliance data.</p>
            </div>
          </div>
        </main>
      );
    }
    throw error;
  }

  if (!tender) notFound();

  return (
    <main className="app-shell">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="mono">{tender.reference ?? tender.title}</p>
            <h1 className="page-title">{tender.accountName ?? "—"} <span className="marker">{tender.title}</span></h1>
            <div className="chips"><span className={`chip ${statusTone[tender.status]}`}>{tender.status.replace("_", " ")}</span></div>
          </div>
          <div className="header-actions"><Link className="button" href="/tenders">All tenders</Link></div>
        </header>

        <section className="tender-grid">
          <div className="stack">
            <article className="card">
              <div className="column-heading"><CheckSquare2 size={18} /><h2>Compliance matrix</h2></div>
              {tender.requirements.length === 0 ? (
                <p>No requirements recorded for this tender yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>ID</th><th>Requirement</th><th>Type</th><th>Status</th><th>Owner</th><th>Partner</th><th>Due</th></tr></thead>
                    <tbody>
                      {tender.requirements.map((req) => (
                        <tr key={req.id}>
                          <td>{req.id}</td>
                          <td>{req.requirement}</td>
                          <td>{req.type}</td>
                          <td><span className={`chip ${requirementTone[req.status] ?? ""}`}>{req.status}</span></td>
                          <td>{req.owner}</td>
                          <td>{req.partner ?? "—"}</td>
                          <td>{req.dueDate ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
