# Armis Sales OS

AI-powered sales intelligence control center for Armis Middle East.

This repository currently contains the first runnable frontend scaffold using realistic mock data and the editorial control-center design direction.

## Included in this first release

- Next.js 15 App Router
- TypeScript strict mode
- Tailwind CSS 4
- Editorial design system inspired by the approved references
- Today control center
- Operating metrics
- Priority action queue
- Active pipeline table
- Realistic Armis mock data
- Environment-variable template

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

## Current mode

The application starts with mock data enabled:

```env
NEXT_PUBLIC_USE_MOCK_DATA="true"
```

No external credentials are needed to run this version.

## Planned implementation sequence

1. Application shell and reusable component library
2. Today and Pipeline workspaces
3. Deal detail and communications queue
4. Meeting intelligence workflow
5. Proposal and tender workspaces
6. Supabase database and Microsoft Entra ID
7. Google Sheets or Excel synchronization
8. Fireflies and Microsoft Calendar integration
9. Governed AI skills and approval workflows
10. n8n automations and production deployment

## Core engineering principle

The platform is entity-based, not a single chatbot. AI actions must be linked to a user and business record, restricted to authorized sources, validated against schemas, logged and human-approved for sensitive changes.

## Repository status

This is the initial MVP scaffold. Backend integrations and additional routes will be committed incrementally.
