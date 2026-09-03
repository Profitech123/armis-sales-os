-- Phase 1 core CRM. Apply and validate in an isolated Supabase project before release.

create table public.opportunity_stages (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null unique,
  position integer not null unique check (position > 0),
  probability integer not null check (probability between 0 and 100),
  terminal boolean not null default false,
  outcome text check (outcome in ('won', 'lost')),
  active boolean not null default true,
  check ((terminal and outcome is not null) or (not terminal and outcome is null))
);

insert into public.opportunity_stages (key, label, position, probability, terminal, outcome) values
  ('qualification', 'Qualification', 1, 10, false, null),
  ('discovery', 'Discovery', 2, 25, false, null),
  ('solution_fit', 'Solution Fit', 3, 45, false, null),
  ('proposal', 'Proposal', 4, 65, false, null),
  ('negotiation', 'Negotiation', 5, 85, false, null),
  ('closed_won', 'Closed Won', 6, 100, true, 'won'),
  ('closed_lost', 'Closed Lost', 7, 0, true, 'lost')
on conflict (key) do nothing;

create table public.opportunity_loss_reasons (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null unique,
  active boolean not null default true
);

insert into public.opportunity_loss_reasons (key, label) values
  ('budget', 'Budget unavailable'),
  ('competition', 'Lost to competitor'),
  ('no_decision', 'No decision'),
  ('timing', 'Timing or priority changed'),
  ('solution_fit', 'Solution fit'),
  ('relationship', 'Relationship or access')
on conflict (key) do nothing;

alter table public.accounts
  add column archived_at timestamptz,
  add column record_version integer not null default 1 check (record_version > 0);

alter table public.contacts
  add column archived_at timestamptz,
  add column record_version integer not null default 1 check (record_version > 0);

create table public.opportunity_contacts (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  role text not null default 'stakeholder' check (char_length(role) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (opportunity_id, contact_id),
  foreign key (opportunity_id, owner_user_id) references public.opportunities(id, owner_user_id) on update cascade on delete cascade,
  foreign key (contact_id, owner_user_id) references public.contacts(id, owner_user_id) on update cascade on delete cascade
);
alter table public.opportunity_contacts enable row level security;
create policy "opportunity_contacts_owner" on public.opportunity_contacts for all to authenticated
  using ((select app_private.current_user_is_approved()) and owner_user_id = (select auth.uid()))
  with check ((select app_private.current_user_is_approved()) and owner_user_id = (select auth.uid()));
create policy "opportunity_contacts_team_read" on public.opportunity_contacts for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);
grant select, insert, update, delete on public.opportunity_contacts to authenticated;

update public.opportunities set stage = case lower(trim(stage))
  when 'qualification' then 'qualification'
  when 'discovery' then 'discovery'
  when 'solution fit' then 'solution_fit'
  when 'proposal' then 'proposal'
  when 'negotiation' then 'negotiation'
  when 'closed won' then 'closed_won'
  when 'won' then 'closed_won'
  when 'closed lost' then 'closed_lost'
  when 'lost' then 'closed_lost'
  else 'qualification' end;

alter table public.opportunities
  add column record_version integer not null default 1 check (record_version > 0),
  add column closed_at timestamptz,
  add column loss_reason_key text references public.opportunity_loss_reasons(key),
  add constraint opportunities_stage_fkey foreign key (stage) references public.opportunity_stages(key),
  add constraint opportunities_loss_reason_check check (
    (stage = 'closed_lost' and loss_reason_key is not null)
    or (stage <> 'closed_lost' and loss_reason_key is null)
  );

