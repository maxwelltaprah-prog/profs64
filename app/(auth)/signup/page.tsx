import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { ProviderButtons } from "@/components/auth/provider-buttons";
import { liveProviders } from "@/lib/db/auth-providers";
import { PASSWORD_MIN } from "@/lib/security/limits";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  const providers = await liveProviders();
  return (
    <>
      <div className="rise flex flex-col gap-1.5 text-center">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
          Create your account
        </h1>
        <p className="text-muted text-sm">20 free credits to start. No card needed.</p>
      </div>
      <div className="rise rise-1 flex flex-col gap-6">
        <ProviderButtons providers={providers} next="/dashboard" verb="Sign up with" />
        <AuthForm
          endpoint="/api/auth/signup"
          submitLabel="Create account"
          pendingLabel="Creating account…"
          successTitle="Check your email"
          successMessage="We sent a confirmation link. Open it on this device to finish creating your account. If nothing arrives in a few minutes, check spam or try again."
          fields={[
            {
              name: "email",
              label: "Email",
              type: "email",
              autoComplete: "email",
              placeholder: "Enter your email address",
            },
            {
              name: "password",
              label: "Password",
              type: "password",
              autoComplete: "new-password",
              placeholder: "Create a password",
              minLength: PASSWORD_MIN,
              hint: "At least 12 characters. A short phrase of unrelated words works well.",
            },
          ]}
        />
      </div>
      <p className="rise rise-2 text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-text font-medium underline underline-offset-4">
          Log in
        </Link>
      </p>
      <p className="rise rise-3 text-subtle text-center text-xs">
        By signing up you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2">
          terms
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy notice
        </Link>
        .
      </p>
    </>
  );
}
