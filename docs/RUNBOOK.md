# Runbook

Steps for the person operating Buildr. Each was written from the code, but the Supabase and OpenRouter dashboard steps have not been run against live accounts from this environment; check them once in a staging project.

## Turn the assistant off (kill switch)

Use this for runaway spend, a provider incident, or a suspected abuse wave.

1. Set `AI_DISABLED=true` in the hosting environment.
2. Redeploy or restart so the new value is read. The setting is read on every request, so a restart is enough on platforms that keep environment variables per process.
3. Check: `POST /api/chat` from a signed-in, verified account returns `503` with code `ai_unavailable`, and no model call is made. Sign-in, projects and the file viewer keep working.
4. To resume, remove the variable (or set it to `false`) and restart.

For a single account, set a lower `AI_DAILY_CREDIT_CAP` for everyone, or refund and then ban the user in the Supabase dashboard (Authentication, Users).

## Rotate keys

Rotate on a schedule, when someone with access leaves, and immediately if a value appears in a log, ticket or repository. Order matters: make the new value available, switch, then revoke the old one.

**OpenRouter API key**

1. Create a new key in the OpenRouter dashboard (set a spending limit on it).
2. Update `OPENROUTER_API_KEY` in the hosting environment and redeploy.
3. Send one chat message and confirm it streams and a ledger row appears.
4. Delete the old key in OpenRouter.

**Supabase service role key** (highest impact: it bypasses RLS)

1. In the Supabase dashboard, Project Settings, API keys: create or roll the service role key.
2. Update `SUPABASE_SERVICE_ROLE_KEY` and redeploy.
3. Check: sign up a test account (the grant is written by a database trigger, not this key), send a chat message (uses the key to deduct credits), and delete the test account (uses it to delete the user).
4. Revoke the old key.

**Supabase anon key and JWT secret**

Rolling the JWT secret signs everyone out. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` (it is embedded in the client build, so rebuild and redeploy), and expect users to sign in again.

**Upstash token**

Create a new token, update `UPSTASH_REDIS_REST_TOKEN`, redeploy, then revoke the old one. If it fails, the app falls back to the in-memory limiter and logs `rate_limit_backend_unavailable`.

**If a key leaked**: rotate first, then look for use. OpenRouter's activity page shows spend by key; Supabase logs show service role queries. Check `credit_ledger` for unexpected `chat_usage` rows.

## Refund or adjust credits

The ledger is append-only: never edit or delete rows. Add a new row with the database function, which locks the account, updates the balance and writes the ledger row in one transaction. Run it in the Supabase SQL editor (it runs as a privileged role; the function is not callable by signed-in users, which `tests/integration/rls.test.ts` checks).

1. Find the charge:

   ```sql
   select id, created_at, delta, model, input_tokens, output_tokens, cost_usd, balance_after
   from public.credit_ledger
   where user_id = '<user uuid>'
   order by id desc limit 20;
   ```

2. Refund (a positive number adds credits):

   ```sql
   select * from public.record_credit_change('<user uuid>', 2.50, 'refund');
   ```

   Use `'admin_adjustment'` for anything that is not a refund. A negative number removes credits, never below zero; the unapplied part is returned as `shortfall`.

3. Confirm the new row shows the expected `balance_after`. Record the reason in your own support system; the ledger row carries no free text on purpose.

The refund and rejection behaviour is covered by `tests/integration/credits.test.ts`. Do not edit `profiles.credit_balance` directly.

## Handle a data request

- **Export**: the person can download their data from Account, or `GET /api/account/export` when signed in. It is one JSON file with profile, projects, files, messages, credit history and security log.
- **Deletion**: the person can delete their account from Account (password required). The database removes projects, files and messages and keeps credit and audit rows without the user or project reference. To do it for someone who cannot sign in, delete the user in the Supabase dashboard (Authentication, Users); the same cascade applies.

## When credits look wrong

1. Compare the ledger row's `input_tokens`, `output_tokens` and `cost_usd` with OpenRouter's activity page for the same time.
2. Rows from requests where the provider reported no usage, or that were stopped mid-step, use estimates (3 characters per token) and log `usage_estimated`. Search logs by the request ID shown in error responses.
3. `credit_shortfall` in logs means a request cost more than the remaining balance; the charge was clamped to zero balance.

## Sign-ups fail with "could not send the confirmation email"

Supabase's built-in mailer allows only a few messages per hour and is meant for development. Once it is exhausted, sign-up returns 429 `email_send_limited` and the log shows `signup_email_send_limited`. The fix is custom SMTP: in the Supabase dashboard, Authentication, then Emails, then SMTP Settings, enter a provider (Resend, Postmark, SES or similar) and raise the rate limit under Authentication, then Rate Limits. Until then nobody can sign up or reset a password.

## Every message fails ("Buildr's AI provider limit was reached")

The provider account (OpenRouter) cannot pay for requests. Logs show `model_stream_error` with `providerStatus: 402`. Seen on 2026-11-08: total credits 0, and each request asks for up to 6,000 output tokens, which OpenRouter refuses when the balance cannot cover them (small requests may still work, so it looks intermittent). Fix: add credits at openrouter.ai, Settings, Credits, or set a higher limit on the key. Nothing is charged to users for these failures. `providerStatus: 429` means the provider is rate limiting instead; wait or raise the limit.

To check the key from a shell: `GET https://openrouter.ai/api/v1/credits` with the key as a bearer token shows total credits and usage.

## Deploy checklist

- Environment variables set; `AI_MODEL_MODE` empty.
- Supabase: email confirmation on, redirect URLs set, `APP_URL` set.
- Migration applied (`supabase db push`).
- Hosted behind a proxy that sets `x-real-ip` or `x-forwarded-for` (see SECURITY.md, IP headers).
- Upstash variables set if running more than one instance.
- One real chat request made and its ledger row compared with OpenRouter (KI-17).
