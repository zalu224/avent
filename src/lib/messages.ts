import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileLite } from "@/lib/types";

/** Server-side reads for direct messages and group chats. RLS limits every query to the caller's own conversations. */

type Db = SupabaseClient;

const PROFILE_LITE = "id, username, display_name, avatar_url";
const CONVERSATION_SELECT = `id, kind, title, created_by, created_at, last_message_at, last_message_preview,
  members:conversation_members(user_id, role, joined_at, last_read_at, profile:profiles!conversation_members_user_id_fkey(${PROFILE_LITE}))`;

export type ConversationKind = "dm" | "group";

export type Member = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  last_read_at: string;
  profile: ProfileLite;
};

export type Conversation = {
  id: string;
  kind: ConversationKind;
  title: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  members: Member[];
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type InboxItem = Conversation & { unread: boolean; others: ProfileLite[] };

function normalize(row: Record<string, unknown>): Conversation {
  const members = ((row.members as Member[] | null) ?? []).filter((m) => m.profile);
  return { ...(row as unknown as Conversation), members };
}

/** The other people in a conversation, for naming and avatars. */
export function othersIn(conversation: Conversation, meId: string): ProfileLite[] {
  return conversation.members.filter((m) => m.user_id !== meId).map((m) => m.profile);
}

/** A group's title, or the other people's names for a DM or an unnamed group. */
export function conversationName(conversation: Conversation, meId: string): string {
  if (conversation.title) return conversation.title;
  const names = othersIn(conversation, meId).map((p) => p.display_name || `@${p.username}`);
  if (names.length === 0) return "Just you";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
}

export function isUnread(conversation: Conversation, meId: string): boolean {
  const me = conversation.members.find((m) => m.user_id === meId);
  if (!me || !conversation.last_message_at) return false;
  return new Date(conversation.last_message_at) > new Date(me.last_read_at);
}

export async function listConversations(db: Db, meId: string): Promise<InboxItem[]> {
  const { data, error } = await db
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("listConversations failed", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const conversation = normalize(row as Record<string, unknown>);
    return { ...conversation, unread: isUnread(conversation, meId), others: othersIn(conversation, meId) };
  });
}

export async function getConversation(db: Db, id: string): Promise<Conversation | null> {
  const { data, error } = await db.from("conversations").select(CONVERSATION_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return normalize(data as Record<string, unknown>);
}

/** The most recent messages, oldest first. */
export async function listMessages(db: Db, conversationId: string, limit = 80): Promise<Message[]> {
  const { data, error } = await db
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listMessages failed", error.message);
    return [];
  }
  return ((data ?? []) as Message[]).reverse();
}

/** How many conversations have something the user hasn't seen, for the nav badge. */
export async function countUnread(db: Db, meId: string): Promise<number> {
  const { data, error } = await db
    .from("conversation_members")
    .select("last_read_at, conversation:conversations!inner(last_message_at)")
    .eq("user_id", meId)
    .not("conversation.last_message_at", "is", null);
  if (error || !data) return 0;
  return data.filter((row) => {
    const conversation = row.conversation as unknown as { last_message_at: string | null } | null;
    return conversation?.last_message_at && new Date(conversation.last_message_at) > new Date(row.last_read_at as string);
  }).length;
}

/** Marks a conversation as read for `meId` using an already-created client (safe during render). */
export async function markConversationRead(db: Db, conversationId: string, meId: string) {
  await db
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", meId);
}
