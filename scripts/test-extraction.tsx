/**
 * Runs the flyer-reading pipeline against an already-uploaded flyer image and
 * prints what each stage produced. No secrets are printed.
 *
 *   npx tsx scripts/test-extraction.tsx <public flyer image url> ["optional caption"]
 */
import { readFileSync } from "node:fs";

// Load .env.local without printing anything.
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {
  // no .env.local
}

async function main() {
  const [imageUrl, caption] = process.argv.slice(2);
  if (!imageUrl) {
    console.error("Usage: npx tsx scripts/test-extraction.tsx <image url> [caption]");
    process.exit(1);
  }

  const { describeProviders } = await import("../src/lib/ai/providers");
  const { extractEventFromImage } = await import("../src/lib/ai/extract-event");
  const { resolveEventLinks } = await import("../src/lib/ai/event-links");

  console.log("providers:", describeProviders().join(" → "));

  const started = Date.now();
  const extraction = await extractEventFromImage({
    imageUrl,
    caption,
    today: new Date().toISOString().slice(0, 10),
    timeZone: "America/Los_Angeles",
  });
  console.log(`\nread by ${extraction.providerLabel} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  const { printed_urls, lineup, tags, ...rest } = extraction.event;
  console.log(JSON.stringify({ ...rest, lineup, tags, printed_urls }, null, 2));

  const t2 = Date.now();
  const links = await resolveEventLinks(extraction.event, caption);
  console.log(`\nlinks resolved in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(links, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
