import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EventListItem } from "@/components/event-card";
import { FollowButton } from "@/components/follow-button";
import { startDm } from "@/lib/actions/messages";
import { isPast, pluralize } from "@/lib/format";
import {
  getEventsByAuthor,
  getFollowers,
  getFollowing,
  getFollowingIds,
  getProfileByUsername,
  getProfileStats,
  getRsvpedEvents,
} from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";
import type { ProfileLite } from "@/lib/types";

type Tab = "posts" | "going" | "been" | "followers" | "following";
const TABS: Tab[] = ["posts", "going", "been", "followers", "following"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

function PeopleRows({
  people,
  myFollowing,
  currentUserId,
  emptyText,
}: {
  people: ProfileLite[];
  myFollowing: Set<string>;
  currentUserId: string;
  emptyText: string;
}) {
  if (people.length === 0) {
    return <p className="px-2 py-10 text-center text-muted-2">{emptyText}</p>;
  }
  return (
    <ul className="mt-2">
      {people.map((p) => (
        <li key={p.id} className="flex items-center gap-3 border-b border-edge py-3 last:border-0">
          <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar profile={p} size={40} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{p.display_name || p.username}</span>
              <span className="block truncate text-sm text-muted">@{p.username}</span>
            </span>
          </Link>
          {p.id !== currentUserId && (
            <FollowButton targetId={p.id} following={myFollowing.has(p.id)} size="sm" />
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ username }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "posts";

  const userId = await requireUserId();
  const supabase = await createClient();
  const tz = await getTimeZone();
  const now = new Date();

  const profile = await getProfileByUsername(supabase, username);
  if (!profile) notFound();

  const isMe = profile.id === userId;
  const [stats, myFollowingIds, posts, rsvps, followers, following] = await Promise.all([
    getProfileStats(supabase, profile.id),
    getFollowingIds(supabase, userId),
    getEventsByAuthor(supabase, profile.id),
    getRsvpedEvents(supabase, profile.id),
    tab === "followers" ? getFollowers(supabase, profile.id) : Promise.resolve([]),
    tab === "following" ? getFollowing(supabase, profile.id) : Promise.resolve([]),
  ]);
  const myFollowing = new Set(myFollowingIds);

  const goingList = rsvps
    .filter((r) => !isPast(r.event.starts_at, now))
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
  const beenList = rsvps.filter(
    (r) => isPast(r.event.starts_at, now) && (r.status === "going" || r.status === "went")
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "posts", label: "Posts", count: posts.length },
    { key: "going", label: "Going", count: goingList.length },
    { key: "been", label: "Been to", count: beenList.length },
    { key: "followers", label: "Followers", count: stats.followers },
    { key: "following", label: "Following", count: stats.following },
  ];

  const name = profile.display_name || profile.username;

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar profile={profile} size={88} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold leading-tight">{name}</h1>
            {isMe ? (
              <Link href="/settings" className="btn btn-outline text-sm">
                Edit profile
              </Link>
            ) : (
              <>
                <FollowButton targetId={profile.id} following={myFollowing.has(profile.id)} />
                <form action={startDm}>
                  <input type="hidden" name="user_id" value={profile.id} />
                  <button type="submit" className="btn btn-outline text-sm">
                    Message
                  </button>
                </form>
              </>
            )}
          </div>
          <p className="text-muted">@{profile.username}</p>
          {profile.city && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-2">
              <MapPin size={14} aria-hidden /> {profile.city}
            </p>
          )}
          {profile.bio && <p className="mt-2 leading-relaxed">{profile.bio}</p>}
          <p className="mt-3 text-sm text-muted-2">
            <span className="font-semibold text-fore">{stats.beenTo}</span>{" "}
            {stats.beenTo === 1 ? "event" : "events"} been to
            <span className="mx-2 text-edge-2" aria-hidden>
              |
            </span>
            <span className="font-semibold text-fore">{stats.posts}</span>{" "}
            {stats.posts === 1 ? "post" : "posts"}
          </p>
        </div>
      </header>

      <nav className="-mx-4 mt-8 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Profile sections">
        <div className="flex gap-1 border-b border-edge">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={
                t.key === "posts" ? `/u/${profile.username}` : `/u/${profile.username}?tab=${t.key}`
              }
              aria-current={tab === t.key ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.key
                  ? "border-glow text-fore"
                  : "border-transparent text-muted hover:text-fore"
              }`}
            >
              {t.label} <span className="text-muted">{t.count}</span>
            </Link>
          ))}
        </div>
      </nav>

      {tab === "followers" && (
        <PeopleRows
          people={followers}
          myFollowing={myFollowing}
          currentUserId={userId}
          emptyText={isMe ? "No followers yet. Share your profile with friends." : `${name} has no followers yet.`}
        />
      )}

      {tab === "following" && (
        <PeopleRows
          people={following}
          myFollowing={myFollowing}
          currentUserId={userId}
          emptyText={isMe ? "You’re not following anyone yet." : `${name} isn’t following anyone yet.`}
        />
      )}

      {(tab === "posts" || tab === "going" || tab === "been") &&
        (() => {
          const list =
            tab === "posts"
              ? posts
              : tab === "going"
                ? goingList.map((r) => r.event)
                : beenList.map((r) => r.event);

          if (list.length === 0) {
            return (
              <p className="px-2 py-10 text-center text-muted-2">
                {tab === "posts"
                  ? isMe
                    ? "You haven’t posted yet."
                    : `${name} hasn’t posted yet.`
                  : tab === "going"
                    ? "Nothing coming up."
                    : "No events logged yet. Mark past events as “Went” to build the list."}
              </p>
            );
          }

          return (
            <>
              <ul className="mt-2">
                {list.map((e) => (
                  <EventListItem
                    key={e.id}
                    event={e}
                    tz={tz}
                    currentUserId={userId}
                    now={now}
                    showAuthor={tab !== "posts"}
                  />
                ))}
              </ul>
              {tab === "been" && (
                <p className="mt-4 text-sm text-muted">
                  {pluralize(beenList.length, "night")} out and counting.
                </p>
              )}
            </>
          );
        })()}
    </>
  );
}
