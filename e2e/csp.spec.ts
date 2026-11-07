import { expect, test } from "@playwright/test";

test("the strict CSP lets the app run: every script carries the nonce and nothing is blocked", async ({
  page,
}) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __cspViolations: string[] }).__cspViolations ??= [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations.push(
        `${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });

  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce, "CSP header must carry a nonce").toBeTruthy();

  const scripts = await page.$$eval("script", (nodes) =>
    nodes.map((node) => ({
      nonce: node.nonce || node.getAttribute("nonce"),
      hasSrc: Boolean(node.src),
    })),
  );
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.filter((script) => script.nonce !== nonce)).toEqual([]);

  await page.waitForLoadState("networkidle");
  const inPage = await page.evaluate(
    () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
  );
  expect([...violations, ...inPage]).toEqual([]);
});

test("each page response gets a different nonce", async ({ request }) => {
  const nonces = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const response = await request.get("/");
    nonces.add(
      /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "")?.[1] ?? "",
    );
  }
  expect(nonces.size).toBe(3);
});

test("security headers are present on pages and API responses", async ({ request }) => {
  for (const path of ["/", "/api/health"]) {
    const headers = (await request.get(path)).headers();
    expect(headers["strict-transport-security"], path).toBeTruthy();
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["referrer-policy"], path).toBeTruthy();
    expect(headers["permissions-policy"], path).toBeTruthy();
  }
});
