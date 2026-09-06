import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditEventForm } from "@/components/edit-event-form";
import { PageHeading } from "@/components/page-heading";
import { getEvent } from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Edit event" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const userId = await requireUserId();
  const supabase = await createClient();
  const tz = await getTimeZone();

  const event = await getEvent(supabase, id);
  if (!event || event.author_id !== userId) notFound();

  return (
    <>
      <PageHeading title="Edit event" sub="Changes show up for everyone who follows you." />
      <EditEventForm event={event} tz={tz} />
    </>
  );
}
