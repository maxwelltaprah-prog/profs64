import path from "node:path";

import { defineConfig } from "vitest/config";

// Integration tests talk to Postgres. With TEST_DATABASE_URL set (CI, `supabase start`)
// they use that database; otherwise global-setup starts a throwaway local Postgres plus a
// minimal Supabase shim. They are kept out of the default unit run so `npm test` needs no services.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
