import { ExternalLink } from "lucide-react";
import { hostOf } from "@/lib/links";
import type { EventRow } from "@/lib/types";

const LABELS = {
  event_url: "Official event page",
  ticket_url: "Tickets",
  organizer_url: "Organizer",
} as const;

/**
 * External links for an event. Every href here has already been normalised to
 * http(s), had shorteners unwrapped, and (when a Safe Browsing key is
 * configured) been checked against Google's threat lists before it was stored,
 * so the page just shows the link and its host.
 */
export function EventLinks({
  event,
  hideTickets = false,
}: {
  event: EventRow;
  /** Set when the page already shows a Tickets button, to avoid repeating it. */
  hideTickets?: boolean;
}) {
  const rows = (Object.keys(LABELS) as (keyof typeof LABELS)[])
    .filter((kind) => !(hideTickets && kind === "ticket_url"))
    .map((kind) => ({ kind, url: event[kind] }))
    .filter((r): r is typeof r & { url: string } => Boolean(r.url));

  if (rows.length === 0 && !event.organizer_name) return null;

  return (
    <section className="mt-6 rounded-card border border-edge bg-surface p-4" aria-label="Organizer and links">
      {event.organizer_name && (
        <p className="text-sm text-muted">
          Put on by <span className="font-semibold text-fore">{event.organizer_name}</span>
        </p>
      )}
      {rows.length > 0 && (
        <ul className={`flex flex-col gap-2 ${event.organizer_name ? "mt-3" : ""}`}>
          {rows.map(({ kind, url }) => (
            <li key={kind} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="inline-flex items-center gap-1.5 font-semibold hover:underline"
              >
                {LABELS[kind]}
                <ExternalLink size={14} aria-hidden />
              </a>
              <span className="text-sm text-muted-2">{hostOf(url)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
