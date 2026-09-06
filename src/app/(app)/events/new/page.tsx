import type { Metadata } from "next";
import { NewPostForm } from "@/components/new-post-form";
import { PageHeading } from "@/components/page-heading";
import { requireUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Post a flyer" };

export default async function NewEventPage() {
  const userId = await requireUserId();

  return (
    <>
      <PageHeading
        title="Post a flyer"
        sub="Add the flyer and we’ll pull out the date, venue and lineup for you."
      />
      <NewPostForm userId={userId} />
    </>
  );
}
