import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { PeoplePicker } from "@/components/people-picker";
import { addMembers } from "@/lib/actions/messages";
import { circleOf } from "@/lib/circle";
import { conversationName, getConversation } from "@/lib/messages";
import { createClient, requireUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add people" };

export default async function AddPeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meId = await requireUserId();
  const supabase = await createClient();
  const conversation = await getConversation(supabase, id);
  if (!conversation || conversation.kind !== "group") notFound();

  const already = new Set(conversation.members.map((m) => m.user_id));
  const people = (await circleOf(supabase, meId)).filter((p) => !already.has(p.id));

  return (
    <>
      <PageHeading title="Add people" sub={`To ${conversationName(conversation, meId)}`} />
      <PeoplePicker people={people} action={addMembers} conversationId={conversation.id} submitLabel="Add to group" />
    </>
  );
}
