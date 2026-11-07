import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
    env: { LOG_LEVEL: "silent" },
    include: ["tests/unit/**/*.test.ts", "lib/**/*.test.ts"],
    exclude: ["tests/integration/**", "e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
