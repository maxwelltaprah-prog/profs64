import { describe, expect, it } from "vitest";

import { greetingName, START_IDEAS, timeAgo } from "@/lib/workspace/home";

describe("greetingName", () => {
  it("uses the first word of the address, capitalised", () => {
    expect(greetingName("maxwell.taprah@example.com")).toBe("Maxwell");
    expect(greetingName("ADA_lovelace@example.com")).toBe("Ada");
    expect(greetingName("sam+test@example.com")).toBe("Sam");
  });
  it("falls back to no name for addresses that do not start with a word", () => {
    for (const email of [
      "",
      null,
      undefined,
      "1234@example.com",
      "x@example.com",
      "<b>@x.y",
      "é@x.y",
    ])
      expect(greetingName(email)).toBeNull();
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  it("reads naturally at each scale", () => {
    expect(timeAgo("2026-11-08T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-11-08T11:55:00Z", now)).toBe("5 minutes ago");
    expect(timeAgo("2026-11-08T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-11-07T10:00:00Z", now)).toBe("yesterday");
    expect(timeAgo("2026-10-18T12:00:00Z", now)).toBe("3 weeks ago");
  });
  it("is safe with bad or future dates", () => {
    expect(timeAgo("not a date", now)).toBe("just now");
    expect(timeAgo("2027-01-01T00:00:00Z", now)).toBe("just now");
  });
});

describe("start ideas", () => {
  it("have unique ids and prompts the chat would accept", () => {
    expect(new Set(START_IDEAS.map((idea) => idea.id)).size).toBe(START_IDEAS.length);
    for (const idea of START_IDEAS) expect(idea.prompt.length).toBeGreaterThan(30);
  });
});
