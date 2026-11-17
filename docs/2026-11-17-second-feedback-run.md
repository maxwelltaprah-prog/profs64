# Synthetic User Feedback Report: second run

**Target:** https://profs64.vercel.app (Buildr, live production)
**Feedback type:** Usability and task completion, desktop (1280px) and phone (390px)
**Date:** 2026-11-17
**Compared with:** `docs/2026-11-16-beta-readiness.md` (first run)

**Read this first.** Four AI-simulated personas (`.claude/skills/synthetic-user-feedback/references/buildr-personas.md`),
drafted by the assistant, not real users and not reviewed by the owner. They drove the real site in a real Chromium
browser with a throwaway account. Unlike the first run, **AI generation worked**, so this run judges real output.
Each task was run once, so costs and timings are single samples. Not verified: the contents of the downloaded
.pptx (only that it downloaded: 200, about 84 KB, correct file type), a GitHub push with a real token, Google
sign-in, the confirmation email, dark theme, other browsers, real phones.

What changed since the first run, and was seen working: short project names ("Bean There", "Habit tracker"),
"Nothing built yet" instead of "My app / Live", the phone layout (one pane at a time, compact header), the
Project Settings dialog, and reply actions (copy, read aloud, like, dislike, regenerate, share).

---

### Priya, cafe owner (task: a website for her cafe)

**Verdict:** Would keep going.
**First impression:** 8/10 (was 7)

**Pain points:**

- She has no way to put the site on a web address. Domains says "Planned", and the GitHub route needs a token she
  would not know how to make.
- On a phone the chat stays on screen after the build, so she cannot tell the site is ready. (A dot on the Preview
  tab now shows this; checked in unit tests only, not re-run in a browser.)
- The page took about a minute and offered no estimate of how long.

**What worked:**

- One sentence produced a finished single-page site: hero, six-drink menu with prices, opening hours, footer, with
  motion. The project was named "Bean There" without her typing a name.
- The reply said what was built in plain words and showed what it cost (2.20 credits on desktop, 1.08 on the phone run).
- Follow-up chips ("Add a pricing section...") gave her a next step.

**Unanswered questions:** How do I publish this? Can I use my own domain? What does a change cost before I ask?

**Final word:**

> "It built my cafe page from one sentence, which I did not expect. Now how do I put it online so people can find it?"

---

### Marcus, product manager (task: judge it as a vendor)

**Verdict:** Needs more info.
**First impression:** 7/10 (was 6)

**Pain points:**

- Cost is hard to budget: one cafe page cost 1.08 to 2.20 credits, while a trivial counter page cost 6.85 and ended
  with "1 step did not finish" (fixed since: the last step now always writes a summary; the cost spread has not been
  measured again).
- GitHub push asks him to paste a personal access token. He would not hand a token to an unnamed company.
- No company name, contact or reviewed legal pages; no team or SSO.

**What worked:**

- Project Settings reads like a real product: owner, created date, launch path with honest statuses
  (Built / Private / Not pushed / Planned), and a delete step that needs a second click.
- The per-reply credit cost and the usage ledger.

**Unanswered questions:** Who runs this? Can several people share a project? Data location? What is the price for a team?

**Final word:**

> "The product is further along than I expected, but I cannot approve a tool whose cost per request swings that much, or one with no company behind it."

---

### Dana, freelance developer (task: judge the code and whether she can take it)

**Verdict:** Would try it on a small job.
**First impression:** 8/10 (was 7)

**Pain points:**

- Replies that end with "Let me verify the final file" instead of a summary (seen before the fix) made her doubt
  the work was complete.
- GitHub push needs a token; she would prefer "Connect GitHub" with OAuth, and the code has not been pushed with a
  real token yet.
- She cannot choose or see which model wrote the code.

**What worked:**

- Real Vite and React files with a "Download codebase" button; the shared preview link opened a working, read-only app.
- Regenerate worked end to end: the old reply was replaced only after the new one was saved, so a failure cannot
  leave her with nothing.
- Like and dislike persist after a reload, also in the full-page chat.

**Unanswered questions:** Which model? Can I bring my own key? Does regenerate undo the file changes the first
attempt made? (It does not; the files stay as they were.)

**Final word:**

> "The code is clean enough to hand to a client, once I can connect my own GitHub without pasting a token."

---

### Sam, operations analyst (task: a 4-slide PowerPoint on Q4 priorities)

**Verdict:** Completed the task (file not opened).
**First impression:** 7/10 (was 6)

**Pain points:**

- He could not see the deck before downloading it. He has to trust the card.
- No way to apply his company template.

**What worked:**

- One request produced a titled .pptx card with a Download button and a reply saying what each slide covers
  (one per priority, three bullets each, a goal line and speaker notes).
- Read aloud and regenerate sit under the reply, and regenerate on the document chat worked.

**Unanswered questions:** Can I edit the slides in the browser? Does it use my template? Is there a size or page limit?

**Final word:**

> "I asked for four slides and got a file. I will open it and see if the wording is usable before I tell anyone."

---

### Cross-persona insights

**All struggled with:** getting from a built app to something live. Everything up to the preview works; after that the
options are a public read-only link, a zip, or a token-based GitHub push.

**Divergent reactions:**

- Priya wants one button to publish. Marcus wants proof of who is behind it and predictable cost. Dana wants OAuth
  and model control. Sam wants a preview of the document before downloading.

**Other issues seen (lower priority):**

- Credit cost per request varies widely (1.08 to 6.85 in four samples), and nothing warns before sending.
- A new project's chat shows no prompt about what it will cost or how long it will take.
- Regenerate keeps files changed by the first attempt.

**Top 3 recommendations:**

1. **Make cost predictable.** Show a typical range before sending, cap steps per request (the last step is now a
   forced summary; measure whether the spread narrows), and say how long a build takes.
2. **Give builders a publish path that needs no token.** GitHub OAuth (or a GitHub App) first; one-click hosting
   after that. Until then, say plainly in the Domains section what the options are.
3. **Add the trust basics.** Company name, contact address, a lawyer-reviewed Terms and Privacy, and two or three
   example projects people can open.
