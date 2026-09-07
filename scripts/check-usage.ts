/**
 * Shows this month's metered API usage against the app's cap, and proves the
 * cap refuses reservations that would exceed it. Nothing here calls Tavily.
 *
 *   npx tsx scripts/check-usage.ts            # show usage
 *   npx tsx scripts/check-usage.ts overcap    # try to reserve more than the cap (must be refused)
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
  const { monthlyUsage, reserveCredits, creditLimit } = await import("../src/lib/usage");
  const provider = "tavily";
  console.log(`${provider} limit this month:`, creditLimit(provider));
  console.log("used:", await monthlyUsage(provider));
  if (process.argv[2] === "overcap") {
    const ok = await reserveCredits(provider, creditLimit(provider) + 1);
    console.log("over-cap reservation allowed?", ok, ok ? "(BUG)" : "(correctly refused)");
    console.log("used after:", await monthlyUsage(provider));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
