import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { EventListItem } from "@/components/event-card";
import { PageHeading } from "@/components/page-heading";
import { dayKey, fmt } from "@/lib/format";
import { getCityCounts, getDiscoverEvents, getProfileById, searchEvents } from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";
import {
  CATEGORY_LABELS,
  EVENT_CATEGORIES,
  type EventCategory,
  type EventWithMeta,
} from "@/lib/types";

export const metadata: Metadata = { title: "Search" };

const EXAMPLES = ["techno", "comedy", "rooftop", "21+", "karaoke"];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; cat?: string }>;
}) {
  const { q: qParam, city: cityParam, cat } = await searchParams;
  const userId = await requireUserId();
  const supabase = await createClient();
  const tz = await getTimeZone();
  const now = new Date();

  const q = (qParam ?? "").trim().slice(0, 120);
  const category = EVENT_CATEGORIES.includes(cat as EventCategory) ? (cat as EventCategory) : null;
  const [profile, cities] = await Promise.all([
    getProfileById(supabase, userId),
    getCityCounts(supabase),
  ]);

  // Browsing defaults to the viewer's own city when it has anything on;
  // searching looks everywhere unless a city is chosen explicitly.
  const city =
    cityParam !== undefined
      ? cityParam
      : !q &&
          profile?.city &&
          cities.some((c) => c.city.toLowerCase() === profile.city!.toLowerCase())
        ? profile.city
        : "";

  const events = q
    ? await searchEvents(supabase, { q, city: city || null, category })
    : await getDiscoverEvents(supabase, { city: city || null, category });

  const byDay = new Map<string, EventWithMeta[]>();
  for (const e of events) {
    const key = dayKey(e.starts_at, tz);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  const href = (next: { q?: string; city?: string; cat?: EventCategory | null }) => {
    const p = new URLSearchParams();
    const nq = next.q ?? q;
    const ncity = next.city ?? city;
    const ncat = next.cat === undefined ? category : next.cat;
    if (nq) p.set("q", nq);
    if (ncity || (cityParam !== undefined && ncity === "")) p.set("city", ncity);
    if (ncat) p.set("cat", ncat);
    const qs = p.toString();
    return `/discover${qs ? `?${qs}` : ""}`;
  };

  const emptyText = q
    ? `Nothing matches “${q}”${city ? ` in ${city}` : ""}${
        category ? ` under ${CATEGORY_LABELS[category].toLowerCase()}` : ""
      }.`
    : city
      ? `No upcoming events in ${city}${
          category ? ` for ${CATEGORY_LABELS[category].toLowerCase()}` : ""
        }.`
      : "No upcoming events yet.";

  return (
    <>
      <PageHeading
        title="Find something to go to"
        sub="Search any event on Headcount, then say you’re in"
      />

      <form action="/discover" method="get" role="search" className="mb-4">
        {city && <input type="hidden" name="city" value={city} />}
        {category && <input type="hidden" name="cat" value={category} />}
        <label htmlFor="q" className="sr-only">
          Search events
        </label>
        <div className="relative">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoComplete="off"
            placeholder="Artist, venue, party name, genre…"
            className="field py-3 pl-10 pr-24 text-base"
          />
          <button type="submit" className="btn btn-primary absolute right-1.5 top-1/2 -translate-y-1/2 py-1.5">
            Search
          </button>
        </div>
        {!q && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            Try
            {EXAMPLES.map((ex) => (
              <Link key={ex} href={href({ q: ex })} className="chip hover:bg-edge-2">
                {ex}
              </Link>
            ))}
          </p>
        )}
      </form>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="City">
        <Link
          href={href({ city: "" })}
          aria-current={city === "" ? "true" : undefined}
          className={`btn text-sm ${city === "" ? "btn-glow" : "btn-outline"}`}
        >
          Everywhere
        </Link>
        {cities.map((c) => {
          const active = city.toLowerCase() === c.city.toLowerCase();
          return (
            <Link
              key={c.city}
              href={href({ city: c.city })}
              aria-current={active ? "true" : undefined}
              className={`btn text-sm ${active ? "btn-glow" : "btn-outline"}`}
            >
              {c.city} <span className="text-xs opacity-70">{c.count}</span>
            </Link>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Type">
        <Link
          href={href({ cat: null })}
          aria-current={!category ? "true" : undefined}
          className={`chip ${!category ? "bg-fore text-canvas" : "hover:bg-edge-2"}`}
        >
          All types
        </Link>
        {EVENT_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={href({ cat: c })}
            aria-current={category === c ? "true" : undefined}
            className={`chip ${category === c ? "bg-fore text-canvas" : "hover:bg-edge-2"}`}
          >
            {CATEGORY_LABELS[c]}
          </Link>
        ))}
      </div>

      {q && events.length > 0 && (
        <p className="mb-3 text-sm text-muted">
          {events.length === 1 ? "1 event" : `${events.length} events`} for “{q}”
        </p>
      )}

      {events.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <h2 className="font-display text-lg font-bold">
            {q ? "No matches" : "Nothing coming up here"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-2">
            {emptyText} If you know about it, post it and it shows up for everyone.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            {q && (
              <Link href={href({ q: "", city: "", cat: null })} className="btn btn-outline">
                Clear search
              </Link>
            )}
            <Link href="/events/new" className="btn btn-primary">
              New post
            </Link>
          </div>
        </div>
      ) : (
        [...byDay.entries()].map(([key, dayEvents]) => (
          <section
            key={key}
            className="mb-6"
            aria-label={fmt(dayEvents[0].starts_at, tz, "EEEE, MMMM d")}
          >
            <h2 className="mb-1 font-display text-base font-bold">
              {fmt(dayEvents[0].starts_at, tz, "EEEE, MMMM d")}
            </h2>
            <ul>
              {dayEvents.map((e) => (
                <EventListItem key={e.id} event={e} tz={tz} currentUserId={userId} now={now} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
