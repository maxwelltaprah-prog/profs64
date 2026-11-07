# Architecture

## Shape

One Next.js app. Browser pages and route handlers run on the server; the browser never talks to Supabase or OpenRouter directly. All data access goes through server code, so there is one place to enforce authentication, ownership and limits.

```
Browser ──(cookie session)──▶ proxy.ts ──▶ pages / route handlers
                                              │
                    ┌─────────────────────────┼───────────────────────┐
                    ▼                         ▼                       ▼
        Supabase (user client, RLS)   Supabase (service role,   OpenRouter
        projects, files, messages     narrow functions only)    (model calls)
                                      credits, audit, assistant
                                      messages, export, delete
```

## Request path

1. `proxy.ts` runs first on every request. It sets a per-request CSP nonce and security headers, refreshes the Supabase session cookie, and redirects signed-out visitors away from `/dashboard`, `/project`, `/account` and `/start` (and signed-in visitors away from the sign-in pages). These redirects are an optimisation: every page and route re-verifies the user itself.
2. Pages are server components rendered per request (the root layout awaits `connection()`), which is what lets the nonce be applied to every script.
3. Route handlers are wrapped by `withApi` (`lib/security/api.ts`): request ID, same-origin check on state-changing methods, uniform JSON errors, one structured log line. They validate bodies with Zod and a byte cap (`lib/security/request.ts`).

## Data

Tables (all in `supabase/migrations/20261107000001_init.sql`): `profiles` (credit balance), `projects`, `project_files` (unique path per project), `messages` (jsonb parts), `credit_ledger` (append-only), `audit_log` (append-only).

- Row Level Security is on and forced for every table, default deny. Users can read their own rows, create and edit their own projects and files, and insert only `user`-role messages. Users cannot write the ledger, the audit log or their balance.
- Balance changes only through `record_credit_change`, which locks the profile row, clamps a charge to the balance, writes the ledger row, and returns the result in one transaction. `deduct_credits` wraps it for chat usage.
- Row caps (50 projects per user, 100 files per project, 2,000 messages per project) and the file path and size rules are enforced by triggers and constraints, so they hold even if application code is wrong.
- Deleting an account cascades to projects, files and messages; the ledger and audit log are kept with the user and project references removed.

## The assistant

`POST /api/chat` (`app/api/chat/route.ts`), in order:

1. Verified user (401 signed out, 403 email unconfirmed). Kill switch (503).
2. Zod validation. The client sends only its newest message and a project id.
3. Rate limits per user and per IP, a one-response-at-a-time lease per account.
4. Ownership check through RLS (404 for another person's project, indistinguishable from a missing one).
5. Credit gate: below 1 credit returns 402. Daily spend cap returns 429. Everything up to here happens before any model code is reached.
6. The user's message is stored. History is loaded from the database (last 20 messages), never taken from the client.
7. Context: instructions in the system prompt (`lib/ai/system-prompt.ts`); the file list and file contents (up to 60 KB) go in a first user message inside a random per-request boundary and labelled untrusted (`lib/ai/context.ts`).
8. `streamText` with the OpenRouter model (`lib/ai/model-factory.ts`), five tools, at most 12 steps, 6,000 output tokens per step, 120 second timeout, and the request's abort signal.
9. Tools (`lib/ai/tools.ts`) are Zod-validated and enforced in code: path allowlist (no absolute paths, `..`, encoded or backslash variants), allowed extensions, 200 KB per file, 100 files, `edit_file` needs exactly one match. They act on the database through the user's own client, so RLS applies again. The model has no shell, network or code execution.
10. The stream is encoded as a UI message stream and sent to the browser. Billing runs exactly once from whichever event ends the request: finish, provider error, Stop (abort), or the browser cancelling the response (`lib/credits/billing.ts`). The assistant's message is written by a narrow service-role function.

Cost: `lib/ai/models.ts` holds prices, `lib/credits/math.ts` converts dollars to credits (1 credit = $0.03, rounded up to two decimals, minimum 0.1).

## Browser

- `components/workspace/*`: split pane (keyboard and pointer resizable, size remembered per user and project), file tree, read-only code viewer, chat panel using `useChat`. Model text is rendered as text nodes only.
- The file tree is refreshed from the server as each file-changing tool call completes. The credit balance refreshes when a turn ends.
- UI primitives in `components/ui/*` use CSS variable tokens (`app/globals.css`). No inline `style` attributes are used anywhere, because the production CSP forbids them.

### Prompt-first entry

The home page leads with a prompt box (`components/landing/prompt-box.tsx`). Submitting it saves the text in `localStorage` (`lib/workspace/pending-prompt.ts`, 24-hour expiry) and either goes to `/start` or, when signed out, opens a native `<dialog>` with the sign-up and sign-in forms. Sign-up sends `next: "/start"` so the confirmation link lands there; sign-in redirects there directly. `/start` (`components/start/start-project.tsx`) creates a project named from the prompt's first line, records the project id alongside the prompt, and opens the workspace. The chat panel sends the prompt once, only when the stored project id matches the open project and the assistant can run; otherwise it is placed in the composer. Browser storage is the right place for this: it is a per-visitor convenience, nothing else reads it, and the server validates the text like any other message.

## Testing layers

| Layer       | Where               | What it proves                                                                                                |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Unit        | `tests/unit`        | Credit math, billing, tools, paths, schemas, routes (mocked storage), chat UI against the real stream format. |
| Integration | `tests/integration` | RLS, atomic deduction under concurrency, append-only ledger, migrations up and down.                          |
| End to end  | `e2e`               | Production build: CSP, headers, API abuse without a session, axe in light and dark.                           |

The model is always the deterministic fake (`lib/ai/fake-model.ts`) in tests.
