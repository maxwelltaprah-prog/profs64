import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const lines = (relative: string) => read(relative).split("\n");

// Frontmatter value for a key, or "" when absent. String ops only, so no dynamic regex.
const frontmatter = (relative: string, key: string) => {
  const line = lines(relative).find((l) => l.startsWith(`${key}: `));
  return line ? line.slice(key.length + 2).trim() : "";
};

const SEMVER = /^\d+\.\d+\.\d+$/;

describe("project guardrails", () => {
  it("CLAUDE.md covers every section the standards require", () => {
    const claudeLines = lines("CLAUDE.md");
    for (const heading of [
      "Stack",
      "Folder conventions",
      "Security rules",
      "Design rules",
      "Testing rules",
      "Definition of done",
    ]) {
      expect(claudeLines, `missing section: ${heading}`).toContain(`## ${heading}`);
    }
  });

  it.each(["security-reviewer", "code-reviewer", "qa-tester", "design-reviewer"])(
    "subagent %s exists with name and description frontmatter",
    (agent) => {
      const file = `.claude/agents/${agent}.md`;
      expect(existsSync(path.join(root, file)), `${file} missing`).toBe(true);
      expect(lines(file)[0]).toBe("---");
      expect(frontmatter(file, "name")).toBe(agent);
      expect(frontmatter(file, "description")).not.toBe("");
    },
  );

  it("reviewers that only report findings have no write tools", () => {
    for (const agent of ["security-reviewer", "code-reviewer", "design-reviewer"]) {
      const tools = frontmatter(`.claude/agents/${agent}.md`, "tools")
        .split(",")
        .map((tool) => tool.trim());
      expect(tools, `${agent} should declare tools`).not.toEqual([""]);
      for (const writeTool of ["Write", "Edit", "NotebookEdit"]) {
        expect(tools, `${agent} must not have ${writeTool}`).not.toContain(writeTool);
      }
    }
  });

  it("defines the /ship-check command with both reviewers", () => {
    const command = read(".claude/commands/ship-check.md");
    expect(command).toContain("security-reviewer");
    expect(command).toContain("code-reviewer");
  });

  it("pre-commit hook runs lint-staged, typecheck and the secret scan", () => {
    const hook = read(".husky/pre-commit");
    expect(hook).toContain("lint-staged");
    expect(hook).toContain("typecheck");
    expect(hook).toContain("secret-scan");
  });

  it("keeps secret keys in .env.example empty", () => {
    const exampleLines = lines(".env.example");
    for (const secretKey of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "OPENROUTER_API_KEY",
      "UPSTASH_REDIS_REST_TOKEN",
    ]) {
      expect(exampleLines, `${secretKey} must be present and empty`).toContain(`${secretKey}=`);
    }
  });

  it("pins every dependency to an exact version", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, version] of Object.entries(all)) {
      expect(version, `${name} is not pinned`).toMatch(SEMVER);
    }
  });

  it("client components never import the Zod schemas module (its parsers need eval, which the CSP blocks)", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.tsx?$/.test(entry) ? [full] : [];
      });
    const offenders = [...walk(path.join(root, "components")), ...walk(path.join(root, "lib"))]
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        const isClient =
          source.startsWith('"use client"') || file.includes(`${path.sep}workspace${path.sep}`);
        return isClient && source.includes("@/lib/security/schemas");
      })
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual([]);
  });
});
