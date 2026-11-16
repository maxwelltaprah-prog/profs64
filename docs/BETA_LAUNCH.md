# Closed beta launch checklist

What the code now does for the beta, and the steps only the owner can do (accounts, DNS, dashboards).
Tick each box as you go. Nothing here needs code changes unless noted.

## 1. Rate limiting that works on Vercel

The code already supports Upstash Redis. Without it each serverless instance counts on its own, so
limits are close to useless (the app logs `rate_limit_in_memory` once per instance in production).

1. Create a free Redis database at upstash.com (pick the region nearest your Vercel region).
2. Copy its REST URL and REST token.
3. In Vercel, Project, Settings, Environment Variables (Production): add `UPSTASH_REDIS_REST_URL`
   and `UPSTASH_REDIS_REST_TOKEN`. Redeploy.
4. Check: in the Vercel logs `rate_limit_in_memory` no longer appears, and the Upstash dashboard shows
   keys starting `buildr:` after a few sign-in attempts.

## 2. Auth email (Resend)

Supabase's built-in sender allows only a handful of emails per hour. Use your own.

1. You need a domain first (see section 8). Create a Resend account, add the domain, and add the DNS
   records it shows (SPF, DKIM, and optionally DMARC) at your domain registrar. Wait until Resend shows
   the domain as verified.
2. Create a Resend API key.
3. Supabase, Authentication, Emails, SMTP Settings: enable custom SMTP. Host `smtp.resend.com`, port
   `465`, username `resend`, password is the API key, sender `noreply@your-domain`.
4. Supabase, Authentication, URL Configuration: Site URL is `https://your-domain`; add
   `https://your-domain/auth/callback` to Redirect URLs. Set `APP_URL=https://your-domain` in Vercel.
5. Raise the email rate limit (Authentication, Rate Limits) to something sensible for your tester count.
6. Check: sign up a listed test address and confirm the email arrives and the link works.

## 3. Who can sign up

Applied by the migration `20261116000002_beta_gate_and_feedback.sql` (run it once in the Supabase SQL
Editor). The gate is a database trigger, so it covers the form and Google sign-in. It is ON by default.

Add testers (full address, or a whole domain with a leading `@`):

```sql
insert into public.beta_allowlist (entry, note) values
  ('tester@example.com', 'Ada'),
  ('@your-company.com', 'whole team');
```

Remove one: `delete from public.beta_allowlist where entry = 'tester@example.com';`
List them: `select * from public.beta_allowlist order by created_at;`
Open sign-up to everyone later: `update public.app_settings set value = 'off' where key = 'beta_gate';`
Close it again with `'on'`. Existing accounts are never affected.

Note: a stranger who tries the sign-up form is told the beta is invite-only, which also tells them
that address is not listed. That is accepted for a beta.

## 4. Legal pages

The pages are written for the beta and list every service that handles data. They still show a
"Beta draft" notice. Have a lawyer review them, then set these in Vercel and redeploy:

- `NEXT_PUBLIC_LEGAL_ENTITY` the company name that operates the service.
- `NEXT_PUBLIC_CONTACT_EMAIL` the address for privacy and terms questions.
- `NEXT_PUBLIC_LEGAL_REVIEWED=true` only after the review; this removes the draft notice.

Check the text against what you actually use. The Resend and Sentry lines are true only once those are
set up, and the Supabase region should match what you chose.

## 5. Error monitoring and backups

Sentry (code is in; it does nothing until a DSN is set):

1. Create a Sentry project (platform: Next.js) and copy the DSN.
2. In Vercel add `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (the same value). Redeploy.
3. Check: trigger an error and see it arrive. Events contain the error, stack and route only; prompts,
   file contents, cookies, request bodies and user details are removed before sending.

Backups: Supabase, Database, Backups. Free projects have no point-in-time recovery. For real testers,
move to a paid plan and turn on daily backups (and PITR if you can), then do one restore test into a
scratch project and write down how long it took.

Tester feedback: the sidebar has a Send feedback button. Messages land in the `public.feedback` table;
read them in Supabase, Table Editor, `feedback` (newest first). They are included in each person's data
export and deleted with their account.

## 6. Other items before inviting people

- Rotate every secret that was shared in chat (OpenRouter, Supabase service role and anon keys, Vercel
  token, Google client secret) and update Vercel.
- Top up OpenRouter and set a hard monthly spend limit there. Keep `AI_DAILY_CREDIT_CAP` modest.
- Confirm the Vercel plan allows your use (the free Hobby plan is for non-commercial use).
- Run the two migrations (`20261116000001` and `20261116000002`) if not yet applied.
