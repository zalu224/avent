import type { Metadata } from "next";
import Link from "next/link";
import { EventListItem } from "@/components/event-card";
import { PageHeading } from "@/components/page-heading";
import { dayKey, fmt } from "@/lib/format";
import { getCityCounts, getDiscoverEvents, getProfileById } from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";
import { CATEGORY_LABELS, EVENT_CATEGORIES, type EventCategory, type EventWithMeta } from "@/lib/types";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; cat?: string }>;
}) {
  const { city: cityParam, cat } = await searchParams;
  const userId = await requireUserId();
  const supabase = await createClient();
  const tz = await getTimeZone();
  const now = new Date();

  const category = EVENT_CATEGORIES.includes(cat as EventCategory) ? (cat as EventCategory) : null;
  const [profile, cities] = await Promise.all([
    getProfileById(supabase, userId),
    getCityCounts(supabase),
  ]);

  // Default to the viewer's own city when it has anything on.
  const city =
    cityParam !== undefined
      ? cityParam
      : profile?.city && cities.some((c) => c.city.toLowerCase() === profile.city!.toLowerCase())
        ? profile.city
        : "";

  const events = await getDiscoverEvents(supabase, { city: city || null, category });

  const byDay = new Map<string, EventWithMeta[]>();
  for (const e of events) {
    const key = dayKey(e.starts_at, tz);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  const href = (nextCity: string, nextCat: EventCategory | null) => {
    const p = new URLSearchParams();
    if (nextCity !== null) p.set("city", nextCity);
    if (nextCat) p.set("cat", nextCat);
    const qs = p.toString();
    return `/discover${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeading title="Discover" sub="Everything posted on Headcount, by city" />

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="City">
        <Link
          href={href("", category)}
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
              href={href(c.city, category)}
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
          href={href(city, null)}
          aria-current={!category ? "true" : undefined}
          className={`chip ${!category ? "bg-cream text-ink" : "hover:bg-plum-3"}`}
        >
          All types
        </Link>
        {EVENT_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={href(city, c)}
            aria-current={category === c ? "true" : undefined}
            className={`chip ${category === c ? "bg-cream text-ink" : "hover:bg-plum-3"}`}
          >
            {CATEGORY_LABELS[c]}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <h2 className="font-display text-lg font-bold">Nothing coming up here</h2>
          <p className="mx-auto mt-2 max-w-sm text-lilac-2">
            {city ? `No upcoming events in ${city}${category ? ` for ${CATEGORY_LABELS[category].toLowerCase()}` : ""}.` : "No upcoming events yet."}{" "}
            Post a flyer and it shows up for everyone.
          </p>
          <Link href="/events/new" className="btn btn-primary mt-5">
            Post a flyer
          </Link>
        </div>
      ) : (
        [...byDay.entries()].map(([key, dayEvents]) => (
          <section key={key} className="mb-6" aria-label={fmt(dayEvents[0].starts_at, tz, "EEEE, MMMM d")}>
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
