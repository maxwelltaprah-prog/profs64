import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";
import security from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  {
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      "import/no-duplicates": "error",
      "import/no-cycle": ["error", { maxDepth: 5 }],
      "import/no-self-import": "error",
      "import/no-useless-path-segments": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      eqeqeq: ["error", "always"],
      "react/no-danger": "error",
      // Inline style attributes are blocked by the CSP. Use classes or CSSOM from an effect.
      "react/forbid-dom-props": ["error", { forbid: ["style"] }],
      "react/jsx-no-target-blank": "error",
    },
  },
  {
    // The service-role module is for route handlers and server libraries only.
    files: [
      "components/**/*.{ts,tsx}",
      "app/**/page.tsx",
      "app/**/layout.tsx",
      "app/**/*.client.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/service", "**/lib/db/service"],
              message: "The service-role client must not be imported from UI code.",
            },
          ],
        },
      ],
    },
  },
  {
    // UI components index small constant maps with typed union props (variant, size, theme).
    // The keys cannot be user-controlled strings, so this rule is noise there; it stays on in
    // lib/ and app/ where keys can come from requests.
    files: ["components/**/*.{ts,tsx}"],
    rules: { "security/detect-object-injection": "off" },
  },
  {
    // Tests build dynamic paths and fixtures on purpose.
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "e2e/**/*.ts"],
    rules: {
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
