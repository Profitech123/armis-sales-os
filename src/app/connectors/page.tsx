import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { listConnectorStatuses, type ConnectorStatus } from "@/lib/data/connectors";
import { ConnectorSetupAction } from "@/components/connector-setup-action";
import { requirePageActor } from "@/lib/auth/authorization";

function statusIcon(status: ConnectorStatus) {
  if (status === "connected") return <CheckCircle2 size={16} />;
  if (status === "degraded") return <AlertTriangle size={16} />;
  return <XCircle size={16} />;
}

function statusChipColor(status: ConnectorStatus) {
  if (status === "connected") return "green";
  if (status === "degraded") return "orange";
  return "red";
}

function statusLabel(status: ConnectorStatus) {
  if (status === "connected") return "Connected";
  if (status === "degraded") return "Degraded";
  if (status === "not_deployed") return "Not deployed";
  return "Not configured";
}

export default async function ConnectorsPage() {
  await requirePageActor(["admin"]);
  const { connectors, recentActivity } = await listConnectorStatuses({ includePrivilegedActivity: true });
  const connectedCount = connectors.filter((c) => c.status === "connected").length;
  const attentionCount = connectors.length - connectedCount;

  return (
    <main className="app-shell">
      <div className="container">
        <Link className="back-link mono" href="/"><ArrowLeft size={14} /> Control Center</Link>
        <header className="header-grid compact-header">
          <div>
            <p className="mono">Integration health</p>
            <h1 className="title">Connectors <span className="marker">Dashboard</span></h1>
            <p className="subtitle">Every API and integration the platform depends on, and whether it&apos;s configured, connected, or needs attention.</p>
          </div>
          <aside className="sync-panel mono">
            <p>{connectors.length} connectors tracked</p>
            <p>{connectedCount} connected</p>
            <p>{attentionCount} need attention</p>
          </aside>
        </header>

        <section>
          <div className="section-title"><span className="mono">01</span><h2>Overview</h2></div>
          <div className="grid grid-3">
            <article className="card metric">
              <p className="mono">Connected</p>
              <strong>{connectedCount}</strong>
              <p>Fully configured and responding.</p>
            </article>
            <article className="card metric">
              <p className="mono">Needs attention</p>
              <strong>{attentionCount}</strong>
              <p>Missing credentials or degraded.</p>
            </article>
            <article className="card metric">
              <p className="mono">Categories</p>
              <strong>{new Set(connectors.map((c) => c.category)).size}</strong>
              <p>Data, AI, automation, enrichment and infra.</p>
            </article>
          </div>
        </section>

        <section>
          <div className="section-title"><span className="mono">02</span><h2>Connectors</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Connector</th><th>Category</th><th>Status</th><th>Last activity</th><th>Required</th><th>Setup</th></tr>
              </thead>
              <tbody>
                {connectors.map((connector) => (
                  <tr key={connector.id}>
                    <td><strong>{connector.label}</strong><div>{connector.description}</div></td>
                    <td>{connector.category}</td>
                    <td>
                      <div className="chips">
                        <span className={`chip ${statusChipColor(connector.status)}`}>
                          {statusIcon(connector.status)} {statusLabel(connector.status)}
                        </span>
                      </div>
                    </td>
                    <td>{connector.lastActivityAt ? new Date(connector.lastActivityAt).toLocaleString() : "—"}</td>
                    <td className="mono">{connector.requiredEnvVars.join(", ") || "—"}</td>
                    <td>
                      {!connector.configured && connector.requiredEnvVars.length > 0 ? (
                        <ConnectorSetupAction envVars={connector.requiredEnvVars} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="section-title"><span className="mono">03</span><h2>Recent activity</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Provider</th><th>Event</th><th>Status</th><th>Occurred</th></tr>
              </thead>
              <tbody>
                {recentActivity.length === 0 && (
                  <tr><td colSpan={4}>No recent webhook or automation activity.</td></tr>
                )}
                {recentActivity.map((event, index) => (
                  <tr key={`${event.provider}-${event.occurredAt}-${index}`}>
                    <td>{event.provider}</td>
                    <td>{event.label}</td>
                    <td>{event.status}</td>
                    <td>{new Date(event.occurredAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
