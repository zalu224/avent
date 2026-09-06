import { Nav } from "@/components/nav";
import { NotConnected } from "@/components/not-connected";
import { getProfileById } from "@/lib/queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, requireUserId } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <NotConnected />;

  const userId = await requireUserId();
  const supabase = await createClient();
  const profile = await getProfileById(supabase, userId);

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-xl font-bold">Setting up your profile</h1>
        <p className="mt-2 text-lilac">
          Your account exists but the profile hasn’t been created yet. Refresh in a moment, or
          sign out and back in.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:pl-60">
      <Nav profile={profile} />
      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:px-8 md:pb-16 md:pt-10">
        {children}
      </main>
    </div>
  );
}
