import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, MessageCircle } from "lucide-react";
import { Avatar } from "./avatar";
import { DateBadge } from "./date-badge";
import { Headcount } from "./headcount";
import { RsvpButtons } from "./rsvp-buttons";
import { ShareButton } from "./share-button";
import { isPast, relativeDay, timeAgo, timeLabel } from "@/lib/format";
import { CATEGORY_LABELS, type EventCategory, type EventWithMeta, type RsvpLite } from "@/lib/types";

export function whereLabel(event: Pick<EventWithMeta, "venue_name" | "city">) {
  return [event.venue_name, event.city].filter(Boolean).join(", ");
}

const CATEGORY_GRADIENT: Record<EventCategory, string> = {
  concert: "from-flare/80 via-plum-3 to-ink",
  rave: "from-glow/70 via-flare/50 to-ink",
  club: "from-plum-3 via-flare/60 to-ink",
  festival: "from-glow/80 via-plum-3 to-ink",
  party: "from-flare/70 via-glow/40 to-ink",
  sports: "from-glow/60 via-plum-3 to-ink",
  comedy: "from-glow/70 via-plum-2 to-ink",
  art: "from-lilac/60 via-plum-3 to-ink",
  food: "from-glow/60 via-flare/40 to-ink",
  other: "from-plum-3 via-plum-2 to-ink",
};

/** "alice and bob are in" / "alice, bob and 3 others are in". */
function WhoIsIn({ going, past }: { going: RsvpLite[]; past: boolean }) {
  const named = going.filter((r) => r.profile).slice(0, 2);
  if (named.length === 0) return null;
  const others = going.length - named.length;
  const verb = past ? "went" : "are in";
  const singleVerb = past ? "went" : "is in";

  return (
    <p className="text-sm">
      {named.map((r, i) => (
        <span key={r.user_id}>
          {i > 0 && (others > 0 ? ", " : " and ")}
          <Link href={`/u/${r.profile!.username}`} className="font-semibold hover:underline">
            {r.profile!.username}
          </Link>
        </span>
      ))}
      {others > 0 && (
        <>
          {" "}
          and <span className="font-semibold">{others} {others === 1 ? "other" : "others"}</span>
        </>
      )}{" "}
      {named.length + others === 1 ? singleVerb : verb}
    </p>
  );
}

/** Instagram-style feed post: header, full-width flyer, actions, headcount, caption. */
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
  const going = event.rsvps.filter((r) => r.status === "going" || r.status === "went");
  const where = whereLabel(event);
  const href = `/events/${event.id}` as const;
  const comments = event.comment_count ?? 0;

  return (
    <article className="mb-2 border-b border-plum-2 pb-5 md:card md:mb-6 md:border md:pb-4">
      <header className="flex items-center gap-3 py-3 md:px-4">
        <Link href={`/u/${event.author.username}`} className="shrink-0">
          <Avatar profile={event.author} size={36} className="ring-2 ring-flare/70 ring-offset-2 ring-offset-ink" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={`/u/${event.author.username}`} className="block truncate text-sm font-semibold hover:underline">
            {event.author.username}
          </Link>
          <p className="truncate text-xs text-lilac">
            {where || CATEGORY_LABELS[event.category]}
          </p>
        </div>
        <span className="shrink-0 text-xs text-lilac">{timeAgo(event.created_at, now)}</span>
      </header>

      <Link href={href} className="relative -mx-4 block md:mx-0" aria-label={`Open ${event.title}`}>
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={`Flyer for ${event.title}`}
            width={1080}
            height={1350}
            sizes="(max-width: 768px) 100vw, 672px"
            className="aspect-[4/5] w-full bg-plum object-contain"
          />
        ) : (
          <div
            className={`flex aspect-[4/5] w-full items-end bg-gradient-to-br p-6 ${CATEGORY_GRADIENT[event.category]}`}
          >
            <h2 className="font-display text-3xl font-black leading-[1.05] text-cream drop-shadow md:text-4xl">
              {event.title}
            </h2>
          </div>
        )}
        <div className="absolute left-3 top-3 shadow-lg">
          <DateBadge iso={event.starts_at} tz={tz} past={past} />
        </div>
      </Link>

      <div className="flex items-center gap-1 pt-3 md:px-4">
        <RsvpButtons eventId={event.id} status={mine} past={past} size="sm" />
        <Link href={`${href}#comments-heading`} aria-label="Plans" className="btn btn-ghost px-2">
          <MessageCircle size={20} aria-hidden />
        </Link>
        <ShareButton title={event.title} url={href} compact />
        {!past && (
          <a
            href={`${href}/calendar.ics`}
            aria-label="Add to calendar"
            className="btn btn-ghost ml-auto px-2"
          >
            <CalendarPlus size={20} aria-hidden />
          </a>
        )}
      </div>

      <div className="flex flex-col gap-1.5 pt-2 md:px-4">
        {going.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {going
                .filter((r) => r.profile)
                .slice(0, 3)
                .map((r) => (
                  <Avatar key={r.user_id} profile={r.profile!} size={22} className="ring-2 ring-ink" />
                ))}
            </div>
            <WhoIsIn going={going} past={past} />
          </div>
        ) : (
          <Headcount rsvps={event.rsvps} past={past} />
        )}

        <div>
          <Link href={href} className="font-display text-base font-bold leading-snug hover:underline">
            {event.title}
          </Link>
          <p className="text-sm text-lilac-2">
            {relativeDay(event.starts_at, tz, now)} at {timeLabel(event.starts_at, tz)}
            {where ? `, ${where}` : ""}
          </p>
        </div>

        {event.caption && (
          <p className="text-sm leading-relaxed">
            <Link href={`/u/${event.author.username}`} className="font-semibold hover:underline">
              {event.author.username}
            </Link>{" "}
            <span className="whitespace-pre-line">{event.caption}</span>
          </p>
        )}

        {event.tags.length > 0 && (
          <p className="text-sm text-lilac">
            {event.tags.slice(0, 4).map((t) => (
              <Link key={t} href={`/discover?q=${encodeURIComponent(t)}`} className="mr-2 hover:underline">
                #{t.replace(/\s+/g, "")}
              </Link>
            ))}
          </p>
        )}

        {comments > 0 && (
          <Link href={`${href}#comments-heading`} className="text-sm text-lilac hover:underline">
            View {comments === 1 ? "the plan" : `all ${comments} plans`}
          </Link>
        )}
      </div>
    </article>
  );
}

/** Compact one-line row used on profiles, search and the calendar. */
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
