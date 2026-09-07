/**
 * Web search used to look up an event's organizer and official pages when
 * Gemini's built-in Google Search grounding isn't available (it's quota-locked
 * on free-tier keys). Providers are tried in this order, each skipped when its
 * free allowance for the period is used up:
 *
 *   GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID   Google Programmable Search, 100 queries/day free
 *   TAVILY_API_KEY                        https://tavily.com, 1,500 credits/month free
 *   BRAVE_SEARCH_API_KEY                  https://brave.com/search/api
 *   (no key)                              DuckDuckGo's HTML results, best effort
 *
 * DuckDuckGo needs no key, so organizer lookup keeps working after every
 * allowance is spent; it is just slower and occasionally rate-limited.
 */

import { reserveCredits } from "@/lib/usage";

export type SearchResult = { title: string; url: string; snippet: string };
export type SearchProviderName = "google_cse" | "tavily" | "brave" | "duckduckgo";
export type SearchResponse = { provider: SearchProviderName; results: SearchResult[] };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HeadcountOrganizerLookup/1.0 (+https://headcountevents.com)";

export function searchProviders(): SearchProviderName[] {
  const list: SearchProviderName[] = [];
  if (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID) list.push("google_cse");
  if (process.env.TAVILY_API_KEY) list.push("tavily");
  if (process.env.BRAVE_SEARCH_API_KEY) list.push("brave");
  if (process.env.DUCKDUCKGO_FALLBACK !== "off") list.push("duckduckgo");
  return list;
}

/** First configured provider, or null when web search is switched off entirely. */
export function searchProviderName(): SearchProviderName | null {
  return searchProviders()[0] ?? null;
}

async function googleCse(query: string, max: number): Promise<SearchResult[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", process.env.GOOGLE_CSE_API_KEY ?? "");
  url.searchParams.set("cx", process.env.GOOGLE_CSE_ID ?? "");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(max, 10)));
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google CSE ${res.status}`);
  const body = (await res.json()) as { items?: { title?: string; link?: string; snippet?: string }[] };
  return (body.items ?? [])
    .filter((r) => r.link)
    .map((r) => ({ title: r.title ?? "", url: r.link!, snippet: (r.snippet ?? "").slice(0, 400) }));
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

function decodeEntities(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** DuckDuckGo's no-JavaScript results page. Links are redirect URLs carrying the real one in `uddg`. */
async function duckduckgo(query: string, max: number): Promise<SearchResult[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`);
  const html = await res.text();

  const results: SearchResult[] = [];
  const blocks = html.split(/<div class="result results_links/).slice(1);
  for (const block of blocks) {
    const link = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    let href = decodeEntities(link[1]);
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (href.startsWith("//")) href = `https:${href}`;
    if (!/^https?:\/\//i.test(href)) continue;
    const snippet = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    results.push({
      title: decodeEntities(link[2]),
      url: href,
      snippet: snippet ? decodeEntities(snippet[1]).slice(0, 400) : "",
    });
    if (results.length >= max) break;
  }
  return results;
}

async function run(provider: SearchProviderName, query: string, max: number) {
  switch (provider) {
    case "google_cse":
      return googleCse(query, max);
    case "tavily":
      return tavily(query, max);
    case "brave":
      return brave(query, max);
    case "duckduckgo":
      return duckduckgo(query, max);
  }
}

/**
 * Runs one query, falling through the provider list when a provider is out of
 * free allowance, errors, or returns nothing. Returns null only when no
 * provider is configured at all.
 */
export async function webSearch(query: string, max = 8): Promise<SearchResponse | null> {
  const providers = searchProviders();
  if (providers.length === 0) return null;

  for (const provider of providers) {
    if (provider === "google_cse" && !(await reserveCredits("google_cse", 1, "day"))) continue;
    if (provider === "tavily" && !(await reserveCredits("tavily", 1, "month"))) continue;

    try {
      const results = await run(provider, query, max);
      if (results.length > 0) return { provider, results };
      console.warn(`[search] ${provider} returned nothing for "${query.slice(0, 60)}"`);
    } catch (err) {
      console.warn(`[search] ${provider} failed`, err instanceof Error ? err.message : err);
    }
  }
  return { provider: providers[providers.length - 1], results: [] };
}
