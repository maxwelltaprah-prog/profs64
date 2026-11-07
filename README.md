# Buildr

An AI app builder. People sign up, create projects, and chat with an assistant that creates and edits the project's files through a fixed set of tools. Usage is paid in credits that are deducted from the tokens each request actually used.

This is the first phase. Not included yet: Stripe or any payment, live preview, GitHub export, deployment, database connections. The workspace shows a "Preview (coming next)" placeholder.

Read [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) before relying on it. The largest open items are that no request has yet gone to a real model or a real Supabase project.

## Stack

Next.js 16 (App Router, `proxy.ts`), TypeScript strict, Tailwind v4, Supabase (Auth, Postgres), Vercel AI SDK v7 with the OpenRouter provider, Zod, Vitest, Playwright. The interface uses hand-built primitives rather than shadcn/ui because shadcn's dependencies need inline styles that the strict CSP forbids; see [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md).

## Set up

Requirements: Node.js 22 or newer, a Supabase project (or the Supabase CLI with Docker for a local one), an OpenRouter API key.

```bash
npm ci
cp .env.example .env.local   # then fill in the values below
```

| Variable                                                    | Where   | Purpose                                                                                          |
| ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Supabase project URL and public key.                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | Server  | Used only in `lib/db/service.ts` for credit deductions, audit and assistant messages.            |
| `OPENROUTER_API_KEY`                                        | Server  | Model calls.                                                                                     |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`        | Server  | Optional. Shared rate limiting; without them an in-memory limiter is used, which is per process. |
| `APP_URL`                                                   | Server  | Optional. Public base URL used in auth emails. Set it in production.                             |
| `AI_DISABLED`                                               | Server  | Optional. `true` turns the assistant off for everyone.                                           |
| `AI_DAILY_CREDIT_CAP`                                       | Server  | Optional. Credits one account can spend per rolling day. Default 50.                             |
| `AI_MODEL_MODE`                                             | Server  | Leave empty in production. `fake` is for tests.                                                  |
| `LOG_LEVEL`                                                 | Server  | Optional. `debug`, `info`, `warn`, `error` or `silent`.                                          |

Never commit real values. Only `.env.example` is tracked.

### Database migrations

The schema is one SQL file in `supabase/migrations/`, with its reverse in `supabase/down/`.

```bash
supabase start                      # local stack, needs Docker
supabase db reset                   # applies migrations/
# or, for a hosted project:
supabase link --project-ref <ref>
supabase db push
```

In the Supabase dashboard for a hosted project, turn on email confirmation (the settings in `supabase/config.toml` apply only to the local stack) and add your site URL and `<APP_URL>/auth/callback` to the redirect allow list. `supabase/config.toml` was written by hand and has not been validated by the CLI (KI-4).

### Run

```bash
npm run dev
```

Sign up, confirm the email (local mail appears in Inbucket at port 54324), and you start with 20 credits.

## Changing the model or its prices

Edit `lib/ai/models.ts`. It holds the default model, the fallback model, and prices in USD per million input and output tokens. Cost is computed from that table, one credit is $0.03 (`lib/credits/math.ts`), charges round up to two decimals with a minimum of 0.1 per request that reached the model. Unit tests in `tests/unit/credits-and-billing.test.ts` pin the current numbers, so changing a price will fail a test on purpose; update the expectation in the same change.

Check any new model id and its prices against OpenRouter before using it, and confirm it supports tool calling.

## Commands

| Command                    | What it does                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`        | TypeScript, strict.                                                   |
| `npm run lint`             | ESLint with zero warnings allowed.                                    |
| `npm test`                 | Unit and component tests.                                             |
| `npm run test:integration` | Database tests: RLS, atomic credits, append-only ledger, migrations.  |
| `npm run test:e2e`         | Playwright against a production build, with axe accessibility checks. |
| `npm run audit:deps`       | `npm audit` at high severity.                                         |
| `npm run secrets`          | gitleaks over the working tree.                                       |
| `npm run ship-check`       | All of the above in one run.                                          |

Integration tests use `TEST_DATABASE_URL` when set (CI points it at local Supabase). Without it they start a throwaway local Postgres 16 with a small stand-in for Supabase's `auth` schema, which is not identical to Supabase.

## More

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) how the pieces fit
- [docs/SECURITY.md](docs/SECURITY.md) threat model, data flows, subprocessors
- [docs/RUNBOOK.md](docs/RUNBOOK.md) rotating keys, turning the assistant off, refunding credits
- [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md), [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md), [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md)
