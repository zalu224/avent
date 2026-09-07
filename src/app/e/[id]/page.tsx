import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CategoryChip } from "@/components/category-chip";
import { DateBadge } from "@/components/date-badge";
import { EventLinks } from "@/components/event-links";
import { fmt, isPast, relativeDay, timeLabel } from "@/lib/format";
import { getSiteUrl } from "@/lib/site";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";
import type { EventRow, ProfileLite } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublicEvent = EventRow & { author: ProfileLite | null };

async function loadPublicEvent(id: string): Promise<PublicEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*, author:profiles!events_author_id_fkey(id, username, display_name, avatar_url)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as PublicEvent | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "Event" };
  const event = await loadPublicEvent(id);
  if (!event) return { title: "Event" };
  const tz = isPast(event.starts_at) ? "UTC" : event.timezone || "UTC";
  const when = `${fmt(event.starts_at, tz, "EEE, MMM d")} at ${timeLabel(event.starts_at, tz)}`;
  const where = [event.venue_name, event.city].filter(Boolean).join(", ");
  const description = [when, where].filter(Boolean).join(" · ") + " · See who's going on Headcount";
  const siteUrl = await getSiteUrl();
  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      url: `${siteUrl}/events/${event.id}`,
      siteName: "Headcount",
      type: "website",
      images: event.image_url ? [{ url: event.image_url, alt: `Flyer for ${event.title}` }] : [],
    },
    twitter: {
      card: event.image_url ? "summary_large_image" : "summary",
      title: event.title,
      description,
      images: event.image_url ? [event.image_url] : [],
    },
  };
}

/** Signed-out view of an event, used for shared links. */
export default async function PublicEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  // Signed-in people get the full page with RSVPs and the plan thread.
  if (await getCurrentUserId()) redirect(`/events/${id}`);

  const event = await loadPublicEvent(id);
  if (!event) notFound();

  const tz = await getTimeZone();
  const now = new Date();
  const past = isPast(event.starts_at, now);
  const where = [event.venue_name, event.city].filter(Boolean).join(", ");
  const nextParam = encodeURIComponent(`/events/${event.id}`);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-black tracking-tight">
          Headcount
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/login?next=${nextParam}`} className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Create account
          </Link>
        </div>
      </header>

      <article>
        {event.image_url && (
          <Image
            src={event.image_url}
            alt={`Flyer for ${event.title}`}
            width={1200}
            height={1500}
            priority
            sizes="(max-width: 768px) 100vw, 672px"
            className="mb-6 max-h-[40rem] w-full rounded-card border border-edge bg-surface object-contain"
          />
        )}

        <div className="flex gap-4">
          <DateBadge iso={event.starts_at} tz={tz} past={past} size="lg" />
          <div className="min-w-0 flex-1">
            <CategoryChip category={event.category} />
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight md:text-3xl">
              {event.title}
            </h1>
            <p className="mt-2 text-lg text-muted-2">
              {relativeDay(event.starts_at, tz, now)} at {timeLabel(event.starts_at, tz)}
              {event.ends_at && ` until ${timeLabel(event.ends_at, tz)}`}
            </p>
            {where && <p className="text-muted-2">{where}</p>}
            {event.author && (
              <p className="mt-1 text-sm text-muted">Posted by @{event.author.username}</p>
            )}
          </div>
        </div>

        <div className="card mt-6 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Who’s going?</h2>
            <p className="text-sm text-muted-2">
              Join Headcount to see the headcount, say you’re in, and plan the night together.
            </p>
          </div>
          <Link href={`/signup?next=${nextParam}`} className="btn btn-primary shrink-0">
            I’m in
          </Link>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {event.address && (
            <div>
              <dt className="text-sm text-muted">Address</dt>
              <dd>{event.address}</dd>
            </div>
          )}
          {event.price && (
            <div>
              <dt className="text-sm text-muted">Price</dt>
              <dd>{event.price}</dd>
            </div>
          )}
          {event.lineup.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Lineup</dt>
              <dd>{event.lineup.join(", ")}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-muted">Full date</dt>
            <dd>{fmt(event.starts_at, tz, "EEEE, MMMM d, yyyy")}</dd>
          </div>
        </dl>

        {event.description && (
          <p className="mt-5 whitespace-pre-line leading-relaxed">{event.description}</p>
        )}

        <EventLinks event={event} />
      </article>
    </div>
  );
}
