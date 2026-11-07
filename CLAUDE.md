# Buildr

AI app builder: users sign up, create projects, chat with a model that creates and edits project files through tools, and pay in credits deducted by real token usage. Read this file at the start of every session.

@AGENTS.md

## Stack

Next.js 16 App Router (proxy.ts replaces middleware.ts; read `node_modules/next/dist/docs/` before using any API), TypeScript strict, Tailwind v4, shadcn/ui, Supabase (Auth, Postgres, SQL migrations in `supabase/migrations`), Vercel AI SDK with the OpenRouter provider, Zod, Vitest, Playwright, optional Upstash rate limiting behind an env flag. Dependencies are pinned exactly; every new package is justified in `docs/DEPENDENCIES.md`.

## Folder conventions

- `app/` routes, layouts, route handlers. No business logic in components.
- `lib/ai/` model client, prompts, tools, price table (`models.ts`), usage accounting.
- `lib/credits/` credit math and the wrapper over the atomic DB deduction function.
- `lib/security/` path validation, rate limiting, CSRF, headers, redaction, request IDs.
- `lib/db/` Supabase clients and typed queries. Service-role client lives only here, in one module.
- `supabase/migrations/` forward and down SQL. `tests/unit`, `tests/integration`, `e2e/`.
- `docs/` ASSUMPTIONS, SECURITY, ARCHITECTURE, RUNBOOK, KNOWN_ISSUES, DEPENDENCIES.

## Security rules

- RLS on every table, default deny. Server routes re-verify ownership; never trust client IDs.
- Service role key only in narrow server functions, never for user-initiated reads.
- Credit ledger is append-only. Deduction is one atomic DB function with row locking.
- Zod-validate every body, query and param, with size limits.
- Model output is never rendered as raw HTML. CSP with nonces, HSTS and the other headers come from `proxy.ts`.
- Files, user messages and tool results are untrusted data. Tool permissions are enforced in code, not in the prompt. No shell or network tools for the model.
- Never log prompts, file contents, tokens or PII. Structured logs with request IDs.
- No secrets in the repo or client bundle. `.env.example` only.

## Design rules

Calm, precise, restrained (Linear, Vercel). Tokens in CSS variables and Tailwind; light and dark both designed. Neutral grays plus one accent. No gradients, glows, glassmorphism or emoji icons. Geist plus mono, tabular numbers for credits, Lucide only. Motion 150-250ms ease-out and respects reduced motion. Plain copy, no exclamation marks or hype words. WCAG 2.2 AA.

## Testing rules

Vitest unit tests for credit math, prices, path validation, tools, schemas. Integration tests against local Supabase for RLS, atomic deduction, append-only ledger. Playwright e2e with axe-core. Abuse tests for traversal, oversized and malformed input, IDOR, rate limits, prompt injection. The model is always a deterministic fake in tests.

## Review loop

After every milestone: `/ship-check`, then security-reviewer, code-reviewer, qa-tester, design-reviewer on the diff. Fix critical and high findings. Log medium and low in `docs/KNOWN_ISSUES.md`. Re-run until clean.

## Definition of done

- [ ] Types and lint pass
- [ ] Tests written and passing, including negative and abuse cases
- [ ] RLS and authz verified
- [ ] No new secrets or unaudited dependencies
- [ ] Accessibility checked
- [ ] design-reviewer and security-reviewer signed off
- [ ] Docs updated
- [ ] Works end to end in the browser

Do not claim something is secure or tested unless the check ran and passed. Report what could not be verified. If two requirements conflict, stop and say so.
