import { addHours } from "date-fns";
import type { EventRow } from "@/lib/types";

function utcStamp(value: string | Date) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function endOrDefault(event: Pick<EventRow, "starts_at" | "ends_at">) {
  return event.ends_at ?? addHours(new Date(event.starts_at), 3).toISOString();
}

function location(event: Pick<EventRow, "venue_name" | "address" | "city">) {
  return [event.venue_name, event.address, event.city].filter(Boolean).join(", ");
}

function details(event: Pick<EventRow, "description" | "lineup" | "price" | "ticket_url">, url: string) {
  return [
    event.description,
    event.lineup.length ? `Lineup: ${event.lineup.join(", ")}` : null,
    event.price ? `Price: ${event.price}` : null,
    event.ticket_url ? `Tickets: ${event.ticket_url}` : null,
    `On Headcount: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function googleCalendarUrl(event: EventRow, eventUrl: string) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.starts_at)}/${utcStamp(endOrDefault(event))}`,
    details: details(event, eventUrl),
    location: location(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds long lines per RFC 5545 (75 octets, continuation lines start with a space). */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(event: EventRow, eventUrl: string) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Headcount//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@headcount`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(event.starts_at)}`,
    `DTEND:${utcStamp(endOrDefault(event))}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(details(event, eventUrl))}`,
    `LOCATION:${icsEscape(location(event))}`,
    `URL:${eventUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
