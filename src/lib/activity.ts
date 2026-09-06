import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileLite, RsvpStatus } from "@/lib/types";

const PROFILE_LITE = "id, username, display_name, avatar_url";

export type ActivityItem =
  | { key: string; at: string; kind: "follow"; actor: ProfileLite }
  | {
      key: string;
      at: string;
      kind: "rsvp";
      actor: ProfileLite;
      status: RsvpStatus;
      event: { id: string; title: string };
    }
  | {
      key: string;
      at: string;
      kind: "comment";
      actor: ProfileLite;
      body: string;
      event: { id: string; title: string };
    };

type FollowRow = { created_at: string; follower: ProfileLite | null };
type RsvpRow = {
  updated_at: string;
  status: RsvpStatus;
  user_id: string;
  profile: ProfileLite | null;
  events: { id: string; title: string; author_id: string } | null;
};
type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author: ProfileLite | null;
  events: { id: string; title: string } | null;
};

/** Things other people did that involve you: follows, RSVPs on your posts, comments on plans you're in. */
export async function getActivity(db: SupabaseServerClient, userId: string): Promise<ActivityItem[]> {
  const [followsRes, rsvpsRes, mine, going] = await Promise.all([
    db
      .from("follows")
      .select(`created_at, follower:profiles!follows_follower_id_fkey(${PROFILE_LITE})`)
      .eq("following_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    db
      .from("rsvps")
      .select(
        `updated_at, status, user_id, profile:profiles!rsvps_user_id_fkey(${PROFILE_LITE}), events!inner(id, title, author_id)`
      )
      .eq("events.author_id", userId)
      .neq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(40),
    db.from("events").select("id").eq("author_id", userId).limit(200),
    db.from("rsvps").select("event_id").eq("user_id", userId).limit(200),
  ]);

  const eventIds = new Set<string>();
  for (const r of mine.data ?? []) eventIds.add(r.id as string);
  for (const r of going.data ?? []) eventIds.add(r.event_id as string);

  const commentsRes =
    eventIds.size > 0
      ? await db
          .from("comments")
          .select(
            `id, body, created_at, author:profiles!comments_author_id_fkey(${PROFILE_LITE}), events!inner(id, title)`
          )
          .in("event_id", [...eventIds])
          .neq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(40)
      : { data: [] as CommentRow[] };

  const items: ActivityItem[] = [];

  for (const row of (followsRes.data as unknown as FollowRow[]) ?? []) {
    if (!row.follower) continue;
    items.push({ key: `f-${row.follower.id}`, at: row.created_at, kind: "follow", actor: row.follower });
  }
  for (const row of (rsvpsRes.data as unknown as RsvpRow[]) ?? []) {
    if (!row.profile || !row.events) continue;
    items.push({
      key: `r-${row.events.id}-${row.user_id}`,
      at: row.updated_at,
      kind: "rsvp",
      actor: row.profile,
      status: row.status,
      event: { id: row.events.id, title: row.events.title },
    });
  }
  for (const row of (commentsRes.data as unknown as CommentRow[]) ?? []) {
    if (!row.author || !row.events) continue;
    items.push({
      key: `c-${row.id}`,
      at: row.created_at,
      kind: "comment",
      actor: row.author,
      body: row.body,
      event: { id: row.events.id, title: row.events.title },
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
}
