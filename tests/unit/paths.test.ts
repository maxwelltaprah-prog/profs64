import { describe, expect, it } from "vitest";

import {
  ALLOWED_EXTENSIONS,
  byteLength,
  isValidProjectPath,
  MAX_FILE_BYTES,
  MAX_FILES_PER_PROJECT,
  validateProjectPath,
} from "@/lib/security/paths";

import { INVALID_PATHS, VALID_PATHS } from "../fixtures/path-vectors";

describe("validateProjectPath", () => {
  it.each(VALID_PATHS)("accepts %s unchanged", (path) => {
    expect(validateProjectPath(path)).toEqual({ ok: true, path });
  });

  it.each(INVALID_PATHS)("rejects %s", (_label, path) => {
    expect(validateProjectPath(path).ok).toBe(false);
    expect(isValidProjectPath(path)).toBe(false);
  });

  it.each([undefined, null, 42, {}, [], ["a.ts"], true])("rejects non-string %j", (value) => {
    expect(validateProjectPath(value)).toEqual({ ok: false, problem: "not_a_string" });
  });

  it("reports a useful reason for the common cases", () => {
    expect(validateProjectPath("")).toEqual({ ok: false, problem: "empty" });
    expect(validateProjectPath("/a.ts")).toEqual({ ok: false, problem: "absolute" });
    expect(validateProjectPath("../a.ts")).toEqual({ ok: false, problem: "invalid_segment" });
    expect(validateProjectPath("a//b.ts")).toEqual({ ok: false, problem: "empty_segment" });
    expect(validateProjectPath("a.exe")).toEqual({ ok: false, problem: "extension_not_allowed" });
    expect(validateProjectPath("a b.ts")).toEqual({ ok: false, problem: "invalid_characters" });
  });

  it("allows exactly the documented extensions, case-insensitively", () => {
    expect([...ALLOWED_EXTENSIONS].sort()).toEqual([
      "css",
      "html",
      "js",
      "json",
      "jsx",
      "md",
      "svg",
      "ts",
      "tsx",
      "txt",
    ]);
    for (const extension of ALLOWED_EXTENSIONS) {
      expect(isValidProjectPath(`file.${extension}`)).toBe(true);
      expect(isValidProjectPath(`file.${extension.toUpperCase()}`)).toBe(true);
    }
  });

  it("never returns a different string than it was given", () => {
    for (const path of VALID_PATHS) {
      const result = validateProjectPath(path);
      expect(result.ok && result.path === path).toBe(true);
    }
  });

  it("holds against generated hostile input: nothing accepted contains a traversal or separator trick", () => {
    const alphabet = ["a", ".", "/", "\\", "%", "2", "e", "\u0000", "\uFF0E", " ", "~", "ts"];
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    let accepted = 0;
    for (let i = 0; i < 20_000; i++) {
      let candidate = "";
      const length = 1 + (next() % 14);
      for (let j = 0; j < length; j++) candidate += alphabet[next() % alphabet.length];
      if (next() % 2 === 0) candidate += ".ts";
      if (!isValidProjectPath(candidate)) continue;
      accepted += 1;
      expect(candidate.split("/")).not.toContain("..");
      expect(candidate.split("/")).not.toContain(".");
      expect(candidate).not.toMatch(/[\\%\u0000\s\uFF0E]/);
      expect(candidate.startsWith("/")).toBe(false);
    }
    expect(accepted).toBeGreaterThan(0);
  });
});

describe("limits", () => {
  it("matches the documented caps", () => {
    expect(MAX_FILE_BYTES).toBe(204_800);
    expect(MAX_FILES_PER_PROJECT).toBe(100);
  });

  it("measures bytes, not characters", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("\u00E9")).toBe(2);
    expect(byteLength("\u{1F600}")).toBe(4);
  });
});
