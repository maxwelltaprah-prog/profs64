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
- **Session cookies are httpOnly.** All data access goes through server code, so the browser never needs to read the Supabase session; cookie options are forced to `httpOnly`, `sameSite=lax` and `secure` in production.
- **Optional env vars.** `APP_URL` (public base URL for auth emails) and `LOG_LEVEL` are optional additions to the brief's variable list. Production should set `APP_URL`; a request Host header is attacker-influenced, so it is only used as a development fallback.
- **Password policy.** Length-first (12 to 128 characters), rejects passwords containing the email local part or on a short deny-list, and checks Have I Been Pwned by k-anonymity (only a 5-character SHA-1 prefix leaves the server). If that service is unreachable the check fails open and logs a warning.
- **Failed-login lockout is per account, not per source.** Five failures per 10 minutes for an email address block further attempts from anywhere, which stops distributed guessing but lets an attacker temporarily lock out a known address. This is the usual trade-off; the lockout expires on its own.
- **Assistant messages are server-written.** Users may insert only `user` messages through RLS; assistant messages go through a narrow service-role function (Milestone 3) so the API cannot forge model output.
- **Credit clamp.** A deduction larger than the remaining balance is clamped to the balance (never negative) and the shortfall is returned and logged.
- **shadcn/ui is not used (stack conflict, decided in favour of the security requirement).** The brief asks for shadcn/ui and also for a strict CSP with nonces. shadcn's dependencies (Radix positioning, `react-resizable-panels`, `cmdk`, `sonner`) emit inline `style` attributes or runtime `<style>` tags, which that CSP blocks. Allowing `unsafe-inline` for styles would weaken the policy. The UI primitives (`components/ui/*`, split pane, command palette, tree) are hand-built with the same conventions (variants, `cn`, semantic tokens) and no inline styles.
- **Next.js 16 `proxy.ts`** is the replacement for `middleware.ts`; the brief's "middleware" is implemented there.
- **Split pane size** is written to a CSS variable through the CSSOM (allowed by CSP) and remembered per user and project in `localStorage`. Below the `md` breakpoint the panes stack.
- **Workspace layout.** Chat on the left; the right side has Code (file tree plus read-only viewer) and Preview tabs, where Preview is the "coming next" placeholder.
- **Chat UI ordering.** The chat panel in Milestone 2 shows persisted messages with a composer that is inert; streaming, tool lines, Stop and Cmd+Enter are built with the chat route in Milestone 3 because they depend on it.
- **Input border token.** `--input-border` is a separate, darker token so form controls meet the 3:1 non-text contrast requirement.
- **E2E environment.** Playwright starts the app with placeholder Supabase values pointing at a closed local port. Signed-out pages render normally; real auth round trips are not covered by e2e here (KI-7).
- **Project creation is two statements** (project, then starter files) because PostgREST has no multi-statement transaction. If seeding fails the empty project is deleted again.
