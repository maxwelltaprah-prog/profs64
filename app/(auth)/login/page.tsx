import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { safeRedirectPath } from "@/lib/security/redirect";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES = new Map<string, string>([
  ["link_invalid", "That link has expired or was already used. Request a new one and try again."],
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
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted text-[13px]">
          Use the email address and password for your account.
        </p>
      </div>
      {notice ? (
        <p
          role="alert"
          className="border-danger bg-danger-subtle rounded-md border px-3 py-2 text-[13px]"
        >
          {notice}
        </p>
      ) : null}
      <AuthForm
        endpoint="/api/auth/login"
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
      <div className="text-muted flex flex-col gap-1.5 text-[13px]">
        <p>
          New here?{" "}
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
