-- Direct messages and group chats.
--
--   conversations          one row per DM or group
--   conversation_members   who is in it, and how far they have read
--   messages               the messages themselves
--
-- Membership checks go through is_conversation_member() (security definer) so
-- the row-level policies on conversation_members don't recurse into themselves.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm', 'group')),
  title text check (title is null or char_length(title) between 1 and 80),
  -- For DMs: the two user ids sorted and joined, so a pair only ever has one thread.
  dm_key text unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_members to authenticated;
grant select, insert, delete on public.messages to authenticated;

create or replace function public.is_conversation_member(p_conversation uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = p_user
  );
$$;
revoke execute on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated, service_role;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "members read their conversations" on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id, (select auth.uid())));
create policy "members rename their groups" on public.conversations
  for update to authenticated
  using (kind = 'group' and public.is_conversation_member(id, (select auth.uid())))
  with check (kind = 'group' and public.is_conversation_member(id, (select auth.uid())));

create policy "members see who is in their conversations" on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id, (select auth.uid())));
create policy "group members add people" on public.conversation_members
  for insert to authenticated
  with check (
    public.is_conversation_member(conversation_id, (select auth.uid()))
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.kind = 'group')
  );
create policy "members track their own reads" on public.conversation_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "members leave groups" on public.conversation_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.kind = 'group')
  );

create policy "members read messages" on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id, (select auth.uid())));
create policy "members send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id, (select auth.uid()))
  );
create policy "senders unsend their messages" on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Creating a conversation inserts several rows at once, so it goes through one
-- function: a DM reuses the existing thread for the pair, a group needs a name.
create or replace function public.create_conversation(p_kind text, p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  others uuid[];
  other uuid;
  key text;
  conv uuid;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  select coalesce(array_agg(distinct m), '{}') into others
  from unnest(p_member_ids) as m
  where m <> me and exists (select 1 from public.profiles p where p.id = m);

  if p_kind = 'dm' then
    if array_length(others, 1) <> 1 then
      raise exception 'a direct message needs exactly one other person';
    end if;
    other := others[1];
    key := least(me, other)::text || ':' || greatest(me, other)::text;
    select id into conv from public.conversations where dm_key = key;
    if conv is not null then
      return conv;
    end if;
    insert into public.conversations (kind, dm_key, created_by)
    values ('dm', key, me)
    returning id into conv;
    insert into public.conversation_members (conversation_id, user_id, role)
    values (conv, me, 'owner'), (conv, other, 'member');
    return conv;
  elsif p_kind = 'group' then
    if array_length(others, 1) is null then
      raise exception 'a group needs at least one other person';
    end if;
    insert into public.conversations (kind, title, created_by)
    values ('group', left(nullif(trim(coalesce(p_title, '')), ''), 80), me)
    returning id into conv;
    insert into public.conversation_members (conversation_id, user_id, role)
    select conv, m, 'member' from unnest(others) as m;
    insert into public.conversation_members (conversation_id, user_id, role)
    values (conv, me, 'owner');
    return conv;
  end if;
  raise exception 'unknown conversation kind %', p_kind;
end;
$$;
revoke execute on function public.create_conversation(text, text, uuid[]) from public, anon;
grant execute on function public.create_conversation(text, text, uuid[]) to authenticated, service_role;

-- Keep the inbox ordering and previews current, and count the sender as caught up.
create or replace function private.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at, last_message_preview = left(new.body, 120)
  where id = new.conversation_id;

  update public.conversation_members
  set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;

create trigger on_message_insert
  after insert on public.messages
  for each row execute function private.on_message_insert();

-- Live updates in open threads.
alter publication supabase_realtime add table public.messages;
