import Link from "next/link";

/** Shown while the Supabase integration has not populated env vars yet. */
export function NotConnected() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-xl font-black tracking-tight">Headcount</p>
      <h1 className="mt-8 font-display text-2xl font-bold">Almost live</h1>
      <p className="mt-3 leading-relaxed text-muted-2">
        The app is deployed but isn’t connected to its database yet. Once the Supabase integration
        is attached to this Vercel project and it’s redeployed, sign-up and posting will work here.
      </p>
      <Link href="/" className="btn btn-outline mt-6">
        Back to the front page
      </Link>
    </div>
  );
}
