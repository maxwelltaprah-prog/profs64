# Synthetic User Feedback Report

**Target:** https://profs64.vercel.app (Buildr, live production)
**Feedback type:** Usability and purchase resonance, task completion mode
**Date:** 2026-11-16
**Method:** Four personas (`.claude/skills/synthetic-user-feedback/references/buildr-personas.md`) explored the live
site in a real Chromium browser, on desktop (1280px) and phone (390px), signed out and signed in with a throwaway
account. Each task was run for real: build a cafe site, open the code, share, chat for a deck, pricing,
integrations, usage.

**Read this first.** This is a simulation run by an AI, not research with people. The personas were drafted by the
assistant, not by you. The assistant could not make anything: **every attempt to build or chat failed with "AI
provider limit was reached"** (see Priya). So the personas are judging the product around the AI, not the quality
of what it makes. Not tested: Google sign-in, the confirmation email, dark theme, real payments, other browsers.

---

### Priya, cafe owner (task: a website for her cafe)

**Verdict:** Gave up at the first step (the build did not run).
**First impression:** 7/10

**Pain points:**

- She typed her cafe description and got "The assistant is unavailable right now because Buildr's AI provider limit
  was reached." Nothing was built. A first-time, non-technical user would take that as the product being broken.
- The project was named after her whole sentence ("A website for my cafe called Bean There..."), which is cut off
  in the sidebar and on the card.
- The preview shows a generic "My app" page with a green "Live" label, though nothing has been built.
- On a phone the project screen is hard to use (see Cross-persona).
- The landing page says "Get started" and "20 free credits", but sign-up will be invite-only.

**What worked:**

- The headline and the four example chips (coffee shop first) told her at once what this is for.
- The home screen, templates and "Your library" are plain and calm.
- The error was honest and said she was not charged.

**Unanswered questions:** Can I get my own web address? Where do I see the finished site? What will this cost me for
one website? (The pricing says "Buying more credits is not available yet.")

**Final word:**

> "I typed what I wanted and it told me the provider was out of something. I don't know what a provider is. I'll ask my nephew."

---

### Marcus, product manager (task: judge it as a vendor for an internal tool)

**Verdict:** Needs more info.
**First impression:** 6/10

**Pain points:**

- Every integration is marked "Planned". His list (GitHub, deploy) is not there yet.
- Credits cannot be bought, and the pricing page has no checkout, no team plan and no company name.
- Privacy and Terms carry a "Beta draft, awaiting legal review" notice and no company or contact. He will not put
  company data in on that basis.
- No customers, quotes or examples of finished work, only a replay of one request.
- The generate button failed, so he could not judge output at all.

**What worked:**

- The Security section is specific (row-level security, no shell or network tools, spending caps, data export).
- The privacy notice now names every service that sees data, and says free models may keep prompts.
- Usage page and per-request cost ledger: "see every charge" is a real strength against credit-based rivals.

**Unanswered questions:** Who runs this? Can a team share projects? Is there SSO? Where is the data stored (region)?
How does it compare with Lovable? (A web search for competitor pricing only returned article titles, no verified
numbers, so no price comparison is made here.)

**Final word:**

> "Good security story, but it is a prototype with a notice saying so. Come back when I can export to GitHub and there is a name behind it."

---

### Dana, freelance developer (task: judge the code and whether she can take it)

**Verdict:** Needs more info.
**First impression:** 7/10

**Pain points:**

- She could not see what the model writes, because generation failed. She opened the starter instead.
- The sharing dialog only offers "Create a public link". No password or expiry.
- No GitHub push or deploy. She has to download a zip and do it herself.
- She cannot tell which model she is getting, or what happens when credits run out, from the project screen.

**What worked:**

- The code view shows a real Vite and React project (shadcn-style components, Tailwind, a README), with a search box
  and a "Download codebase" button. That is what she wanted to see.
- "Pay for tokens" with a visible ledger instead of opaque credits.
- The hover and open animations are smooth enough that the app does not feel cheap.

**Unanswered questions:** Which model? Does it follow my edits or rewrite files? Can it run tests? Can I bring my own
API key?

**Final word:**

> "The starter is clean and I can download it. Show me one generated project that is not a toy and I'll try it on a client job."

---

### Sam, operations analyst (task: a 4-slide PowerPoint on Q4 priorities)

**Verdict:** Failed task (no deck produced).
**First impression:** 6/10

**Pain points:**

- Same provider error after about a minute of waiting. No file, and no suggestion of what to do next.
- The error appeared after a delay, with nothing to say it was still working.

**What worked:**

- "New chat" says plainly that it can make a PowerPoint, Word document or PDF, and has one-click starters
  ("Make a slide deck", "Draft a Word report").
- The chat page is simple and keyboard friendly (Enter to send).

**Unanswered questions:** Will my deck follow my company template? Is there a page limit? Is it free?

**Final word:**

> "It offered exactly what I asked for and then could not do it. I'll use the old template."

---

### Cross-persona insights

**All struggled with:**

- **The core action fails.** Both builder and chat return the provider-limit error on every try. Right now no tester
  would see a single result. This overrides everything else in this report.
- No result to look at, so no persona could say whether the product is good.

**Divergent reactions:**

- Priya wants simplicity and a finished site she can publish. Marcus wants proof (company, legal, customers).
  Dana wants code ownership and export. Sam wants a file in one request.
- The "pay for tokens, see every charge" message pulls Marcus and Dana in and means little to Priya.

**Other issues seen (lower priority):**

- **Phone project screen:** the top bar collides (credits pill covers the name and Share), the chat input sits in the
  middle of the page, and the Code/Preview tabs are below it. Hard to use on a phone.
- **Landing page:** the strip of chips under the hero is clipped hard at both edges; on a phone the send arrow wraps
  onto its own row; the landing says "Get started" but sign-up is invite-only.
- **First-run prompts:** a notifications permission prompt appears in the project view.

**Top 3 recommendations:**

1. **Make the AI work before anyone is invited.** Top up OpenRouter and set a hard monthly limit. Also change the
   product: when the paid model is unavailable, fall back to a free model (as chat already does when credits run out)
   or show a clear "AI is paused, we are on it" banner before the person types, and do not create a project for a
   message that could not run. A test build should be a pre-launch check.
2. **Make the first result visible and the first screen trustworthy.** Name projects from a short title, not the
   whole prompt; show a real "nothing built yet" state instead of "My app / Live"; swap "Get started" for "Request
   access" while sign-up is invite-only. Add a company name, contact address and finished example projects (a real
   build someone can open) to the site, and finish the legal review.
3. **Fix the phone workspace and give builders an exit.** Redo the mobile project layout (top bar, chat/preview
   order). Then add the first real integration: GitHub push, which both Marcus and Dana asked for.
