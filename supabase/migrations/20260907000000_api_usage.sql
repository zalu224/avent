-- Monthly usage ledger for metered third-party APIs (Tavily today), so the app
-- can stop calling a provider before it exceeds a free plan.

create table public.api_usage (
  provider text not null,
  period text not null, -- 'YYYY-MM' in UTC
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (provider, period)
);
alter table public.api_usage enable row level security;
-- No policies on purpose: only the service role reads or writes it.
grant select, insert, update on public.api_usage to service_role;

-- Atomically reserve credits for the current month. Returns true when the
-- reservation fits under the limit, false (and nothing consumed) otherwise.
create or replace function public.consume_api_credits(
  p_provider text,
  p_amount integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_used integer;
begin
  insert into public.api_usage (provider, period, used)
  values (p_provider, v_period, 0)
  on conflict (provider, period) do nothing;

  select used into v_used
  from public.api_usage
  where provider = p_provider and period = v_period
  for update;

  if v_used + p_amount > p_limit then
    return false;
  end if;

  update public.api_usage
  set used = v_used + p_amount, updated_at = now()
  where provider = p_provider and period = v_period;
  return true;
end;
$$;

revoke execute on function public.consume_api_credits(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_credits(text, integer, integer) to service_role;
