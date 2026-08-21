import { spawn } from "node:child_process";
import process from "node:process";

const port = 4199;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: { ...process.env, CRON_SECRET: "local-e2e-secret", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const response = await fetch(`${origin}/sign-in`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next.js server did not become ready");
}

function assert(condition, message) { if (!condition) throw new Error(message); }

try {
  await waitForServer();
  const protectedPage = await fetch(`${origin}/pipeline`, { redirect: "manual" });
  assert([307, 308].includes(protectedPage.status), `expected pipeline redirect, received ${protectedPage.status}`);
  assert(protectedPage.headers.get("location")?.includes("/sign-in"), "pipeline did not redirect to sign-in");

  const publicSignIn = await fetch(`${origin}/sign-in`);
  assert(publicSignIn.status === 200, `expected sign-in 200, received ${publicSignIn.status}`);

  const protectedApi = await fetch(`${origin}/api/opportunities`);
  assert(protectedApi.status === 503, `expected unconfigured API 503, received ${protectedApi.status}`);

  const unauthorizedHealth = await fetch(`${origin}/api/health`);
  assert(unauthorizedHealth.status === 401, `expected health 401, received ${unauthorizedHealth.status}`);

  const configuredHealth = await fetch(`${origin}/api/health`, { headers: { authorization: "Bearer local-e2e-secret" } });
  assert(configuredHealth.status === 503, `expected database-unconfigured health 503, received ${configuredHealth.status}`);
  process.stdout.write("E2E smoke checks passed\n");
} finally {
  server.kill("SIGTERM");
}
