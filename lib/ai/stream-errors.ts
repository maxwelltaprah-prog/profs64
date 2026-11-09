import { STREAM_ERRORS } from "@/lib/workspace/stream-errors";

// The HTTP status a provider error carried, looking through the wrappers the AI SDK adds (retry
// errors keep the last attempt's error; others keep a cause). Only the number is ever used.
export function providerStatus(error: unknown, depth = 0): number | undefined {
  if (!error || typeof error !== "object" || depth > 4) return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record["statusCode"] === "number") return record["statusCode"];
  return (
    providerStatus(record["lastError"], depth + 1) ?? providerStatus(record["cause"], depth + 1)
  );
}

// 402: the provider account cannot pay for the request (out of credits or over its limit). That is
// the operator's problem, so the person is told the assistant is unavailable, not to retry now.
// 429: rate limited upstream. Everything else gets the general message.
export function streamErrorText(error: unknown): string {
  const status = providerStatus(error);
  if (status === 402) return STREAM_ERRORS.unavailable;
  if (status === 429) return STREAM_ERRORS.busy;
  return STREAM_ERRORS.generic;
}
