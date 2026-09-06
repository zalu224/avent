-- Event search: tags, a maintained search text/vector, trigram + GIN indexes,
-- and a ranked search_events() function callable from the app.

create extension if not exists pg_trgm with schema extensions;

alter table public.events
  add column tags text[] not null default '{}',
  add column search_text text not null default '',
  add column search_vector tsvector;

-- Keep the searchable text and weighted vector in sync with the row.
create or replace function private.events_search_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  lineup_text text := coalesce(array_to_string(new.lineup, ' '), '');
  tags_text text := coalesce(array_to_string(new.tags, ' '), '');
begin
  new.search_text := lower(concat_ws(' ',
    new.title, lineup_text, tags_text, new.venue_name, new.city, new.address,
    new.description, new.caption
  ));
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('simple', lineup_text), 'A')
    || setweight(to_tsvector('simple', tags_text), 'B')
    || setweight(to_tsvector('simple', concat_ws(' ', new.venue_name, new.city)), 'B')
    || setweight(to_tsvector('simple', concat_ws(' ', new.description, new.caption)), 'C');
  return new;
end;
$$;

create trigger events_search_update
  before insert or update on public.events
  for each row execute function private.events_search_update();

-- Backfill any existing rows.
update public.events set title = title;

create index events_search_vector_idx on public.events using gin (search_vector);
create index events_search_text_trgm_idx on public.events using gin (search_text extensions.gin_trgm_ops);
create index events_tags_idx on public.events using gin (tags);

-- Ranked search. Matches whole words via full-text search and partial words via
-- trigram ILIKE, so "boil" finds "Boiler Room". Runs as the caller (RLS applies).
create or replace function public.search_events(
  q text,
  only_upcoming boolean default true,
  max_results integer default 60
)
returns setof public.events
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select lower(trim(coalesce(q, ''))) as term
  )
  select e.*
  from public.events e, params p
  where (not only_upcoming or e.starts_at >= now() - interval '6 hours')
    and (
      p.term = ''
      or e.search_vector @@ websearch_to_tsquery('simple', p.term)
      or e.search_text ilike '%' || p.term || '%'
    )
  order by
    case when p.term = '' then 0 else ts_rank(e.search_vector, websearch_to_tsquery('simple', p.term)) end desc,
    case when p.term = '' then 0 else extensions.similarity(e.search_text, p.term) end desc,
    e.starts_at asc
  limit greatest(1, least(coalesce(max_results, 60), 200))
$$;

revoke execute on function public.search_events(text, boolean, integer) from public, anon;
grant execute on function public.search_events(text, boolean, integer) to authenticated, service_role;
