import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Download, ExternalLink, Pencil } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CategoryChip } from "@/components/category-chip";
import { Comments } from "@/components/comments";
import { DateBadge } from "@/components/date-badge";
import { DeleteEventButton } from "@/components/delete-event-button";
import { whereLabel } from "@/components/event-card";
import { EventLinks } from "@/components/event-links";
import { RsvpButtons } from "@/components/rsvp-buttons";
import { ShareButton } from "@/components/share-button";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { fmt, isPast, relativeDay, timeAgo, timeLabel } from "@/lib/format";
import { getComments, getEvent } from "@/lib/queries";
import { getSiteUrl } from "@/lib/site";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";
import type { RsvpLite } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "Event" };
  const supabase = await createClient();
  const event = await getEvent(supabase, id);
  if (!event) return { title: "Event" };

  const tz = event.timezone || "UTC";
  const when = `${fmt(event.starts_at, tz, "EEE, MMM d")} at ${timeLabel(event.starts_at, tz)}`;
  const where = whereLabel(event);
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
      images: event.image_url ? [{ url: event.image_url, alt: `Photo for ${event.title}` }] : [],
    },
    twitter: {
      card: event.image_url ? "summary_large_image" : "summary",
      title: event.title,
      description,
      images: event.image_url ? [event.image_url] : [],
    },
  };
}

function PeopleList({ title, people }: { title: string; people: RsvpLite[] }) {
  if (people.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-2">
        {title} ({people.length})
      </h3>
      <ul className="flex flex-wrap gap-2">
        {people.map((r) =>
          r.profile ? (
            <li key={r.user_id}>
              <Link
                href={`/u/${r.profile.username}`}
                className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-sm hover:bg-edge"
              >
                <Avatar profile={r.profile} size={24} />
                {r.profile.display_name || r.profile.username}
              </Link>
            </li>
          ) : null
        )}
      </ul>
    </div>
  );
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const userId = await requireUserId();
  const supabase = await createClient();
  const tz = await getTimeZone();
  const now = new Date();

  const [event, comments, siteUrl] = await Promise.all([
    getEvent(supabase, id),
    getComments(supabase, id),
    getSiteUrl(),
  ]);
  if (!event) notFound();

  const eventUrl = `${siteUrl}/events/${event.id}`;
  const past = isPast(event.starts_at, now);
  const mine = event.rsvps.find((r) => r.user_id === userId)?.status ?? null;
  const going = event.rsvps.filter((r) => r.status === "going" || r.status === "went");
  const interested = event.rsvps.filter((r) => r.status === "interested");
  const where = whereLabel(event);
  const isAuthor = event.author_id === userId;

  return (
    <article>
      {event.image_url && (
        <Image
          src={event.image_url}
          alt={`Photo for ${event.title}`}
          width={1200}
          height={1500}
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className="mb-6 max-h-[40rem] w-full rounded-card border border-edge object-contain bg-surface"
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
        </div>
      </div>

      {/* Primary action: your RSVP. */}
      <div className="mt-5">
        <RsvpButtons eventId={event.id} status={mine} past={past} />
      </div>

      {/* Secondary actions: one compact row that wraps cleanly on phones. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {event.ticket_url && (
          <a
            href={event.ticket_url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="btn btn-outline text-sm"
          >
            Tickets <ExternalLink size={14} aria-hidden />
          </a>
        )}
        <ShareButton title={event.title} />
        {!past && (
          <details className="group relative">
            <summary className="btn btn-outline cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
              <CalendarPlus size={14} aria-hidden />
              <span className="sm:hidden">Calendar</span>
              <span className="hidden sm:inline">Add to calendar</span>
            </summary>
            <div className="absolute left-0 z-10 mt-2 w-56 rounded-xl border border-edge-2 bg-surface p-1 shadow-card">
              <a
                href={googleCalendarUrl(event, eventUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-edge"
              >
                <CalendarPlus size={14} aria-hidden /> Google Calendar
              </a>
              <a
                href={`/events/${event.id}/calendar.ics`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-edge"
              >
                <Download size={14} aria-hidden /> Apple / Outlook (.ics)
              </a>
            </div>
          </details>
        )}
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
        {event.tags.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted">Tags</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {event.tags.map((t) => (
                <Link key={t} href={`/discover?q=${encodeURIComponent(t)}`} className="chip hover:bg-edge-2">
                  {t}
                </Link>
              ))}
            </dd>
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

      <EventLinks event={event} hideTickets={Boolean(event.ticket_url)} />

      <section className="mt-8 flex gap-3 border-t border-edge pt-6">
        <Link href={`/u/${event.author.username}`} className="shrink-0">
          <Avatar profile={event.author} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            Posted by{" "}
            <Link href={`/u/${event.author.username}`} className="font-semibold text-fore hover:underline">
              {event.author.display_name || event.author.username}
            </Link>{" "}
            {timeAgo(event.created_at, now)}
            {event.ai_extracted && " · details filled in by AI"}
          </p>
          {event.caption && <p className="mt-1 whitespace-pre-line leading-relaxed">{event.caption}</p>}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-4 border-t border-edge pt-6" aria-label="Who's in">
        <h2 className="font-display text-lg font-bold">
          {going.length === 0 && interested.length === 0
            ? past
              ? "Nobody logged this one"
              : "Nobody’s in yet"
            : past
              ? "Who went"
              : "Who’s in"}
        </h2>
        <PeopleList title={past ? "Went" : "Going"} people={going} />
        <PeopleList title="Interested" people={interested} />
      </section>

      <Comments eventId={event.id} comments={comments} currentUserId={userId} />

      {isAuthor && (
        <div className="mt-10 flex flex-wrap items-center justify-end gap-2 border-t border-edge pt-4">
          <Link href={`/events/${event.id}/edit`} className="btn btn-outline text-sm">
            <Pencil size={14} aria-hidden /> Edit
          </Link>
          <DeleteEventButton eventId={event.id} />
        </div>
      )}
    </article>
  );
}
