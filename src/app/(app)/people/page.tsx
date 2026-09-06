import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { PageHeading } from "@/components/page-heading";
import { getFollowingIds, searchProfiles } from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const userId = await requireUserId();
  const supabase = await createClient();

  const [results, followingIds] = await Promise.all([
    searchProfiles(supabase, q),
    getFollowingIds(supabase, userId),
  ]);
  const following = new Set(followingIds);
  const people = results.filter((p) => p.id !== userId);

  return (
    <>
      <PageHeading title="People" sub="Follow friends to see their plans on your calendar" />

      <form action="/people" method="get" role="search" className="relative mb-6">
        <label htmlFor="q" className="sr-only">
          Search by name or username
        </label>
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lilac"
        />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name or @username"
          className="field pl-10"
        />
      </form>

      {people.length === 0 ? (
        <p className="px-2 py-10 text-center text-lilac-2">
          {q ? `Nobody matches “${q}”.` : "No one else has joined yet. Invite your friends."}
        </p>
      ) : (
        <ul>
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-plum-2 py-3 last:border-0">
              <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar profile={p} size={44} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.display_name || p.username}</span>
                  <span className="block truncate text-sm text-lilac">@{p.username}</span>
                </span>
              </Link>
              <FollowButton targetId={p.id} following={following.has(p.id)} size="sm" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
