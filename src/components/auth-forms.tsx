"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";

export function LoginForm({
  next,
  linkError,
  oauthError,
}: {
  next?: string;
  linkError?: boolean;
  oauthError?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}

      {linkError && (
        <p role="alert" className="rounded-lg border border-glow/50 bg-glow/10 px-3 py-2 text-sm text-glow-ink">
          That sign-in link has expired or was already used. Sign in with your password instead.
        </p>
      )}

      {oauthError && (
        <p role="alert" className="rounded-lg border border-glow/50 bg-glow/10 px-3 py-2 text-sm text-glow-ink">
          Google sign-in didn’t finish. Try again, or use your email and password.
        </p>
      )}

      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <Link href="/forgot-password" className="mb-1.5 text-sm text-muted hover:text-fore hover:underline">
            Forgot it?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-flare">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full py-3">
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-fore hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signUp, {});

  if (state.message) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg border border-glow/50 bg-glow/10 px-3 py-3 text-glow-ink">
          {state.message}
        </p>
        <Link href="/login" className="btn btn-outline w-full py-3">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="first_name" className="field-label">
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            required
            maxLength={40}
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
            autoComplete="family-name"
            required
            maxLength={40}
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
            autoComplete="username"
            required
            pattern="[a-z0-9_]{3,24}"
            title="3–24 lowercase letters, numbers or underscores"
            className="field rounded-l-none"
          />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Password
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

      {state.error && (
        <p role="alert" className="text-sm text-flare">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full py-3">
        {pending ? "Creating your account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-fore hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
