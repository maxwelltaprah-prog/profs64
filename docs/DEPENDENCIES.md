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

| Package                | Version | Why                                                                                                                                                                                                                                                                                                                                                         | Alternatives considered                                                                                                                                                                                              |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sucrase`              | 3.35.1  | Transpiles TS/TSX to ES modules in the browser without evaluating anything, so the preview works under the app's strict CSP. Small, fast, and does not type-check, which is what a preview wants.                                                                                                                                                           | esbuild-wasm (needs WebAssembly and `wasm-unsafe-eval` in the CSP, 10x larger), Babel standalone (much larger), a server build (needs a build sandbox per project and would not run on Vercel's limits).             |
| `es-module-lexer`      | 3.0.4   | Exact import/export positions for rewriting specifiers; replaces a regex that could be made to backtrack on crafted (model-generated) input. The pure-JS build is used so no WebAssembly is needed.                                                                                                                                                         | Hand-written regex (rejected: ReDoS surface and false matches in strings and comments).                                                                                                                              |
| `prism-react-renderer` | 2.4.1   | Syntax highlighting for the code view. It tokenises with a bundled Prism (no `eval`, no WebAssembly) and hands back tokens that are rendered as React text nodes, so file content is never HTML. Its theme styles are not used (inline styles are blocked by the CSP); colours come from `tok-*` classes. One small dependency (`clsx`). Released Dec 2024. | Shiki (needs WebAssembly or a large JS regex engine, and emits inline styles), highlight.js (returns an HTML string, which would need `dangerouslySetInnerHTML`), a hand-written tokenizer (more code to get wrong). |

## Agent skills (development only, not shipped)

No npm packages were added for the auth redesign. Two skill sets live in `.claude/skills/` and are never bundled or run by the app: `ponytail*` from DietrichGebert/ponytail (MIT, markdown only, hooks deliberately left out) and `ui-ux-pro-max` from nextlevelbuilder/ui-ux-pro-max-skill (MIT, markdown, CSV data and local Python search scripts that use only the standard library and make no network calls). Licences are kept beside them. Both were read before installing; re-read after any update.

## Starter template packages (in each user's project, not in Buildr)

Added on 2026-11-09 so generated apps feel smooth, from Lovable's `vite_react_shadcn_ts` template where possible: `tailwindcss-animate` 1.0.7 and `sonner` 1.7.4 (Lovable's versions), and `framer-motion` 12.43.0 (not in Lovable's template; the last 12.x release, chosen because 12.23.12 pulls a newer `motion-dom` that breaks `vite build`). Security bumps at the same time: `react-router-dom` 6.30.1 to 6.30.6, `postcss` 8.5.6 to 8.5.31, `vite` 5.4.19 to 5.4.21, and `@types/node` 22.16.5 added (the starter's `vite.config.ts` did not typecheck without it). Verified by writing the starter to disk, `npm install`, `tsc --noEmit` and `vite build`. The zip download uses a small hand-written writer (`lib/workspace/zip.ts`) instead of `fflate`, whose registry history showed old versions re-published in July 2026.
