create extension if not exists pgcrypto;

create type public.approval_status as enum ('draft', 'pending', 'approved', 'changes_requested', 'rejected');
create type public.integration_provider as enum ('microsoft', 'fireflies', 'n8n');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'seller' check (role in ('seller', 'manager', 'approver', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  name text not null,
  industry text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, name)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  owner_name text not null,
  stage text not null,
  value_amount numeric(14,2) not null default 0 check (value_amount >= 0),
  probability integer not null default 0 check (probability between 0 and 100),
  expected_close_date date,
  next_step text,
  health_score integer not null default 50 check (health_score between 0 and 100),
  attention text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  opportunity_id uuid references public.opportunities(id) on delete set null,
  external_id text,
  provider integration_provider,
  title text not null,
  started_at timestamptz not null,
  attendees jsonb not null default '[]'::jsonb,
  transcript text,
  summary text,
  sentiment text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.meeting_insights (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  kind text not null check (kind in ('summary', 'buying_signal', 'risk', 'objection', 'commitment', 'decision')),
  content text not null,
  evidence_quote text,
  evidence_timestamp_seconds integer,
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  title text not null,
  assignee_email text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  title text not null,
  version integer not null default 1,
  content jsonb not null default '{}'::jsonb,
  status approval_status not null default 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  reference text,
  due_at timestamptz,
  requirements jsonb not null default '[]'::jsonb,
  status approval_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  proposal_id uuid references public.proposals(id) on delete cascade,
  tender_id uuid references public.tenders(id) on delete cascade,
  approver_user_id uuid references auth.users(id),
  status approval_status not null default 'pending',
  comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((proposal_id is not null)::integer + (tender_id is not null)::integer = 1)
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  provider integration_provider not null,
  external_account_id text,
  status text not null default 'connected' check (status in ('connected', 'degraded', 'disconnected')),
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, provider)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider integration_provider not null,
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_event_id)
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id),
  workflow_name text not null,
  external_execution_id text,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index opportunities_owner_idx on public.opportunities(owner_user_id, updated_at desc);
create index meetings_owner_started_idx on public.meetings(owner_user_id, started_at desc);
create index action_items_owner_status_idx on public.action_items(owner_user_id, status, due_at);
create index approvals_approver_status_idx on public.approval_requests(approver_user_id, status);
create index webhook_events_status_idx on public.webhook_events(status, received_at);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.opportunities enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_insights enable row level security;
alter table public.action_items enable row level security;
alter table public.proposals enable row level security;
alter table public.tenders enable row level security;
alter table public.approval_requests enable row level security;
alter table public.integration_connections enable row level security;
alter table public.webhook_events enable row level security;
alter table public.automation_runs enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles_self" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "accounts_owner" on public.accounts for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "opportunities_owner" on public.opportunities for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "meetings_owner" on public.meetings for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "meeting_insights_owner" on public.meeting_insights for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "action_items_owner" on public.action_items for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "proposals_owner" on public.proposals for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "tenders_owner" on public.tenders for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "approval_participants" on public.approval_requests for select to authenticated using ((select auth.uid()) in (owner_user_id, approver_user_id));
create policy "approval_owner_insert" on public.approval_requests for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy "approval_participants_update" on public.approval_requests for update to authenticated using ((select auth.uid()) in (owner_user_id, approver_user_id)) with check ((select auth.uid()) in (owner_user_id, approver_user_id));
create policy "connections_owner" on public.integration_connections for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy "automation_owner" on public.automation_runs for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy "audit_actor_read" on public.audit_log for select to authenticated using ((select auth.uid()) = actor_user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.accounts, public.opportunities, public.meetings, public.meeting_insights, public.action_items, public.proposals, public.tenders, public.approval_requests, public.integration_connections to authenticated;
grant select on public.automation_runs, public.audit_log to authenticated;
revoke all on public.webhook_events from anon, authenticated;
