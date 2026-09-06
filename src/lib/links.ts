/**
 * Link safety for organizer, event and ticket URLs.
 *
 * Every external link an event stores goes through `verifyLink`:
 *   1. parse + normalise; only http(s), no credentials, no private hosts
 *   2. follow redirects server-side so shorteners resolve to their real destination
 *   3. optional Google Safe Browsing lookup when GOOGLE_SAFE_BROWSING_API_KEY is set
 *   4. record where the link came from (flyer, Google grounding, or the user)
 */

export type LinkSource = "flyer" | "google" | "user";

export type LinkCheck = {
  source: LinkSource;
  checked_at: string;
  final_url: string;
  host: string;
  safe_browsing: "ok" | "unchecked" | "flagged";
  corroborated: boolean;
};

export type LinkChecks = Record<string, LinkCheck>;

const BLOCKED_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|.*\.local$|.*\.internal$|172\.(1[6-9]|2\d|3[01])\.)/i;

const SHORTENERS = new Set([
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
  "rb.gy",
  "linktr.ee",
  "lnk.to",
  "shorturl.at",
]);

/** Returns a normalised https/http URL or null when it isn't a safe web link. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".") || BLOCKED_HOST_RE.test(url.hostname)) return null;
  url.hash = "";
  return url.toString();
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Root domain for corroboration checks: sub.example.co.uk → example.co.uk (best effort). */
export function rootDomain(host: string) {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const secondLevel = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);
  if (parts.length >= 3 && secondLevel.has(parts[parts.length - 2]) && parts[parts.length - 1].length === 2) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

/**
 * Follows redirects (max 5) without downloading bodies, so that shorteners and
 * tracking links resolve to the page a user will actually land on.
 */
export async function resolveRedirects(url: string, maxHops = 5): Promise<string> {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: { "user-agent": "HeadcountLinkCheck/1.0 (+https://avent-avent.vercel.app)" },
      });
    } catch {
      return current;
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const next = normalizeUrl(new URL(location, current).toString());
      if (!next) return current;
      current = next;
      continue;
    }
    return current;
  }
  return current;
}

/** Google Safe Browsing v4 lookup. Returns "unchecked" when no key is configured. */
export async function safeBrowsingStatus(url: string): Promise<LinkCheck["safe_browsing"]> {
  const key = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!key) return "unchecked";
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(6000),
        body: JSON.stringify({
          client: { clientId: "headcount", clientVersion: "1.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      }
    );
    if (!res.ok) return "unchecked";
    const body = (await res.json()) as { matches?: unknown[] };
    return body.matches && body.matches.length > 0 ? "flagged" : "ok";
  } catch {
    return "unchecked";
  }
}

/**
 * Full check. `corroboratingHosts` are hosts we independently trust for this
 * event (Google grounding sources, or domains printed on the flyer); a link
 * whose final host isn't among them is kept but marked uncorroborated.
 */
export async function verifyLink(
  raw: string | null | undefined,
  source: LinkSource,
  corroboratingHosts: string[] = []
): Promise<{ url: string; check: LinkCheck } | null> {
  const normalized = normalizeUrl(raw);
  if (!normalized) return null;

  const startHost = hostOf(normalized);
  const final = SHORTENERS.has(startHost) || source !== "user" ? await resolveRedirects(normalized) : normalized;
  const finalNormalized = normalizeUrl(final);
  if (!finalNormalized) return null;

  const host = hostOf(finalNormalized);
  if (SHORTENERS.has(host)) return null; // shortener that never resolved

  const safe_browsing = await safeBrowsingStatus(finalNormalized);
  if (safe_browsing === "flagged") return null;

  const trusted = new Set(corroboratingHosts.map(rootDomain));
  const corroborated = source === "user" ? true : trusted.has(rootDomain(host));

  return {
    url: finalNormalized,
    check: {
      source,
      checked_at: new Date().toISOString(),
      final_url: finalNormalized,
      host,
      safe_browsing,
      corroborated,
    },
  };
}

/** Pull bare domains and URLs out of free text (flyer OCR / captions). */
export function extractHosts(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const re = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\/[^\s)]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const host = m[1].toLowerCase();
    if (/\.(com|co|net|org|io|app|events|club|live|tickets|fm|to|ly|me|us|uk|de|fr|es|nl|ca|au|nz|jp|kr|tv|xyz)(\.[a-z]{2})?$/.test(host)) {
      found.add(host);
    }
  }
  return [...found];
}
