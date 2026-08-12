-- Junto: event cancellation
--
-- Cancelling marks rather than deletes. Anyone who already sent money needs
-- the page to still resolve — a 404 tells them nothing and leaves them with
-- no way to find out what happened.

alter table public.events add column if not exists cancelled_at timestamptz;

-- Optional note from the organizer, shown on the cancelled page.
alter table public.events add column if not exists cancel_reason text;

create index if not exists events_cancelled_at_idx
  on public.events (cancelled_at)
  where cancelled_at is not null;
