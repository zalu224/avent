import type { SupabaseClient } from "@supabase/supabase-js";
import { getFollowers, getFollowing } from "@/lib/queries";
import type { ProfileLite } from "@/lib/types";

/** People you follow plus people who follow you, each once, sorted by name. */
export async function circleOf(db: SupabaseClient, userId: string): Promise<ProfileLite[]> {
  const [following, followers] = await Promise.all([getFollowing(db, userId), getFollowers(db, userId)]);
  const seen = new Map<string, ProfileLite>();
  for (const p of [...following, ...followers]) seen.set(p.id, p);
  return [...seen.values()].sort((a, b) =>
    (a.display_name || a.username).localeCompare(b.display_name || b.username)
  );
}
