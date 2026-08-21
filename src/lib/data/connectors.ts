import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { connectorRegistry, type ConnectorDefinition } from "@/lib/integrations/registry";

export type ConnectorStatus = "connected" | "degraded" | "not_configured" | "not_deployed";

export type ConnectorSummary = ConnectorDefinition & {
  configured: boolean;
  status: ConnectorStatus;
  lastActivityAt: string | null;
};

export type ActivityEvent = {
  provider: string;
  label: string;
  status: string;
  occurredAt: string;
};

export type ConnectorsOverview = {
  connectors: ConnectorSummary[];
  recentActivity: ActivityEvent[];
};

function envConfigured(vars: string[]) {
  return vars.every((name) => Boolean(process.env[name]));
}

export async function listConnectorStatuses(options: { includePrivilegedActivity?: boolean } = {}): Promise<ConnectorsOverview> {
  const supabase = await createSupabaseServerClient();
  const admin = options.includePrivilegedActivity ? createSupabaseAdminClient() : null;

  const connectionRows = new Map<string, { status: string; last_synced_at: string | null }>();
  if (supabase) {
    const { data } = await supabase.from("integration_connections").select("provider,status,last_synced_at");
    for (const row of data ?? []) connectionRows.set(row.provider as string, row);
  }

  let latestAutomationRun: { workflow_name: string; status: string; started_at: string } | null = null;
  const automationActivity: ActivityEvent[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("automation_runs")
      .select("workflow_name,status,started_at")
      .order("started_at", { ascending: false })
      .limit(10);
    for (const row of data ?? []) {
      automationActivity.push({ provider: "n8n", label: row.workflow_name, status: row.status, occurredAt: row.started_at });
    }
    latestAutomationRun = data?.[0] ?? null;
  }

  const webhookActivity: ActivityEvent[] = [];
  if (admin) {
    const { data } = await admin
      .from("webhook_events")
      .select("provider,event_type,status,received_at")
      .order("received_at", { ascending: false })
      .limit(10);
    for (const row of data ?? []) {
      webhookActivity.push({ provider: row.provider, label: row.event_type, status: row.status, occurredAt: row.received_at });
    }
  }

  let supabasePing: ConnectorStatus = "not_configured";
  if (supabase) {
    const { error } = await supabase.from("opportunities").select("id", { head: true, count: "exact" }).limit(1);
    supabasePing = error ? "degraded" : "connected";
  }

  const connectors: ConnectorSummary[] = connectorRegistry.map((definition) => {
    const configured = envConfigured(definition.requiredEnvVars);
    const connectionRow = connectionRows.get(definition.id);

    let status: ConnectorStatus;
    let lastActivityAt: string | null = null;

    if (definition.id === "supabase") {
      status = supabasePing;
    } else if (definition.id === "vercel") {
      status = process.env.VERCEL ? "connected" : "not_deployed";
    } else if (definition.id === "n8n") {
      status = configured ? "connected" : "not_configured";
      lastActivityAt = latestAutomationRun?.started_at ?? null;
    } else if (connectionRow) {
      status = configured
        ? connectionRow.status === "connected"
          ? "connected"
          : "degraded"
        : "not_configured";
      lastActivityAt = connectionRow.last_synced_at;
    } else {
      status = configured ? "connected" : "not_configured";
    }

    return { ...definition, configured, status, lastActivityAt };
  });

  const recentActivity = [...webhookActivity, ...automationActivity]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 10);

  return { connectors, recentActivity };
}
