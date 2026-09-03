-- Manual live RLS harness for an isolated synthetic Supabase project only.
-- Do not run against production. Replace the synthetic UUIDs after provisioning
-- isolated auth users and execute each section with the corresponding JWT role.

begin;

-- Preconditions that can be checked by a migration test connection.
do $$ begin
  assert exists (select 1 from pg_tables where schemaname='public' and tablename='opportunity_change_history');
  assert exists (select 1 from pg_policies where schemaname='public' and tablename='accounts');
  assert exists (select 1 from pg_policies where schemaname='public' and tablename='activities');
  assert exists (select 1 from pg_trigger where tgname='audit_log_immutable');
  assert has_table_privilege('authenticated','public.opportunity_stages','SELECT');
  assert not has_table_privilege('authenticated','public.opportunity_stages','INSERT');
  assert not has_table_privilege('authenticated','public.audit_log','UPDATE');
end $$;

-- Session/JWT-specific assertions belong in the isolated CI harness:
-- seller A: own rows visible/mutable; seller B rows invisible.
-- assigned seller: assigned activity visible and status mutable, ownership fixed.
-- manager: team rows visible, direct edits denied, authorized reassign_opportunity and assign_activity RPCs allowed within team.
-- approver: no implicit core CRM visibility.
-- inactive/unapproved identity: zero rows and mutation denied.
-- stale record_version: update/transition returns no row or version_conflict.
-- audit/history UPDATE and DELETE: immutable_record.

rollback;
