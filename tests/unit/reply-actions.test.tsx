// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReadAloudButton } from "@/components/chat/reply-actions";
import { OutputBar } from "@/components/workspace/output-bar";

const speak = vi.fn();
const cancel = vi.fn();

beforeEach(() => {
  speak.mockReset();
  cancel.mockReset();
  vi.stubGlobal("speechSynthesis", { speak, cancel });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      lang = "";
      constructor(public text: string) {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ReadAloudButton", () => {
  it("reads the plain text, then stops when pressed again", async () => {
    render(<ReadAloudButton text={"**Hello** there. Second sentence."} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Read reply aloud" }));
    expect(speak).toHaveBeenCalledTimes(1);
    expect((speak.mock.calls[0]?.[0] as { text: string }).text).toBe(
      "Hello there. Second sentence.",
    );
    await user.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Read reply aloud" })).toBeDefined();
  });

  it("is not shown when the browser cannot speak", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    delete (window as unknown as Record<string, unknown>)["speechSynthesis"];
    render(<ReadAloudButton text="Hello" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("OutputBar actions", () => {
  it("offers copy, read aloud, like, dislike and share, and regenerate only when given", async () => {
    const onRegenerate = vi.fn();
    const { rerender } = render(<OutputBar text="Hi" info={undefined} onRate={vi.fn()} />);
    const names = () => screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names()).toEqual([
      "Copy reply",
      "Read reply aloud",
      "Good reply",
      "Bad reply",
      "Share reply",
    ]);
    rerender(<OutputBar text="Hi" info={undefined} onRate={vi.fn()} onRegenerate={onRegenerate} />);
    expect(names()).toEqual([
      "Copy reply",
      "Read reply aloud",
      "Good reply",
      "Bad reply",
      "Regenerate reply",
      "Share reply",
    ]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Regenerate reply" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});
