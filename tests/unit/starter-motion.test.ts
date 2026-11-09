import { describe, expect, it } from "vitest";

import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { cdnUrlFor } from "@/lib/preview/packages";
import { ANIMATE_UTILITIES_CSS } from "@/lib/templates/animate-css";
import { SHADCN_TAILWIND_CONFIG } from "@/lib/templates/shadcn-theme";
import {
  STARTER_DEPENDENCIES,
  STARTER_DEV_DEPENDENCIES,
  STARTER_FILES,
} from "@/lib/templates/vite-react-starter";

const file = (path: string) => STARTER_FILES.find((entry) => entry.path === path)?.content ?? "";

describe("motion in new projects", () => {
  it("pins the motion and feedback packages exactly, plus patched router and build tools", () => {
    expect(STARTER_DEPENDENCIES["framer-motion"]).toBe("12.43.0");
    expect(STARTER_DEPENDENCIES.sonner).toBe("1.7.4");
    expect(STARTER_DEPENDENCIES["tailwindcss-animate"]).toBe("1.0.7");
    expect(STARTER_DEPENDENCIES["react-router-dom"]).toBe("6.30.6");
    expect(STARTER_DEV_DEPENDENCIES.vite).toBe("5.4.21");
    expect(STARTER_DEV_DEPENDENCIES.postcss).toBe("8.5.31");
    expect(STARTER_DEV_DEPENDENCIES["@types/node"]).toBe("22.16.5");
    for (const version of Object.values({ ...STARTER_DEPENDENCIES, ...STARTER_DEV_DEPENDENCIES }))
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(JSON.parse(file("package.json")).dependencies).toEqual(STARTER_DEPENDENCIES);
  });

  it("wires reduced motion and toasts into the app, and uses the presets on the first page", () => {
    expect(file("src/App.tsx")).toContain('<MotionConfig reducedMotion="user">');
    expect(file("src/App.tsx")).toContain("<Toaster />");
    expect(file("src/lib/motion.ts")).toMatch(/export const (fadeUp|stagger|inView)/);
    expect(file("src/components/ui/sonner.tsx")).toContain('from "sonner"');
    expect(file("src/pages/Index.tsx")).toContain("variants={fadeUp}");
  });

  it("registers tailwindcss-animate in the project and its classes in the preview", () => {
    const config = file("tailwind.config.ts");
    expect(config).toContain('import animate from "tailwindcss-animate";');
    expect(config).toContain("plugins: [animate]");
    expect(Object.keys(SHADCN_TAILWIND_CONFIG.theme.extend.keyframes)).toEqual(
      expect.arrayContaining(["accordion-down", "accordion-up", "fade-up", "scale-in"]),
    );
    expect(ANIMATE_UTILITIES_CSS).toContain("@keyframes enter");
    expect(ANIMATE_UTILITIES_CSS).toContain("@layer utilities");
    for (const name of [
      ".animate-in {",
      ".animate-out {",
      ".fade-in-0 {",
      ".zoom-in-95 {",
      ".slide-in-from-top-2 {",
      ".slide-out-to-left-1\\/2 {",
      ".duration-200 {",
    ])
      expect(ANIMATE_UTILITIES_CSS).toContain(name);
  });

  it("loads the pinned versions in the preview", () => {
    expect(cdnUrlFor("framer-motion")).toContain("framer-motion@12.43.0");
    expect(cdnUrlFor("sonner")).toContain("sonner@1.7.4");
  });

  it("tells the assistant to build with motion, toasts and reduced motion in mind", () => {
    for (const phrase of ["framer-motion", "toast()", "animate-in", "reduced motion", "skeletons"])
      expect(SYSTEM_PROMPT).toContain(phrase);
  });
});
