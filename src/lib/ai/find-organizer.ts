import { generateText, Output } from "ai";
import { z } from "zod";
import { geminiModelIds, googleProvider, textProviders } from "./providers";
import { hostOf, normalizeUrl, resolveRedirects } from "@/lib/links";
import { searchProviderName, webSearch, type SearchResult } from "@/lib/search";

/**
 * Finds the real organizer and the event's official pages.
 *
 * Strategy 1: Gemini with Google Search grounding (needs a billed Gemini key;
 *             free-tier keys get RESOURCE_EXHAUSTED, so we try it once).
 * Strategy 2: a web search API (Tavily or Brave) whose results are handed to
 *             whichever text model is configured, Gemini or Qwen alike.
 *
 * In both cases every URL the model proposes is later checked against the
 * hosts the search actually returned, so nothing gets invented.
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
  method: "google-grounding" | "web-search";
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
  return Boolean(googleProvider()) || (Boolean(searchProviderName()) && textProviders().length > 0);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

function facts(input: LookupInput) {
  return [
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
}

const RULES =
  "Rules: only report URLs that appear in the search results. If the event cannot be found, set found=false and leave the URLs null. Never guess or construct URLs. Prefer official sources (the organizer's own site or Instagram, the venue, Resident Advisor, Dice, Eventbrite, Partiful, Ticketmaster) over aggregators.";

/* ---------- Strategy 1: Gemini + Google Search grounding ---------- */

async function viaGoogleGrounding(input: LookupInput): Promise<OrganizerLookup | null> {
  const google = googleProvider();
  if (!google) return null;
  const id = geminiModelIds()[0];

  const prompt = [
    "You verify nightlife and local events. Use Google Search to find this exact event and who is organizing it.",
    facts(input),
    "Find: (1) the organizer, promoter, collective or venue putting it on; (2) the organizer's official website or Instagram; (3) the event's own page; (4) the official ticket link.",
    RULES,
    'Respond with ONLY a JSON object: {"found": boolean, "organizer_name": string|null, "organizer_url": string|null, "event_url": string|null, "ticket_url": string|null, "summary": string|null, "confidence": number 0-1}',
  ].join("\n\n");

  try {
    const result = await generateText({
      model: google(id),
      tools: { google_search: google.tools.googleSearch({}) },
      prompt,
      maxOutputTokens: 2048,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(40_000),
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
    return {
      ...parsed,
      sources,
      groundingHosts: [...new Set(sources.map((s) => s.host))],
      method: "google-grounding",
      model: id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const quota = /quota|RESOURCE_EXHAUSTED|429/i.test(message);
    console.warn(
      `[organizer] Google grounding unavailable (${quota ? "quota" : "error"}): ${message.slice(0, 160)}`
    );
    return null;
  }
}

/* ---------- Strategy 2: web search API + any text model ---------- */

function queriesFor(input: LookupInput) {
  const year = input.date?.slice(0, 4);
  const q: string[] = [];
  q.push([input.title, input.venue, input.city, year].filter(Boolean).join(" "));
  if (input.organizerHint) q.push([input.organizerHint, input.city, "events"].filter(Boolean).join(" "));
  else if (input.lineup[0]) q.push([input.lineup[0], input.venue ?? input.city, year].filter(Boolean).join(" "));
  return [...new Set(q.map((s) => s.trim()).filter(Boolean))].slice(0, 2);
}

async function viaWebSearch(input: LookupInput): Promise<OrganizerLookup | null> {
  if (!searchProviderName()) return null;
  const models = textProviders();
  if (models.length === 0) return null;

  const seen = new Map<string, SearchResult>();
  for (const query of queriesFor(input)) {
    const res = await webSearch(query, 8);
    for (const r of res?.results ?? []) {
      const url = normalizeUrl(r.url);
      if (url && !seen.has(url)) seen.set(url, { ...r, url });
    }
  }
  const results = [...seen.values()].slice(0, 12);
  if (results.length === 0) return null;

  const listing = results
    .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet.replace(/\s+/g, " ")}`)
    .join("\n");

  const prompt = [
    "You verify nightlife and local events using web search results.",
    facts(input),
    "Search results:",
    listing,
    "From these results only, identify: (1) the organizer, promoter, collective or venue putting the event on; (2) the organizer's official website or Instagram; (3) the event's own page; (4) the official ticket link. Copy URLs exactly from the results.",
    RULES,
  ].join("\n\n");

  for (const provider of models) {
    try {
      const { output } = await generateText({
        model: provider.model,
        output: Output.object({ schema: foundSchema }),
        prompt,
        providerOptions: provider.providerOptions,
        maxOutputTokens: 2048,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(40_000),
      });
      if (!output) throw new Error("no structured output");
      const sources = results.map((r) => ({ url: r.url, title: r.title || null, host: hostOf(r.url) }));
      return {
        ...output,
        sources,
        groundingHosts: [...new Set(sources.map((s) => s.host))],
        method: "web-search",
        model: provider.label,
      };
    } catch (err) {
      console.warn(`[organizer] ${provider.label} failed reading search results`, err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }
  return null;
}

export async function findOrganizer(input: LookupInput): Promise<OrganizerLookup | null> {
  if (!input.title) return null;
  return (await viaGoogleGrounding(input)) ?? (await viaWebSearch(input));
}
