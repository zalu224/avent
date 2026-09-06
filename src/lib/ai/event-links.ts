import type { ExtractedEvent } from "./extract-event";
import { canLookupOrganizer, findOrganizer, type OrganizerLookup } from "./find-organizer";
import { extractHosts, verifyLink, type LinkChecks, type LinkSource } from "@/lib/links";

export const LINK_KINDS = ["organizer_url", "event_url", "ticket_url"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export type ResolvedLinks = {
  organizer_name: string | null;
  organizer_url: string | null;
  event_url: string | null;
  ticket_url: string | null;
  link_checks: LinkChecks;
  lookup: {
    attempted: boolean;
    found: boolean;
    summary: string | null;
    sourceHosts: string[];
  };
};

/**
 * Combines what the flyer says with what Google finds, then verifies every
 * link. Google-sourced links must be corroborated by a real search source;
 * flyer-printed links are accepted once they resolve and pass Safe Browsing.
 */
export async function resolveEventLinks(
  event: ExtractedEvent,
  caption: string | undefined
): Promise<ResolvedLinks> {
  const flyerText = [caption ?? "", ...event.printed_urls, event.organizer_url, event.event_url, event.ticket_url]
    .filter(Boolean)
    .join(" ");
  const flyerHosts = extractHosts(flyerText);

  let lookup: OrganizerLookup | null = null;
  const attempted = canLookupOrganizer() && Boolean(event.title);
  if (attempted) {
    lookup = await findOrganizer({
      title: event.title,
      organizerHint: event.organizer_name,
      venue: event.venue_name,
      city: event.city,
      date: event.date,
      lineup: event.lineup,
      printedUrls: event.printed_urls,
    });
  }

  const corroborating = [...(lookup?.groundingHosts ?? []), ...flyerHosts];
  const link_checks: LinkChecks = {};
  const out: Record<LinkKind, string | null> = { organizer_url: null, event_url: null, ticket_url: null };

  for (const kind of LINK_KINDS) {
    const candidates: { url: string | null; source: LinkSource }[] = [
      { url: lookup?.found ? lookup[kind] : null, source: "google" },
      { url: event[kind], source: "flyer" },
    ];
    for (const c of candidates) {
      if (!c.url) continue;
      const verified = await verifyLink(c.url, c.source, corroborating);
      if (!verified) continue;
      // A Google-suggested link has to be backed by an actual search source.
      if (c.source === "google" && !verified.check.corroborated) continue;
      out[kind] = verified.url;
      link_checks[kind] = verified.check;
      break;
    }
  }

  return {
    organizer_name: lookup?.found && lookup.organizer_name ? lookup.organizer_name : event.organizer_name,
    ...out,
    link_checks,
    lookup: {
      attempted,
      found: Boolean(lookup?.found),
      summary: lookup?.summary ?? null,
      sourceHosts: lookup?.groundingHosts ?? [],
    },
  };
}
