-- Junto: where an event is, and how long it runs
--
-- An event was a single instant with no place. Both gaps show up the moment
-- you try to produce a calendar entry — the format requires an end — and
-- "where is this?" was only expressible as free text in the description.

alter table public.events
  add column if not exists location text;

alter table public.events
  add column if not exists duration_minutes int not null default 120
    check (duration_minutes > 0 and duration_minutes <= 24 * 60);

comment on column public.events.location is
  'Free text: a venue, an address, or "the church hall". Shown on the event page, in reminders, and as LOCATION in the calendar file.';

comment on column public.events.duration_minutes is
  'How long the event runs. Defaults to two hours, which is right for a potluck and adjustable for anything else.';
