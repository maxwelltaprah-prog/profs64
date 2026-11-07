import { describe, expect, it } from "vitest";

import {
  byteLength,
  MAX_FILE_BYTES,
  MAX_FILES_PER_PROJECT,
  validateProjectPath,
} from "@/lib/security/paths";
import { STARTER_FILES } from "@/lib/templates/vite-react-starter";

describe("starter template", () => {
  it("only contains paths the path validator accepts, with no duplicates", () => {
    const paths = STARTER_FILES.map((file) => file.path);
    for (const path of paths) expect(validateProjectPath(path), path).toMatchObject({ ok: true });
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("fits comfortably inside the per-file and per-project limits", () => {
    expect(STARTER_FILES.length).toBeLessThan(MAX_FILES_PER_PROJECT / 2);
    for (const file of STARTER_FILES)
      expect(byteLength(file.content), file.path).toBeLessThan(MAX_FILE_BYTES / 10);
  });

  it("has the files a Vite React TypeScript Tailwind app needs", () => {
    const paths = STARTER_FILES.map((file) => file.path);
    for (const required of [
      "package.json",
      "index.html",
      "vite.config.ts",
      "src/main.tsx",
      "src/App.tsx",
      "src/index.css",
    ]) {
      expect(paths).toContain(required);
    }
  });

  it("ships valid JSON config and wires the entry point correctly", () => {
    const byPath = new Map(STARTER_FILES.map((file) => [file.path, file.content]));
    const pkg = JSON.parse(byPath.get("package.json") ?? "{}") as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["react", "react-dom"]);
    expect(pkg.devDependencies).toHaveProperty("vite");
    expect(pkg.devDependencies).toHaveProperty("tailwindcss");
    expect(() => JSON.parse(byPath.get("tsconfig.json") ?? "")).not.toThrow();
    expect(byPath.get("index.html")).toContain('src="/src/main.tsx"');
    expect(byPath.get("src/main.tsx")).toContain('import "./index.css"');
    expect(byPath.get("src/index.css")).toContain('@import "tailwindcss"');
  });

  it("contains no secrets or network calls", () => {
    for (const file of STARTER_FILES) {
      expect(file.content, file.path).not.toMatch(/https?:\/\/|api[_-]?key|secret|token/i);
    }
  });
});
