import { describe, expect, it } from "vitest";

import { plainSpeech, speechChunks } from "@/lib/workspace/speech-text";

describe("plainSpeech", () => {
  it("removes Markdown so it reads naturally", () => {
    const text = plainSpeech(
      "## Title\n\n- **Bold** item with `code` and a [link](https://x.test)\n\n```ts\nconst a = 1;\n```\n\nDone.",
    );
    expect(text).toBe("Title Bold item with code and a link Code omitted. Done.");
  });
});

describe("speechChunks", () => {
  it("returns nothing for empty text", () => {
    expect(speechChunks("")).toEqual([]);
    expect(speechChunks("```a```")).toEqual(["Code omitted."]);
  });
  it("keeps short text whole and splits long text at sentence ends under the limit", () => {
    expect(speechChunks("One. Two.")).toEqual(["One. Two."]);
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = speechChunks(long, 100);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.every((c) => c.endsWith("."))).toBe(true);
    expect(chunks.join(" ")).toBe(long);
  });
  it("cuts a single very long sentence at word boundaries", () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const chunks = speechChunks(words, 60);
    expect(chunks.every((c) => c.length <= 60)).toBe(true);
    expect(chunks.join(" ")).toBe(words);
  });
});
