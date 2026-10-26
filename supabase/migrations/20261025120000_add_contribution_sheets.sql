-- Junto: contribution sheets
--
-- A second kind of event. Instead of jobs with a fixed number of slots, the
-- organizer lists everyone on a team and a few ways to contribute (food,
-- serving, money). Each person finds their name and ticks what they'll do —
-- the shared-spreadsheet version of a clipboard passed round after church.
--
-- Nobody signs in and there are no emails: anyone with the link can tick any
-- row, the same trust a paper sheet has. The organizer can tidy up from the
-- manage page.

alter table public.events
  add column if not exists kind text not null default 'slots'
    check (kind in ('slots', 'sheet'));

comment on column public.events.kind is
  '''slots'' = jobs people claim a limited number of places in. ''sheet'' = a list of names ticking contribution columns.';

-- =====================
-- Tables
-- =====================

create table if not exists public.sheet_columns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  sort_order int not null default 0
);
create index if not exists sheet_columns_event_id_idx on public.sheet_columns (event_id);

create table if not exists public.sheet_rows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- e.g. "Lasagna" or "Can serve until 1pm". Editable by anyone with the link.
  note text check (note is null or char_length(note) <= 200),
  -- True when someone added their own name from the public page, so the
  -- organizer can spot additions they didn't make.
  self_added boolean not null default false,
  sort_order int not null default 0
);
create index if not exists sheet_rows_event_id_idx on public.sheet_rows (event_id);

-- A tick is the presence of a row; unticking deletes it. The primary key makes
-- a double-tap or a retried request harmless.
create table if not exists public.sheet_ticks (
  row_id uuid not null references public.sheet_rows(id) on delete cascade,
  column_id uuid not null references public.sheet_columns(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (row_id, column_id)
);
create index if not exists sheet_ticks_column_id_idx on public.sheet_ticks (column_id);

-- =====================
-- Row Level Security
-- =====================

alter table public.sheet_columns enable row level security;
alter table public.sheet_rows enable row level security;
alter table public.sheet_ticks enable row level security;

drop policy if exists "sheet columns public read" on public.sheet_columns;
create policy "sheet columns public read" on public.sheet_columns for select using (true);

drop policy if exists "sheet rows public read" on public.sheet_rows;
create policy "sheet rows public read" on public.sheet_rows for select using (true);

drop policy if exists "sheet ticks public read" on public.sheet_ticks;
create policy "sheet ticks public read" on public.sheet_ticks for select using (true);

-- Every write goes through server actions using the service role, which
-- bypasses RLS. No anon insert/update/delete policies, on purpose.
