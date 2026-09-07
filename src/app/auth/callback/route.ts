import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase Auth sends the browser back to: email confirmation and
 * password-reset links, Google sign-in, and connecting Google to an existing
 * account. Supports both the PKCE `code` flow and the `token_hash` flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const requestedNext = searchParams.get("next") ?? "/feed";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/feed";
  const linking = next.startsWith("/settings");

  // Google (or Supabase) declined: e.g. the user cancelled, or that Google
  // account already belongs to someone else.
  const oauthError = searchParams.get("error") ?? searchParams.get("error_code");
  if (oauthError) {
    const reason = (searchParams.get("error_description") ?? oauthError).slice(0, 120);
    const target = linking
      ? `/settings?error=link&reason=${encodeURIComponent(reason)}`
      : "/login?error=oauth";
    return NextResponse.redirect(`${origin}${target}`);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("auth callback: code exchange failed", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}${linking ? "/settings?error=link" : "/login?error=link"}`);
}
