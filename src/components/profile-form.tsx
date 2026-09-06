"use client";

import { useActionState, useRef, useState } from "react";
import { Avatar } from "./avatar";
import { updateProfile, type ProfileState } from "@/lib/actions/social";
import { prepareImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const prepared = await prepareImage(file);
      const path = `${profile.id}/avatar-${Date.now()}.${prepared.ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("event-images")
        .upload(path, prepared.blob, { contentType: prepared.type });
      if (error) throw error;
      setAvatarUrl(supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl);
    } catch (err) {
      console.error(err);
      setUploadError("That photo didn't upload. Try another one.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Avatar
          profile={{ username: profile.username, display_name: profile.display_name, avatar_url: avatarUrl || null }}
          size={64}
        />
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn btn-outline"
          >
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          {avatarUrl && (
            <button type="button" onClick={() => setAvatarUrl("")} className="btn btn-ghost ml-2">
              Remove
            </button>
          )}
          {uploadError && <p className="mt-2 text-sm text-flare">{uploadError}</p>}
        </div>
      </div>
      <input type="hidden" name="avatar_url" value={avatarUrl} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="first_name" className="field-label">
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            required
            maxLength={40}
            autoComplete="given-name"
            defaultValue={profile.first_name ?? profile.display_name.split(" ")[0] ?? ""}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="last_name" className="field-label">
            Last name
          </label>
          <input
            id="last_name"
            name="last_name"
            required
            maxLength={40}
            autoComplete="family-name"
            defaultValue={
              profile.last_name ?? profile.display_name.split(" ").slice(1).join(" ") ?? ""
            }
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="username" className="field-label">
          Username
        </label>
        <div className="flex items-center">
          <span className="rounded-l-lg border border-r-0 border-edge-2 bg-edge px-3 py-2.5 text-muted">
            @
          </span>
          <input
            id="username"
            name="username"
            required
            pattern="[a-z0-9_]{3,24}"
            title="3–24 lowercase letters, numbers or underscores"
            defaultValue={profile.username}
            className="field rounded-l-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="city" className="field-label">
          City
        </label>
        <input id="city" name="city" maxLength={80} defaultValue={profile.city ?? ""} className="field" />
      </div>

      <div>
        <label htmlFor="bio" className="field-label">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={300}
          defaultValue={profile.bio ?? ""}
          className="field resize-y"
          placeholder="Techno on Fridays, comedy on Sundays."
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className={`text-sm ${state.error ? "text-flare" : "text-glow-ink"}`} role="status">
          {state.error ?? state.message}
        </p>
        <button type="submit" disabled={pending || uploading} className="btn btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
