"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { extractEventFromImage, type ExtractedEvent } from "@/lib/ai/extract-event";
import { notifyComment, notifyRsvp } from "@/lib/email/notify";
import { fmt, isValidTimeZone, localInputToIso } from "@/lib/format";
import { getSiteUrl } from "@/lib/site";
import { eventImagePublicPrefix } from "@/lib/supabase/env";
import { createClient, requireUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";
import { EVENT_CATEGORIES, RSVP_STATUSES, type RsvpStatus } from "@/lib/types";

export type AnalyzeResult =
  | { ok: true; event: ExtractedEvent }
  | { ok: false; error: string };

export async function analyzeFlyer(input: {
  imageUrl?: string;
  caption?: string;
}): Promise<AnalyzeResult> {
  await requireUserId();

  const imageUrl = input.imageUrl?.trim() || undefined;
  const caption = input.caption?.trim() || undefined;

  if (imageUrl && !imageUrl.startsWith(eventImagePublicPrefix())) {
    return { ok: false, error: "Upload the flyer through Headcount first." };
  }
  if (!imageUrl && !caption) {
    return { ok: false, error: "Add a flyer photo or write a caption first." };
  }

  const timeZone = await getTimeZone();
  const today = fmt(new Date(), timeZone, "yyyy-MM-dd");

  try {
    const event = await extractEventFromImage({ imageUrl, caption, today, timeZone });
    return { ok: true, event };
  } catch (err) {
    console.error("analyzeFlyer failed", err);
    return {
      ok: false,
      error: "Couldn't read the flyer automatically. Fill in the details below.",
    };
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s.length ? s : null));

const eventFieldsSchema = z.object({
  title: z.string().trim().min(1, "Give the event a title.").max(120),
  category: z.enum(EVENT_CATEGORIES),
  starts_at_local: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Pick a start date and time."),
  ends_at_local: z.string().optional().default(""),
  tz: z.string().default("UTC"),
  venue_name: optionalText(120),
  address: optionalText(200),
  city: optionalText(80),
  price: optionalText(80),
  ticket_url: optionalText(500),
  description: optionalText(2000),
  caption: optionalText(2000),
  lineup: z.string().optional().default(""),
  tags: z.string().optional().default(""),
});

function splitList(value: string, max: number, lowercase = false) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[,\n]/)) {
    const item = (lowercase ? raw.toLowerCase() : raw).trim().replace(/^#/, "").slice(0, 60);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

const createEventSchema = eventFieldsSchema.extend({
  image_url: optionalText(1000),
  image_path: optionalText(500),
  ai_extracted: z.string().optional().default("false"),
  ai_confidence: z.string().optional().default(""),
});

const updateEventSchema = eventFieldsSchema.extend({
  id: z.string().uuid(),
});

export type CreateEventState = { error?: string };

function formToRecord(formData: FormData) {
  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") raw[key] = value;
  });
  return raw;
}

type EventValues = z.infer<typeof eventFieldsSchema>;

