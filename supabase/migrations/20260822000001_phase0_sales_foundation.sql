-- Phase 0 production foundation: controlled identities, team visibility,
-- contacts, activities, and disabled-by-default CRM integration state.

create table public.approved_identities (
  email text primary key,
  role text not null default 'seller' check (role in ('seller', 'manager', 'approver', 'admin')),
  active boolean not null default true,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

alter table public.approved_identities enable row level security;
revoke all on public.approved_identities from anon, authenticated;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create or replace function app_private.current_user_is_approved()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.approved_identities ai on ai.email = p.email
    where p.id = auth.uid() and ai.active and ai.role = p.role
  );
$$;
revoke all on function app_private.current_user_is_approved() from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.current_user_is_approved() to authenticated;

create table public.team_memberships (
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (manager_user_id, member_user_id),
  check (manager_user_id <> member_user_id)
);

alter table public.accounts
  add column source text not null default 'manual' check (source in ('manual', 'crm')),
  add column external_id text;
create unique index accounts_source_external_idx on public.accounts(source, external_id) where external_id is not null;
alter table public.accounts add constraint accounts_id_owner_unique unique (id, owner_user_id);

alter table public.opportunities
  add column source text not null default 'manual' check (source in ('manual', 'crm')),
  add column external_id text,
  add column currency_code text not null default 'AED' check (currency_code ~ '^[A-Z]{3}$');
create unique index opportunities_source_external_idx on public.opportunities(source, external_id) where external_id is not null;
alter table public.opportunities add constraint opportunities_id_owner_unique unique (id, owner_user_id);
alter table public.opportunities drop constraint opportunities_account_id_fkey;
alter table public.opportunities add constraint opportunities_account_owner_fkey
  foreign key (account_id, owner_user_id) references public.accounts(id, owner_user_id) on delete cascade;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  account_id uuid not null,
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null default '' check (char_length(last_name) <= 100),
  email text,
  phone text,
  job_title text,
  relationship_role text,
  source text not null default 'manual' check (source in ('manual', 'crm')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is null or email = lower(trim(email)))
);
alter table public.contacts add constraint contacts_id_owner_unique unique (id, owner_user_id);
alter table public.contacts add constraint contacts_account_owner_fkey
  foreign key (account_id, owner_user_id) references public.accounts(id, owner_user_id) on delete cascade;

create unique index contacts_owner_email_idx
  on public.contacts (owner_user_id, email)
  where email is not null;
create index contacts_account_idx on public.contacts(account_id, last_name, first_name);
create unique index contacts_source_external_idx on public.contacts(source, external_id) where external_id is not null;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  account_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  kind text not null check (kind in ('task', 'follow_up', 'call', 'email', 'note')),
  subject text not null check (char_length(subject) between 1 and 240),
  details text check (char_length(details) <= 4000),
  due_at timestamptz,
  completed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);
alter table public.activities add constraint activities_account_owner_fkey
  foreign key (account_id, owner_user_id) references public.accounts(id, owner_user_id) on delete cascade;
alter table public.activities add constraint activities_contact_owner_fkey
  foreign key (contact_id, owner_user_id) references public.contacts(id, owner_user_id) on delete set null (contact_id);
alter table public.activities add constraint activities_opportunity_owner_fkey
  foreign key (opportunity_id, owner_user_id) references public.opportunities(id, owner_user_id) on delete cascade;

alter table public.meetings drop constraint meetings_opportunity_id_fkey;
alter table public.meetings add constraint meetings_opportunity_owner_fkey
  foreign key (opportunity_id, owner_user_id) references public.opportunities(id, owner_user_id) on delete set null (opportunity_id);
alter table public.proposals drop constraint proposals_opportunity_id_fkey;
alter table public.proposals add constraint proposals_opportunity_owner_fkey
  foreign key (opportunity_id, owner_user_id) references public.opportunities(id, owner_user_id) on delete cascade;
