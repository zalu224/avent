import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-1 mb-6 text-muted">We’ll email you a link to choose a new one.</p>
      <ForgotPasswordForm />
    </>
  );
}
