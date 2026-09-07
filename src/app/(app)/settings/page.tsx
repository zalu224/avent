import type { Metadata } from "next";
import { ConnectedAccounts, type AccountNotice } from "@/components/connected-accounts";
import { PageHeading } from "@/components/page-heading";
import { ProfileForm } from "@/components/profile-form";
import { signOut } from "@/lib/actions/auth";
import { getProfileById } from "@/lib/queries";
import { createClient, requireUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<AccountNotice>;
}) {
  const userId = await requireUserId();
  const notice = await searchParams;
  const supabase = await createClient();
  const [profile, { data: identityData }] = await Promise.all([
    getProfileById(supabase, userId),
    supabase.auth.getUserIdentities(),
  ]);
  if (!profile) return null;

  return (
    <>
      <PageHeading title="Settings" sub="How you show up to your friends" />
      <ProfileForm profile={profile} />
      <ConnectedAccounts identities={identityData?.identities ?? []} notice={notice} />

      <form action={signOut} className="mt-8 flex justify-end">
        <button type="submit" className="btn btn-outline">
          Sign out
        </button>
      </form>
    </>
  );
}
