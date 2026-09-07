-- Notification preferences, reminder bookkeeping, event timezones, and
-- public (signed-out) read access to event pages for share links.

alter table public.profiles
  add column email_notifications boolean not null default true,
  add column reminder_emails boolean not null default true;

-- The poster's IANA timezone at creation, so reminder emails show local times.
alter table public.events
  add column timezone text not null default 'UTC' check (char_length(timezone) <= 64);

-- One row per reminder actually sent, so a cron re-run never emails twice.
create table public.reminders_sent (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('day_before')),
  sent_at timestamptz not null default now(),
  primary key (event_id, user_id, kind)
);
create index reminders_sent_user_id_idx on public.reminders_sent (user_id);
alter table public.reminders_sent enable row level security;
-- No policies on purpose: only the service role (cron) reads or writes it.
grant select, insert on public.reminders_sent to service_role;

-- Share links: anyone can open an event page. RSVPs and comments stay
-- signed-in only; the public page shows the event itself and a sign-up prompt.
grant select on public.events to anon;
create policy "events are readable by anon" on public.events
  for select to anon using (true);
