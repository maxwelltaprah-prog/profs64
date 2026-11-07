import type { NextConfig } from "next";

// Cache Components is intentionally off: nonce-based CSP requires every page to
// render per request, which defeats the static shell. See docs/ASSUMPTIONS.md.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
