import { ExternalLink, ShieldCheck } from "lucide-react";
import { hostOf } from "@/lib/links";
import type { EventRow } from "@/lib/types";

const LABELS = {
  event_url: "Official event page",
  ticket_url: "Tickets",
  organizer_url: "Organizer",
} as const;

function provenance(check: EventRow["link_checks"][string] | undefined) {
  if (!check) return "Added by the poster";
  if (check.source === "google") return "Matched a Google result";
  if (check.source === "flyer") return "Printed on the flyer";
  return "Added by the poster";
}

/**
 * External links with their provenance and safety status. Every href here has
 * already been normalised to http(s), had shorteners unwrapped, and (when a
 * Safe Browsing key is configured) been checked against Google's threat lists.
 */
export function EventLinks({ event }: { event: EventRow }) {
  const rows = (Object.keys(LABELS) as (keyof typeof LABELS)[])
    .map((kind) => ({ kind, url: event[kind], check: event.link_checks?.[kind] }))
    .filter((r): r is typeof r & { url: string } => Boolean(r.url));

  if (rows.length === 0 && !event.organizer_name) return null;

  return (
    <section className="mt-6 rounded-card border border-plum-2 bg-plum p-4" aria-label="Organizer and links">
      {event.organizer_name && (
        <p className="text-sm text-lilac">
          Put on by <span className="font-semibold text-cream">{event.organizer_name}</span>
        </p>
      )}
      {rows.length > 0 && (
        <ul className={`flex flex-col gap-2 ${event.organizer_name ? "mt-3" : ""}`}>
          {rows.map(({ kind, url, check }) => (
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
              <span className="text-sm text-lilac-2">{hostOf(url)}</span>
              <span className="inline-flex items-center gap-1 text-xs text-lilac">
                {check?.safe_browsing === "ok" && (
                  <ShieldCheck size={12} aria-hidden className="text-glow" />
                )}
                {provenance(check)}
                {check?.safe_browsing === "ok" && ", passed Safe Browsing"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
