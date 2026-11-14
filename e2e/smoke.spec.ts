import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("health endpoint reports ok without caching", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});

test("landing page has no detectable accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Animation disabled by reduced motion preference" }),
  ).toBeDisabled();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("the landing demo can pause, resume, and replay without looping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const demo = page.getByRole("figure", { name: /replay of one request/i });
  expect(await demo.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(demo.getByRole("button", { name: "Pause replay" })).toBeVisible();
  await demo.getByRole("button", { name: "Pause replay" }).click();
  await expect(demo.getByRole("button", { name: "Resume replay" })).toBeVisible();
  await demo.getByRole("button", { name: "Resume replay" }).click();
  await expect(demo.getByRole("button", { name: "Pause replay" })).toBeVisible();

  await page.waitForTimeout(8_000);
  await expect(demo.getByRole("button", { name: "Replay demo" })).toBeVisible();
  await page.waitForTimeout(7_000);
  await expect(demo.getByRole("button", { name: "Replay demo" })).toBeVisible();

  await demo.getByRole("button", { name: "Replay demo" }).click();
  await expect(demo.getByRole("button", { name: "Pause replay" })).toBeVisible();
});
