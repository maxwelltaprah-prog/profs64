import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { ProviderButtons } from "@/components/auth/provider-buttons";
import { PASSWORD_MIN } from "@/lib/security/limits";
import { enabledProviders } from "@/lib/security/oauth-providers";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted text-sm">
          You get 20 credits to start. Confirm your email address before using the assistant.
        </p>
      </div>
      <ProviderButtons
        providers={enabledProviders(process.env["OAUTH_PROVIDERS"])}
        next="/dashboard"
      />
      <AuthForm
        endpoint="/api/auth/signup"
        submitLabel="Create account"
        successTitle="Check your email"
        successMessage="We sent a confirmation link. Open it on this device to finish creating your account. If nothing arrives in a few minutes, check spam or try again."
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "new-password",
            minLength: PASSWORD_MIN,
            hint: "At least 12 characters. A short phrase of unrelated words works well.",
          },
        ]}
      />
      <p className="text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
      <p className="text-subtle text-center text-xs">
        By creating an account you agree to the{" "}
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
