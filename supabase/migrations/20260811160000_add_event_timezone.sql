-- Junto: event timezone
--
-- event_at is a timestamptz, so the instant is correct — but rendering it with
-- the server's timezone is not. On a UTC host a 6pm Chicago potluck printed as
-- "Saturday, November 28 at 12:00 AM": wrong time and wrong day.
--
-- These are in-person events, so the right zone is where the event happens,
-- not where the server or the viewer is. Everyone should read "6:00 PM".

alter table public.events
  add column if not exists event_tz text;

comment on column public.events.event_tz is
  'IANA zone the event happens in, e.g. America/Chicago. Captured from the organizer''s browser. Null on rows created before this column existed; those fall back to UTC and are labelled as such.';
