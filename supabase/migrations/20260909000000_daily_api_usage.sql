-- Let callers pick the accounting period (a 'YYYY-MM' month or a 'YYYY-MM-DD'
-- day) so daily free quotas, like Google Programmable Search's 100/day, can be
-- capped alongside monthly ones.

drop function if exists public.consume_api_credits(text, integer, integer);

create or replace function public.consume_api_credits(
  p_provider text,
  p_amount integer,
  p_limit integer,
  p_period text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := coalesce(nullif(p_period, ''), to_char(now() at time zone 'utc', 'YYYY-MM'));
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

revoke execute on function public.consume_api_credits(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.consume_api_credits(text, integer, integer, text) to service_role;
