import { createHmac, timingSafeEqual } from "node:crypto";
import type { LinkChecks } from "./links";

/**
 * Link checks are produced server-side during flyer analysis, round-trip
 * through the browser as hidden form fields, and come back on save. Signing
 * them stops a client from marking its own link as "found on Google".
 */

function secret() {
  return (
    process.env.LINK_SIGNING_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.RESEND_API_KEY ??
    "headcount-dev-secret"
  );
}

export function signLinkChecks(checks: LinkChecks): string {
  const payload = Buffer.from(JSON.stringify(checks)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyLinkChecks(token: string | null | undefined): LinkChecks | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as LinkChecks) : null;
  } catch {
    return null;
  }
}
