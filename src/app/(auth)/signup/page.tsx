import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";
import { GoogleSignIn, OrDivider } from "@/components/google-sign-in";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Get on the list</h1>
      <p className="mt-1 mb-6 text-muted">Follow friends, post events, go out together.</p>
      <GoogleSignIn label="Sign up with Google" />
      <OrDivider />
      <SignupForm />
    </>
  );
}
