import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { PageHeading } from "@/components/page-heading";
import { getActivity, type ActivityItem } from "@/lib/activity";
import { timeAgo } from "@/lib/format";
import { createClient, requireUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activity" };

function Line({ item }: { item: ActivityItem }) {
  const name = item.actor.display_name || item.actor.username;
  const who = (
    <Link href={`/u/${item.actor.username}`} className="font-semibold hover:underline">
      {name}
    </Link>
  );

  if (item.kind === "follow") {
    return <>{who} started following you.</>;
  }

  const eventLink = (
    <Link href={`/events/${item.event.id}`} className="font-semibold hover:underline">
      {item.event.title}
    </Link>
  );

  if (item.kind === "rsvp") {
    const verb =
      item.status === "going"
        ? "is going to"
        : item.status === "went"
          ? "went to"
          : "is interested in";
    return (
      <>
        {who} {verb} {eventLink}.
      </>
    );
  }

  return (
    <>
      {who} on {eventLink}: <span className="text-lilac-2">{item.body}</span>
    </>
  );
}

export default async function ActivityPage() {
  const userId = await requireUserId();
  const supabase = await createClient();
  const now = new Date();
  const items = await getActivity(supabase, userId);

  return (
    <>
      <PageHeading title="Activity" sub="Follows, headcounts and plans that involve you" />

      {items.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <h2 className="font-display text-lg font-bold">Quiet for now</h2>
          <p className="mx-auto mt-2 max-w-sm text-lilac-2">
            When someone follows you, says they’re in for one of your events, or replies on a plan
            you’re part of, it shows up here.
          </p>
          <Link href="/people" className="btn btn-primary mt-5">
            Find people to follow
          </Link>
        </div>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 border-b border-plum-2 py-3 last:border-0">
              <Link href={`/u/${item.actor.username}`} className="shrink-0">
                <Avatar profile={item.actor} size={36} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="leading-snug">
                  <Line item={item} />
                </p>
                <p className="mt-0.5 text-xs text-lilac">{timeAgo(item.at, now)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
