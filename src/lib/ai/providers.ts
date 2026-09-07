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
const GEMINI_DEFAULTS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

/**
 * Gemini "thinking" settings. Reasoning adds seconds and eats into the output
 * budget, and none of these tasks need it. 2.x and 3.5 Flash accept
 * thinkingBudget=0; the Lite and 3.6 models reject that and take a
 * thinkingLevel instead ("low" answers in about a second on the free tier).
 */
function geminiOptions(id: string): VisionProvider["providerOptions"] {
  if (/^gemini-(2\.\d+-|3\.5-flash$)/.test(id)) {
    return { google: { thinkingConfig: { thinkingBudget: 0 } } };
  }
  return { google: { thinkingConfig: { thinkingLevel: "low" } } };
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
 * Text-only tasks (reading search results, picking links) use the same chain,
 * but with the Gemini Lite models first: a dozen search snippets are easy
 * reading, and Lite answers in about a second on the free tier while the
 * full Flash models often queue behind demand.
 */
export function textProviders(): VisionProvider[] {
  const all = visionProviders();
  const lite = all.filter((p) => p.name === "google" && /lite/.test(p.label));
  return [...lite, ...all.filter((p) => !lite.includes(p))];
}

export function describeProviders() {
  return visionProviders().map((p) => p.label);
}