/** Turns validated form values into a row payload, or returns a user-facing error. */
function toEventRow(v: EventValues) {
  const tz = isValidTimeZone(v.tz) ? v.tz : "UTC";

  let starts_at: string;
  let ends_at: string | null = null;
  try {
    starts_at = localInputToIso(v.starts_at_local, tz);
    if (v.ends_at_local) ends_at = localInputToIso(v.ends_at_local, tz);
  } catch {
    return { error: "That date doesn't look right." } as const;
  }
  if (ends_at && ends_at <= starts_at) {
    return { error: "The end time has to be after the start." } as const;
  }

  let ticket_url = v.ticket_url;
  if (ticket_url && !/^https?:\/\//i.test(ticket_url)) ticket_url = `https://${ticket_url}`;

  const lineup = splitList(v.lineup, 30);
  const tags = splitList(v.tags, 12, true);

  return {
    row: {
      title: v.title,
      caption: v.caption,
      description: v.description,
      category: v.category,
      venue_name: v.venue_name,
      address: v.address,
      city: v.city,
      starts_at,
      ends_at,
      lineup,
      tags,
      price: v.price,
      ticket_url,
    },
  } as const;
}

export async function createEvent(
  _prev: CreateEventState,
  formData: FormData
): Promise<CreateEventState> {
  const userId = await requireUserId();

  const parsed = createEventSchema.safeParse(formToRecord(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const built = toEventRow(v);
  if ("error" in built) return { error: built.error };

  if (v.image_url && !v.image_url.startsWith(eventImagePublicPrefix())) {
    return { error: "Upload the flyer through Headcount first." };
  }

  const confidence = Number.parseFloat(v.ai_confidence);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      ...built.row,
      author_id: userId,
      image_url: v.image_url,
      image_path: v.image_path,
      ai_extracted: v.ai_extracted === "true",
      ai_confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createEvent failed", error);
    return { error: "Couldn't save the event. Try again." };
  }

  // Posting an event means you're going.
  await supabase
    .from("rsvps")
    .insert({ event_id: data.id, user_id: userId, status: "going" });

  revalidatePath("/feed");
  revalidatePath("/calendar");
  revalidatePath("/discover");
  redirect(`/events/${data.id}`);
}

export async function updateEvent(
  _prev: CreateEventState,
  formData: FormData
): Promise<CreateEventState> {
  const userId = await requireUserId();

  const parsed = updateEventSchema.safeParse(formToRecord(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const built = toEventRow(v);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update(built.row)
    .match({ id: v.id, author_id: userId })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateEvent failed", error);
    return { error: "Couldn't save your changes. Try again." };
  }
  if (!data) return { error: "Only the person who posted this can edit it." };

  revalidatePath("/feed");
  revalidatePath("/calendar");
  revalidatePath("/discover");
  revalidatePath(`/events/${v.id}`);
  redirect(`/events/${v.id}`);
}

export async function setRsvp(eventId: string, status: RsvpStatus | null) {
  const userId = await requireUserId();
  if (status && !RSVP_STATUSES.includes(status)) return;

  const supabase = await createClient();
  let wasGoing = false;
  if (status === "going") {
    const { data: existing } = await supabase
      .from("rsvps")
      .select("status")
      .match({ event_id: eventId, user_id: userId })
      .maybeSingle();
    wasGoing = existing?.status === "going" || existing?.status === "went";
  }

  if (status) {
    await supabase
      .from("rsvps")
      .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: "event_id,user_id" });
  } else {
    await supabase.from("rsvps").delete().match({ event_id: eventId, user_id: userId });
  }

  if (status === "going" && !wasGoing) {
    const siteUrl = await getSiteUrl();
    after(() => notifyRsvp(eventId, userId, siteUrl));
  }

  revalidatePath("/feed");
  revalidatePath("/calendar");
  revalidatePath("/discover");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/u/[username]", "page");
}

export type CommentState = { error?: string; savedAt?: number };

export async function addComment(
  eventId: string,
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const userId = await requireUserId();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };
  if (body.length > 1000) return { error: "Keep comments under 1000 characters." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .insert({ event_id: eventId, author_id: userId, body });
  if (error) return { error: "Couldn't post that comment." };

  const siteUrl = await getSiteUrl();
  after(() => notifyComment(eventId, userId, body, siteUrl));

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/activity");
  return { savedAt: Date.now() };
}

export async function deleteComment(commentId: string, eventId: string) {
  const userId = await requireUserId();
  const supabase = await createClient();
  await supabase.from("comments").delete().match({ id: commentId, author_id: userId });
  revalidatePath(`/events/${eventId}`);
}

export async function deleteEvent(eventId: string) {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, image_path")
    .match({ id: eventId, author_id: userId })
    .maybeSingle();
  if (!event) return;

  await supabase.from("events").delete().match({ id: eventId, author_id: userId });
  if (event.image_path) {
    await supabase.storage.from("event-images").remove([event.image_path]);
  }

  revalidatePath("/feed");
  revalidatePath("/calendar");
  revalidatePath("/discover");
  redirect("/feed");
}
