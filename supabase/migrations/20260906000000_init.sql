-- Headcount: initial schema
-- Social event discovery: profiles, follows, events (AI-extracted from flyers), rsvps, comments.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.event_category as enum (
  'concert', 'rave', 'club', 'festival', 'party', 'sports', 'comedy', 'art', 'food', 'other'
);

create type public.rsvp_status as enum ('interested', 'going', 'went');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text,
  bio text check (bio is null or char_length(bio) <= 300),
  city text check (city is null or char_length(city) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_id_idx on public.follows (following_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  caption text check (caption is null or char_length(caption) <= 2000),
  description text check (description is null or char_length(description) <= 2000),
  category public.event_category not null default 'other',
  venue_name text check (venue_name is null or char_length(venue_name) <= 120),
  address text check (address is null or char_length(address) <= 200),
  city text check (city is null or char_length(city) <= 80),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at > starts_at),
  lineup text[] not null default '{}',
  price text check (price is null or char_length(price) <= 80),
  ticket_url text check (ticket_url is null or char_length(ticket_url) <= 500),
  image_url text,
  image_path text,
  ai_extracted boolean not null default false,
  ai_confidence real check (ai_confidence is null or ai_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_author_id_idx on public.events (author_id);
create index events_starts_at_idx on public.events (starts_at);
create index events_created_at_idx on public.events (created_at desc);

create table public.rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null default 'going',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index rsvps_user_id_idx on public.rsvps (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_event_id_created_at_idx on public.comments (event_id, created_at);
create index comments_author_id_idx on public.comments (author_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute function private.set_updated_at();
create trigger rsvps_set_updated_at before update on public.rsvps
  for each row execute function private.set_updated_at();

-- Create a profile row for every new auth user. Username is derived from
-- sign-up metadata (sanitised) or the email local part, de-duplicated with a
-- numeric suffix. SECURITY DEFINER is required to write public.profiles from
-- an auth.users trigger; it lives in the private schema and is not callable
-- by API roles.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, ''), '@', 1), 'user'),
    '[^a-z0-9_]', '', 'g'
  ));
  if char_length(base) < 3 then
    base := 'user' || base;
  end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1), ''), 60)
  );
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Data API grants (tables are not exposed automatically on new projects)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.rsvps to authenticated;
grant select, insert, delete on public.comments to authenticated;

grant select on public.profiles to anon;

grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.comments enable row level security;

-- profiles: everyone signed in can browse people; you can only edit yourself.
-- anon may read profiles so sign-up can check username availability.
create policy "profiles are readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "profiles are readable by anon" on public.profiles
  for select to anon using (true);
create policy "users insert their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- follows: the graph is visible; you can only follow/unfollow as yourself.
create policy "follows are readable by signed-in users" on public.follows
  for select to authenticated using (true);
create policy "users follow as themselves" on public.follows
  for insert to authenticated with check ((select auth.uid()) = follower_id);
create policy "users unfollow as themselves" on public.follows
  for delete to authenticated using ((select auth.uid()) = follower_id);

-- events: visible to everyone signed in (feed/calendar filter by follow graph
-- in the app); only the author can edit or delete.
create policy "events are readable by signed-in users" on public.events
  for select to authenticated using (true);
create policy "users post events as themselves" on public.events
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "authors update their events" on public.events
  for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
create policy "authors delete their events" on public.events
  for delete to authenticated using ((select auth.uid()) = author_id);

-- rsvps: headcounts are visible to signed-in users; you control only your own.
create policy "rsvps are readable by signed-in users" on public.rsvps
  for select to authenticated using (true);
create policy "users rsvp as themselves" on public.rsvps
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update their own rsvp" on public.rsvps
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users remove their own rsvp" on public.rsvps
  for delete to authenticated using ((select auth.uid()) = user_id);

-- comments
create policy "comments are readable by signed-in users" on public.comments
  for select to authenticated using (true);
create policy "users comment as themselves" on public.comments
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "authors delete their comments" on public.comments
  for delete to authenticated using ((select auth.uid()) = author_id);

-- ---------------------------------------------------------------------------
-- Storage: flyer / event photos and avatars
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images', 'event-images', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "event images are publicly readable" on storage.objects
  for select to anon, authenticated using (bucket_id = 'event-images');
create policy "users upload into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "users update their own images" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'event-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete their own images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
