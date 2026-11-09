import { describe, expect, it } from "vitest";

import { fileKind, languageFor, tokenClass } from "@/lib/workspace/code-language";
import { crc32, createZip, safeEntryName, zipFolderName } from "@/lib/workspace/zip";

describe("code language helpers", () => {
  it("maps file extensions to highlighter languages", () => {
    expect(languageFor("src/App.tsx")).toBe("tsx");
    expect(languageFor("src/lib/utils.ts")).toBe("typescript");
    expect(languageFor("package.json")).toBe("json");
    expect(languageFor("index.html")).toBe("markup");
    expect(languageFor("README.MD")).toBe("markdown");
    expect(languageFor("Makefile")).toBe("plain");
    expect(languageFor(".env")).toBe("plain");
  });

  it("groups files for icons", () => {
    expect(fileKind("src/App.tsx")).toBe("react");
    expect(fileKind("vite.config.ts")).toBe("script");
    expect(fileKind("src/index.css")).toBe("style");
    expect(fileKind("public/logo.svg")).toBe("image");
    expect(fileKind("notes.txt")).toBe("doc");
    expect(fileKind("LICENSE")).toBe("other");
  });

  it("picks the most specific known token type, and nothing for unknown ones", () => {
    expect(tokenClass(["keyword"])).toBe("tok-kw");
    expect(tokenClass(["tag", "punctuation"])).toBe("tok-punct");
    expect(tokenClass(["template-string", "string"])).toBe("tok-str");
    expect(tokenClass(["maybe-class-name"])).toBe("tok-type");
    expect(tokenClass(["plain"])).toBeUndefined();
    expect(tokenClass([])).toBeUndefined();
  });
});

// Reads the zip back with no library: walks the central directory and each local header.
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: Array<{ name: string; content: string; crcOk: boolean }> = [];
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const nameLength = view.getUint16(at + 28, true);
    const size = view.getUint32(at + 24, true);
    const crc = view.getUint32(at + 16, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const dataStart = local + 30 + view.getUint16(local + 26, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    entries.push({ name, content: decoder.decode(data), crcOk: crc32(data) === crc });
    at += 46 + nameLength;
  }
  return entries;
}

describe("zip writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("writes every file under one folder with correct contents and checksums", () => {
    const zip = createZip("my-app", [
      { path: "src/App.tsx", content: "export default function App() {}\n" },
      { path: "src/naïve ✓.md", content: "# héllo" },
    ]);
    expect(readZip(zip)).toEqual([
      { name: "my-app/src/App.tsx", content: "export default function App() {}\n", crcOk: true },
      { name: "my-app/src/naïve ✓.md", content: "# héllo", crcOk: true },
    ]);
  });

  it("never lets an entry climb out of the folder", () => {
    expect(safeEntryName("app", "../../etc/passwd")).toBeNull();
    expect(safeEntryName("app", "src/../../x")).toBeNull();
    expect(safeEntryName("app", "/abs/./path.ts")).toBe("app/abs/path.ts");
    const zip = createZip("app", [
      { path: "../evil", content: "x" },
      { path: "ok.ts", content: "y" },
    ]);
    expect(readZip(zip).map((entry) => entry.name)).toEqual(["app/ok.ts"]);
  });

  it("names the folder from the project name safely", () => {
    expect(zipFolderName("Banking Landing Page!")).toBe("banking-landing-page");
    expect(zipFolderName("../../")).toBe("project");
    expect(zipFolderName("")).toBe("project");
  });
});
