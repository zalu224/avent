import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { GroupAvatar } from "@/components/group-avatar";
import { GroupMenu } from "@/components/group-menu";
import { MessageThread } from "@/components/message-thread";
import { conversationName, getConversation, listMessages, markConversationRead, othersIn } from "@/lib/messages";
import { createClient, requireUserId } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const meId = await requireUserId();
  const supabase = await createClient();
  const conversation = await getConversation(supabase, id);
  return { title: conversation ? conversationName(conversation, meId) : "Messages" };
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meId = await requireUserId();
  const supabase = await createClient();
  const conversation = await getConversation(supabase, id);
  if (!conversation) notFound();

  const [messages] = await Promise.all([listMessages(supabase, id), markConversationRead(supabase, id, meId)]);

  const name = conversationName(conversation, meId);
  const others = othersIn(conversation, meId);
  const isGroup = conversation.kind === "group";

  return (
    <>
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-edge bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Link href="/messages" className="btn btn-ghost px-2" aria-label="Back to messages">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        {isGroup ? (
          <GroupAvatar people={others} size={40} />
        ) : others[0] ? (
          <Link href={`/u/${others[0].username}`}>
            <Avatar profile={others[0]} size={40} />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold leading-tight">{name}</h1>
          <p className="truncate text-xs text-muted">
            {isGroup
              ? `${conversation.members.length} people: ${conversation.members
                  .map((m) => m.profile.display_name || m.profile.username)
                  .join(", ")}`
              : others[0]
                ? `@${others[0].username}`
                : ""}
          </p>
        </div>
        {isGroup && <GroupMenu conversationId={conversation.id} title={conversation.title} />}
      </header>

      <MessageThread
        conversationId={conversation.id}
        meId={meId}
        initialMessages={messages}
        members={conversation.members.map((m) => m.profile)}
        isGroup={isGroup}
      />
    </>
  );
}
