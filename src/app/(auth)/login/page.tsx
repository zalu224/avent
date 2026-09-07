import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { GoogleSignIn, OrDivider } from "@/components/google-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 mb-6 text-muted">See what your people are going to.</p>
      <GoogleSignIn next={next} />
      <OrDivider />
      <LoginForm next={next} linkError={error === "link"} oauthError={error === "oauth"} />
    </>
  );
}
