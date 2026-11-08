import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { ProviderButtons } from "@/components/auth/provider-buttons";
import { enabledProviders } from "@/lib/security/oauth-providers";
import { safeRedirectPath } from "@/lib/security/redirect";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES = new Map<string, string>([
  ["link_invalid", "That link has expired or was already used. Request a new one and try again."],
  [
    "provider_unavailable",
    "That sign-in option is not available right now. Use your email and password.",
  ],
  ["too_many_attempts", "Too many attempts. Wait a few minutes and try again."],
]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params["next"] === "string" ? params["next"] : null);
  const errorKey = typeof params["error"] === "string" ? params["error"] : "";
  const notice = NOTICES.get(errorKey);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="text-muted text-sm">Use the email address and password for your account.</p>
      </div>
      {notice ? (
        <p
          role="alert"
          className="border-danger bg-danger-subtle rounded-md border px-3 py-2 text-[13px]"
        >
          {notice}
        </p>
      ) : null}
      <ProviderButtons providers={enabledProviders(process.env["OAUTH_PROVIDERS"])} next={next} />
      <AuthForm
        endpoint="/api/auth/login"
        rememberMethod
        submitLabel="Sign in"
        redirectTo={next}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
      />
      <div className="text-muted flex flex-col gap-1.5 text-center text-sm">
        <p>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent underline underline-offset-2">
            Create an account
          </Link>
        </p>
        <p>
          <Link href="/forgot-password" className="text-accent underline underline-offset-2">
            Forgot your password?
          </Link>
        </p>
      </div>
    </>
  );
}
