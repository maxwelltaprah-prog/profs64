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

The landing page (`app/page.tsx`) is a server component with two client islands: the prompt box and `components/landing/build-demo.tsx`, a replay of one real request (figures from a production run) that plays once on load and shows its final state immediately under `prefers-reduced-motion`. The page makes only claims the code keeps; the "ink" tokens in `globals.css` are the always-dark panel used to show the workspace. Motion lives in one place at the end of `globals.css`: a staggered hero entrance (`.rise`), scroll-in for later sections (`.reveal`, added only by `components/landing/reveal.tsx` after mount so nothing is hidden without script), hover lift and press feedback, and dialog entrance. Every step is within the 150-250ms budget (press feedback is 160ms); `prefers-reduced-motion` disables all of it, and the e2e accessibility audits run with reduced motion emulated so axe does not sample text mid-fade.

The home page leads with a prompt box (`components/landing/prompt-box.tsx`). Submitting it saves the text in `localStorage` (`lib/workspace/pending-prompt.ts`, 24-hour expiry) and either goes to `/start` or, when signed out, opens a native `<dialog>` with the sign-up and sign-in forms. Sign-up sends `next: "/start"` so the confirmation link lands there; sign-in redirects there directly. `/start` (`components/start/start-project.tsx`) creates a project named from the prompt's first line, records the project id alongside the prompt, and opens the workspace. The chat panel sends the prompt once, only when the stored project id matches the open project and the assistant can run; otherwise it is placed in the composer. Browser storage is the right place for this: it is a per-visitor convenience, nothing else reads it, and the server validates the text like any other message.

### Stop

The Stop button stops the local stream and calls `POST /api/projects/[id]/chat/stop` (auth, ownership by RLS, rate limit 60 per 10 minutes). That records a `chat_stop` audit event with the project id. The chat request reads the newest stop id before it starts and checks for a newer one every 1.5 s (`lib/ai/stop-watch.ts`, `lib/db/stop.ts`); when it sees one it aborts the model call, which settles billing through the existing abort path (tokens used so far, cut-off step estimated). A stop event from before a request started can never cancel it. No schema change.

### Chat actions, details and hiding the chat

- **Replies collapse to a preview.** A finished assistant reply shows its closing text, a one-line summary of the work (steps, files changed) and a Details toggle. Details reveals earlier narration, each step, buttons that open the changed files, the token and credit line, and View preview. The reply being generated is shown in full.
- **Per-reply actions.** Copy, Good reply, Bad reply, Share, and the credits used sit under each finished reply. Copy and Share use the clipboard and the share sheet (`navigator.share`, else clipboard); there are no public share links.
- **Credits per reply.** The chat route fixes the reply's id up front, settles billing, then stores a `data-usage` part (credits, input and output tokens) with the reply. `GET /api/projects/[id]/outputs` returns usage and the caller's rating for each reply. Replies created before this change have no usage and say so. `data-usage` parts are dropped when history is replayed to the model.
- **Ratings** are `message_feedback` audit events (project id, message id, up, down or none; the newest event wins), written by `PUT /api/projects/[id]/messages/[messageId]/feedback` after an RLS ownership check. No new table.
- **Attachments** are text files (3 per message, 100 KB each) saved by `POST /api/projects/[id]/files` under `attachments/` with a sanitised name, then referenced in the message as `Attached: name`. The model reads them as ordinary project files, which the system prompt labels untrusted.
- **Voice input** uses the browser's speech recognition (feature-detected; the button is absent where unsupported). The transcript is appended to the message box for editing; nothing is sent until the person sends.
- **Suggestions** are follow-up chips computed locally from the project's files and the turn count (`lib/workspace/suggestions.ts`); they are not model calls and cost no credits.
- **Hide chat.** The chat pane stays mounted while hidden, so a reply keeps streaming and billing settles as usual. The choice is kept per person and project in localStorage; a dot on Show chat means work is in progress.

### Sign-in pages and navigation

