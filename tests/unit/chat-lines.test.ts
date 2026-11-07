import { describe, expect, it } from "vitest";

import { changedFiles, describeToolPart, friendlyChatError } from "@/lib/workspace/chat-lines";

describe("describeToolPart", () => {
  it("describes finished file changes in plain words", () => {
    expect(
      describeToolPart({
        type: "tool-write_file",
        state: "output-available",
        input: { path: "src/components/Hero.tsx" },
        output: { ok: true, path: "src/components/Hero.tsx", action: "created" },
      }),
    ).toEqual({ text: "Created src/components/Hero.tsx", state: "done" });
    expect(
      describeToolPart({
        type: "tool-write_file",
        state: "output-available",
        output: { ok: true, path: "a.ts", action: "updated" },
      })?.text,
    ).toBe("Updated a.ts");
    expect(
      describeToolPart({
        type: "tool-edit_file",
        state: "output-available",
        output: { ok: true, path: "a.ts", action: "edited" },
      })?.text,
    ).toBe("Edited a.ts");
    expect(
      describeToolPart({
        type: "tool-delete_file",
        state: "output-available",
        output: { ok: true, path: "a.ts", action: "deleted" },
      })?.text,
    ).toBe("Deleted a.ts");
    expect(
      describeToolPart({
        type: "tool-read_file",
        state: "output-available",
        output: { ok: true, path: "a.ts", content: "x" },
      })?.text,
    ).toBe("Read a.ts");
  });

  it("shows progress while a call is running", () => {
    expect(
      describeToolPart({
        type: "tool-write_file",
        state: "input-available",
        input: { path: "a.ts" },
      }),
    ).toEqual({ text: "Writing a.ts", state: "working" });
    expect(describeToolPart({ type: "tool-write_file", state: "input-streaming" })).toEqual({
      text: "Writing",
      state: "working",
    });
  });

  it("shows a failure with the server's fixed reason, never raw output", () => {
    const line = describeToolPart({
      type: "tool-write_file",
      state: "output-available",
      input: { path: "../x.ts" },
      output: { ok: false, error: 'Paths cannot contain "." or ".." segments.' },
    });
    expect(line?.state).toBe("failed");
    expect(line?.text).toContain("../x.ts");
    expect(line?.text).toContain("Paths cannot");
  });

  it("ignores parts that are not file tools", () => {
    expect(describeToolPart({ type: "text" })).toBeNull();
    expect(describeToolPart({ type: "tool-unknown_tool", state: "output-available" })).toBeNull();
    expect(describeToolPart({ type: "tool-constructor", state: "output-available" })).toBeNull();
    expect(describeToolPart({ type: "tool-__proto__", state: "output-available" })).toBeNull();
  });

  it("tolerates garbage in input and output", () => {
    expect(
      describeToolPart({
        type: "tool-write_file",
        state: "output-available",
        input: "str",
        output: 5,
      })?.state,
    ).toBe("done");
  });
});

describe("changedFiles", () => {
  it("is true only for successful writes, edits and deletes", () => {
    expect(
      changedFiles({ type: "tool-write_file", state: "output-available", output: { ok: true } }),
    ).toBe(true);
    expect(
      changedFiles({ type: "tool-edit_file", state: "output-available", output: { ok: true } }),
    ).toBe(true);
    expect(
      changedFiles({ type: "tool-delete_file", state: "output-available", output: { ok: true } }),
    ).toBe(true);
    expect(
      changedFiles({ type: "tool-write_file", state: "output-available", output: { ok: false } }),
    ).toBe(false);
    expect(changedFiles({ type: "tool-write_file", state: "input-available" })).toBe(false);
    expect(
      changedFiles({ type: "tool-read_file", state: "output-available", output: { ok: true } }),
    ).toBe(false);
  });
});

describe("friendlyChatError", () => {
  it("uses the server's message from a JSON error body", () => {
    expect(
      friendlyChatError(
        new Error(
          JSON.stringify({
            error: { code: "insufficient_credits", message: "You are out of credits." },
          }),
        ),
      ),
    ).toBe("You are out of credits.");
  });
  it("falls back to a generic message for anything else", () => {
    expect(friendlyChatError(new Error("Failed to fetch"))).toContain("could not be sent");
    expect(friendlyChatError("weird")).toContain("could not be sent");
    expect(friendlyChatError(new Error("{broken"))).toContain("could not be sent");
  });
});
