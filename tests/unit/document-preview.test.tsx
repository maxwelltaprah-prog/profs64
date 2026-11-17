// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentCard } from "@/components/chat/document-card";
import { SlideSvg } from "@/components/chat/slide-svg";
import { deckSpecSchema } from "@/lib/documents/spec";

const deck = deckSpecSchema.parse({
  title: "Q4 review",
  style: "academic",
  slides: [
    {
      title: "Sales grew every month",
      bullets: ["Oct 10", "Nov 20"],
      source: "Source: internal",
      visual: {
        type: "chart",
        kind: "bar",
        categories: ["Oct", "Nov"],
        series: [{ name: "s", values: [10, 20] }],
      },
    },
    { title: "Steps", visual: { type: "process", steps: [{ title: "Plan" }, { title: "Build" }] } },
    {
      title: "Picture",
      visual: { type: "image", imageId: "11111111-1111-4111-8111-111111111111" },
    },
  ],
});

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

describe("SlideSvg", () => {
  it("draws the cover and every slide kind without throwing", () => {
    for (let i = -1; i < deck.slides.length; i++) {
      const { container, unmount } = render(<SlideSvg deck={deck} index={i} images={{}} />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });
  it("shows the title and source, and no inline style attributes", () => {
    const { container } = render(<SlideSvg deck={deck} index={0} images={{}} />);
    expect(container.textContent).toContain("Sales grew every month");
    expect(container.textContent).toContain("Source: internal");
    expect(container.querySelector("[style]")).toBeNull();
  });
});

describe("DocumentCard preview", () => {
  const doc = { id: "d1", kind: "pptx" as const, title: "Q4 review" };
  it("opens a preview built from the stored outline and moves between slides", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ kind: "pptx", title: "Q4 review", deck, images: {} })),
    );
    render(<DocumentCard conversationId="c1" document={doc} />);
    await userEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(screen.getByText(/Slide 1 of 4/)).toBeDefined());
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Slide 2 of 4/)).toBeDefined();
  });
  it("says so when the preview cannot load, and keeps Download available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    render(<DocumentCard conversationId="c1" document={doc} />);
    await userEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getAllByText("Download").length).toBeGreaterThan(0);
  });
});

describe("SlideSvg colours", () => {
  it("uses valid SVG colours (with #), not bare hex", () => {
    const { container } = render(<SlideSvg deck={deck} index={0} images={{}} />);
    const fills = Array.from(container.querySelectorAll("[fill]")).map((e) =>
      e.getAttribute("fill"),
    );
    expect(fills.filter((f) => f && /^[0-9A-Fa-f]{6}$/.test(f))).toEqual([]);
    const strokes = Array.from(container.querySelectorAll("[stroke]")).map((e) =>
      e.getAttribute("stroke"),
    );
    expect(strokes.filter((f) => f && /^[0-9A-Fa-f]{6}$/.test(f))).toEqual([]);
  });
});
