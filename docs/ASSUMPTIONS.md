# Assumptions

Decisions made where the brief was silent or ambiguous. Change them here first.

## Milestone 0

- **Project location.** The app lives in `buildr/`, a subfolder of the session's working directory. The parent is a home directory holding SSH keys and session tokens, so making it the repo root would put those under git and the secret scanner.
- **Next.js 16.** `create-next-app` installed Next 16.4.5, where `middleware.ts` is now `proxy.ts`. All "middleware" requirements are implemented in `proxy.ts`. I read the bundled docs in `node_modules/next/dist/docs/` rather than relying on memory.
- **Cache Components off.** The scaffold enabled `cacheComponents`. Nonce-based CSP needs per-request rendering, so it is disabled.
- **ESLint 9 and TypeScript 5.9.** ESLint 10 and TypeScript 7 exist, but `eslint-plugin-import` and the typescript-eslint stack target ESLint 9 and TS 5. Staying on the supported combination.
- **Exact pins.** `.npmrc` sets `save-exact=true`; every dependency uses an exact version, enforced by a unit test.
- **Secret scanning.** gitleaks runs in CI through its GitHub Action and locally through `scripts/secret-scan.sh`. The pre-built binary could not be downloaded in this environment, so it was built with `go install github.com/zricethezav/gitleaks/v8@latest` into `~/.local/bin`. The hook fails if gitleaks is missing rather than skipping silently.
- **Subagents.** Defined in `.claude/agents/`. No `docs/REVIEW_*.md` fallback files were created; see the note below on how reviews ran in the creating session.
- **Playwright e2e** starts the production build with `AI_MODEL_MODE=fake`. The fake model arrives in Milestone 3.
- **Rate limiting.** Upstash is used when its env vars are set; otherwise an in-memory limiter is used. The in-memory limiter is per-process and is documented as not suitable for multi-instance production.
- **Auth throttling.** Auth rate limits are applied to the app's own auth route handlers. Supabase's hosted limits are an additional layer, not a replacement.
- **Reviewer subagents in this session.** The four agents are defined in `.claude/agents/`, but they were not registered in the session that created them, so the milestone reviews were done manually against the same checklists. They load in later sessions.
- **No Docker daemon here.** `supabase start` cannot run in this environment (no Docker socket). Postgres 16 server binaries are installed locally, so Milestone 1 integration tests run against a local Postgres 16 with a minimal shim of Supabase's `auth` schema and roles. CI runs the same tests against real local Supabase. The shim is not identical to Supabase; results here are reported as such.
