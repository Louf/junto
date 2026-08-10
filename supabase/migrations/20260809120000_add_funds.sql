-- Junto: fund collection
--
-- Junto never touches money. A fund records who fronted the cost and where to
-- send repayment; contributions are self-reported by payers and confirmed by
-- the organizer. No processor, no payouts, no custody.

-- =====================
-- Tables
-- =====================

create table if not exists public.funds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  -- Only 'reimburse' for now. 'goal' and 'split' are planned.
  mode text not null default 'reimburse' check (mode in ('reimburse', 'goal', 'split')),
  -- Who paid up front, shown to payers so they know who they're sending to.
  payer_name text not null,
  -- What was spent in total, and what each person owes. Both are nullable:
  -- an organizer can set up where to send money before they've done the
  -- shopping, then fill in the amounts later. The public pay card stays
  -- hidden until both are set.
  total_cents int check (total_cents > 0),
  share_cents int check (share_cents > 0),
  method text not null check (method in ('venmo', 'cashapp', 'paypal', 'zelle')),
  -- Handle only, never a full URL — the URL is built server-side so an
  -- organizer cannot point the pay button at an arbitrary domain.
  handle text not null,
  note text
);
create index if not exists funds_event_id_idx on public.funds (event_id);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  name text not null,
  amount_cents int not null check (amount_cents > 0),
  -- 'pledged' = payer says they sent it. 'confirmed' = organizer saw it land.
  status text not null default 'pledged' check (status in ('pledged', 'confirmed'))
);
create index if not exists contributions_fund_id_idx on public.contributions (fund_id);

-- =====================
-- Row Level Security
-- =====================

alter table public.funds enable row level security;
alter table public.contributions enable row level security;

drop policy if exists "funds public read" on public.funds;
create policy "funds public read" on public.funds for select using (true);

drop policy if exists "contributions public read" on public.contributions;
create policy "contributions public read" on public.contributions for select using (true);

drop policy if exists "funds owner all" on public.funds;
create policy "funds owner all" on public.funds for all
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.events e
      where e.id = funds.event_id and e.creator_user_id = auth.uid()
    )
  )
  with check (
    auth.uid() is not null
    and exists (
      select 1 from public.events e
      where e.id = funds.event_id and e.creator_user_id = auth.uid()
    )
  );

-- Token-based mutations run server-side with the service role, which bypasses
-- RLS. No anon insert policies are defined intentionally.
