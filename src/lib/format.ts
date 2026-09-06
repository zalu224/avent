import { TZDate } from "@date-fns/tz";
import { addDays, format, isSameDay } from "date-fns";

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function inZone(value: string | Date, tz: string) {
  return new TZDate(new Date(value), tz);
}

export function fmt(value: string | Date, tz: string, pattern: string) {
  return format(inZone(value, tz), pattern);
}

/** yyyy-MM-dd in the viewer's timezone; used to group events by day. */
export function dayKey(value: string | Date, tz: string) {
  return fmt(value, tz, "yyyy-MM-dd");
}

export function relativeDay(value: string | Date, tz: string, now: Date = new Date()) {
  const d = inZone(value, tz);
  const n = inZone(now, tz);
  if (isSameDay(d, n)) return d.getHours() >= 17 ? "Tonight" : "Today";
  if (isSameDay(d, addDays(n, 1))) return "Tomorrow";
  if (d.getFullYear() !== n.getFullYear()) return format(d, "EEE, MMM d, yyyy");
  return format(d, "EEE, MMM d");
}

export function timeLabel(value: string | Date, tz: string) {
  return format(inZone(value, tz), "h:mm aaa");
}

export function dateTimeLabel(value: string | Date, tz: string, now: Date = new Date()) {
  return `${relativeDay(value, tz, now)} · ${timeLabel(value, tz)}`;
}

export function isPast(value: string | Date, now: Date = new Date()) {
  return new Date(value).getTime() < now.getTime();
}

export function timeAgo(value: string | Date, now: Date = new Date()) {
  const seconds = Math.max(0, (now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return format(new Date(value), "MMM d, yyyy");
}

/** Converts a datetime-local input value ("2026-09-12T21:00") in tz to ISO UTC. */
export function localInputToIso(local: string, tz: string) {
  const [datePart, timePart = "00:00"] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new TZDate(y, m - 1, d, hh, mm, 0, 0, tz).toISOString();
}

/** Converts an ISO timestamp to a datetime-local input value in tz. */
export function isoToLocalInput(iso: string, tz: string) {
  return fmt(iso, tz, "yyyy-MM-dd'T'HH:mm");
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
