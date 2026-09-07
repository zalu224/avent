/**
 * Sends one sample notification email through Resend so the key, sender and
 * template can be checked in a real inbox.
 *
 *   npx tsx scripts/send-test-email.tsx you@example.com
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
  const { RsvpEmail } = await import("../src/lib/email/notification-emails");
  const { sendEmail, emailFrom } = await import("../src/lib/email/resend");
  console.log("from:", emailFrom());
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npx tsx scripts/send-test-email.tsx you@example.com");
    process.exit(1);
  }

  const result = await sendEmail({
    to,
    subject: "Maya is in for Boiler Room x Warehouse Project",
    react: (
      <RsvpEmail
        actor={{ name: "Maya Chen", username: "maya" }}
        event={{
          id: "00000000-0000-0000-0000-000000000000",
          title: "Boiler Room x Warehouse Project",
          month: "Sep",
          day: "12",
          weekday: "Fri",
          when: "Fri, Sep 12 at 10:00 pm",
          where: "The Warehouse, Los Angeles",
        }}
        goingCount={4}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "https://avent-avent.vercel.app"}
      />
    ),
  });

  console.log(result.ok ? `sent (id ${result.id})` : `not sent: ${result.error ?? "skipped"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
