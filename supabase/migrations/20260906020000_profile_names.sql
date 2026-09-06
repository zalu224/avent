-- Split names: first and last name on profiles, populated at sign-up.

alter table public.profiles
  add column first_name text check (first_name is null or char_length(first_name) <= 40),
  add column last_name text check (last_name is null or char_length(last_name) <= 40);

-- Backfill from the existing display name (first word / rest).
update public.profiles
set
  first_name = nullif(split_part(display_name, ' ', 1), ''),
  last_name = nullif(trim(substr(display_name, length(split_part(display_name, ' ', 1)) + 1)), '')
where first_name is null and display_name <> '';

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
  first_n text := left(nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''), 40);
  last_n text := left(nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), ''), 40);
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

  insert into public.profiles (id, username, display_name, first_name, last_name)
  values (
    new.id,
    candidate,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(trim(concat_ws(' ', first_n, last_n)), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    ), 60),
    first_n,
    last_n
  );
  return new;
end;
$$;
