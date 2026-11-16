// Shared Sentry settings. Error reporting is off unless a DSN is set, and what it sends is cut
// down first: no cookies, request bodies, headers, user data or breadcrumbs, because those can
// hold prompts, file contents or personal data (CLAUDE.md: never log them). What remains is the
// error type, a shortened message, the stack and the route. Pure, so it is unit tested.

import type { ErrorEvent } from "@sentry/nextjs";

const MESSAGE_LIMIT = 200;

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.breadcrumbs;
  delete event.contexts?.["device"];
  if (event.request) {
    const { url, method } = event.request;
    event.request = {
      ...(url ? { url: url.split("?")[0] ?? url } : {}),
      ...(method ? { method } : {}),
    };
  }
  if (event.message) event.message = event.message.slice(0, MESSAGE_LIMIT);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = exception.value.slice(0, MESSAGE_LIMIT);
  }
  delete event.extra;
  return event;
}

export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment: process.env["VERCEL_ENV"] ?? process.env.NODE_ENV,
    release: process.env["VERCEL_GIT_COMMIT_SHA"],
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  };
}

// The origin the browser sends events to, so the CSP can allow exactly that and nothing wider.
export function sentryConnectOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