alter table public.tenders drop constraint tenders_account_id_fkey;
alter table public.tenders add constraint tenders_account_owner_fkey
  foreign key (account_id, owner_user_id) references public.accounts(id, owner_user_id) on delete cascade;

create index activities_owner_status_due_idx on public.activities(owner_user_id, status, due_at);
create index activities_opportunity_idx on public.activities(opportunity_id, created_at desc);

create table public.crm_sync_state (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  provider text,
  last_attempted_at timestamptz,
  last_succeeded_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  check (not enabled or provider is not null)
);
insert into public.crm_sync_state (id, enabled) values (true, false) on conflict (id) do nothing;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  approved_role text;
begin
  if new.email is null then
    raise exception using errcode = 'P0001', message = 'identity_not_approved';
  end if;

  select ai.role into approved_role
  from public.approved_identities ai
  where ai.email = lower(trim(new.email)) and ai.active;

  if approved_role is null then
    raise exception using errcode = 'P0001', message = 'identity_not_approved';
  end if;

  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    lower(trim(new.email)),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    approved_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Existing auth users are deliberately not auto-enrolled. Their normalized
-- email must be approved before a profile is provisioned administratively.

-- Users may update their display name, but role changes are server-controlled.
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self_read" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_self_update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

alter table public.team_memberships enable row level security;
create policy "team_memberships_participant_read" on public.team_memberships for select to authenticated
  using ((select auth.uid()) in (manager_user_id, member_user_id));

alter table public.contacts enable row level security;
create policy "contacts_owner" on public.contacts for all to authenticated
  using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "contacts_team_read" on public.contacts for select to authenticated using (
  exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);

alter table public.activities enable row level security;
create policy "activities_owner" on public.activities for all to authenticated
  using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "activities_team_read" on public.activities for select to authenticated using (
  exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);

-- Managers and administrators get read-only team visibility. Record owners
-- retain the existing mutation policy; write delegation needs sales approval.
create policy "accounts_team_read" on public.accounts for select to authenticated using (
  exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy "opportunities_team_read" on public.opportunities for select to authenticated using (
  exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy "meetings_team_read" on public.meetings for select to authenticated using (
  exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy "proposals_team_read" on public.proposals for select to authenticated using (
  exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy "tenders_team_read" on public.tenders for select to authenticated using (
  exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);

-- Replace every authenticated data policy with an approved-identity check.
-- Policies are permissive by default, so leaving any original policy in place
-- would allow it to bypass the enrollment gate.
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_read" on public.profiles for select to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = id);
create policy "profiles_self_update" on public.profiles for update to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = id);

drop policy if exists "team_memberships_participant_read" on public.team_memberships;
create policy "team_memberships_participant_read" on public.team_memberships for select to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) in (manager_user_id, member_user_id));

drop policy if exists "contacts_owner" on public.contacts;
drop policy if exists "contacts_team_read" on public.contacts;
create policy "contacts_owner" on public.contacts for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
create policy "contacts_team_read" on public.contacts for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);

drop policy if exists "activities_owner" on public.activities;
drop policy if exists "activities_team_read" on public.activities;
create policy "activities_owner" on public.activities for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
create policy "activities_team_read" on public.activities for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);

drop policy if exists "accounts_owner" on public.accounts;
drop policy if exists "accounts_team_read" on public.accounts;
create policy "accounts_owner" on public.accounts for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
create policy "accounts_team_read" on public.accounts for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);

drop policy if exists "opportunities_owner" on public.opportunities;
drop policy if exists "opportunities_team_read" on public.opportunities;
create policy "opportunities_owner" on public.opportunities for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
create policy "opportunities_team_read" on public.opportunities for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);

drop policy if exists "meetings_owner" on public.meetings;
drop policy if exists "meetings_team_read" on public.meetings;
create policy "meetings_owner" on public.meetings for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
create policy "meetings_team_read" on public.meetings for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);

drop policy if exists "meeting_insights_owner" on public.meeting_insights;
create policy "meeting_insights_owner" on public.meeting_insights for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
drop policy if exists "action_items_owner" on public.action_items;
create policy "action_items_owner" on public.action_items for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);

