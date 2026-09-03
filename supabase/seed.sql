-- Local development seed data.
--
-- RLS on every table is scoped to owner_user_id = auth.uid(), so this seed
-- only produces visible rows once you replace :seed_user_id below with the
-- auth.users.id of a real signed-in local test user (e.g. from `select id
-- from auth.users where email = 'you@example.com'`). Safe to re-run —
-- inserts are idempotent via fixed UUIDs + `on conflict do nothing`.

\set seed_user_id '00000000-0000-0000-0000-000000000000'

insert into public.accounts (id, owner_user_id, name, industry)
values ('11111111-1111-1111-1111-111111111111', :'seed_user_id', 'DEWA', 'Utilities')
on conflict (owner_user_id, name) do nothing;

insert into public.opportunities (id, owner_user_id, account_id, name, owner_name, stage, value_amount, probability, expected_close_date, next_step, health_score, attention)
values (
  '22222222-2222-2222-2222-222222222222',
  :'seed_user_id',
  '11111111-1111-1111-1111-111111111111',
  'AI Smart Library',
  'Elio Berberi',
  'Proposal preparation',
  2500000,
  50,
  '2026-11-30',
  'Submit revised concept proposal',
  64,
  'Overdue'
)
on conflict (id) do nothing;

insert into public.meetings (id, owner_user_id, opportunity_id, title, started_at, attendees, transcript, summary, sentiment, processed_at)
values (
  '33333333-3333-3333-3333-333333333333',
  :'seed_user_id',
  '22222222-2222-2222-2222-222222222222',
  'DEWA Smart Library — discovery and proposal alignment',
  '2026-07-20 10:00:00+04',
  '[{"name":"Hend Al Ali","role":"Initiative owner"},{"name":"Elio Berberi","role":"Armis sales"}]'::jsonb,
  'Hend: We want one concept that brings together the digital library, AI assistance, RFID automation and the robotics layer. Elio: We can structure the concept around a unified software platform and clearly assign responsibilities across Armis, Profitech and the technology vendors.',
  'DEWA wants a single future-library proposition combining AI knowledge services, RFID, self-service and robotics.',
  'Positive',
  '2026-07-20 11:00:00+04'
)
on conflict (id) do nothing;

insert into public.meeting_insights (owner_user_id, meeting_id, kind, content, evidence_quote, evidence_timestamp_seconds, confidence)
values
  (:'seed_user_id', '33333333-3333-3333-3333-333333333333', 'summary', 'DEWA wants one integrated future-library experience rather than separate products.', null, null, 0.9),
  (:'seed_user_id', '33333333-3333-3333-3333-333333333333', 'buying_signal', 'The customer explicitly requested a revised proposal and vendor shortlist.', 'Please send the revised concept with the vendor shortlist and the Microsoft architecture included.', 1647, 0.85),
  (:'seed_user_id', '33333333-3333-3333-3333-333333333333', 'risk', 'Commercial ownership and integration responsibility across Armis, Profitech and vendors remain unclear.', null, null, 0.7)
on conflict do nothing;

insert into public.proposals (id, owner_user_id, opportunity_id, title, version, content, status, submitted_at)
values (
  '44444444-4444-4444-4444-444444444444',
  :'seed_user_id',
  '22222222-2222-2222-2222-222222222222',
  'DEWA AI Smart Library Concept',
  1,
  '{"sections":[{"title":"Executive summary","body":"Armis proposes an integrated AI-enabled library ecosystem combining enterprise knowledge access, bilingual conversational assistance, RFID automation, self-service and a coordinated robotics layer."},{"title":"Proposed solution","body":"A single digital front door provides employees and visitors with search, discovery, recommendations, service requests and AI-powered guidance across Arabic and English."}]}'::jsonb,
  'pending',
  '2026-07-18 09:00:00+04'
)
on conflict (id) do nothing;

insert into public.tenders (id, owner_user_id, account_id, title, reference, due_at, requirements, status)
values (
  '55555555-5555-5555-5555-555555555555',
  :'seed_user_id',
  '11111111-1111-1111-1111-111111111111',
  'AI Governance and Security',
  'EOI AI-GOV-2026',
  '2026-07-29 17:00:00+04',
  '[{"id":"R-001","requirement":"AI governance framework","type":"Mandatory","status":"Complete","owner":"Elio","partner":null,"dueDate":"23 Jul"},{"id":"R-002","requirement":"Security control mapping","type":"Mandatory","status":"Partial","owner":"Technical","partner":"Microsoft","dueDate":"24 Jul"}]'::jsonb,
  'pending'
)
on conflict (id) do nothing;
