import { describe, expect, it } from "vitest";

import { FREE_COOLDOWN_MS, FREE_WINDOW_MS, freeWindow } from "@/lib/agent/free-window";
import { AGENT_PROMPT } from "@/lib/agent/prompt";
import { compactAgentParts, createAgentTools } from "@/lib/agent/tools";
import { FREE_MODELS, priceFor } from "@/lib/ai/models";

const now = new Date("2026-11-09T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600 * 1000);

describe("free window", () => {
  it("is available with no history, active for 24 hours, then cools down for 24 more", () => {
    expect(freeWindow(null, now)).toEqual({ state: "available" });
    expect(freeWindow(hoursAgo(1), now)).toEqual({
      state: "active",
      until: new Date(hoursAgo(1).getTime() + FREE_WINDOW_MS),
    });
    expect(freeWindow(hoursAgo(30), now)).toEqual({
      state: "cooling-down",
      availableAt: new Date(hoursAgo(30).getTime() + FREE_WINDOW_MS + FREE_COOLDOWN_MS),
    });
    expect(freeWindow(hoursAgo(48.1), now)).toEqual({ state: "available" });
    expect(freeWindow(new Date("garbage"), now)).toEqual({ state: "available" });
  });
});

describe("free models", () => {
  it("are free ids with two choices, never priced as paid models", () => {
    expect(FREE_MODELS).toHaveLength(2);
    for (const model of FREE_MODELS) {
      expect(model.id.endsWith(":free")).toBe(true);
      expect(model.inputUsdPerMillion + model.outputUsdPerMillion).toBe(0);
    }
    // A free id is not in the billing table, so it could only ever be billed at the default price
    // if a paid path used it by mistake; the agent route never bills in free mode.
    expect(priceFor(FREE_MODELS[0]?.id ?? "").id).not.toContain(":free");
  });
});

describe("document tool", () => {
  const deck = { title: "Plan", slides: [{ title: "One", bullets: ["a"] }] };

  it("saves a validated outline and reports where it is", async () => {
    const saved: unknown[] = [];
    const tools = createAgentTools({
      save: async (input) => {
        saved.push(input);
        return { id: "doc-1" };
      },
    });
    const run = tools.create_document.execute as (
      input: unknown,
      options: unknown,
    ) => Promise<unknown>;
    expect(await run({ kind: "pptx", deck }, {})).toEqual({
      ok: true,
      id: "doc-1",
      kind: "pptx",
      title: "Plan",
    });
    expect(saved).toEqual([{ kind: "pptx", title: "Plan", spec: deck }]);
  });

  it("refuses oversized outlines and reports storage failures without detail", async () => {
    const tools = createAgentTools({
      save: async () => {
        throw new Error("db password in message");
      },
    });
    const run = tools.create_document.execute as (
      input: unknown,
      options: unknown,
    ) => Promise<unknown>;
    expect(await run({ kind: "pptx", deck }, {})).toEqual({
      ok: false,
      error: "The document could not be saved. Try again.",
    });
    const huge = {
      title: "Big",
      blocks: Array.from({ length: 200 }, () => ({ type: "paragraph", text: "x".repeat(1100) })),
    };
    expect(await run({ kind: "docx", document: huge }, {})).toEqual({
      ok: false,
      error: "The document is too long. Shorten it and try again.",
    });
  });

  it("keeps only the kind of a document call when storing a reply", () => {
    const parts = compactAgentParts([
      { type: "text", text: "Here it is" },
      {
        type: "tool-create_document",
        state: "output-available",
        input: { kind: "docx", document: { title: "x", blocks: [] } },
        output: { ok: true },
      },
    ]);
    expect(parts[1]).toMatchObject({ input: { kind: "docx" }, output: { ok: true } });
    expect(parts[0]).toEqual({ type: "text", text: "Here it is" });
  });
});

describe("agent instructions", () => {
  it("cover documents, the no-internet limit and the untrusted-data rule", () => {
    for (const phrase of [
      "create_document",
      "pptx",
      "docx",
      "pdf",
      "no internet access",
      "untrusted data",
    ])
      expect(AGENT_PROMPT).toContain(phrase);
  });
});
