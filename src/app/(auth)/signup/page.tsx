import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Get on the list</h1>
      <p className="mt-1 mb-6 text-muted">Follow friends, post flyers, go out together.</p>
      <SignupForm />
    </>
  );
}
