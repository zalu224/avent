import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { GroupAvatar } from "@/components/group-avatar";
import { PageHeading } from "@/components/page-heading";
import { timeAgo } from "@/lib/format";
import { conversationName, listConversations } from "@/lib/messages";
import { createClient, requireUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const meId = await requireUserId();
  const { error } = await searchParams;
  const supabase = await createClient();
  const inbox = await listConversations(supabase, meId);
  const now = new Date();

  return (
    <>
      <PageHeading
        title="Messages"
        sub="Plan the night with your people"
        action={
          <Link href="/messages/new" className="btn btn-primary">
            <MessageSquarePlus size={16} aria-hidden /> New message
          </Link>
        }
      />

      {error === "start" && (
        <p role="alert" className="mb-4 text-sm text-flare">
          Couldn’t open that conversation. Try again.
        </p>
      )}

      {inbox.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <h2 className="font-display text-lg font-bold">No messages yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-2">
            Message a friend from their profile, or start a group for the people you go out with.
          </p>
          <Link href="/messages/new" className="btn btn-primary mt-5">
            New message
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-edge" aria-label="Conversations">
          {inbox.map((c) => {
            const name = conversationName(c, meId);
            const preview =
              c.last_message_preview ?? (c.kind === "group" ? `${c.members.length} people` : "No messages yet");
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-edge/40"
                >
                  {c.kind === "dm" && c.others[0] ? (
                    <Avatar profile={c.others[0]} size={44} />
                  ) : (
                    <GroupAvatar people={c.others} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${c.unread ? "font-bold" : "font-medium"}`}>{name}</span>
                      {c.last_message_at && (
                        <span className="shrink-0 text-xs text-muted">{timeAgo(c.last_message_at, now)}</span>
                      )}
                    </span>
                    <span className={`block truncate text-sm ${c.unread ? "text-fore" : "text-muted"}`}>
                      {preview}
                    </span>
                  </span>
                  {c.unread && <span className="size-2.5 shrink-0 rounded-full bg-flare" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
