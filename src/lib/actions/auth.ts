"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";

export type AuthState = { error?: string; message?: string };

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const NOT_CONNECTED =
  "Headcount isn’t connected to its database yet. Try again once setup is finished.";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/feed";
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("first_name") ?? "").trim().slice(0, 40);
  const lastName = String(formData.get("last_name") ?? "").trim().slice(0, 40);
  const displayName = [firstName, lastName].filter(Boolean).join(" ").slice(0, 60);

  if (!firstName) return { error: "Enter your first name." };
  if (!lastName) return { error: "Enter your last name." };
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (!USERNAME_RE.test(username)) {
    return { error: "Usernames are 3–24 characters: lowercase letters, numbers and underscores." };
  }
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };
  if (!isSupabaseConfigured()) return { error: NOT_CONNECTED };

  const supabase = await createClient();

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) return { error: "That username is taken. Try another." };

  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: displayName || username,
        first_name: firstName,
        last_name: lastName,
      },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/feed`,
    },
  });

  if (error) return { error: error.message };
  if (data.session) redirect("/feed");

  return {
    message: `Almost there. Open the confirmation link we sent to ${email}, then sign in.`,
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) return { error: "Enter your email and password." };
  if (!isSupabaseConfigured()) return { error: NOT_CONNECTED };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email first. Check your inbox for the link." };
    }
    return { error: "That email and password don't match." };
  }

  redirect(next);
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter the email you signed up with." };
  if (!isSupabaseConfigured()) return { error: NOT_CONNECTED };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });
  if (error) {
    console.error("requestPasswordReset failed", error.message);
  }
  // Always respond the same way so addresses can't be probed.
  return { message: `If ${email} has a Headcount account, a reset link is on its way.` };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };
  if (password !== confirm) return { error: "Those passwords don't match." };
  if (!isSupabaseConfigured()) return { error: NOT_CONNECTED };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { error: "That reset link has expired. Request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/feed");
}

export async function signOut() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
