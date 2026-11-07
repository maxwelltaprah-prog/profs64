import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const expired = params["error"] === "expired";

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-muted text-[13px]">
          Enter your email address and we will send you a reset link.
        </p>
      </div>
      {expired ? (
        <p
          role="alert"
          className="border-danger bg-danger-subtle rounded-md border px-3 py-2 text-[13px]"
        >
          That reset link has expired or was already used. Request a new one below.
        </p>
      ) : null}
      <AuthForm
        endpoint="/api/auth/forgot-password"
        submitLabel="Send reset link"
        successTitle="Check your email"
        successMessage="If an account exists for that address, a reset link is on its way. The link works once and expires after a short time."
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      />
      <p className="text-muted text-[13px]">
        <Link href="/login" className="text-accent underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
