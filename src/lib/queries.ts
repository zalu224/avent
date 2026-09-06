import type { SupabaseServerClient } from "@/lib/supabase/server";
import type {
  CommentWithAuthor,
  EventCategory,
  EventWithMeta,
  Profile,
  ProfileLite,
  ProfileStats,
  RsvpStatus,
} from "@/lib/types";

const PROFILE_LITE = "id, username, display_name, avatar_url";

export const EVENT_SELECT = `*,
  author:profiles!events_author_id_fkey(${PROFILE_LITE}),
  rsvps(user_id, status, profile:profiles!rsvps_user_id_fkey(${PROFILE_LITE}))`;

type Db = SupabaseServerClient;

export async function getProfileById(db: Db, id: string): Promise<Profile | null> {
  const { data } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function getProfileByUsername(db: Db, username: string): Promise<Profile | null> {
  const { data } = await db
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function getFollowingIds(db: Db, userId: string): Promise<string[]> {
  const { data } = await db.from("follows").select("following_id").eq("follower_id", userId);
  return (data ?? []).map((r) => r.following_id as string);
}

export async function getFollowerIds(db: Db, userId: string): Promise<string[]> {
  const { data } = await db.from("follows").select("follower_id").eq("following_id", userId);
  return (data ?? []).map((r) => r.follower_id as string);
}

export async function isFollowing(db: Db, followerId: string, followingId: string) {
  const { data } = await db
    .from("follows")
    .select("follower_id")
    .match({ follower_id: followerId, following_id: followingId })
    .maybeSingle();
  return Boolean(data);
}

function sortByStart(events: EventWithMeta[]) {
  return [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

function uniqueById(events: EventWithMeta[]) {
  const seen = new Map<string, EventWithMeta>();
  for (const e of events) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()];
}

/** Newest posts from people you follow, plus your own, with comment counts. */
export async function getFeed(db: Db, userId: string): Promise<EventWithMeta[]> {
  const following = await getFollowingIds(db, userId);
  const { data } = await db
    .from("events")
    .select(EVENT_SELECT)
    .in("author_id", [userId, ...following])
    .order("created_at", { ascending: false })
    .limit(60);
  const events = (data as unknown as EventWithMeta[]) ?? [];
  if (events.length === 0) return events;

  const { data: comments } = await db
    .from("comments")
    .select("event_id")
    .in(
      "event_id",
      events.map((e) => e.id)
    )
    .limit(5000);
  const counts = new Map<string, number>();
  for (const c of comments ?? []) {
    const id = c.event_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return events.map((e) => ({ ...e, comment_count: counts.get(e.id) ?? 0 }));
}

/** Upcoming events from your circle for the discover strip. */
export async function getUpcomingFromCircle(
  db: Db,
  userId: string,
  limit = 8
): Promise<EventWithMeta[]> {
  const following = await getFollowingIds(db, userId);
  const { data } = await db
    .from("events")
    .select(EVENT_SELECT)
    .in("author_id", [userId, ...following])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  return (data as unknown as EventWithMeta[]) ?? [];
}

export type CalendarFilter = "all" | "going" | "mine";

export async function getCalendarEvents(
  db: Db,
  userId: string,
  fromIso: string,
  toIso: string,
  filter: CalendarFilter
): Promise<EventWithMeta[]> {
  const inRange = () =>
    db.from("events").select(EVENT_SELECT).gte("starts_at", fromIso).lte("starts_at", toIso);

  if (filter === "mine") {
    const { data } = await inRange().eq("author_id", userId).order("starts_at");
    return (data as unknown as EventWithMeta[]) ?? [];
  }

  const { data: myRsvps } = await db
    .from("rsvps")
    .select("event_id, status")
    .eq("user_id", userId);
  const rsvpIds = (myRsvps ?? [])
    .filter((r) => filter === "all" || r.status !== "interested")
    .map((r) => r.event_id as string);

  const rsvped =
    rsvpIds.length > 0
      ? ((await inRange().in("id", rsvpIds)).data as unknown as EventWithMeta[]) ?? []
      : [];

  if (filter === "going") return sortByStart(rsvped);

  const following = await getFollowingIds(db, userId);
  const { data: circle } = await inRange().in("author_id", [userId, ...following]);

  return sortByStart(uniqueById([...(circle as unknown as EventWithMeta[]), ...rsvped]));
}

export async function getEvent(db: Db, id: string): Promise<EventWithMeta | null> {
  const { data } = await db.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as EventWithMeta | null) ?? null;
}

export async function getComments(db: Db, eventId: string): Promise<CommentWithAuthor[]> {
  const { data } = await db
    .from("comments")
    .select(`*, author:profiles!comments_author_id_fkey(${PROFILE_LITE})`)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  return (data as unknown as CommentWithAuthor[]) ?? [];
}

export async function getProfileStats(db: Db, userId: string): Promise<ProfileStats> {
  const now = new Date().toISOString();
  const [followers, following, posts, went, pastGoing] = await Promise.all([
    db.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    db.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    db.from("events").select("*", { count: "exact", head: true }).eq("author_id", userId),
    db.from("rsvps").select("*", { count: "exact", head: true }).match({ user_id: userId, status: "went" }),
    db
      .from("rsvps")
      .select("event_id, events!inner(starts_at)", { count: "exact", head: true })
      .match({ user_id: userId, status: "going" })
      .lt("events.starts_at", now),
  ]);
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    posts: posts.count ?? 0,
    beenTo: (went.count ?? 0) + (pastGoing.count ?? 0),
  };
}

export async function getEventsByAuthor(db: Db, userId: string): Promise<EventWithMeta[]> {
  const { data } = await db
    .from("events")
    .select(EVENT_SELECT)
    .eq("author_id", userId)
    .order("starts_at", { ascending: false })
    .limit(100);
  return (data as unknown as EventWithMeta[]) ?? [];
}

export type RsvpedEvent = { status: RsvpStatus; event: EventWithMeta };

/** Events a user has RSVP'd to, with the RSVP status. */
export async function getRsvpedEvents(db: Db, userId: string): Promise<RsvpedEvent[]> {
  const { data } = await db
    .from("rsvps")
    .select(`status, event:events!rsvps_event_id_fkey(${EVENT_SELECT})`)
    .eq("user_id", userId)
    .limit(200);
  const rows = (data as unknown as { status: RsvpStatus; event: EventWithMeta | null }[]) ?? [];
  return rows
    .filter((r): r is RsvpedEvent => Boolean(r.event))
    .sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));
}

