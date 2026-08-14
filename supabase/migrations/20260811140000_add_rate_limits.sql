-- Junto: shared rate limiting
--
-- Replaces an in-memory limiter, which on serverless kept a separate counter
-- per instance and reset on every cold start. This lives in the database the
-- app already has, so every instance counts against the same bucket.

create table if not exists public.rate_limits (
  bucket_key text not null,
  -- Fixed window: now() floored to the window size.
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- No policies: only the service role touches this, and it bypasses RLS.

/**
 * Increment and test in one statement.
 *
 * The insert-on-conflict-do-update is atomic, so two concurrent requests
 * can't both read the same count and each decide they're under the limit.
 */
create or replace function public.rate_limit_hit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (bucket_key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set count = rate_limits.count + 1
  returning rate_limits.count into v_count;

  -- Opportunistic sweep. A cron job would be tidier, but this keeps the table
  -- bounded without depending on pg_cron being available.
  if random() < 0.01 then
    delete from public.rate_limits
     where window_start < now() - interval '1 day';
  end if;

  if v_count > p_limit then
    return query
      select
        false,
        greatest(
          1,
          ceil(
            extract(
              epoch from (
                v_window_start + make_interval(secs => p_window_seconds) - now()
              )
            )
          )::int
        );
  else
    return query select true, 0;
  end if;
end;
$$;

-- Security definer, so keep it off the public API surface.
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