- `/login` and `/signup` share one layout: the form on the left, an illustrated product still (`components/auth/auth-showcase.tsx`, hidden from assistive tech and below the lg breakpoint) on the right. The layout stays mounted between the two pages, so only the form changes, with a short staggered entrance.
- The home-page prompt no longer hops through `/start`: after sign-in in the dialog (or straight away when already signed in) the browser creates the project (`lib/workspace/open-project.ts`) and opens the workspace, while the dialog shows "Opening your workspace". `/start` remains for the email-confirmation link and as the fallback that shows an error with a retry.
- Sign out answers the click at once (busy button, page dimmed) and leaves with a full navigation so nothing from the session stays in the client router cache. The logout audit row is written with `after()`, after the response.

### Home screen

`/dashboard` is the signed-in home: a left rail (`components/home/home-sidebar.tsx`: search, new project, home, account, recent projects, credits, theme, sign out; a top bar below md) and a page with a greeting, the same prompt box as the landing page (it creates the project and opens the workspace), recent projects as cards with relative times, and "Start from an idea" cards that fill the prompt. The rail only links to pages that exist. The header and the rail share commands and sign out through `useAppActions`.

### Done notifications

After the first message is sent, a dialog offers browser notifications once (`components/workspace/notify-prompt.tsx`). If allowed, a notification is shown when a reply finishes or fails, only while the tab is hidden, with fixed text that never contains the prompt or the reply (`lib/workspace/notify.ts`).

### Sign-in providers

Provider buttons come from Supabase's public `/auth/v1/settings` (`lib/db/auth-providers.ts`, cached 5 minutes, hidden on any failure). `OAUTH_PROVIDERS` is now optional and can only narrow that list.

### Code view

The Code tab (`components/workspace/code-workspace.tsx`) has a file search, a tree with file-type icons, open-file tabs, Copy and Download for the open file, and "Download codebase" (a zip built in the browser by `lib/workspace/zip.ts`, stored entries, names kept inside one folder). Highlighting is `prism-react-renderer` with token classes from `lib/workspace/code-language.ts`; colours are the `--code-*` tokens, contrast-tested in both themes.

### Motion in generated apps

New projects include framer-motion, sonner and tailwindcss-animate, with `MotionConfig reducedMotion="user"` and a `Toaster` in `App.tsx`, presets in `src/lib/motion.ts`, and accordion, fade-up and scale-in keyframes in the Tailwind theme. The preview cannot run Tailwind plugins (its config is sent by postMessage), so `lib/templates/animate-css.ts` supplies tailwindcss-animate's classes as plain CSS in `@layer utilities`, where variants still apply. The system prompt asks for hover, press and focus states, entrances, toasts, skeletons and reduced motion by default. Existing projects keep their own package.json; the assistant can add these packages to them.

### Chat agent

`/chat` is a general assistant alongside the builder: questions, writing, and PowerPoint, Word and PDF documents. Conversations, their messages and documents live in three tables (`supabase/migrations/20261109000001_conversations.sql`) with forced RLS; assistant replies and documents are written only by the server. `POST /api/conversations/[id]/chat` streams like the builder route (same billing, lease, stop and fixed error texts) with one tool, `create_document`, whose input is a bounded outline (`lib/documents/spec.ts`). The outline is stored, not a file; `GET /api/conversations/[id]/documents/[docId]` re-validates it and renders the file (`pptxgenjs`, `docx`, `pdf-lib`). Stored replies keep only a stub of the tool input so history stays small.

Free fallback: when a person's balance is below 1 credit or their daily cap is reached, the agent (not the builder) uses an OpenRouter free model for 24 hours from the first such message, then not again for 24 hours (`lib/agent/free-window.ts`, recorded as a `free_window_started` audit event). Free replies are never billed, are limited to 40 per person per day, and are marked "Free model" in the chat; the response header `x-buildr-mode` tells the browser.

## Live preview

The Preview tab runs the project in the browser without a build server.

