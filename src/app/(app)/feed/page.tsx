import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EventCard } from "@/components/event-card";
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
    getUpcomingFromCircle(supabase, userId, 10),
  ]);

  return (
    <>
      {upcoming.length > 0 && (
        <section
          aria-label="Up next"
          className="-mx-4 mb-4 overflow-x-auto border-b border-plum-2 px-4 pb-4 md:mx-0 md:border-0 md:px-0"
        >
          <ul className="flex gap-4">
            {upcoming.map((e) => {
              const iAmIn = e.rsvps.some((r) => r.user_id === userId && r.status !== "interested");
              return (
                <li key={e.id} className="w-16 shrink-0 text-center">
                  <Link href={`/events/${e.id}`} className="block" aria-label={e.title}>
                    <span
                      className={`block rounded-full p-[3px] ${
                        iAmIn
                          ? "bg-gradient-to-tr from-glow to-flare"
                          : "bg-gradient-to-tr from-flare to-plum-3"
                      }`}
                    >
                      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-plum ring-2 ring-ink">
                        {e.image_url ? (
                          <Image
                            src={e.image_url}
                            alt=""
                            width={56}
                            height={56}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="font-display text-lg font-black">
                            {fmt(e.starts_at, tz, "d")}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-lilac-2">
                      {fmt(e.starts_at, tz, "EEE d")}
                    </span>
                  </Link>
                </li>
              );
            })}
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
