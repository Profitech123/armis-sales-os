-- Internal GTM prompt briefs and a review-only lead staging queue.
-- Explee/n8n dispatch remains controlled by a disabled server-side feature flag.

create table public.gtm_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  product_service text not null check (char_length(product_service) between 1 and 200),
  target_industries text not null check (char_length(target_industries) between 1 and 500),
  geographies text not null check (char_length(geographies) between 1 and 500),
  company_profile text not null check (char_length(company_profile) between 1 and 1200),
  buyer_roles text not null check (char_length(buyer_roles) between 1 and 800),
  pain_points text not null check (char_length(pain_points) between 1 and 1600),
  exclusions text check (exclusions is null or char_length(exclusions) <= 1000),
  lead_quantity integer not null check (lead_quantity between 1 and 500),
  structured_brief jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'dispatched', 'results_ready', 'cancelled')),
  approved_at timestamptz,
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id),
  check (
    (status = 'draft' and approved_at is null)
    or (status in ('approved', 'dispatched', 'results_ready') and approved_at is not null)
    or status = 'cancelled'
  ),
  check (dispatched_at is null or approved_at is not null)
);

create table public.gtm_lead_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  brief_id uuid not null,
  source text not null check (source in ('synthetic', 'explee')),
  external_id text,
  company_name text not null check (char_length(company_name) between 1 and 200),
  company_domain text,
  industry text,
  geography text,
  contact_name text,
  contact_title text,
  contact_email text,
  evidence jsonb not null default '[]'::jsonb,
  score integer not null check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  validation_status text not null default 'valid' check (validation_status in ('valid', 'invalid', 'duplicate')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (brief_id, owner_user_id) references public.gtm_briefs(id, owner_user_id) on delete cascade,
  check (company_domain is null or company_domain = lower(trim(company_domain))),
  check (contact_email is null or contact_email = lower(trim(contact_email))),
  check ((review_status = 'pending' and reviewed_at is null) or review_status <> 'pending')
);

create table public.gtm_ingestion_events (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null unique check (char_length(batch_id) between 1 and 200),
  brief_id uuid not null references public.gtm_briefs(id) on delete cascade,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index gtm_lead_candidates_source_external_idx
  on public.gtm_lead_candidates(source, external_id)
  where external_id is not null;
create unique index gtm_lead_candidates_owner_domain_idx
  on public.gtm_lead_candidates(owner_user_id, company_domain)
  where company_domain is not null and validation_status <> 'duplicate';
create unique index gtm_lead_candidates_owner_email_idx
  on public.gtm_lead_candidates(owner_user_id, contact_email)
  where contact_email is not null and validation_status <> 'duplicate';
create index gtm_briefs_owner_created_idx on public.gtm_briefs(owner_user_id, created_at desc);
create index gtm_candidates_owner_review_idx on public.gtm_lead_candidates(owner_user_id, review_status, score desc);

alter table public.gtm_briefs enable row level security;
alter table public.gtm_lead_candidates enable row level security;
alter table public.gtm_ingestion_events enable row level security;
revoke all on public.gtm_ingestion_events from anon, authenticated;

create policy "gtm_briefs_owner" on public.gtm_briefs for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);
create policy "gtm_candidates_owner" on public.gtm_lead_candidates for all to authenticated
  using ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id)
  with check ((select app_private.current_user_is_approved()) and (select auth.uid()) = owner_user_id);

grant select, insert, update, delete on public.gtm_briefs, public.gtm_lead_candidates to authenticated;

create trigger trg_gtm_briefs_updated_at before update on public.gtm_briefs
  for each row execute function public.set_updated_at();
create trigger trg_gtm_candidates_updated_at before update on public.gtm_lead_candidates
  for each row execute function public.set_updated_at();
