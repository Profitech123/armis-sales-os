import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { listTenders } from "@/lib/data/tenders";

const statusTone: Record<string, string> = {
  draft: "",
  pending: "orange",
  approved: "green",
  changes_requested: "orange",
  rejected: "red",
};

export default async function TendersPage() {
  const tenders = await listTenders();

  return (
    <main className="app-shell">
      <div className="container">
        <Link className="back-link mono" href="/"><ArrowLeft size={14} /> Control Center</Link>
        <header className="page-header">
          <div>
            <p className="mono">Tender workspace</p>
            <h1 className="page-title">All <span className="marker">Tenders</span></h1>
            <p className="subtitle">Every tender in progress, with submission deadlines and status.</p>
          </div>
        </header>

        {tenders.length === 0 ? (
          <div className="empty-state">
            <h2>No tenders yet</h2>
            <p>Tenders will appear here once created against an account.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Account</th><th>Reference</th><th>Status</th><th>Due</th><th /></tr></thead>
              <tbody>
                {tenders.map((tender) => (
                  <tr key={tender.id}>
                    <td><strong>{tender.title}</strong></td>
                    <td>{tender.accountName ?? "—"}</td>
                    <td>{tender.reference ?? "—"}</td>
                    <td><span className={`chip ${statusTone[tender.status]}`}>{tender.status.replace("_", " ")}</span></td>
                    <td>{tender.dueAt ? new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short" }).format(new Date(tender.dueAt)) : "—"}</td>
                    <td><Link className="icon-link" href={`/tenders/${tender.id}`}><ArrowUpRight size={16} /></Link></td>
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
