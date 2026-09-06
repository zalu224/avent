import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EventListItem } from "@/components/event-card";
import { FollowButton } from "@/components/follow-button";
import { isPast, pluralize } from "@/lib/format";
import {
  getEventsByAuthor,
  getProfileByUsername,
  getProfileStats,
  getRsvpedEvents,
  isFollowing,
} from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";

type Tab = "posts" | "going" | "been";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ username }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const tab: Tab = tabParam === "going" || tabParam === "been" ? tabParam : "posts";

  const userId = await requireUserId();
  const supabase = await createClient();
  const tz = await getTimeZone();
  const now = new Date();

  const profile = await getProfileByUsername(supabase, username);
  if (!profile) notFound();

  const isMe = profile.id === userId;
  const [stats, following, posts, rsvps] = await Promise.all([
    getProfileStats(supabase, profile.id),
    isMe ? Promise.resolve(false) : isFollowing(supabase, userId, profile.id),
    getEventsByAuthor(supabase, profile.id),
    getRsvpedEvents(supabase, profile.id),
  ]);

  const goingList = rsvps
    .filter((r) => !isPast(r.event.starts_at, now))
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
  const beenList = rsvps.filter(
    (r) => isPast(r.event.starts_at, now) && (r.status === "going" || r.status === "went")
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "posts", label: "Posts", count: posts.length },
    { key: "going", label: "Going", count: goingList.length },
    { key: "been", label: "Been to", count: beenList.length },
  ];

  const list = tab === "posts" ? posts : tab === "going" ? goingList.map((r) => r.event) : beenList.map((r) => r.event);

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar profile={profile} size={88} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold leading-tight">
              {profile.display_name || profile.username}
            </h1>
            {isMe ? (
              <Link href="/settings" className="btn btn-outline text-sm">
                Edit profile
              </Link>
            ) : (
              <FollowButton targetId={profile.id} following={following} />
            )}
          </div>
          <p className="text-lilac">@{profile.username}</p>
          {profile.city && (
            <p className="mt-1 flex items-center gap-1 text-sm text-lilac-2">
              <MapPin size={14} aria-hidden /> {profile.city}
            </p>
          )}
          {profile.bio && <p className="mt-2 leading-relaxed">{profile.bio}</p>}
          <p className="mt-3 text-sm text-lilac-2">
            <span className="font-semibold text-cream">{stats.followers}</span>{" "}
            {stats.followers === 1 ? "follower" : "followers"}
            {"  "}
            <span className="mx-2 text-plum-3" aria-hidden>
              |
            </span>
            <span className="font-semibold text-cream">{stats.following}</span> following
            <span className="mx-2 text-plum-3" aria-hidden>
              |
            </span>
            <span className="font-semibold text-cream">{stats.beenTo}</span>{" "}
            {stats.beenTo === 1 ? "event" : "events"} been to
          </p>
        </div>
      </header>

      <nav className="mt-8 flex gap-1 border-b border-plum-2" aria-label="Profile sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "posts" ? `/u/${profile.username}` : `/u/${profile.username}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-glow text-cream"
                : "border-transparent text-lilac hover:text-cream"
            }`}
          >
            {t.label} <span className="text-lilac">{t.count}</span>
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="px-2 py-10 text-center text-lilac-2">
          {tab === "posts"
            ? isMe
              ? "You haven’t posted a flyer yet."
              : `${profile.display_name || profile.username} hasn’t posted yet.`
            : tab === "going"
              ? "Nothing coming up."
              : "No events logged yet. Mark past events as “Went” to build the list."}
        </p>
      ) : (
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
      )}

      {tab === "been" && beenList.length > 0 && (
        <p className="mt-4 text-sm text-lilac">
          {pluralize(beenList.length, "night")} out and counting.
        </p>
      )}
    </>
  );
}
