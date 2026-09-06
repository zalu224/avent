-- Organizer and official links on events, with a record of how they were verified.

alter table public.events
  add column organizer_name text check (organizer_name is null or char_length(organizer_name) <= 120),
  add column organizer_url text check (organizer_url is null or char_length(organizer_url) <= 500),
  add column event_url text check (event_url is null or char_length(event_url) <= 500),
  -- How each stored link was checked: {"ticket_url": {"source": "google"|"flyer"|"user", "checked_at": iso, "safe_browsing": "ok"|"unchecked"|"flagged"}, ...}
  add column link_checks jsonb not null default '{}'::jsonb;

-- Keep search in sync with the organizer name.
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
    new.title, lineup_text, tags_text, new.organizer_name, new.venue_name, new.city, new.address,
    new.description, new.caption
  ));
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('simple', lineup_text), 'A')
    || setweight(to_tsvector('simple', coalesce(new.organizer_name, '')), 'B')
    || setweight(to_tsvector('simple', tags_text), 'B')
    || setweight(to_tsvector('simple', concat_ws(' ', new.venue_name, new.city)), 'B')
    || setweight(to_tsvector('simple', concat_ws(' ', new.description, new.caption)), 'C');
  return new;
end;
$$;
