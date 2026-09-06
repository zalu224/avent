# Headcount

Post a flyer for the concert, the rave, the club night. Headcount reads the flyer with AI, puts the
event on your friends' calendars, and shows you who's in, so nobody goes alone.

- **Follow friends** and see the events they post in your feed and on a shared calendar.
- **Post a flyer**: upload the photo, Claude extracts title, date, venue, lineup and price; you
  confirm and post. Authors can edit or delete their posts.
- **I'm in / Maybe**: RSVP, see the headcount, and plan in the thread on each event.
- **Search**: find any event by artist, venue, party name, genre or tag, filter by city and type,
  and say you're in straight from the results. Claude tags each flyer with genres and vibes so
  searches like "techno" or "21+" work. Ranked full-text + trigram search lives in Postgres
  (`search_events()`), so partial words match too.
- **Activity**: new followers, RSVPs on your posts, and replies on plans you're part of.
- **Add to calendar**: Google Calendar link or an `.ics` download on every event, plus share links.
- **Been to**: past events you marked as going become your going-out history.

## Stack

| Layer     | Choice                                                         |
| --------- | -------------------------------------------------------------- |
| App       | Next.js 16 (App Router, Server Actions), React 19, Tailwind 4  |
| Data/Auth | Supabase (Postgres, Auth, Storage) via the Vercel Marketplace  |
| AI        | Vercel AI SDK + AI Gateway, `anthropic/claude-sonnet-5` vision |
| Hosting   | Vercel (auto-deploys from GitHub)                              |

## Local development

```bash
npm install
vercel link                      # once, links this folder to the Vercel project
vercel env pull .env.local       # pulls Supabase keys + VERCEL_OIDC_TOKEN for AI Gateway
npm run dev
```

## Database

Schema lives in `supabase/migrations/`. Apply it to the linked Supabase project with the
connection string Vercel provides:

```bash
vercel env pull .env.local
supabase db push --db-url "$POSTGRES_URL_NON_POOLING"
```

Migrations, in order: `20260906000000_init` (tables, RLS, storage bucket + policies),
`20260906010000_event_search` (tags + ranked search), `20260906020000_profile_names` (first/last
name). If you apply them by pasting into the SQL editor, run the whole file each time; the storage
section at the end of the first one is easy to miss.

Everything is behind row-level security. Signed-in users can read profiles, events, RSVPs and
comments; they can only write rows they own. Flyers go in the public `event-images` storage bucket,
scoped to a folder per user.

## Environment variables

Set automatically by the Supabase integration on Vercel (pull them with `vercel env pull`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `..._PUBLISHABLE_KEY`)
- `POSTGRES_URL_NON_POOLING` (used only for migrations)

Optional:

- `NEXT_PUBLIC_SITE_URL`: absolute origin for auth emails (defaults to the request host)
- `AI_GATEWAY_API_KEY`: only needed outside Vercel if you don't have `VERCEL_OIDC_TOKEN`
- `EVENT_EXTRACTION_MODEL`: override the vision model (default `anthropic/claude-sonnet-5`)

## Deployment notes

- New Vercel projects protect the `*.vercel.app` production URL with Vercel Authentication. To
  make the site public, set Project Settings → Deployment Protection → Vercel Authentication to
  "Only Preview Deployments", or attach a custom domain.
- Until the Supabase integration has populated the env vars, the app renders a "not connected"
  notice instead of failing. Redeploy after the integration is attached.

## Auth notes

- Email + password sign-in. New Supabase projects require email confirmation; turn it off under
  Authentication → Providers → Email in the Supabase dashboard if you'd rather skip it while
  testing.
- Add your production and preview URLs to Authentication → URL Configuration → Redirect URLs
  (`https://<your-app>.vercel.app/auth/callback`).

## Project layout

```
src/app/(auth)        login, signup
src/app/(app)         feed, discover, calendar, activity, events/new, events/[id] (+ edit, calendar.ics),
                      u/[username], people, settings
src/app/auth/callback email confirmation handler
src/lib/actions       server actions (auth, events, social)
src/lib/ai            flyer extraction (AI SDK structured output)
src/lib/supabase      browser/server clients + session-refresh proxy
src/lib/queries.ts    data access helpers
src/proxy.ts          Next.js proxy (session refresh + auth redirects)
supabase/migrations   database schema, RLS, storage policies
```
