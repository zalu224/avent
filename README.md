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
| AI        | Vercel AI SDK; Gemini (free tier, with Google Search grounding) first, Qwen VL as backup |
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

## Flyer reading and organizer lookup

`src/lib/ai/providers.ts` builds a chain of vision models from whichever keys are set, and the
flyer is read by the first one that works:

1. **Google Gemini** (`GOOGLE_GENERATIVE_AI_API_KEY`, free tier from AI Studio).
2. **Qwen VL on OpenRouter** (`OPENROUTER_API_KEY`), cheap and hosted but flyer-only.
3. **Qwen VL on Ollama** (`OLLAMA_BASE_URL`), free on your own machine, local dev only.
4. **Anthropic** (`ANTHROPIC_API_KEY`) and finally **Vercel AI Gateway**.

### Finding the organizer

`find-organizer.ts` looks the event up on the web to find the real promoter, the official event
page and the ticket link. It first tries Gemini's Google Search grounding (only works on a billed
Gemini key; free keys get "resource exhausted"), then falls back to a search API, Tavily
(`TAVILY_API_KEY`, free tier) or Brave (`BRAVE_SEARCH_API_KEY`), whose results are handed to
whichever text model is configured. That is how a flyer-only model like Qwen still "knows" about
the event: it reads the search results. Any link the model proposes must match a host the search
actually returned.

### Link safety

Every organizer, event and ticket link goes through `src/lib/links.ts` before it is stored or shown:

- only `http(s)` URLs, no embedded credentials, no private or local hosts;
- redirects are followed server-side so shorteners resolve to the real destination, and links
  that never resolve are dropped;
- links Gemini suggests are kept only when their domain matches one of the Google Search
  sources returned with the answer, so the model can't invent a URL;
- links printed on the flyer are accepted once they resolve; links typed by the poster are
  verified fresh on save;
- with `GOOGLE_SAFE_BROWSING_API_KEY` set, every link is checked against Google Safe Browsing
  and flagged ones are dropped;
- the provenance of each link is signed during analysis (`link-token.ts`) so a client can't
  claim a link was "found on Google", and each link shows its domain and provenance on the
  event page. External links open with `rel="noopener noreferrer nofollow ugc"`.

## Email (Resend)

Two kinds of email, both branded Headcount:

1. **Auth emails** (confirm sign-up, sign-in link, password reset, email change) are sent by
   Supabase Auth through Resend's SMTP relay. Templates live in `src/lib/email/auth-emails.tsx`;
   run `npx tsx scripts/render-auth-emails.tsx` to regenerate `supabase/templates/*.html`, then
   paste them into Supabase → Authentication → Email Templates (or push `supabase/config.toml`).
   SMTP settings in Supabase → Authentication → SMTP: host `smtp.resend.com`, port `465`,
   username `resend`, password = your Resend API key, sender = an address on a domain verified in
   Resend (`onboarding@resend.dev` only delivers to your own inbox while testing).
2. **Notifications** are sent from the app with the Resend SDK (`src/lib/email/notify.ts`): a new
   follower, someone saying "I'm in" on your event, and replies on your event's plan thread.
   These need `RESEND_API_KEY`, `EMAIL_FROM`, and `SUPABASE_SECRET_KEY` (only used server-side to
   look up the recipient's address). Without those keys the app simply skips sending.

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
