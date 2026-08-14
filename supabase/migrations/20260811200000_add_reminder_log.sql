-- Junto: reminder log
--
-- The cron that sends reminders can run late, run twice, or be retried after a
-- partial failure. Emails can't be unsent, so every send is recorded first and
-- the unique key is what makes a re-run safe rather than embarrassing.

create table if not exists public.sent_reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  -- 'claimant' goes to one signup; 'organizer_nudge' goes once per event.
  kind text not null check (kind in ('claimant', 'organizer_nudge')),
  -- The signup for a claimant reminder, null for an event-level one.
  signup_id uuid references public.signups(id) on delete cascade
);

-- One claimant reminder per signup per kind.
create unique index if not exists sent_reminders_signup_uniq
  on public.sent_reminders (kind, signup_id)
  where signup_id is not null;

-- One event-level reminder per event per kind.
create unique index if not exists sent_reminders_event_uniq
  on public.sent_reminders (kind, event_id)
  where signup_id is null;

create index if not exists sent_reminders_event_idx
  on public.sent_reminders (event_id);

alter table public.sent_reminders enable row level security;
-- No policies: only the service role writes here, and it bypasses RLS.
