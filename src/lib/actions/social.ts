"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyFollow } from "@/lib/email/notify";
import { getSiteUrl } from "@/lib/site";
import { createClient, requireUserId } from "@/lib/supabase/server";

export async function setFollow(targetId: string, follow: boolean) {
  const userId = await requireUserId();
  if (targetId === userId) return;

  const supabase = await createClient();
  if (follow) {
    const { data: existing } = await supabase
      .from("follows")
      .select("follower_id")
      .match({ follower_id: userId, following_id: targetId })
      .maybeSingle();
    await supabase
      .from("follows")
      .upsert({ follower_id: userId, following_id: targetId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });
    if (!existing) {
      const siteUrl = await getSiteUrl();
      after(() => notifyFollow(targetId, userId, siteUrl));
    }
  } else {
    await supabase
      .from("follows")
      .delete()
      .match({ follower_id: userId, following_id: targetId });
  }

  revalidatePath("/feed");
  revalidatePath("/calendar");
  revalidatePath("/people");
  revalidatePath("/u/[username]", "page");
}

export type ProfileState = { error?: string; message?: string };

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const userId = await requireUserId();

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const first_name = String(formData.get("first_name") ?? "").trim().slice(0, 40);
  const last_name = String(formData.get("last_name") ?? "").trim().slice(0, 40);
  const display_name = [first_name, last_name].filter(Boolean).join(" ").slice(0, 60);
  const city = String(formData.get("city") ?? "").trim().slice(0, 80);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 300);
  const avatar_url = String(formData.get("avatar_url") ?? "").trim();
  const email_notifications = formData.get("email_notifications") === "on";
  const reminder_emails = formData.get("reminder_emails") === "on";

  if (!USERNAME_RE.test(username)) {
    return { error: "Usernames are 3–24 characters: lowercase letters, numbers and underscores." };
  }
  if (!first_name) return { error: "Add your first name." };
  if (!last_name) return { error: "Add your last name." };

  const supabase = await createClient();
  const base = {
    username,
    display_name,
    city: city || null,
    bio: bio || null,
    avatar_url: avatar_url || null,
  };

  let { error } = await supabase
    .from("profiles")
    .update({ ...base, first_name, last_name, email_notifications, reminder_emails })
    .eq("id", userId);

  // Older databases without the newer columns still get the core fields.
  if (error?.code === "42703") {
    ({ error } = await supabase.from("profiles").update(base).eq("id", userId));
  }

  if (error) {
    if (error.code === "23505") return { error: "That username is taken." };
    return { error: "Couldn't save your profile." };
  }

  revalidatePath("/settings");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/feed");
  return { message: "Saved." };
}
