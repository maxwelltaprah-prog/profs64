// Error reporting in the browser. The SDK is fetched only when a DSN is configured.
const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("./lib/monitoring/sentry-options")]).then(
    ([Sentry, { sentryOptions }]) => Sentry.init(sentryOptions(dsn)),
  );
}
