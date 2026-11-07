import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getOptionalUser } from "@/lib/db/auth";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The emailed link signs the person in with a short-lived session; without one there is
  // nothing to reset, so send them to request a fresh link.
  if (!(await getOptionalUser())) redirect("/forgot-password?error=expired");

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-muted text-[13px]">You will stay signed in on this device.</p>
      </div>
      <AuthForm
        endpoint="/api/auth/reset-password"
        submitLabel="Update password"
        redirectTo="/dashboard"
        fields={[
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
            hint: "At least 12 characters.",
          },
        ]}
      />
    </>
  );
}