1. `lib/preview/bundle.ts` walks the module graph from the `<script type="module">` in `index.html`. Each TS/TSX file is transpiled with sucrase (no type-checking, no evaluation, so it runs under the strict CSP) and its imports are rewritten with es-module-lexer: project files become `~/path` entries, `@/` resolves to `src/`, stylesheets are collected, JSON and SVG become modules, and bare package names map to pinned esm.sh URLs (`lib/preview/packages.ts`, versions from the starter template). `react-router-dom` is shimmed so `BrowserRouter` is the in-memory router inside the sandbox.
2. `components/workspace/preview-panel.tsx` rebuilds 400 ms after files change and reloads the frame only when the output differs. It shows a skeleton while loading, compile problems in place of the frame, and runtime errors and console output under it. Desktop, tablet and phone widths are offered.
3. `app/preview-frame/route.ts` serves a plain HTML document (no Next runtime) that the panel embeds with `sandbox="allow-scripts allow-forms allow-modals"`, so it has an opaque origin. `proxy.ts` gives that path its own policy (`lib/security/csp.ts`): inline scripts allowed for the import map, scripts and styles from esm.sh and the Tailwind CDN, network only to esm.sh, frameable by the app alone. The parent posts the bundle; the frame turns modules into blob URLs, writes an import map, injects the CSS through runtime Tailwind (`type="text/tailwindcss"`) with the starter's shadcn theme, and imports the entry. It accepts messages only from `window.parent` at the request's own origin.

The starter template (`lib/templates/vite-react-starter.ts`) follows Lovable's `vite_react_shadcn_ts` shape: Vite 5, React 18, Tailwind 3 with shadcn tokens (`lib/templates/shadcn-theme.ts`), react-router, lucide, and Button, Card, Input, Label and Badge in `src/components/ui`. Dependencies are exact pins so the previewed versions are the installed ones.

## Testing layers

| Layer       | Where               | What it proves                                                                                                |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Unit        | `tests/unit`        | Credit math, billing, tools, paths, schemas, routes (mocked storage), chat UI against the real stream format. |
| Integration | `tests/integration` | RLS, atomic deduction under concurrency, append-only ledger, migrations up and down.                          |
| End to end  | `e2e`               | Production build: CSP, headers, API abuse without a session, axe in light and dark.                           |

The model is always the deterministic fake (`lib/ai/fake-model.ts`) in tests.

- **Design-engineering rules.** The skills from `emilkowalski/skills` are installed in `.claude/skills/` (MIT, licence copied; the Swift and React Native skills were left out). Applied to the UI: strong custom curves (`--ease-out` cubic-bezier(0.23, 1, 0.32, 1), plus `--ease-in-out` and `--ease-drawer`); press feedback is `scale(0.97)` over 160ms on every pressable (`.press`, including header search, tabs and CTA links); hover motion is gated to `(hover: hover) and (pointer: fine)`; toasts use transitions with `@starting-style` and leave faster than they arrive instead of restarting keyframes; dialogs enter from `scale(0.96)`; the command palette opens with no animation because it is keyboard-initiated and used constantly; the file-tree chevron now actually animates; headings get `-0.02em` tracking and balanced wrapping. Phone baseline: no tap flash, 16px inputs on touch (no iOS focus zoom, zoom never disabled), `touch-action: manipulation`, no text selection on controls, `min-h-dvh` instead of `min-h-screen`, `viewport-fit=cover` and a `theme-color` per colour scheme. `tests/unit/design-tokens.test.ts` fails if `transition: all`, `ease-in` or `scale(0)` appear in the stylesheet, or the baseline is removed. The skills' own conflicts with CLAUDE.md were checked: the cheat sheets and animation rules fit it (150-250ms, no gradients); the libraries are not adopted (KI-31).
- **Chat panel.** The user's message is a right-aligned bubble; the assistant's reply is plain text with the role label "Buildr". `lib/workspace/message-text.ts` reads the formatting the model writes (paragraphs, lists, headings, fenced code, `**bold**`, `` `code` ``) into plain data and `components/workspace/message-text.tsx` renders it as React text nodes, so nothing from the model becomes HTML; links, images and raw HTML stay literal, and the parser uses no regular expressions over the input. Consecutive file steps are grouped into one list. While a reply is generating: new blocks and steps rise in (`.chat-in`, a `@starting-style` transition, only for content that arrives after the panel opened), the last text block carries a pulsing caret (`.stream-caret`), and three dots (`.thinking-dot`) show between sending and the first token and between tool calls. Under reduced motion the pulses stop and the entrance becomes a plain fade. A "Latest" button appears when the person scrolls up during a reply. Form controls keep a 3:1 visible border (`border-input`), not the faint card edge.
