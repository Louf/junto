-- Junto schema
-- Run in Supabase SQL editor.

create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- =====================
-- Tables
-- =====================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  event_at timestamptz not null,
  banner_path text,
  creator_email citext not null,
  creator_user_id uuid references auth.users(id) on delete set null,
  edit_token text not null unique,
  slug text not null unique
);
create index if not exists events_creator_email_idx on public.events (creator_email);
create index if not exists events_creator_user_id_idx on public.events (creator_user_id);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text,
  capacity int not null check (capacity > 0),
  sort_order int not null default 0
);
create index if not exists jobs_event_id_idx on public.jobs (event_id);

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  email citext not null,
  note text,
  cancel_token text not null unique
);
create index if not exists signups_job_id_idx on public.signups (job_id);
create unique index if not exists signups_job_email_uniq on public.signups (job_id, email);

-- =====================
-- Row Level Security
-- =====================

alter table public.events enable row level security;
alter table public.jobs enable row level security;
alter table public.signups enable row level security;

-- Public read for events / jobs / signups (signup roster public for v1).
drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events for select using (true);

drop policy if exists "jobs public read" on public.jobs;
create policy "jobs public read" on public.jobs for select using (true);

drop policy if exists "signups public read" on public.signups;
create policy "signups public read" on public.signups for select using (true);

-- Authenticated creators can update / delete their own events.
drop policy if exists "events owner update" on public.events;
create policy "events owner update" on public.events for update
  using (auth.uid() is not null and auth.uid() = creator_user_id);

drop policy if exists "events owner delete" on public.events;
create policy "events owner delete" on public.events for delete
  using (auth.uid() is not null and auth.uid() = creator_user_id);

drop policy if exists "jobs owner all" on public.jobs;
create policy "jobs owner all" on public.jobs for all
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.events e
      where e.id = jobs.event_id and e.creator_user_id = auth.uid()
    )
  )
  with check (
    auth.uid() is not null
    and exists (
      select 1 from public.events e
      where e.id = jobs.event_id and e.creator_user_id = auth.uid()
    )
  );

-- Inserts / token-based mutations are performed server-side with the service role,
-- which bypasses RLS. No anon insert policies are defined intentionally.

-- =====================
-- Storage bucket
-- =====================
insert into storage.buckets (id, name, public)
values ('event-banners', 'event-banners', true)
on conflict (id) do nothing;

drop policy if exists "event banners public read" on storage.objects;
create policy "event banners public read" on storage.objects for select
  using (bucket_id = 'event-banners');

-- Uploads are performed server-side via the service role; no anon insert policy.

-- =====================
-- RPC: attach existing events to a new account by email
-- =====================
create or replace function public.claim_events_by_email()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email citext;
  v_count int;
begin
  if v_uid is null then
    return 0;
  end if;
  select email::citext into v_email from auth.users where id = v_uid;
  if v_email is null then
    return 0;
  end if;
  update public.events
     set creator_user_id = v_uid
   where creator_email = v_email
     and creator_user_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.claim_events_by_email() to authenticated;
