import { createElement } from "react";
import { CommentEmail, NewFollowerEmail, RsvpEmail } from "./notification-emails";
import { isEmailConfigured, sendEmail } from "./resend";
import { fmt, relativeDay, timeLabel } from "@/lib/format";
import { createAdminClient, getUserEmail, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/timezone";

/**
 * Notification emails. Each function is safe to call from `after()` in a
 * server action: it never throws, and it quietly does nothing when Resend or
 * the admin key is not configured, or when the recipient opted out.
 */

function canNotify() {
  return isEmailConfigured() && isAdminConfigured();
}

type Person = { name: string; username: string };

async function loadActor(userId: string): Promise<Person | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return { name: (data.display_name as string) || (data.username as string), username: data.username as string };
}

/** Recipient email, or null when they opted out of activity emails. */
export async function recipientFor(
  userId: string,
  pref: "email_notifications" | "reminder_emails"
): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("profiles").select(pref).eq("id", userId).maybeSingle();
  const prefs = (data ?? null) as Record<string, unknown> | null;
  if (prefs && prefs[pref] === false) return null;
  return getUserEmail(userId);
}

async function loadEvent(eventId: string) {
  const supabase = await createClient();
  const tz = await getTimeZone();
  const { data } = await supabase
    .from("events")
    .select("id, title, author_id, starts_at, venue_name, city, rsvps(user_id, status)")
    .eq("id", eventId)
    .maybeSingle();
  if (!data) return null;
  const rsvps = (data.rsvps as { user_id: string; status: string }[]) ?? [];
  return {
    id: data.id as string,
    title: data.title as string,
    authorId: data.author_id as string,
    goingCount: rsvps.filter((r) => r.status === "going" || r.status === "went").length,
    info: {
      id: data.id as string,
      title: data.title as string,
      month: fmt(data.starts_at as string, tz, "MMM"),
      day: fmt(data.starts_at as string, tz, "d"),
      weekday: fmt(data.starts_at as string, tz, "EEE"),
      when: `${relativeDay(data.starts_at as string, tz)} at ${timeLabel(data.starts_at as string, tz)}`,
      where: [data.venue_name, data.city].filter(Boolean).join(", ") || null,
    },
  };
}

/** Someone said "I'm in" on your event. */
export async function notifyRsvp(eventId: string, actorId: string, siteUrl: string) {
  try {
    if (!canNotify()) return;
    const [event, actor] = await Promise.all([loadEvent(eventId), loadActor(actorId)]);
    if (!event || !actor || event.authorId === actorId) return;
    const to = await recipientFor(event.authorId, "email_notifications");
    if (!to) return;
    await sendEmail({
      to,
      subject: `${actor.name} is in for ${event.title}`,
      react: createElement(RsvpEmail, { actor, event: event.info, goingCount: event.goingCount, siteUrl }),
    });
  } catch (err) {
    console.error("[email] notifyRsvp failed", err);
  }
}

/** Someone followed you. */
export async function notifyFollow(targetId: string, actorId: string, siteUrl: string) {
  try {
    if (!canNotify() || targetId === actorId) return;
    const [actor, to] = await Promise.all([loadActor(actorId), recipientFor(targetId, "email_notifications")]);
    if (!actor || !to) return;
    await sendEmail({
      to,
      subject: `${actor.name} started following you on Headcount`,
      react: createElement(NewFollowerEmail, { actor, siteUrl }),
    });
  } catch (err) {
    console.error("[email] notifyFollow failed", err);
  }
}

/** Someone commented on an event you posted. */
export async function notifyComment(eventId: string, actorId: string, body: string, siteUrl: string) {
  try {
    if (!canNotify()) return;
    const [event, actor] = await Promise.all([loadEvent(eventId), loadActor(actorId)]);
    if (!event || !actor || event.authorId === actorId) return;
    const to = await recipientFor(event.authorId, "email_notifications");
    if (!to) return;
    await sendEmail({
      to,
      subject: `${actor.name} added to the plan for ${event.title}`,
      react: createElement(CommentEmail, { actor, event: event.info, body, siteUrl }),
    });
  } catch (err) {
    console.error("[email] notifyComment failed", err);
  }
}
