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
- Fireflies-to-n8n webhook ingress and a production health endpoint
- Realistic mock-data fallback when Supabase is not configured

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

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. In Supabase Auth, enable Azure, configure the Entra client ID/secret, and use the tenant URL required by your organization. Add `https://<your-domain>/auth/callback` to the allowed redirect URLs.

Authenticated CRUD endpoints:

- `GET|POST /api/opportunities`
- `PATCH|DELETE /api/opportunities/:id`

Production monitoring probes `GET /api/health`. Fireflies can post transcript events to `POST /api/webhooks/fireflies`; requests must include `x-armis-webhook-secret` and are forwarded to `N8N_FIREFLIES_WEBHOOK_URL`.

## Deployment

Connect `Profitech123/armis-sales-os` from the Vercel project’s Settings → Git page, set `main` as the production branch, and configure all production environment variables from `.env.example`. The repository’s `vercel.json` pins the Dubai region and configures a 15-minute health cron.

## Remaining production activation

1. Authorize GitHub and Vercel, connect the repository, and deploy `main`.
2. Create/link the Supabase project and push the migration.
3. Configure Entra, Microsoft Graph, Fireflies, and n8n credentials.
4. Add the transcript analysis model invocation and approval UI on top of the implemented schema.
5. Connect alerting/error tracking to the health endpoint and Vercel runtime logs.

## Core engineering principle

The platform is entity-based, not a single chatbot. AI actions must be linked to a user and business record, restricted to authorized sources, validated against schemas, logged and human-approved for sensitive changes.

## Repository status

Run `npm run check` before deploying. Production activation requires account credentials and must be verified against the deployed URL.
