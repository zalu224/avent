import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PeoplePicker } from "@/components/people-picker";
import { createConversation } from "@/lib/actions/messages";
import { circleOf } from "@/lib/circle";
import { createClient, requireUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New message" };

export default async function NewMessagePage() {
  const meId = await requireUserId();
  const supabase = await createClient();
  const people = await circleOf(supabase, meId);

  return (
    <>
      <PageHeading title="New message" sub="Pick one person for a direct message, or several for a group." />
      <PeoplePicker people={people} action={createConversation} submitLabel="Send message" />
    </>
  );
}
