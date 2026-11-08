import { describe, expect, it } from "vitest";

import { validateProjectPath } from "@/lib/security/paths";
import {
  ATTACHMENT_MARKER,
  attachmentPath,
  checkAttachment,
  looksBinary,
  MAX_ATTACHMENT_BYTES,
  splitAttachmentMarker,
  withAttachmentMarker,
} from "@/lib/workspace/attachments";

describe("attachmentPath", () => {
  it("keeps a clean name and its type", () => {
    expect(attachmentPath("brief.md")).toBe("attachments/brief.md");
    expect(attachmentPath("menu-2026_v2.JSON")).toBe("attachments/menu-2026_v2.JSON");
  });

  it("turns unsafe characters into dashes and keeps unusual text types as text", () => {
    expect(attachmentPath("Q3 Report (final).CSV")).toBe("attachments/Q3-Report-final-.CSV.txt");
    expect(attachmentPath("notes")).toBe("attachments/notes.txt");
    expect(attachmentPath("data.yaml")).toBe("attachments/data.yaml.txt");
  });

  it("never produces a traversal, hidden file or foreign directory", () => {
    for (const name of [
      "../../etc/passwd",
      "..\\..\\windows\\system32",
      ".env",
      "/etc/shadow",
      "a/b/c.md",
      "%2e%2e%2fsecret",
      "ｆｕｌｌｗｉｄｔｈ.md",
      "name\u0000.md",
    ]) {
      const path = attachmentPath(name);
      expect(path === null || validateProjectPath(path).ok, name).toBe(true);
      if (path) {
        expect(path.startsWith("attachments/")).toBe(true);
        expect(path.split("/")).toHaveLength(2);
        expect(path).not.toMatch(/\.\./);
        expect(path.split("/")[1]?.startsWith(".")).toBe(false);
      }
    }
    expect(attachmentPath("....")).toBeNull();
    expect(attachmentPath("")).toBeNull();
  });

  it("shortens very long names but keeps the type", () => {
    const path = attachmentPath(`${"a".repeat(300)}.md`);
    expect(path?.endsWith(".md")).toBe(true);
    expect(path?.length).toBeLessThan(120);
  });
});

describe("checkAttachment", () => {
  it("accepts text and rejects binary, empty and oversized files", () => {
    expect(checkAttachment("a.md", "# hello")).toEqual({ ok: true, path: "attachments/a.md" });
    expect(checkAttachment("a.md", "   ")).toEqual({ ok: false, problem: "empty" });
    expect(checkAttachment("a.md", "PK\u0003\u0004\u0000zip")).toEqual({
      ok: false,
      problem: "not_text",
    });
    expect(checkAttachment("a.md", "bad � bytes")).toEqual({ ok: false, problem: "not_text" });
    expect(checkAttachment("a.md", "x".repeat(MAX_ATTACHMENT_BYTES + 1))).toEqual({
      ok: false,
      problem: "too_large",
    });
    expect(checkAttachment("....", "text")).toEqual({ ok: false, problem: "bad_name" });
  });

  it("counts bytes, not characters", () => {
    const wide = "é".repeat(MAX_ATTACHMENT_BYTES / 2 + 1);
    expect(checkAttachment("a.txt", wide)).toEqual({ ok: false, problem: "too_large" });
  });

  it("detects binary content", () => {
    expect(looksBinary("plain")).toBe(false);
    expect(looksBinary("a\u0000b")).toBe(true);
  });
});

describe("the attachment marker on a message", () => {
  it("round-trips paths and leaves ordinary text alone", () => {
    const text = withAttachmentMarker("Use my menu", ["attachments/a.md", "attachments/b.txt"]);
    expect(text).toBe(`Use my menu\n\n${ATTACHMENT_MARKER}attachments/a.md, attachments/b.txt`);
    expect(splitAttachmentMarker(text)).toEqual({
      text: "Use my menu",
      paths: ["attachments/a.md", "attachments/b.txt"],
    });
    expect(splitAttachmentMarker("no marker here")).toEqual({ text: "no marker here", paths: [] });
    expect(withAttachmentMarker("hi", [])).toBe("hi");
  });

  it("ignores a marker that points outside attachments/ or lists too many files", () => {
    const outside = "hi\n\nAttached: src/App.tsx";
    expect(splitAttachmentMarker(outside)).toEqual({ text: outside, paths: [] });
    const many = `hi\n\nAttached: ${["a", "b", "c", "d"].map((n) => `attachments/${n}.md`).join(", ")}`;
    expect(splitAttachmentMarker(many).paths).toEqual([]);
  });
});
