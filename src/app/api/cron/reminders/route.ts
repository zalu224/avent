import { createElement } from "react";
import { NextResponse, type NextRequest } from "next/server";
import { ReminderEmail } from "@/lib/email/notification-emails";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { fmt, isValidTimeZone, relativeDay, timeLabel } from "@/lib/format";
import { createAdminClient, getUserEmail } from "@/lib/supabase/admin";

export const maxDuration = 120;

/**
 * Daily reminder: emails everyone who is "going" to an event that starts in
 * the next 26 hours, once per event. Scheduled in vercel.json; Vercel calls
 * it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin || !isEmailConfigured()) {
    return NextResponse.json({ skipped: true, reason: "email or admin key not configured" });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");

  const now = new Date();
  const until = new Date(now.getTime() + 26 * 60 * 60 * 1000);

  const { data: events, error } = await admin
    .from("events")
    .select("id, title, starts_at, venue_name, city, timezone, rsvps(user_id, status)")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", until.toISOString())
    .limit(200);
  if (error) {
    console.error("[cron] events query failed", error.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  const { data: alreadySent } = await admin
    .from("reminders_sent")
    .select("event_id, user_id")
    .eq("kind", "day_before")
    .in("event_id", (events ?? []).map((e) => e.id as string));
  const sentKeys = new Set((alreadySent ?? []).map((r) => `${r.event_id}:${r.user_id}`));

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const event of events ?? []) {
    const rsvps = (event.rsvps as { user_id: string; status: string }[]) ?? [];
    const going = rsvps.filter((r) => r.status === "going");
    const tz = isValidTimeZone(event.timezone as string) ? (event.timezone as string) : "UTC";
    const info = {
      id: event.id as string,
      title: event.title as string,
      month: fmt(event.starts_at as string, tz, "MMM"),
      day: fmt(event.starts_at as string, tz, "d"),
      weekday: fmt(event.starts_at as string, tz, "EEE"),
      when: `${relativeDay(event.starts_at as string, tz, now)} at ${timeLabel(event.starts_at as string, tz)}`,
      where: [event.venue_name, event.city].filter(Boolean).join(", ") || null,
    };

    for (const r of going) {
      const key = `${event.id}:${r.user_id}`;
      if (sentKeys.has(key)) {
        skipped++;
        continue;
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("first_name, display_name, reminder_emails")
        .eq("id", r.user_id)
        .maybeSingle();
      if (profile?.reminder_emails === false) {
        skipped++;
        continue;
      }
      const to = await getUserEmail(r.user_id);
      if (!to) {
        skipped++;
        continue;
      }
      const firstName =
        (profile?.first_name as string | null) ??
        ((profile?.display_name as string | undefined)?.split(" ")[0] || null);

      const result = await sendEmail({
        to,
        subject: `${info.when.split(" at ")[0]}: ${info.title}`,
        react: createElement(ReminderEmail, { event: info, goingCount: going.length, firstName, siteUrl }),
      });
      if (result.ok) {
        sent++;
        await admin
          .from("reminders_sent")
          .insert({ event_id: event.id, user_id: r.user_id, kind: "day_before" });
      } else {
        failures.push(`${key}: ${result.error ?? "skipped"}`);
      }
      if (sent >= 80) break; // Resend's free plan allows 100 emails/day; leave room for notifications
    }
  }

  return NextResponse.json({ events: events?.length ?? 0, sent, skipped, failures });
}
