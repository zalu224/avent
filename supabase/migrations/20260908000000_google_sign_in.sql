-- Google sign-in: new users created through Google arrive with `full_name`
-- (and sometimes `given_name` / `family_name`) plus an `avatar_url` in their
-- metadata instead of the first/last name fields our sign-up form sends.
-- Fill the profile from whichever is present.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text;
  candidate text;
  n int := 0;
  full_n text := nullif(trim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '');
  first_n text := left(coalesce(
    nullif(trim(coalesce(meta ->> 'first_name', meta ->> 'given_name', '')), ''),
    nullif(split_part(full_n, ' ', 1), '')
  ), 40);
  last_n text := left(coalesce(
    nullif(trim(coalesce(meta ->> 'last_name', meta ->> 'family_name', '')), ''),
    nullif(trim(substr(full_n, length(split_part(full_n, ' ', 1)) + 1)), '')
  ), 40);
  avatar text := nullif(trim(coalesce(meta ->> 'avatar_url', meta ->> 'picture', '')), '');
begin
  base := lower(regexp_replace(
    coalesce(
      nullif(meta ->> 'username', ''),
      nullif(meta ->> 'preferred_username', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'user'
    ),
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

  insert into public.profiles (id, username, display_name, first_name, last_name, avatar_url)
  values (
    new.id,
    candidate,
    left(coalesce(
      nullif(meta ->> 'display_name', ''),
      full_n,
      nullif(trim(concat_ws(' ', first_n, last_n)), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    ), 60),
    first_n,
    last_n,
    case when avatar ~* '^https://' then avatar end
  );
  return new;
end;
$$;
