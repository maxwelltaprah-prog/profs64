import path from "node:path";

import { defineConfig } from "vitest/config";

// Integration tests talk to a local Supabase (`supabase start`) and are kept out
// of the default unit run so `npm test` stays fast and needs no services.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
