/**
 * Renders the Supabase Auth email templates to static HTML with Go template
 * placeholders intact, so they can be pasted into
 * Supabase → Authentication → Email Templates (or pushed via config.toml).
 *
 *   npx tsx scripts/render-auth-emails.tsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@react-email/components";
import {
  ChangeEmailEmail,
  ConfirmSignupEmail,
  MagicLinkEmail,
  ResetPasswordEmail,
} from "../src/lib/email/auth-emails";

const SITE = "{{ .SiteURL }}";
const callback = (type: string, next: string) =>
  `${SITE}/auth/callback?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;

const templates = {
  confirmation: {
    subject: "Confirm your email for Headcount",
    element: <ConfirmSignupEmail url={callback("email", "/feed")} siteUrl={SITE} />,
  },
  magic_link: {
    subject: "Your Headcount sign-in link",
    element: <MagicLinkEmail url={callback("magiclink", "/feed")} siteUrl={SITE} />,
  },
  recovery: {
    subject: "Reset your Headcount password",
    element: <ResetPasswordEmail url={callback("recovery", "/reset-password")} siteUrl={SITE} />,
  },
  email_change: {
    subject: "Confirm your new email for Headcount",
    element: (
      <ChangeEmailEmail url={callback("email_change", "/settings")} siteUrl={SITE} newEmail="{{ .NewEmail }}" />
    ),
  },
};

async function main() {
  const outDir = join(process.cwd(), "supabase", "templates");
  mkdirSync(outDir, { recursive: true });

  for (const [name, t] of Object.entries(templates)) {
    const html = await render(t.element, { pretty: true });
    // React escapes & inside attributes; Supabase/Go treats the template as
    // plain text so restore literal ampersands in the links.
    const cleaned = html.replace(/&amp;/g, "&");
    const file = join(outDir, `${name}.html`);
    writeFileSync(file, cleaned, "utf8");
    console.log(`${name}: ${cleaned.length} bytes → supabase/templates/${name}.html (subject: ${t.subject})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
