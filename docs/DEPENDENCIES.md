# Dependencies

Every package is pinned exactly. Add a row here in the same change that adds the package.

## Runtime

| Package                | Why                                         |
| ---------------------- | ------------------------------------------- |
| next, react, react-dom | Framework required by the brief (scaffold). |

## Development

| Package                                                 | Why                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| typescript, @types/node, @types/react, @types/react-dom | Strict typing.                                                |
| tailwindcss, @tailwindcss/turbopack                     | Styling; loader installed by the Next.js scaffold.            |
| eslint, eslint-config-next                              | Linting; scaffold default.                                    |
| eslint-plugin-security                                  | Flags risky patterns (dynamic regex, object injection).       |
| eslint-plugin-import, eslint-import-resolver-typescript | Import order, cycles and duplicates; resolves the `@/` alias. |
| prettier, prettier-plugin-tailwindcss                   | Formatting and class ordering.                                |
| husky, lint-staged                                      | Pre-commit checks on staged files.                            |
| vitest, @vitest/coverage-v8                             | Unit and integration tests, coverage.                         |
| @playwright/test, @axe-core/playwright                  | End-to-end tests and automated accessibility checks.          |

Planned for later milestones (to be added with justification): `@supabase/supabase-js`, `@supabase/ssr`, `ai`, `@openrouter/ai-sdk-provider`, `zod`, `@upstash/ratelimit`, `@upstash/redis`, `lucide-react`, `geist`.
