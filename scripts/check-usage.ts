/**
 * Shows this month's metered API usage against the app's cap, and proves the
 * cap refuses reservations that would exceed it. Nothing here calls Tavily.
 *
 *   npx tsx scripts/check-usage.ts            # show usage
 *   npx tsx scripts/check-usage.ts overcap    # try to reserve more than the Tavily cap (must be refused)
 */
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {
  // no .env.local
}

async function main() {
  const { usageFor, reserveCredits, creditLimit } = await import("../src/lib/usage");
  const metered = [
    { provider: "tavily", period: "month" as const },
    { provider: "google_cse", period: "day" as const },
  ];
  for (const { provider, period } of metered) {
    console.log(`${provider} (per ${period}):`, await usageFor(provider, period));
  }
  if (process.argv[2] === "overcap") {
    const { provider, period } = metered[0];
    const ok = await reserveCredits(provider, creditLimit(provider) + 1, period);
    console.log("over-cap reservation allowed?", ok, ok ? "(BUG)" : "(correctly refused)");
    console.log("used after:", await usageFor(provider, period));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
