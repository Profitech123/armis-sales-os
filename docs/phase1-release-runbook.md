# Phase 1 release runbook

This document prepares an isolated staging and production release. It does not authorize connecting external services or using production data.

## Required confirmations

- Sales leadership approves the canonical stages, probabilities, loss reasons, assignment rules, manager visibility, currencies, archive policy, and export eligibility.
- Identity administration confirms the Microsoft Entra tenant, redirect URLs, approved identity list, user deactivation process, session revocation process, and first-admin procedure.
- Platform ownership confirms separate Supabase and Vercel projects for staging and production, separate secrets, separate URLs, and no production credentials in preview environments.
- Compliance ownership confirms retention periods for CRM records, activity notes, audit logs, and exports.

## Isolated staging validation

1. Create an empty, isolated Supabase project using synthetic fixtures only.
2. Confirm the Data API exposes only intended `public` objects. New Supabase projects may require explicit exposure in addition to SQL grants.
3. Apply every migration from an empty database, then test the supported upgrade path from the previous schema.
4. Run database advisors and resolve security/performance findings.
5. Provision synthetic seller A, seller B, manager, approver, admin, inactive, and unapproved identities.
6. Run `tests/live/phase1-rls.sql` using short-lived isolated test sessions. Verify seller isolation, manager read-only visibility, assignee access, transition authorization, immutable history, and audit redaction.
7. Run lint, TypeScript, unit/integration tests, the production build, role-based browser tests, accessibility tests, and security scan.
8. Confirm feature flags for CRM sync, AI, Fireflies, Explee/n8n, and GTM AI remain `false`.

## Monitoring gates

- Route and job logs must include a correlation ID but no tokens, secrets, transcripts, message bodies, personal email addresses, or phone numbers.
- Connect logs to an approved error tracker and alert destination in staging first.
- Alert on degraded health, elevated 401/403/409/429/500 rates, migration failure, authentication anomalies, and delayed reminders.
- Record alert owner, severity, response time, and escalation route in the incident runbook.
- The current JSON console logger and health cron alone are not a production monitoring system.

## Backup, PITR, and restore drill

1. Confirm the selected Supabase plan's backup retention and point-in-time recovery window. Database backups do not include Supabase Storage objects.
2. Document production RPO, RTO, restore owner, approver, and emergency access procedure.
3. Take or confirm an automated backup of the isolated synthetic staging database.
4. Record a recovery timestamp, mutate synthetic CRM records, and restore to a separate recovery project—not over staging or production.
5. Validate row counts, foreign keys, audit/history immutability, RLS policies, functions, triggers, grants, and a sample seller/manager workflow.
6. Record actual recovery time, data-loss interval, exceptions, and sign-off. A successful restore drill is a release gate.

## Release gates

- No unresolved critical/high security issue or undocumented dependency vulnerability.
- Clean and upgrade migration paths pass against isolated Postgres/Supabase.
- All live RLS, negative authorization, role E2E, accessibility, and core workflow tests pass.
- Backup/PITR is configured and the restore drill meets approved RPO/RTO.
- Monitoring alerts reach a named operator.
- Production mock data is disabled and production secrets are scoped only to production.
- Roll-forward recovery is documented; destructive rollback is not assumed.
- Final schema, sales policy, identity, compliance, and platform sign-offs are recorded.

## Out of scope

Proposals, tenders, forecasting, AI, Fireflies, n8n, Apify, Dynamics synchronization, email sending, and other external integrations remain disabled and are not Phase 1 release dependencies.

