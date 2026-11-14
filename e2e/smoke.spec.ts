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
  expect(
    await page
      .locator("#how .stagger-item")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
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

test("the landing composer uses 16px text and the explainer sections show their icons", async ({
  page,
}) => {
  await page.goto("/");

  const prompt = page.getByLabel("Describe the app you want to build");
  expect(await prompt.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
  expect(
    await prompt.evaluate((element) => Number.parseFloat(getComputedStyle(element).minHeight)),
  ).toBeGreaterThanOrEqual(96);
  expect(
    await prompt.evaluate((element) => Number.parseFloat(getComputedStyle(element).minHeight)),
  ).toBeLessThanOrEqual(112);
  expect(
    await prompt.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(700);
  await expect(page.getByRole("heading", { name: "What do you want to build?" })).toHaveCSS(
    "font-size",
    "48px",
  );
  await expect(page.getByText("A clearer path from idea to project")).toHaveCount(0);
  await expect(page.getByText("Need a starting point? Try one of these")).toBeVisible();
  await expect(page.getByText("Ctrl Enter")).toHaveCount(0);
  const generate = page.getByRole("button", { name: "Generate for free" });
  await expect(generate).toBeDisabled();
  await prompt.fill("A coffee shop");
  await expect(generate).toBeEnabled();
  await expect(generate).toHaveAttribute("title", "Generate for free");
  await expect(generate.locator("svg")).toBeVisible();

  const how = page.locator("#how");
  const security = page.locator("#security");
  const faq = page.locator("#faq");
  expect(await how.locator("li.stagger-item svg").count()).toBe(4);
  expect(await security.locator("svg").count()).toBe(6);
  expect(await faq.locator("svg").count()).toBe(4);
  await how.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      how
        .locator(".stagger-item")
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    )
    .toBe("section-item-in");
});

test("the account dialog has a smooth entrance animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByLabel("Describe the app you want to build").fill("A coffee shop site");
  await page.getByRole("button", { name: "Generate for free" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => getComputedStyle(element).animationName)).toBe(
    "dialog-in",
  );
});

test("the project examples show their local preview images", async ({ page }) => {
  await page.goto("/");

  const examples = page.getByRole("list", { name: "Starting points" }).locator("img");
  await expect(examples).toHaveCount(6);
  for (const image of await examples.all()) {
    await expect(image).toBeVisible();
    expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(640);
  }
});

test("the landing page fits a phone viewport without the workflow illustration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expect(
    page.getByRole("img", { name: /example of a coffee shop brief becoming/i }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
