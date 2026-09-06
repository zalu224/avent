import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
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
  ticket_url: z.string().nullable().describe("Ticket link or site if printed"),
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

/** Vision-capable model id, "provider/model" for the gateway. */
export const EXTRACTION_MODEL =
  process.env.EVENT_EXTRACTION_MODEL ?? "anthropic/claude-sonnet-5";

/**
 * Model resolution: Vercel AI Gateway by default (OIDC on Vercel, or
 * AI_GATEWAY_API_KEY). If ANTHROPIC_API_KEY is set, call Anthropic directly
 * instead, which avoids needing gateway billing.
 */
function resolveModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const id = EXTRACTION_MODEL.replace(/^anthropic\//, "");
    return anthropic(id);
  }
  return EXTRACTION_MODEL;
}

type Input = {
  imageUrl?: string;
  caption?: string;
  /** yyyy-MM-dd in the poster's timezone */
  today: string;
  timeZone: string;
};

export async function extractEventFromImage(input: Input): Promise<ExtractedEvent> {
  const content: Array<{ type: "image"; image: URL } | { type: "text"; text: string }> = [];

  if (input.imageUrl) {
    content.push({ type: "image", image: new URL(input.imageUrl) });
  }

  content.push({
    type: "text",
    text: [
      "You read flyers and posts for nightlife and local events (concerts, raves, club nights, festivals, parties, games, shows) and extract the details so they can go on a calendar.",
      `Today is ${input.today} in ${input.timeZone}. If a flyer shows a day and month with no year, pick the next occurrence on or after today. If it shows a weekday only, pick the next such weekday.`,
      "Convert times like 'doors 9pm' or '10PM-4AM' into 24-hour HH:MM start and end times. Leave a field null when it is not visible or stated. Never invent a venue, city or price.",
      "Use the category that best fits; 'club' is for DJ nights at venues, 'rave' for warehouse or underground parties, 'party' for house or private parties.",
      "Add tags that would help someone find this event by searching: music genres, the kind of night it is, age limit, and the name of the promoter or series if printed.",
      input.caption?.trim()
        ? `The poster's caption may add or override details:\n"""${input.caption.trim()}"""`
        : "The poster did not write a caption.",
    ].join("\n\n"),
  });

  const { output } = await generateText({
    model: resolveModel(),
    output: Output.object({ schema: extractedEventSchema }),
    messages: [{ role: "user", content }],
    maxOutputTokens: 1024,
  });

  if (!output) {
    throw new Error("The model returned no structured output.");
  }
  return output;
}
