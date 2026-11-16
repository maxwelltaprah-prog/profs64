import type { Instrumentation } from "next";

// Error reporting for the server. Nothing is loaded and nothing is sent unless SENTRY_DSN is set.
export async function register() {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn || process.env["NEXT_RUNTIME"] !== "nodejs") return;
  const [Sentry, { sentryOptions }] = await Promise.all([
    import("@sentry/nextjs"),
    import("./lib/monitoring/sentry-options"),
  ]);
  Sentry.init(sentryOptions(dsn));
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env["SENTRY_DSN"]) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