export async function searchProfiles(db: Db, q: string, limit = 30): Promise<ProfileLite[]> {
  const term = q.trim().replace(/[%_,]/g, "");
  let query = db.from("profiles").select(PROFILE_LITE).limit(limit);
  if (term) {
    query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
  } else {
    query = query.order("created_at", { ascending: false });
  }
  const { data } = await query;
  return (data as ProfileLite[]) ?? [];
}

export async function getProfilesByIds(db: Db, ids: string[]): Promise<ProfileLite[]> {
  if (ids.length === 0) return [];
  const { data } = await db.from("profiles").select(PROFILE_LITE).in("id", ids);
  return (data as ProfileLite[]) ?? [];
}

export async function getFollowers(db: Db, userId: string): Promise<ProfileLite[]> {
  const { data } = await db
    .from("follows")
    .select(`created_at, profile:profiles!follows_follower_id_fkey(${PROFILE_LITE})`)
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = (data as unknown as { profile: ProfileLite | null }[]) ?? [];
  return rows.map((r) => r.profile).filter((p): p is ProfileLite => Boolean(p));
}

export async function getFollowing(db: Db, userId: string): Promise<ProfileLite[]> {
  const { data } = await db
    .from("follows")
    .select(`created_at, profile:profiles!follows_following_id_fkey(${PROFILE_LITE})`)
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = (data as unknown as { profile: ProfileLite | null }[]) ?? [];
  return rows.map((r) => r.profile).filter((p): p is ProfileLite => Boolean(p));
}

/** Upcoming events from everyone, optionally narrowed to a city and category. */
export async function getDiscoverEvents(
  db: Db,
  opts: { city: string | null; category: EventCategory | null; limit?: number }
): Promise<EventWithMeta[]> {
  let query = db
    .from("events")
    .select(EVENT_SELECT)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(opts.limit ?? 100);

  if (opts.city) {
    const safe = opts.city.replace(/[%_*\\,()]/g, "").trim();
    if (safe) query = query.ilike("city", safe);
  }
  if (opts.category) query = query.eq("category", opts.category);

  const { data } = await query;
  return (data as unknown as EventWithMeta[]) ?? [];
}

/**
 * Ranked free-text search over titles, lineups, tags, venues, cities and
 * descriptions (see search_events() in the database). Optional city/category
 * narrowing is applied on top.
 */
export async function searchEvents(
  db: Db,
  opts: { q: string; city: string | null; category: EventCategory | null; limit?: number }
): Promise<EventWithMeta[]> {
  const q = opts.q.trim().slice(0, 120);
  if (!q) return [];

  let query = db
    .rpc("search_events", { q, only_upcoming: true, max_results: opts.limit ?? 60 })
    .select(EVENT_SELECT);

  if (opts.city) {
    const safe = opts.city.replace(/[%_*\\,()]/g, "").trim();
    if (safe) query = query.ilike("city", safe);
  }
  if (opts.category) query = query.eq("category", opts.category);

  const { data, error } = await query;
  if (error) {
    console.error("searchEvents failed", error);
    return [];
  }
  return (data as unknown as EventWithMeta[]) ?? [];
}

/** Cities with upcoming events, most active first. */
export async function getCityCounts(db: Db, limit = 8): Promise<{ city: string; count: number }[]> {
  const { data } = await db
    .from("events")
    .select("city")
    .gte("starts_at", new Date().toISOString())
    .not("city", "is", null)
    .limit(1000);

  const counts = new Map<string, { city: string; count: number }>();
  for (const row of data ?? []) {
    const raw = String(row.city ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { city: raw, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
