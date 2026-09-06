import { Resend } from "resend";
import type { ReactElement } from "react";

/** Sender shown in inboxes. Use a verified Resend domain in production. */
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Headcount <onboarding@resend.dev>";

let client: Resend | null = null;

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped?: true; error?: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
}): Promise<SendResult> {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set; skipped "${input.subject}"`);
    return { ok: false, skipped: true };
  }

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    react: input.react,
    replyTo: input.replyTo,
  });

  if (error) {
    console.error("[email] send failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}
