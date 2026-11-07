import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["PORT"] ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The model is always the deterministic fake in e2e so CI never spends credits.
    command: `npm run build && npm run start -- --port ${PORT} --hostname 127.0.0.1`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env["CI"],
    timeout: 240_000,
    env: {
      AI_MODEL_MODE: "fake",
      // Placeholders pointing at a closed local port: pages render signed-out and no request
      // ever reaches a real Supabase project. Auth round trips are covered by integration tests.
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-placeholder-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-placeholder-service",
    },
  },
});