create table public.opportunity_change_history (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  actor_user_id uuid not null references auth.users(id),
  source text not null default 'application',
  correlation_id uuid not null,
  change_type text not null check (change_type in ('created', 'edited', 'stage_transition', 'ownership_changed', 'archived')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index opportunity_history_record_idx on public.opportunity_change_history(opportunity_id, created_at desc, id desc);
alter table public.opportunity_change_history enable row level security;
create policy "opportunity_history_visible" on public.opportunity_change_history for select to authenticated using (
  (select app_private.current_user_is_approved()) and (
    owner_user_id = (select auth.uid())
    or exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = owner_user_id)
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);
grant select on public.opportunity_change_history to authenticated;
revoke insert, update, delete on public.opportunity_change_history from anon, authenticated;

alter table public.activities
  add column assignee_user_id uuid references auth.users(id),
  add column priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column reminder_at timestamptz,
  add column record_version integer not null default 1 check (record_version > 0),
  add column cancelled_at timestamptz,
  add column cancellation_reason text check (char_length(cancellation_reason) <= 500);
update public.activities set assignee_user_id = owner_user_id where assignee_user_id is null;
alter table public.activities alter column assignee_user_id set not null;
create index activities_assignee_status_due_idx on public.activities(assignee_user_id, status, due_at, id);

-- Ownership transfers remain referentially consistent across dependent records.
alter table public.activities drop constraint activities_opportunity_owner_fkey;
alter table public.activities add constraint activities_opportunity_owner_fkey
  foreign key (opportunity_id, owner_user_id) references public.opportunities(id, owner_user_id)
  on update cascade on delete cascade;
alter table public.meetings drop constraint meetings_opportunity_owner_fkey;
alter table public.meetings add constraint meetings_opportunity_owner_fkey
  foreign key (opportunity_id, owner_user_id) references public.opportunities(id, owner_user_id)
  on update cascade on delete set null (opportunity_id);
alter table public.proposals drop constraint proposals_opportunity_owner_fkey;
alter table public.proposals add constraint proposals_opportunity_owner_fkey
  foreign key (opportunity_id, owner_user_id) references public.opportunities(id, owner_user_id)
  on update cascade on delete cascade;

alter table public.audit_log
  add column source text not null default 'application',
  add column correlation_id uuid,
  add column metadata jsonb not null default '{}'::jsonb;
create index audit_log_entity_created_idx on public.audit_log(entity_type, entity_id, created_at desc, id desc);
revoke insert, update, delete on public.audit_log from anon, authenticated;

alter table public.opportunity_stages enable row level security;
alter table public.opportunity_loss_reasons enable row level security;
create policy "opportunity_stages_read" on public.opportunity_stages for select to authenticated using ((select app_private.current_user_is_approved()));
create policy "opportunity_loss_reasons_read" on public.opportunity_loss_reasons for select to authenticated using ((select app_private.current_user_is_approved()));
grant select on public.opportunity_stages, public.opportunity_loss_reasons to authenticated;
revoke insert, update, delete on public.opportunity_stages, public.opportunity_loss_reasons from anon, authenticated;

-- Managers retain read-only visibility; sellers may only mutate owned rows.
drop policy if exists "activities_owner" on public.activities;
create policy "activities_owner_select" on public.activities for select to authenticated using (
  (select app_private.current_user_is_approved()) and (owner_user_id = (select auth.uid()) or assignee_user_id = (select auth.uid()))
);
create policy "activities_owner_insert" on public.activities for insert to authenticated with check (
  (select app_private.current_user_is_approved()) and owner_user_id = (select auth.uid()) and (
    assignee_user_id = (select auth.uid()) or exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = assignee_user_id)
  )
);
create policy "activities_owner_update" on public.activities for update to authenticated
  using ((select app_private.current_user_is_approved()) and (owner_user_id = (select auth.uid()) or assignee_user_id = (select auth.uid())))
  with check ((select app_private.current_user_is_approved()) and (
    (owner_user_id = (select auth.uid()) and (assignee_user_id = (select auth.uid()) or exists (select 1 from public.team_memberships tm where tm.manager_user_id = (select auth.uid()) and tm.member_user_id = assignee_user_id)))
    or (assignee_user_id = (select auth.uid()) and owner_user_id <> (select auth.uid()))
  ));
create policy "activities_owner_delete" on public.activities for delete to authenticated using (
  (select app_private.current_user_is_approved()) and owner_user_id = (select auth.uid())
);

-- Sensitive-value redaction for immutable audit records.
create or replace function app_private.redact_audit_json(value jsonb)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select case when value is null then null else value - array['email','phone','transcript','body','content','token','secret'] end
$$;

create or replace function app_private.capture_core_audit()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
declare actor uuid := auth.uid();
begin
  insert into public.audit_log(actor_user_id, entity_type, entity_id, action, before_data, after_data, source, correlation_id)
  values (
    actor,
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else app_private.redact_audit_json(to_jsonb(old)) end,
    case when tg_op = 'DELETE' then null else app_private.redact_audit_json(to_jsonb(new)) end,
    coalesce(nullif(current_setting('app.audit_source', true), ''), 'application'),
    coalesce(nullif(current_setting('app.correlation_id', true), '')::uuid, gen_random_uuid())
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app_private.capture_core_audit() from public, anon, authenticated;

create trigger audit_accounts after insert or update or delete on public.accounts for each row execute function app_private.capture_core_audit();
create trigger audit_contacts after insert or update or delete on public.contacts for each row execute function app_private.capture_core_audit();
create trigger audit_opportunities after insert or update or delete on public.opportunities for each row execute function app_private.capture_core_audit();
create trigger audit_activities after insert or update or delete on public.activities for each row execute function app_private.capture_core_audit();

create or replace function app_private.capture_opportunity_edit_history()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
begin
  if tg_op = 'INSERT' then
    insert into public.opportunity_change_history(opportunity_id,owner_user_id,actor_user_id,source,correlation_id,change_type,after_data)
    values(new.id,new.owner_user_id,coalesce(auth.uid(),new.owner_user_id),'application',gen_random_uuid(),'created',app_private.redact_audit_json(to_jsonb(new)));
  elsif new.stage = old.stage and new.owner_user_id = old.owner_user_id then
    insert into public.opportunity_change_history(opportunity_id,owner_user_id,actor_user_id,source,correlation_id,change_type,before_data,after_data)
    values(new.id,new.owner_user_id,coalesce(auth.uid(),new.owner_user_id),'application',gen_random_uuid(),'edited',app_private.redact_audit_json(to_jsonb(old)),app_private.redact_audit_json(to_jsonb(new)));
  end if;
  return new;
end;
$$;
revoke all on function app_private.capture_opportunity_edit_history() from public,anon,authenticated;
create trigger opportunity_edit_history after insert or update on public.opportunities for each row execute function app_private.capture_opportunity_edit_history();

-- Audit and history are append-only even for privileged application roles.
create or replace function app_private.reject_immutable_mutation()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin raise exception using errcode = '55000', message = 'immutable_record'; end;
$$;
create trigger audit_log_immutable before update or delete on public.audit_log for each row execute function app_private.reject_immutable_mutation();
create trigger opportunity_history_immutable before update or delete on public.opportunity_change_history for each row execute function app_private.reject_immutable_mutation();

create or replace function public.transition_opportunity(
  target_id uuid,
  expected_version integer,
  target_stage text,
  target_loss_reason text default null,
  correlation uuid default gen_random_uuid()
) returns public.opportunities
language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
declare current_row public.opportunities; next_stage public.opportunity_stages; changed public.opportunities;
begin
  select * into current_row from public.opportunities where id = target_id for update;
  if not found or current_row.owner_user_id <> auth.uid() then raise exception using errcode = '42501', message = 'forbidden'; end if;
  if current_row.record_version <> expected_version then raise exception using errcode = '40001', message = 'version_conflict'; end if;
  select * into next_stage from public.opportunity_stages where key = target_stage and active;
  if not found then raise exception using errcode = '22023', message = 'invalid_stage'; end if;
  if target_stage = 'closed_lost' and target_loss_reason is null then raise exception using errcode = '22023', message = 'loss_reason_required'; end if;
  if target_stage <> 'closed_lost' then target_loss_reason := null; end if;
  update public.opportunities set
    stage = next_stage.key,
    probability = next_stage.probability,
    loss_reason_key = target_loss_reason,
    closed_at = case when next_stage.terminal then now() else null end,
    record_version = record_version + 1
  where id = target_id returning * into changed;
  insert into public.opportunity_change_history(opportunity_id, owner_user_id, actor_user_id, source, correlation_id, change_type, before_data, after_data)
  values (target_id, current_row.owner_user_id, auth.uid(), 'application', correlation, 'stage_transition',
    jsonb_build_object('stage', current_row.stage, 'probability', current_row.probability, 'lossReason', current_row.loss_reason_key),
    jsonb_build_object('stage', changed.stage, 'probability', changed.probability, 'lossReason', changed.loss_reason_key));
  return changed;
end;
$$;
revoke all on function public.transition_opportunity(uuid, integer, text, text, uuid) from public, anon;
grant execute on function public.transition_opportunity(uuid, integer, text, text, uuid) to authenticated;

create or replace function public.reassign_opportunity(
  target_id uuid,
  expected_version integer,
  target_owner uuid,
  correlation uuid default gen_random_uuid()
) returns public.opportunities
language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
declare actor_role text; current_row public.opportunities; target_profile public.profiles; changed public.opportunities;
begin
  select role into actor_role from public.profiles p join public.approved_identities ai on ai.email = p.email and ai.active and ai.role = p.role where p.id = auth.uid();
  if actor_role not in ('manager', 'admin') then raise exception using errcode = '42501', message = 'forbidden'; end if;
  select * into current_row from public.opportunities where id = target_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'not_found'; end if;
  if actor_role = 'manager' and current_row.owner_user_id <> auth.uid() and not exists (
    select 1 from public.team_memberships where manager_user_id = auth.uid() and member_user_id = current_row.owner_user_id
  ) then raise exception using errcode = '42501', message = 'forbidden'; end if;
  if current_row.record_version <> expected_version then raise exception using errcode = '40001', message = 'version_conflict'; end if;
  select * into target_profile from public.profiles where id = target_owner;
  if not found or (actor_role = 'manager' and target_owner <> auth.uid() and not exists (
    select 1 from public.team_memberships where manager_user_id = auth.uid() and member_user_id = target_owner
  )) then raise exception using errcode = '42501', message = 'invalid_owner'; end if;
  update public.opportunities set owner_user_id = target_owner, owner_name = coalesce(target_profile.display_name, target_profile.email), record_version = record_version + 1
  where id = target_id returning * into changed;
  insert into public.opportunity_change_history(opportunity_id, owner_user_id, actor_user_id, source, correlation_id, change_type, before_data, after_data)
  values (target_id, target_owner, auth.uid(), 'application', correlation, 'ownership_changed',
    jsonb_build_object('ownerUserId', current_row.owner_user_id), jsonb_build_object('ownerUserId', target_owner));
  return changed;
end;
$$;
revoke all on function public.reassign_opportunity(uuid, integer, uuid, uuid) from public, anon;
grant execute on function public.reassign_opportunity(uuid, integer, uuid, uuid) to authenticated;

-- The row-level "activities_owner_update" policy only lets the record owner or the
-- current assignee update a row, so a manager assigning work to a team member they
-- do not yet own or hold as assignee would otherwise be silently blocked by RLS.
-- This governed RPC lets an owner delegate to their own team, or a manager
-- reassign within their team, while still enforcing optimistic concurrency.
create or replace function public.assign_activity(
  target_id uuid,
  expected_version integer,
  target_assignee uuid
) returns public.activities
language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
declare actor_role text; current_row public.activities; changed public.activities;
begin
  select role into actor_role from public.profiles p join public.approved_identities ai on ai.email = p.email and ai.active and ai.role = p.role where p.id = auth.uid();
  select * into current_row from public.activities where id = target_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'not_found'; end if;
  if current_row.owner_user_id <> auth.uid() and actor_role not in ('manager', 'admin') then raise exception using errcode = '42501', message = 'forbidden'; end if;
  if current_row.owner_user_id <> auth.uid() and actor_role = 'manager' and not exists (
    select 1 from public.team_memberships where manager_user_id = auth.uid() and member_user_id = current_row.owner_user_id
  ) then raise exception using errcode = '42501', message = 'forbidden'; end if;
  if current_row.record_version <> expected_version then raise exception using errcode = '40001', message = 'version_conflict'; end if;
  if target_assignee <> current_row.owner_user_id and not exists (
    select 1 from public.team_memberships where manager_user_id = current_row.owner_user_id and member_user_id = target_assignee
  ) and not exists (
    select 1 from public.team_memberships where manager_user_id = auth.uid() and member_user_id = target_assignee
  ) and target_assignee <> auth.uid() then raise exception using errcode = '42501', message = 'invalid_assignee'; end if;
  update public.activities set assignee_user_id = target_assignee, record_version = record_version + 1
  where id = target_id returning * into changed;
  return changed;
end;
$$;
revoke all on function public.assign_activity(uuid, integer, uuid) from public, anon;
grant execute on function public.assign_activity(uuid, integer, uuid) to authenticated;
