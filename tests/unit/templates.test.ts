import { describe, expect, it } from "vitest";

import { CHAT_TEXT_MAX_CHARS } from "@/lib/security/limits";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  templateById,
  templatesByCategory,
} from "@/lib/workspace/templates";

describe("project templates", () => {
  it("have unique ids, known categories, and substantial prompts the chat will accept", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const template of TEMPLATES) {
      expect(TEMPLATE_CATEGORIES).toContain(template.category);
      expect(template.prompt.length).toBeGreaterThan(80);
      expect(template.prompt.length).toBeLessThanOrEqual(CHAT_TEXT_MAX_CHARS);
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
    }
  });

  it("groups every template under a category with none left out or empty", () => {
    const groups = templatesByCategory();
    expect(groups.flatMap((g) => g.items)).toHaveLength(TEMPLATES.length);
    for (const group of groups) expect(group.items.length).toBeGreaterThan(0);
  });

  it("looks up by id", () => {
    expect(templateById("saas-landing")?.category).toBe("Websites");
    expect(templateById("nope")).toBeUndefined();
  });
});
