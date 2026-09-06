import Image from "next/image";
import Link from "next/link";
import { Avatar } from "./avatar";
import { CategoryChip } from "./category-chip";
import { DateBadge } from "./date-badge";
import { Headcount } from "./headcount";
import { RsvpButtons } from "./rsvp-buttons";
import { isPast, relativeDay, timeAgo, timeLabel } from "@/lib/format";
import type { EventWithMeta } from "@/lib/types";

export function whereLabel(event: Pick<EventWithMeta, "venue_name" | "city">) {
  return [event.venue_name, event.city].filter(Boolean).join(", ");
}

export function EventCard({
  event,
  tz,
  currentUserId,
  now,
}: {
  event: EventWithMeta;
  tz: string;
  currentUserId: string;
  now: Date;
}) {
  const mine = event.rsvps.find((r) => r.user_id === currentUserId)?.status ?? null;
  const past = isPast(event.starts_at, now);
  const authorName = event.author.display_name || event.author.username;
  const where = whereLabel(event);

  return (
    <article className="border-b border-plum-2 py-6 first:pt-0">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href={`/u/${event.author.username}`}
          className="flex min-w-0 items-center gap-2.5 hover:underline"
        >
          <Avatar profile={event.author} size={34} />
          <span className="truncate font-semibold">{authorName}</span>
          <span className="truncate text-sm text-lilac">@{event.author.username}</span>
        </Link>
        <span className="ml-auto shrink-0 text-sm text-lilac">{timeAgo(event.created_at, now)}</span>
      </header>

      <div className="flex gap-4">
        <Link href={`/events/${event.id}`} aria-label={`Open ${event.title}`}>
          <DateBadge iso={event.starts_at} tz={tz} past={past} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/events/${event.id}`}>
            <h2 className="font-display text-lg font-bold leading-snug hover:underline md:text-xl">
              {event.title}
            </h2>
          </Link>
          <p className="mt-1 text-lilac-2">
            {relativeDay(event.starts_at, tz, now)} at {timeLabel(event.starts_at, tz)}
          </p>
          {where && <p className="text-lilac-2">{where}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <CategoryChip category={event.category} />
            {event.tags.slice(0, 3).map((t) => (
              <Link key={t} href={`/discover?q=${encodeURIComponent(t)}`} className="chip hover:bg-plum-3">
                {t}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {event.image_url && (
        <Link href={`/events/${event.id}`} className="mt-4 block">
          <Image
            src={event.image_url}
            alt={`Flyer for ${event.title}`}
            width={960}
            height={1200}
            sizes="(max-width: 768px) 100vw, 672px"
            className="max-h-[36rem] w-full rounded-card border border-plum-2 object-cover"
          />
        </Link>
      )}

      {event.caption && (
        <p className="mt-3 whitespace-pre-line leading-relaxed">{event.caption}</p>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Headcount rsvps={event.rsvps} past={past} />
        <RsvpButtons eventId={event.id} status={mine} past={past} size="sm" />
      </footer>
    </article>
  );
}

/** Compact one-line row used on profiles and the calendar. */
export function EventListItem({
  event,
  tz,
  currentUserId,
  now,
  showAuthor = true,
}: {
  event: EventWithMeta;
  tz: string;
  currentUserId: string;
  now: Date;
  showAuthor?: boolean;
}) {
  const mine = event.rsvps.find((r) => r.user_id === currentUserId)?.status ?? null;
  const past = isPast(event.starts_at, now);
  const where = whereLabel(event);

  return (
    <li className="flex items-center gap-3 border-b border-plum-2 py-3 last:border-0">
      <Link href={`/events/${event.id}`} aria-label={`Open ${event.title}`}>
        <DateBadge iso={event.starts_at} tz={tz} past={past} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/events/${event.id}`} className="block truncate font-semibold hover:underline">
          {event.title}
        </Link>
        <p className="truncate text-sm text-lilac">
          {timeLabel(event.starts_at, tz)}
          {where && ` at ${where}`}
          {showAuthor && (
            <>
              {" "}
              <span aria-hidden>·</span> posted by{" "}
              <Link href={`/u/${event.author.username}`} className="hover:underline">
                @{event.author.username}
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="hidden sm:block">
        <Headcount rsvps={event.rsvps} past={past} max={3} />
      </div>
      <RsvpButtons eventId={event.id} status={mine} past={past} size="sm" />
    </li>
  );
}
