import type { UserIdentity } from "@supabase/supabase-js";
import { GoogleIcon } from "./google-sign-in";
import { linkGoogle, unlinkGoogle } from "@/lib/actions/oauth";

export type AccountNotice = { linked?: string; unlinked?: string; error?: string; reason?: string };

function noticeFor(n: AccountNotice): { text: string; tone: "ok" | "error" } | null {
  if (n.linked === "google") return { text: "Google is connected. You can sign in with it from now on.", tone: "ok" };
  if (n.unlinked === "google") return { text: "Google is disconnected.", tone: "ok" };
  if (n.error === "last_identity") {
    return {
      text: "Google is your only way to sign in. Set a password first (use “Forgot it?” on the sign-in page), then disconnect it.",
      tone: "error",
    };
  }
  if (n.error === "link") {
    if (/already|exists|linked/i.test(n.reason ?? "")) {
      return { text: "That Google account is already connected to a different Headcount account.", tone: "error" };
    }
    return { text: "Google didn’t connect. Try again.", tone: "error" };
  }
  if (n.error === "unlink") return { text: "Google didn’t disconnect. Try again.", tone: "error" };
  return null;
}

export function ConnectedAccounts({
  identities,
  notice,
}: {
  identities: UserIdentity[];
  notice: AccountNotice;
}) {
  const google = identities.find((i) => i.provider === "google");
  const email = identities.find((i) => i.provider === "email");
  const canUnlink = identities.length > 1;
  const message = noticeFor(notice);
  const googleEmail = (google?.identity_data?.email as string | undefined) ?? null;
  const accountEmail = (email?.identity_data?.email as string | undefined) ?? null;

  return (
    <section className="card mt-6 flex flex-col gap-4 p-4" aria-labelledby="connected-heading">
      <div>
        <h2 id="connected-heading" className="font-display text-lg font-bold">
          Connected accounts
        </h2>
        <p className="mt-1 text-sm text-muted">
          Sign in with any of these. Connecting Google lets you skip the password.
        </p>
      </div>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error"
              ? "text-sm text-flare"
              : "rounded-lg border border-glow/50 bg-glow/10 px-3 py-2 text-sm text-glow-ink"
          }
        >
          {message.text}
        </p>
      )}

      <ul className="divide-y divide-edge">
        <li className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium">Email and password</p>
            <p className="truncate text-sm text-muted">{accountEmail ?? "No password set"}</p>
          </div>
          <span className="shrink-0 text-sm text-muted">{email ? "Connected" : "Google only"}</span>
        </li>

        <li className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <GoogleIcon className="size-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">Google</p>
              <p className="truncate text-sm text-muted">{google ? (googleEmail ?? "Connected") : "Not connected"}</p>
            </div>
          </div>
          {google ? (
            <form action={unlinkGoogle}>
              <button
                type="submit"
                disabled={!canUnlink}
                title={canUnlink ? undefined : "Set a password before disconnecting Google"}
                className="btn btn-outline shrink-0 text-sm"
              >
                Disconnect
              </button>
            </form>
          ) : (
            <form action={linkGoogle}>
              <button type="submit" className="btn btn-outline shrink-0 text-sm">
                Connect
              </button>
            </form>
          )}
        </li>
      </ul>
    </section>
  );
}
