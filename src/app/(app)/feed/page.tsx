import type { Metadata } from "next";
import Link from "next/link";
import { DateBadge } from "@/components/date-badge";
import { EventCard } from "@/components/event-card";
import { PageHeading } from "@/components/page-heading";
import { fmt } from "@/lib/format";
import { getFeed, getUpcomingFromCircle } from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage() {
  const userId = await requireUserId();
  const supabase = await createClient();
  const tz = await getTimeZone();
  const now = new Date();

  const [events, upcoming] = await Promise.all([
    getFeed(supabase, userId),
    getUpcomingFromCircle(supabase, userId, 8),
  ]);

  return (
    <>
      <PageHeading title="Feed" sub="What your people are going to" />

      {upcoming.length > 0 && (
        <section aria-label="Up next" className="-mx-4 mb-6 overflow-x-auto px-4 md:-mx-8 md:px-8">
          <ul className="flex gap-3">
            {upcoming.map((e) => (
              <li key={e.id} className="w-44 shrink-0">
                <Link
                  href={`/events/${e.id}`}
                  className="card flex h-full flex-col gap-2 p-3 hover:border-plum-3"
                >
                  <DateBadge iso={e.starts_at} tz={tz} size="sm" />
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">{e.title}</span>
                  <span className="mt-auto text-xs text-lilac">
                    {fmt(e.starts_at, tz, "h:mm aaa")}
                    {e.venue_name ? ` at ${e.venue_name}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <h2 className="font-display text-lg font-bold">Your feed is empty</h2>
          <p className="mx-auto mt-2 max-w-sm text-lilac-2">
            Follow a few people to see what they’re going to, or post the first flyer yourself.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/people" className="btn btn-outline">
              Find people
            </Link>
            <Link href="/events/new" className="btn btn-primary">
              Post a flyer
            </Link>
          </div>
        </div>
      ) : (
        <div>
          {events.map((event) => (
            <EventCard key={event.id} event={event} tz={tz} currentUserId={userId} now={now} />
          ))}
        </div>
      )}
    </>
  );
}
