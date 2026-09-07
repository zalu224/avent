/**
 * Web search used to look up an event's organizer and official pages when
 * Gemini's built-in Google Search grounding isn't available (it's quota-locked
 * on free-tier keys). Providers, in order:
 *
 *   TAVILY_API_KEY        https://tavily.com   (free tier, no card)
 *   BRAVE_SEARCH_API_KEY  https://brave.com/search/api
 */

import { reserveCredits } from "@/lib/usage";

export type SearchResult = { title: string; url: string; snippet: string };
export type SearchResponse = { provider: "tavily" | "brave"; results: SearchResult[] };

export function searchProviderName(): SearchResponse["provider"] | null {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  return null;
}

async function tavily(query: string, max: number): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ query, max_results: max, search_depth: "basic", include_answer: false }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const body = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
  return (body.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: (r.content ?? "").slice(0, 400) }));
}

async function brave(query: string, max: number): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(max));
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY ?? "",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const body = (await res.json()) as {
    web?: { results?: { title?: string; url?: string; description?: string }[] };
  };
  return (body.web?.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: (r.description ?? "").slice(0, 400) }));
}

/**
 * Runs one query against the configured provider. Returns null when none is
 * set or the provider's monthly credit cap has been reached (a basic Tavily
 * search costs 1 credit).
 */
export async function webSearch(query: string, max = 8): Promise<SearchResponse | null> {
  const provider = searchProviderName();
  if (!provider) return null;

  if (provider === "tavily" && !(await reserveCredits("tavily", 1))) {
    return null;
  }

  try {
    const results = provider === "tavily" ? await tavily(query, max) : await brave(query, max);
    return { provider, results };
  } catch (err) {
    console.warn(`[search] ${provider} failed`, err instanceof Error ? err.message : err);
    return { provider, results: [] };
  }
}