drop policy if exists "proposals_owner" on public.proposals;
drop policy if exists "proposals_team_read" on public.proposals;
create policy "proposals_owner" on public.proposals for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
create policy "proposals_team_read" on public.proposals for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);

drop policy if exists "tenders_owner" on public.tenders;
drop policy if exists "tenders_team_read" on public.tenders;
create policy "tenders_owner" on public.tenders for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
create policy "tenders_team_read" on public.tenders for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);

drop policy if exists "connections_owner" on public.integration_connections;
create policy "connections_owner" on public.integration_connections for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
drop policy if exists "communications_owner" on public.communications;
create policy "communications_owner" on public.communications for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
drop policy if exists "automation_owner" on public.automation_runs;
create policy "automation_owner" on public.automation_runs for select to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
drop policy if exists "audit_actor_read" on public.audit_log;
create policy "audit_actor_read" on public.audit_log for select to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = actor_user_id);

-- Request owners cannot decide their own approval requests.
alter table public.approval_requests
  add constraint approval_request_separation_check
  check (approver_user_id is null or approver_user_id <> owner_user_id);
drop policy if exists "approval_participants_update" on public.approval_requests;
drop policy if exists "approval_owner_insert" on public.approval_requests;
drop policy if exists "approval_participants" on public.approval_requests;
create policy "approval_participants_read" on public.approval_requests for select to authenticated
  using (
    (select app_private.current_user_is_approved())
    and (select auth.uid()) in (owner_user_id, approver_user_id)
  );
revoke insert, update, delete on public.approval_requests from authenticated;

alter table public.crm_sync_state enable row level security;

grant select, insert, update, delete on public.contacts, public.activities to authenticated;
grant select on public.team_memberships to authenticated;
revoke all on public.crm_sync_state from anon, authenticated;

-- Role changes, last-admin protection, and auditing happen in one transaction.
create or replace function public.admin_update_user_role(target_user_id uuid, target_role text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  target_email text;
  previous_role text;
begin
  if actor_id is null or not exists (
    select 1
    from public.profiles p
    join public.approved_identities ai on ai.email = p.email and ai.active and ai.role = p.role
    where p.id = actor_id and p.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if target_role not in ('seller', 'manager', 'approver', 'admin') then
    raise exception using errcode = '22023', message = 'invalid_role';
  end if;
  if target_user_id = actor_id then
    raise exception using errcode = '22023', message = 'self_role_change_blocked';
  end if;

  lock table public.profiles in share row exclusive mode;
  select email, role into target_email, previous_role
  from public.profiles where id = target_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'user_not_found';
  end if;
  if previous_role = 'admin' and target_role <> 'admin'
     and (
       select count(*)
       from public.profiles p
       join public.approved_identities ai on ai.email = p.email and ai.active and ai.role = p.role
       where p.role = 'admin'
     ) <= 1 then
    raise exception using errcode = '22023', message = 'last_admin_blocked';
  end if;

  update public.profiles set role = target_role where id = target_user_id;
  update public.approved_identities
  set role = target_role, updated_at = now()
  where email = target_email and active;
  if not found then
    raise exception using errcode = 'P0002', message = 'approved_identity_not_found';
  end if;
  insert into public.audit_log (actor_user_id, entity_type, entity_id, action, before_data, after_data)
  values (
    actor_id,
    'profile',
    target_user_id,
    'role_changed',
    jsonb_build_object('role', previous_role),
    jsonb_build_object('role', target_role)
  );
end;
$$;
revoke all on function public.admin_update_user_role(uuid, text) from public, anon;
grant execute on function public.admin_update_user_role(uuid, text) to authenticated;

create trigger trg_contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger trg_activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();
create trigger trg_crm_sync_state_updated_at before update on public.crm_sync_state
  for each row execute function public.set_updated_at();
create trigger trg_approved_identities_updated_at before update on public.approved_identities
  for each row execute function public.set_updated_at();
