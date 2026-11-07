# Dependencies

Every package is pinned exactly. Add a row here in the same change that adds the package.

## Runtime

| Package                            | Why                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| next, react, react-dom             | Framework required by the brief (scaffold).                                      |
| @supabase/supabase-js              | Supabase client; used with the service role in one module (`lib/db/service.ts`). |
| @supabase/ssr                      | Cookie-based Supabase sessions for Next.js server code and `proxy.ts`.           |
| zod                                | Validation of every request body, query, param and env var.                      |
| server-only                        | Build-time guard so server modules cannot be bundled into client code.           |
| @upstash/ratelimit, @upstash/redis | Optional distributed rate limiting behind an env flag, as the brief specifies.   |

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

Planned for later milestones (to be added with justification): `ai`, `@openrouter/ai-sdk-provider`, `lucide-react`, `geist`.
