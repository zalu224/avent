import type { Metadata } from "next";
import { NewPostForm } from "@/components/new-post-form";
import { PageHeading } from "@/components/page-heading";
import { getProfileById } from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New post" };

export default async function NewEventPage() {
  const userId = await requireUserId();
  const supabase = await createClient();
  const profile = await getProfileById(supabase, userId);

  return (
    <>
      <PageHeading
        title="New post"
        sub="Share what you’re going to. Add a photo of the flyer and we’ll fill in the date, venue and lineup, or type them yourself."
      />
      <NewPostForm userId={userId} defaultCity={profile?.city ?? null} />
    </>
  );
}
