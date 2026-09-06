"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, updatePassword, type AuthState } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  if (state.message) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg border border-glow/50 bg-glow/10 px-3 py-3 text-glow">
          {state.message}
        </p>
        <Link href="/login" className="btn btn-outline w-full py-3">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-flare">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full py-3">
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-lilac">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-cream hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className="field-label">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="field-label">
          Type it again
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-flare">
          {state.error}{" "}
          {state.error.includes("expired") && (
            <Link href="/forgot-password" className="font-semibold underline">
              Request a new one
            </Link>
          )}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full py-3">
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
