import { generateText, Output } from "ai";
import { z } from "zod";
import { visionProviders, type ProviderName } from "./providers";
import { EVENT_CATEGORIES } from "@/lib/types";

export const extractedEventSchema = z.object({
  is_event: z
    .boolean()
    .describe("true when the image or caption describes a specific upcoming event"),
  title: z.string().nullable().describe("Short event name as it would appear on a calendar"),
  category: z.enum(EVENT_CATEGORIES).nullable(),
  date: z.string().nullable().describe("Start date as YYYY-MM-DD, or null if not stated"),
  start_time: z.string().nullable().describe("Start or doors time as 24-hour HH:MM, or null"),
  end_time: z.string().nullable().describe("End time as 24-hour HH:MM, or null"),
  venue_name: z.string().nullable(),
  address: z.string().nullable().describe("Street address if printed"),
  city: z.string().nullable(),
  organizer_name: z
    .string()
    .nullable()
    .describe(
      "The promoter, collective, venue, brand or person putting the event on, exactly as printed (e.g. after 'presents' or next to a logo)"
    ),
  organizer_url: z
    .string()
    .nullable()
    .describe("The organizer's website, Instagram or link printed on the flyer, if any"),
  event_url: z
    .string()
    .nullable()
    .describe("A link to the event's own page if printed (e.g. an RA, Dice, Eventbrite or venue URL)"),
  ticket_url: z.string().nullable().describe("Ticket link if printed"),
  printed_urls: z
    .array(z.string())
    .describe("Every website, link or @handle visible on the flyer, exactly as written"),
  lineup: z
    .array(z.string())
    .describe("Performers, DJs, artists, teams or hosts named, in billing order"),
  tags: z
    .array(z.string())
    .describe(
      "Up to 6 short lowercase tags people would search for: genres (techno, hip-hop, indie), vibes (rooftop, warehouse, drag, karaoke), age limits (18+, 21+), recurring series names"
    ),
  price: z
    .string()
    .nullable()
    .describe("Ticket price or cover as written, e.g. '$20', 'Free before 11pm'"),
  description: z
    .string()
    .nullable()
    .describe("One or two plain sentences summarising what the event is"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident you are that the extracted title/date/venue are right"),
});

export type ExtractedEvent = z.infer<typeof extractedEventSchema>;

type Input = {
  imageUrl?: string;
  caption?: string;
  /** yyyy-MM-dd in the poster's timezone */
  today: string;
  timeZone: string;
};

export type ExtractionResult = {
  event: ExtractedEvent;
  provider: ProviderName;
  providerLabel: string;
};

export class NoVisionProviderError extends Error {
  constructor() {
    super(
      "No vision model is configured. Set GOOGLE_GENERATIVE_AI_API_KEY (recommended), OPENROUTER_API_KEY, OLLAMA_BASE_URL, ANTHROPIC_API_KEY or AI Gateway credentials."
    );
    this.name = "NoVisionProviderError";
  }
}

function imageMediaType(url: string) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

function buildPrompt(input: Input) {
  return [
    "You read flyers and posts for nightlife and local events (concerts, raves, club nights, festivals, parties, games, shows) and extract the details so they can go on a calendar.",
    `Today is ${input.today} in ${input.timeZone}. If a flyer shows a day and month with no year, pick the next occurrence on or after today. If it shows a weekday only, pick the next such weekday.`,
    "Convert times like 'doors 9pm' or '10PM-4AM' into 24-hour HH:MM start and end times. Leave a field null when it is not visible or stated. Never invent a venue, city, organizer, price or link.",
    "Identify who is putting the event on: the promoter, collective, venue or brand named on the flyer (often after 'presents' or shown as a logo). Copy every URL and @handle exactly as printed into printed_urls.",
    "Use the category that best fits; 'club' is for DJ nights at venues, 'rave' for warehouse or underground parties, 'party' for house or private parties.",
    "Add tags that would help someone find this event by searching: music genres, the kind of night it is, age limit, and the name of the promoter or series if printed.",
    input.caption?.trim()
      ? `The poster's caption may add or override details:\n"""${input.caption.trim()}"""`
      : "The poster did not write a caption.",
  ].join("\n\n");
}

/**
 * Reads a flyer with the first working provider in the chain. Throws only if
 * every configured provider fails (or none is configured).
 */
export async function extractEventFromImage(input: Input): Promise<ExtractionResult> {
  const providers = visionProviders();
  if (providers.length === 0) throw new NoVisionProviderError();

  const content: Array<
    { type: "file"; data: Uint8Array; mediaType: string } | { type: "text"; text: string }
  > = [];
  if (input.imageUrl) {
    // Send bytes inline: Gemini rejects arbitrary external URLs as file
    // references, and local Ollama can't fetch them at all.
    const res = await fetch(input.imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Could not download the flyer image (${res.status})`);
    const mediaType = res.headers.get("content-type")?.split(";")[0] || imageMediaType(input.imageUrl);
    content.push({ type: "file", data: new Uint8Array(await res.arrayBuffer()), mediaType });
  }
  content.push({ type: "text", text: buildPrompt(input) });

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const { output } = await generateText({
        model: provider.model,
        output: Output.object({ schema: extractedEventSchema }),
        messages: [{ role: "user", content }],
        // Some Gemini models spend output budget on "thinking" by default,
        // which truncated the JSON; providers.ts turns it off where allowed.
        providerOptions: provider.providerOptions,
        maxOutputTokens: 4096,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(45_000),
      });
      if (!output) throw new Error("no structured output");
      return { event: output, provider: provider.name, providerLabel: provider.label };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${provider.label}: ${message.slice(0, 200)}`);
      console.warn(`[extract] ${provider.label} failed, trying next`, message.slice(0, 300));
    }
  }

  throw new Error(`All vision providers failed:\n${failures.join("\n")}`);
}
