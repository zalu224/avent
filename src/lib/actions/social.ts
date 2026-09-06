"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUserId } from "@/lib/supabase/server";

export async function setFollow(targetId: string, follow: boolean) {
  const userId = await requireUserId();
  if (targetId === userId) return;

  const supabase = await createClient();
  if (follow) {
    await supabase
      .from("follows")
      .upsert({ follower_id: userId, following_id: targetId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });
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
  const display_name = String(formData.get("display_name") ?? "").trim().slice(0, 60);
  const city = String(formData.get("city") ?? "").trim().slice(0, 80);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 300);
  const avatar_url = String(formData.get("avatar_url") ?? "").trim();

  if (!USERNAME_RE.test(username)) {
    return { error: "Usernames are 3–24 characters: lowercase letters, numbers and underscores." };
  }
  if (!display_name) return { error: "Add a display name." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name,
      city: city || null,
      bio: bio || null,
      avatar_url: avatar_url || null,
    })
    .eq("id", userId);

  if (error) {
    if (error.code === "23505") return { error: "That username is taken." };
    return { error: "Couldn't save your profile." };
  }

  revalidatePath("/settings");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/feed");
  return { message: "Saved." };
}
