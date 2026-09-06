import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider-v2";
import type { JSONValue, LanguageModel } from "ai";

/**
 * Vision model chain for reading flyers, in priority order. Each entry is
 * tried until one succeeds, so a rate-limited or misconfigured provider falls
 * through to the next.
 *
 *   1. Google Gemini      GOOGLE_GENERATIVE_AI_API_KEY  (free tier; also powers Google Search grounding)
 *   2. Qwen VL, OpenRouter OPENROUTER_API_KEY           (cheap hosted Qwen; no web search)
 *   3. Qwen VL, Ollama     OLLAMA_BASE_URL               (free, local; dev machines only)
 *   4. Claude              ANTHROPIC_API_KEY
 *   5. Vercel AI Gateway   AI_GATEWAY_API_KEY / OIDC     (needs billing on the Vercel team)
 */

export type ProviderName = "google" | "openrouter" | "ollama" | "anthropic" | "gateway";

export type VisionProvider = {
  name: ProviderName;
  label: string;
  model: LanguageModel;
  /** Provider-specific call options, e.g. turning off Gemini "thinking". */
  providerOptions?: Record<string, Record<string, JSONValue>>;
};

// Google retires older Flash models for new keys; keep a couple of fallbacks
// so a retired or overloaded model doesn't take flyer reading down.
// 3.5 Flash goes first: it accepts thinkingBudget=0, which keeps structured
// output fast and untruncated. 3.6 rejects that option, so it runs as-is.
const GEMINI_DEFAULTS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

/** Models known to accept thinkingBudget: 0 (2.x and 3.5 Flash families). */
function geminiOptions(id: string): VisionProvider["providerOptions"] {
  return /^gemini-(2\.|3\.5-|flash-lite-latest|flash-latest)/.test(id)
    ? { google: { thinkingConfig: { thinkingBudget: 0 } } }
    : undefined;
}
const GATEWAY_DEFAULT = "anthropic/claude-sonnet-5";

function unique<T>(items: (T | undefined | null)[]) {
  return [...new Set(items.filter((x): x is T => Boolean(x)))];
}

export function geminiModelIds() {
  return unique([process.env.GEMINI_MODEL, ...GEMINI_DEFAULTS]);
}

export function googleProvider() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  return createGoogle({ apiKey });
}

export function visionProviders(): VisionProvider[] {
  const list: VisionProvider[] = [];

  const google = googleProvider();
  if (google) {
    for (const id of geminiModelIds()) {
      list.push({
        name: "google",
        label: `Gemini (${id})`,
        model: google(id),
        providerOptions: geminiOptions(id),
      });
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const id = process.env.OPENROUTER_VISION_MODEL ?? "qwen/qwen3-vl-8b-instruct";
    list.push({ name: "openrouter", label: `OpenRouter (${id})`, model: openrouter(id) });
  }

  if (process.env.OLLAMA_BASE_URL) {
    const ollama = createOllama({ baseURL: process.env.OLLAMA_BASE_URL });
    const id = process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl";
    list.push({ name: "ollama", label: `Ollama (${id})`, model: ollama(id) });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const id = (process.env.EVENT_EXTRACTION_MODEL ?? GATEWAY_DEFAULT).replace(/^anthropic\//, "");
    list.push({ name: "anthropic", label: `Anthropic (${id})`, model: anthropic(id) });
  }

  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) {
    const id = process.env.EVENT_EXTRACTION_MODEL ?? GATEWAY_DEFAULT;
    list.push({ name: "gateway", label: `AI Gateway (${id})`, model: id });
  }

  return list;
}

/**
 * Text-only tasks (reading search results, picking links) can use the same
 * chain; every vision model here handles plain text too.
 */
export function textProviders(): VisionProvider[] {
  return visionProviders();
}

export function describeProviders() {
  return visionProviders().map((p) => p.label);
}
