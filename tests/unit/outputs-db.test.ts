import { describe, expect, it } from "vitest";

import { listRatings, outputsFor } from "@/lib/db/outputs";

const PROJECT = "11111111-1111-4111-8111-111111111111";

// from("audit_log").select().eq().eq().order().limit() resolves to the rows.
const clientWith = (result: { data: unknown; error: unknown }) =>
  ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain["select"] = () => chain;
      chain["eq"] = () => chain;
      chain["order"] = () => chain;
      chain["limit"] = async () => result;
      return chain;
    },
  }) as never;

describe("listRatings", () => {
  it("uses the newest event for each message and lets none clear a rating", async () => {
    // Rows arrive newest first.
    const rows = [
      { metadata: { messageId: "a", rating: "none" } },
      { metadata: { messageId: "a", rating: "up" } },
      { metadata: { messageId: "b", rating: "down" } },
      { metadata: { messageId: "b", rating: "up" } },
      { metadata: { messageId: "c", rating: "sideways" } },
      { metadata: { rating: "up" } },
    ];
    const ratings = await listRatings(PROJECT, clientWith({ data: rows, error: null }));
    expect([...ratings]).toEqual([["b", "down"]]);
  });

  it("returns no ratings rather than failing the page when the read fails", async () => {
    const ratings = await listRatings(PROJECT, clientWith({ data: null, error: { code: "x" } }));
    expect(ratings.size).toBe(0);
  });

  it("refuses a project id that is not a UUID", async () => {
    await expect(listRatings("../x", clientWith({ data: [], error: null }))).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("outputsFor", () => {
  it("keeps assistant replies only, with their stored usage and rating", () => {
    const outputs = outputsFor(
      [
        { id: "u", role: "user", parts: [], createdAt: "" },
        {
          id: "a",
          role: "assistant",
          parts: [{ type: "data-usage", data: { credits: 1, inputTokens: 2, outputTokens: 3 } }],
          createdAt: "",
        },
      ],
      new Map([["a", "up"]]),
    );
    expect(outputs).toEqual({
      a: { usage: { credits: 1, inputTokens: 2, outputTokens: 3 }, rating: "up" },
    });
  });
});
