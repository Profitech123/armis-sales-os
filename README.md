# Armis Sales OS

AI-powered sales intelligence control center for Armis Middle East.

The application now includes a production-ready backend contract while retaining mock-data fallback for credential-free local development.

## Included

- Next.js 15 App Router
- TypeScript strict mode
- Tailwind CSS 4
- Editorial design system inspired by the approved references
- Today control center
- Operating metrics
- Priority action queue
- Active pipeline table
- Shared application navigation
- Supabase schema with row-level security
- Microsoft Entra ID sign-in through Supabase Auth
- Authenticated opportunity CRUD API
- Meeting intelligence, approvals, integrations, automation and audit data models
- Disabled-by-default Fireflies-to-n8n webhook ingress and a production health endpoint
- Disabled-by-default transcript analysis with signed webhook validation
- Connectors dashboard (`/connectors`) showing live status for every integration
- Realistic mock-data fallback when Supabase is not configured
- Production route authentication with fail-closed configuration checks
- Repository-backed accounts, contacts, opportunities, activities, follow-ups, and permission-aware search
- Server-controlled seller, manager, approver, and admin roles with admin-only connector/user administration
- Development-only mock safeguards, structured server logs, and automated security/authorization checks
- Internal GTM prompt builder with approval-gated Explee/n8n dispatch and a synthetic lead review queue

## Run locally

```bash
git clone https://github.com/Profitech123/armis-sales-os.git
cd armis-sales-os
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

## Build verification

```bash
npm run typecheck
npm run build
```

## Data and authentication setup

The application falls back to mock opportunities when Supabase is not configured. For real data:

```bash
cp .env.example .env.local
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. In Supabase Auth, enable Azure, configure the Entra client ID/secret, and use the tenant URL required by your organization. Add `https://<your-domain>/auth/callback` to the allowed redirect URLs. Disable public signup, anonymous authentication, and every unapproved provider. Before a user signs in, an administrator must add the normalized work email and assigned role to `approved_identities`; the database trigger rejects every identity not on that active allowlist.

Authenticated CRUD endpoints:

- `GET|POST /api/opportunities`
- `PATCH|DELETE /api/opportunities/:id`

Production monitoring probes `GET /api/health`. The Fireflies placeholder accepts at most 256 KiB at `POST /api/webhooks/fireflies`. Machine clients must send `x-armis-webhook-id`, a Unix-seconds `x-armis-webhook-timestamp`, and `x-armis-webhook-signature: sha256=<hex>`, where the HMAC input is `<timestamp>.<event-id>.<raw-body>` and the key is `FIREFLIES_WEBHOOK_SECRET`. Requests outside the five-minute replay window, repeated identifiers, invalid signatures, and excessive rates are rejected. `FIREFLIES_FORWARDING_ENABLED=false` and `AI_TRANSCRIPT_ANALYSIS_ENABLED=false` keep forwarding and analysis disabled for Phase 0.

## Deployment

Connect `Profitech123/armis-sales-os` from the Vercel project’s Settings → Git page, set `main` as the production branch, and configure all production environment variables from `.env.example`. The repository’s `vercel.json` pins the Dubai region and configures a 15-minute health cron.

## Remaining production activation

1. Apply all migrations to an isolated database and run live role-by-role RLS tests before staging promotion.
2. Configure only the approved single-tenant Entra authentication path and provision the first approved administrator through a controlled database procedure.
3. Confirm automated backups, retention, point-in-time recovery availability, RPO/RTO, and complete a synthetic-data restore drill.
4. Connect structured logs to staging error tracking and alerting, add request correlation, and verify a synthetic degraded-health alert reaches an operator.
5. Keep CRM sync, Fireflies forwarding, transcript AI, communications, proposals, tenders, forecasting, notifications, and later-phase workflows disabled.

Phase 0 deliberately leaves CRM sync, webhook forwarding, and AI disabled until the sales team approves the relevant business and data-handling rules. Approval records are read-only for staging. The first administrator must be approved and provisioned through a controlled database procedure; subsequent role changes use one locked database transaction that blocks self-modification and last-admin removal and inserts the audit record atomically.

## GTM lead discovery

`/gtm` implements the Vibe Prospecting-style workflow internally without connecting to Vibe Prospecting. Sellers enter the product or service, industry, geography, company profile, buyer roles, pain points, exclusions, and lead quantity. Sales OS creates a structured ICP and search prompt locally, then requires explicit approval before dispatch.

`EXPLEE_AUTOGTM_ENABLED=false` keeps both the outbound n8n handoff and inbound Explee result ingestion unavailable by default. When a later staging approval enables it, Sales OS sends only the approved structured brief to `N8N_EXPLEE_GTM_WEBHOOK_URL`; n8n owns the provider-specific Explee mapping and credentials. Results return through a signed normalized payload to `/api/webhooks/explee`, where they are validated, deduplicated, scored, and placed in `gtm_lead_candidates`. They never create accounts, contacts, or opportunities automatically.

Synthetic mode creates fictional `example.com` candidates to exercise review safely. Candidate approval only marks a lead as eligible for a future, separately approved import. `GTM_PROMPT_AI_ENABLED=false` reserves the future AI conversion path; the current structured brief is generated deterministically and sends no prompt or internal data to an AI provider.

## Open release gates

- `npm audit` reports three high transitive vulnerabilities in the Next.js-bundled PostCSS and Sharp versions. npm currently proposes Next.js 16 as the automatic remediation, so resolution requires a separately tested major-upgrade path or documented, time-limited security risk acceptance.
- Migration syntax, upgrade behavior, RLS enforcement, Data API grants, the role-change transaction, and approved-identity provisioning require validation against an isolated Supabase/Postgres environment. Static contract tests do not replace live database tests.
- The in-process webhook replay cache and rate limiter protect a single runtime instance. Before enabling the endpoint across multiple instances, replace them with a shared durable store or platform-level rate limiting. Forwarding remains disabled until then.
- The Explee search-submission and result schemas must be mapped and contract-tested against the existing n8n workflow before enabling `EXPLEE_AUTOGTM_ENABLED`. The ingestion event table supplies durable batch replay protection, but live migration and RLS validation remain required.
- Centralized error tracking, request/trace correlation, alert delivery, log redaction validation, authentication-event monitoring, and an incident runbook remain staging-environment work.
- Backup retention, point-in-time recovery, restore ownership, RPO/RTO, migration recovery, and a completed restore drill require infrastructure confirmation. No production deployment should proceed without them.

## Core engineering principle

The platform is entity-based, not a single chatbot. AI actions must be linked to a user and business record, restricted to authorized sources, validated against schemas, logged and human-approved for sensitive changes.

## Phase 1 core CRM

Phase 1 adds governed account/contact workspaces, canonical opportunity stages, won/lost transitions, optimistic concurrency, ownership reassignment, append-only opportunity history, richer tasks and reminders, permission-aware CSV exports, immutable audit triggers, and production configuration contracts. The stage taxonomy and operating rules are proposed defaults and require sales-policy approval before activation.

Operational staging, backup/PITR, restore-drill, monitoring, and release-gate procedures are documented in [`docs/phase1-release-runbook.md`](docs/phase1-release-runbook.md). Live RLS verification uses synthetic identities in an isolated Supabase environment; `tests/live/phase1-rls.sql` must never be run against production.

Proposals, tenders, forecasting, AI, Fireflies, n8n, Apify, Dynamics synchronization, and email sending remain outside Phase 1 and disabled.

## Repository status

Run `npm run check` before deploying. Production activation requires account credentials and must be verified against the deployed URL.
