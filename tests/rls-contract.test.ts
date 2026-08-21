import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20260822000001_phase0_sales_foundation.sql"), "utf8");

describe("Phase 0 RLS migration contract", () => {
  it("enables RLS and owner policies for contacts and activities", () => {
    expect(migration).toContain("alter table public.contacts enable row level security");
    expect(migration).toContain("create policy \"contacts_owner\"");
    expect(migration).toContain("alter table public.activities enable row level security");
    expect(migration).toContain("create policy \"activities_owner\"");
  });

  it("grants managers read-only team visibility", () => {
    expect(migration).toContain("create policy \"opportunities_team_read\"");
    expect(migration).not.toMatch(/create policy "opportunities_team_(?:update|write|all)"/);
  });

  it("blocks self-role changes and self-approval", () => {
    expect(migration).toContain("grant update (display_name) on public.profiles to authenticated");
    expect(migration).toContain("approval_request_separation_check");
    expect(migration).toContain("approver_user_id <> owner_user_id");
  });

  it("keeps CRM synchronization disabled by default", () => {
    expect(migration).toContain("enabled boolean not null default false");
    expect(migration).toContain("insert into public.crm_sync_state (id, enabled) values (true, false)");
  });

  it("enforces same-owner relationships between core records", () => {
    expect(migration).toContain("opportunities_account_owner_fkey");
    expect(migration).toContain("contacts_account_owner_fkey");
    expect(migration).toContain("activities_opportunity_owner_fkey");
    expect(migration).toContain("meetings_opportunity_owner_fkey");
  });

  it("fails closed unless the authenticated email is explicitly approved", () => {
    expect(migration).toContain("create table public.approved_identities");
    expect(migration).toContain("app_private.current_user_is_approved()");
    expect(migration).toContain("message = 'identity_not_approved'");
    expect(migration).not.toContain("from auth.users u\non conflict (id) do nothing");
  });

  it("keeps approval records read-only for staging", () => {
    expect(migration).toContain("revoke insert, update, delete on public.approval_requests from authenticated");
    expect(migration).not.toContain("create policy \"approval_assignee_update\"");
  });

  it("updates roles, protects the last administrator, and audits in one function", () => {
    expect(migration).toContain("function public.admin_update_user_role");
    expect(migration).toContain("lock table public.profiles in share row exclusive mode");
    expect(migration).toContain("message = 'last_admin_blocked'");
    expect(migration).toContain("insert into public.audit_log");
  });
});
