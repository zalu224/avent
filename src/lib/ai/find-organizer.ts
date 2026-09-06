import { generateText } from "ai";
import { z } from "zod";
import { geminiModelIds, googleProvider } from "./providers";
import { hostOf, normalizeUrl, resolveRedirects } from "@/lib/links";

/**
 * Uses Gemini with Google Search grounding to find the real organizer and the
 * event's official pages. Every URL the model suggests is later checked
 * against the hosts Google actually returned as sources, so the model cannot
 * make up a link that nothing on the web backs.
 */

const foundSchema = z.object({
  found: z.boolean(),
  organizer_name: z.string().nullable(),
  organizer_url: z.string().nullable(),
  event_url: z.string().nullable(),
  ticket_url: z.string().nullable(),
  summary: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type OrganizerLookup = z.infer<typeof foundSchema> & {
  sources: { url: string; title: string | null; host: string }[];
  groundingHosts: string[];
  model: string;
};

export type LookupInput = {
  title: string | null;
  organizerHint: string | null;
  venue: string | null;
  city: string | null;
  date: string | null;
  lineup: string[];
  printedUrls: string[];
};

export function canLookupOrganizer() {
  return Boolean(googleProvider());
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function findOrganizer(input: LookupInput): Promise<OrganizerLookup | null> {
  const google = googleProvider();
  if (!google || !input.title) return null;

  const facts = [
    `Event title: ${input.title}`,
    input.organizerHint ? `Organizer printed on the flyer: ${input.organizerHint}` : null,
    input.venue ? `Venue: ${input.venue}` : null,
    input.city ? `City: ${input.city}` : null,
    input.date ? `Date: ${input.date}` : null,
    input.lineup.length ? `Lineup: ${input.lineup.join(", ")}` : null,
    input.printedUrls.length ? `Links printed on the flyer: ${input.printedUrls.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "You verify nightlife and local events. Use Google Search to find this exact event and who is organizing it.",
    facts,
    "Find: (1) the organizer, promoter, collective or venue putting it on; (2) the organizer's official website or Instagram; (3) the event's own page (Resident Advisor, Dice, Eventbrite, Partiful, the venue's site, Instagram post, etc.); (4) the official ticket link.",
    "Rules: only report URLs that appear in your search results. If you cannot find the event, set found=false and leave the URLs null. Never guess or construct URLs. Prefer official sources over aggregators.",
    'Respond with ONLY a JSON object: {"found": boolean, "organizer_name": string|null, "organizer_url": string|null, "event_url": string|null, "ticket_url": string|null, "summary": string|null, "confidence": number 0-1}',
  ].join("\n\n");

  let lastError: unknown = null;
  for (const id of geminiModelIds()) {
    try {
      const result = await generateText({
        model: google(id),
        tools: { google_search: google.tools.googleSearch({}) },
        prompt,
        maxOutputTokens: 800,
        maxRetries: 1,
      });

      const parsed = foundSchema.parse(extractJson(result.text));

      const rawSources = result.sources
        .filter((s): s is Extract<typeof s, { sourceType: "url" }> => s.sourceType === "url")
        .map((s) => ({ url: s.url, title: s.title ?? null }));

      // Grounding links are Google redirect URLs; resolve them to real hosts.
      const resolved = await Promise.all(
        rawSources.slice(0, 12).map(async (s) => {
          const final = normalizeUrl(await resolveRedirects(s.url));
          return final ? { url: final, title: s.title, host: hostOf(final) } : null;
        })
      );
      const sources = resolved.filter((s): s is NonNullable<typeof s> => Boolean(s));
      const groundingHosts = [...new Set(sources.map((s) => s.host))];

      return { ...parsed, sources, groundingHosts, model: id };
    } catch (err) {
      lastError = err;
      console.warn(`[organizer] Gemini ${id} lookup failed`, err instanceof Error ? err.message.slice(0, 300) : err);
    }
  }
  if (lastError) console.error("[organizer] lookup failed on all Gemini models");
  return null;
}
