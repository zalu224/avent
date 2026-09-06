import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
      <p className="mt-1 mb-6 text-lilac">You’ll be signed in as soon as it’s saved.</p>
      <ResetPasswordForm />
    </>
  );
}
