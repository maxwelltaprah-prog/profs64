"use client";

// Sends an error caught by an error boundary to Sentry, if it is configured.
export function reportClientError(error: Error & { digest?: string }): void {
  if (!process.env["NEXT_PUBLIC_SENTRY_DSN"]) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
}
