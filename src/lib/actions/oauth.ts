"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";

/**
 * Google sign-in through Supabase Auth. Supabase links a Google identity to an
 * existing account automatically when the verified email matches; signed-in
 * users can also connect or disconnect Google from Settings.
 */

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/feed";
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (!isSupabaseConfigured()) redirect("/login?error=oauth");

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("signInWithGoogle failed", error?.message);
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}

export async function linkGoogle() {
  if (!isSupabaseConfigured()) redirect("/settings?error=link");

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/settings?linked=google")}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("linkGoogle failed", error?.message);
    redirect("/settings?error=link");
  }
  redirect(data.url);
}

export async function unlinkGoogle() {
  if (!isSupabaseConfigured()) redirect("/settings?error=unlink");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUserIdentities();
  const identities = data?.identities ?? [];
  const google = identities.find((i) => i.provider === "google");
  if (error || !google) redirect("/settings?error=unlink");
  // Supabase refuses to remove the last way into an account; say so up front.
  if (identities.length < 2) redirect("/settings?error=last_identity");

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(google);
  if (unlinkError) {
    console.error("unlinkGoogle failed", unlinkError.message);
    redirect("/settings?error=unlink");
  }
  redirect("/settings?unlinked=google");
}
