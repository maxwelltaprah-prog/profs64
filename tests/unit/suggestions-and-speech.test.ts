import { describe, expect, it } from "vitest";

import { readUsage, usagePart } from "@/lib/ai/messages";
import { appendDictation, speechErrorMessage, transcriptFrom } from "@/lib/workspace/speech";
import { suggestFollowUps } from "@/lib/workspace/suggestions";

describe("suggestFollowUps", () => {
  const bare = [{ path: "src/App.tsx", content: "export default function App() {}" }];

  it("offers three ideas for a bare project and rotates them by turn", () => {
    const first = suggestFollowUps(bare, 0);
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(suggestFollowUps(bare, 1)).not.toEqual(first);
    expect(suggestFollowUps(bare, 0)).toEqual(first);
  });

  it("skips ideas the project already covers", () => {
    const files = [
      { path: "src/components/Contact.tsx", content: "<form>" },
      { path: "src/components/Footer.tsx", content: "" },
      { path: "src/App.tsx", content: "dark mode toggle, pricing, frequently asked, sm:, md:" },
    ];
    const all = suggestFollowUps(files, 0, 20).join(" | ");
    expect(all).not.toMatch(/contact section/i);
    expect(all).not.toMatch(/footer/i);
    expect(all).not.toMatch(/dark mode/i);
    expect(all).not.toMatch(/pricing/i);
  });

  it("never fails on an empty project or a negative turn", () => {
    expect(suggestFollowUps([], -5)).toHaveLength(3);
    expect(suggestFollowUps([], 0, 0)).toEqual([]);
  });
});

describe("speech helpers", () => {
  it("joins finished and in-progress pieces", () => {
    const items: Array<{ isFinal: boolean; length: number; 0: { transcript: string } }> = [
      { isFinal: true, length: 1, 0: { transcript: "build a landing page " } },
      { isFinal: false, length: 1, 0: { transcript: "for a coffee shop" } },
    ];
    const event = {
      resultIndex: 0,
      results: { length: items.length, item: (index: number) => items[index] },
    };
    expect(transcriptFrom(event)).toBe("build a landing page for a coffee shop");
  });

  it("appends dictation with one space and keeps what was typed", () => {
    expect(appendDictation("", "hello")).toBe("hello");
    expect(appendDictation("make it", "blue")).toBe("make it blue");
    expect(appendDictation("make it ", "blue")).toBe("make it blue");
    expect(appendDictation("keep", "")).toBe("keep");
  });

  it("explains blocked microphones and stays quiet for silence", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/blocked/i);
    expect(speechErrorMessage("no-speech")).toBeNull();
    expect(speechErrorMessage("weird")).toMatch(/try again/i);
  });
});

describe("stored usage", () => {
  it("round-trips through the stored part and ignores malformed ones", () => {
    const part = usagePart({ credits: 0.81, inputTokens: 12735, outputTokens: 1441 });
    expect(readUsage([{ type: "text", text: "hi" }, part])).toEqual({
      credits: 0.81,
      inputTokens: 12735,
      outputTokens: 1441,
    });
    expect(
      readUsage([{ type: "data-usage", data: { credits: -1, inputTokens: 1, outputTokens: 1 } }]),
    ).toBeNull();
    expect(readUsage([{ type: "data-usage", data: "x" }, null, 5])).toBeNull();
    expect(readUsage([])).toBeNull();
  });
});
