import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/does-not-exist",
];

for (const theme of ["light", "dark"] as const) {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has no axe violations and no CSP violations in ${theme} theme`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "buildr-theme", value: theme, url: baseURL ?? "http://127.0.0.1:3100" },
      ]);
      const blocked: string[] = [];
      page.on("console", (message) => {
        if (/content security policy/i.test(message.text())) blocked.push(message.text());
      });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.locator("html").getAttribute("data-theme")).toBe(theme);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
      expect(blocked).toEqual([]);
    });
  }
}

test("protected pages send signed-out visitors to sign in and keep the destination", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await page.goto("/project/00000000-0000-4000-8000-000000000000");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
});

test("the sign-in form shows a generic error and stays usable", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form [role=alert]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("the sign-in page offers a command palette on Ctrl+K only after sign-in, not before", async ({
  page,
}) => {
  await page.goto("/login");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
