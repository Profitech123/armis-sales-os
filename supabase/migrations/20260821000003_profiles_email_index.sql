-- Normalize profile emails so webhook ownership lookups are unambiguous and
-- can use a regular indexed equality predicate.
update public.profiles set email = lower(trim(email));

create unique index if not exists profiles_email_idx
  on public.profiles (email);

alter table public.profiles
  add constraint profiles_email_lowercase_check
  check (email = lower(trim(email)));
