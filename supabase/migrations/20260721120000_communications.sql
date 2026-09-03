create type public.communication_category as enum ('needs_reply', 'urgent', 'waiting');
create type public.communication_tone as enum ('red', 'orange', 'blue', 'green');

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  opportunity_id uuid references public.opportunities(id) on delete set null,
  account_name text not null,
  subject text not null,
  body text not null,
  recommended_action text not null,
  category communication_category not null,
  tone communication_tone not null default 'blue',
  received_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index communications_owner_category_idx on public.communications(owner_user_id, category, received_at desc);

alter table public.communications enable row level security;

create policy "communications_owner" on public.communications for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);

grant select, insert, update, delete on public.communications to authenticated;
