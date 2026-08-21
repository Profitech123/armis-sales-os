-- Automatically maintain updated_at on every table that declares it.
-- A single trigger function is reused across all tables.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- accounts
create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- opportunities
create trigger trg_opportunities_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

-- meetings
create trigger trg_meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

-- action_items
create trigger trg_action_items_updated_at
  before update on public.action_items
  for each row execute function public.set_updated_at();

-- proposals
create trigger trg_proposals_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

-- tenders
create trigger trg_tenders_updated_at
  before update on public.tenders
  for each row execute function public.set_updated_at();

-- integration_connections
create trigger trg_integration_connections_updated_at
  before update on public.integration_connections
  for each row execute function public.set_updated_at();

-- communications
create trigger trg_communications_updated_at
  before update on public.communications
  for each row execute function public.set_updated_at();
