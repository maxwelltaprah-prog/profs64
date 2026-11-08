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

Added in Milestone 2:

| Package                                                    | Why                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| lucide-react                                               | The only icon set (design rule). Icons render as inline SVG with no style attributes.        |
| ai, @ai-sdk/react, @openrouter/ai-sdk-provider             | Vercel AI SDK and OpenRouter provider; installed now, used by the chat route in Milestone 3. |
| jsdom, @testing-library/react, @testing-library/user-event | Component tests for the split pane, file tree, code viewer and command palette.              |

Planned later: `geist` (fonts), if self-hosting the files is not enough.

## Added for the live preview

| Package           | Version | Why                                                                                                                                                                                                 | Alternatives considered                                                                                                                                                                                  |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sucrase`         | 3.35.1  | Transpiles TS/TSX to ES modules in the browser without evaluating anything, so the preview works under the app's strict CSP. Small, fast, and does not type-check, which is what a preview wants.   | esbuild-wasm (needs WebAssembly and `wasm-unsafe-eval` in the CSP, 10x larger), Babel standalone (much larger), a server build (needs a build sandbox per project and would not run on Vercel's limits). |
| `es-module-lexer` | 3.0.4   | Exact import/export positions for rewriting specifiers; replaces a regex that could be made to backtrack on crafted (model-generated) input. The pure-JS build is used so no WebAssembly is needed. | Hand-written regex (rejected: ReDoS surface and false matches in strings and comments).                                                                                                                  |

## Agent skills (development only, not shipped)

No npm packages were added for the auth redesign. Two skill sets live in `.claude/skills/` and are never bundled or run by the app: `ponytail*` from DietrichGebert/ponytail (MIT, markdown only, hooks deliberately left out) and `ui-ux-pro-max` from nextlevelbuilder/ui-ux-pro-max-skill (MIT, markdown, CSV data and local Python search scripts that use only the standard library and make no network calls). Licences are kept beside them. Both were read before installing; re-read after any update.
