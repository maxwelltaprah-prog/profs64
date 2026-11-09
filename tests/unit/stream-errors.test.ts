import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";

import { providerStatus, streamErrorText } from "@/lib/ai/stream-errors";
import { friendlyChatError } from "@/lib/workspace/chat-lines";
import { STREAM_ERRORS } from "@/lib/workspace/stream-errors";

const apiError = (statusCode: number) =>
  new APICallError({
    message: "This request requires more credits. Account acct_123, prompt: secret plan",
    url: "https://openrouter.ai/api/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
  });

describe("provider stream errors", () => {
  it("reads the status through the SDK's wrappers", () => {
    expect(providerStatus(apiError(402))).toBe(402);
    const retry = new RetryError({
      message: "failed after retries",
      reason: "maxRetriesExceeded",
      errors: [apiError(500), apiError(429)],
    });
    expect(providerStatus(retry)).toBe(429);
    expect(providerStatus(new Error("x", { cause: apiError(402) }))).toBe(402);
    expect(providerStatus(new Error("plain"))).toBeUndefined();
    expect(providerStatus(null)).toBeUndefined();
  });

  it("maps to fixed texts only, never the provider's own message", () => {
    expect(streamErrorText(apiError(402))).toBe(STREAM_ERRORS.unavailable);
    expect(streamErrorText(apiError(429))).toBe(STREAM_ERRORS.busy);
    expect(streamErrorText(apiError(500))).toBe(STREAM_ERRORS.generic);
    expect(streamErrorText(new Error("boom"))).toBe(STREAM_ERRORS.generic);
    for (const text of Object.values(STREAM_ERRORS)) {
      expect(text).not.toMatch(/acct_|secret|openrouter/i);
    }
  });

  it("shows the server's fixed stream errors as they are, not as a connection problem", () => {
    for (const text of Object.values(STREAM_ERRORS)) {
      expect(friendlyChatError(new Error(text))).toBe(text);
    }
    expect(friendlyChatError(new Error("Failed to fetch"))).toContain("could not be sent");
    expect(friendlyChatError(new Error("Some provider said: acct_123"))).toContain(
      "could not be sent",
    );
  });
});
