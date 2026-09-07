"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUserId } from "@/lib/supabase/server";
import type { Message } from "@/lib/messages";

export type MessageState = { error?: string };
export type SendState = { error?: string; sent?: Message };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ids(formData: FormData, field: string) {
  return [...new Set(formData.getAll(field).map(String).filter((v) => UUID_RE.test(v)))];
}

/** Opens (or creates) the DM with one person. Used by the Message button on profiles. */
export async function startDm(formData: FormData) {
  await requireUserId();
  const [userId] = ids(formData, "user_id");
  if (!userId) redirect("/messages");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_conversation", {
    p_kind: "dm",
    p_title: null,
    p_member_ids: [userId],
  });
  if (error || !data) {
    console.error("startDm failed", error?.message);
    redirect("/messages?error=start");
  }
  redirect(`/messages/${data}`);
}

/** New conversation from the picker: one person makes a DM, several make a group. */
export async function createConversation(_prev: MessageState, formData: FormData): Promise<MessageState> {
  await requireUserId();
  const members = ids(formData, "member");
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  if (members.length === 0) return { error: "Pick at least one person." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_conversation", {
    p_kind: members.length === 1 ? "dm" : "group",
    p_title: members.length === 1 ? null : title || null,
    p_member_ids: members,
  });
  if (error || !data) {
    console.error("createConversation failed", error?.message);
    return { error: "Couldn’t start that conversation. Try again." };
  }
  redirect(`/messages/${data}`);
}

export async function sendMessage(_prev: SendState, formData: FormData): Promise<SendState> {
  const meId = await requireUserId();
  const conversationId = String(formData.get("conversation_id") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!UUID_RE.test(conversationId)) return { error: "That conversation doesn’t exist." };
  if (!body) return { error: "Write something first." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: meId, body })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();
  if (error || !data) {
    console.error("sendMessage failed", error?.message);
    return { error: "Your message didn’t send. Try again." };
  }
  revalidatePath("/messages");
  return { sent: data as Message };
}

/** Marks everything in a conversation as seen. Called when the thread is opened. */
export async function markRead(conversationId: string) {
  const meId = await requireUserId();
  if (!UUID_RE.test(conversationId)) return;
  const supabase = await createClient();
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", meId);
}

export async function renameGroup(_prev: MessageState, formData: FormData): Promise<MessageState> {
  await requireUserId();
  const conversationId = String(formData.get("conversation_id") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  if (!UUID_RE.test(conversationId)) return { error: "That group doesn’t exist." };
  if (!title) return { error: "Give the group a name." };

  const supabase = await createClient();
  const { error } = await supabase.from("conversations").update({ title }).eq("id", conversationId);
  if (error) return { error: "Couldn’t rename the group." };
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return {};
}

export async function addMembers(_prev: MessageState, formData: FormData): Promise<MessageState> {
  await requireUserId();
  const conversationId = String(formData.get("conversation_id") ?? "");
  const members = ids(formData, "member");
  if (!UUID_RE.test(conversationId)) return { error: "That group doesn’t exist." };
  if (members.length === 0) return { error: "Pick at least one person." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("conversation_members")
    .upsert(
      members.map((user_id) => ({ conversation_id: conversationId, user_id, role: "member" })),
      { onConflict: "conversation_id,user_id", ignoreDuplicates: true }
    );
  if (error) {
    console.error("addMembers failed", error.message);
    return { error: "Couldn’t add them. Try again." };
  }
  redirect(`/messages/${conversationId}`);
}

export async function leaveGroup(formData: FormData) {
  const meId = await requireUserId();
  const conversationId = String(formData.get("conversation_id") ?? "");
  if (!UUID_RE.test(conversationId)) redirect("/messages");

  const supabase = await createClient();
  await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", meId);
  revalidatePath("/messages");
  redirect("/messages");
}
