---
name: synthetic-user-feedback
description: Simulate realistic user feedback by having detailed personas browse a website or app, providing running commentary and a structured synthesis report. Use when the user wants to test a URL or product flow for usability or purchase/conversion resonance through the eyes of target customer personas. Triggers on: user testing, synthetic feedback, persona testing, usability review, conversion analysis, user research simulation, "what would my users think", "test this page", "simulate user feedback".
---

# Synthetic User Feedback

Simulate real user testing by having 2–4 personas explore a site or app with running commentary, then produce a structured synthesis report.

## Invocation

Just describe what you want in plain language — no special syntax required. Include a URL and any context about what to test or accomplish.

**Examples:**

- `/synthetic-user-feedback https://example.com — does this convert?`
- `/synthetic-user-feedback check the signup flow for friction`
- `/synthetic-user-feedback https://app.example.com — have them try to send a message to a contact`
- `/synthetic-user-feedback https://app.example.com — have them find and upgrade their plan, start on the dashboard`
- `/synthetic-user-feedback https://competitor.com/pricing — how does this land vs ours?`

**Inferring intent:** Parse the invocation for:

- A URL or app context (where to start)
- A specific task to complete (e.g., "send a message", "find the export button") → **task completion mode**
- A general vibe check with no specific task → ask: "Usability feedback or purchase/message resonance?"

## Step 1: Persona Setup

**Before doing anything else**, determine which personas to use:

1. If the user pasted persona definitions in their message → use those
2. If a `references/[name]-personas.md` file exists in the skill directory → offer to use it
3. **If no personas found** → ask:

   > "No personas are defined yet. I need 2–4 target customer personas to run this simulation. You can:
   >
   > - **Describe them now** — give me their role, budget, key concerns, and what would make them convert (or bounce)
   > - **Point me to a file** — if you have personas documented somewhere in the project, share the path
   > - **Let me draft them** — tell me your product and target market and I'll propose personas for your approval before starting"

   Wait for the user's response before proceeding.

**Adding reusable personas:** Copy `references/personas-template.md`, fill it in for your industry, and save it as `references/[name]-personas.md`. Future runs can reference it by name.

## Step 2: Requirements Check

Browser access is required. Check in this order:

1. **Chrome Extension** — preferred; active if session was started with `claude --chrome`
2. **Playwright MCP** — fallback if Chrome extension is not available

If neither is available, stop and ask the user to enable one.

**For mobile-focused personas**: set viewport to 390x844 before navigating.

## Step 3: Clarify Scope (if needed)

- If a specific task was inferred from the invocation, personas are in **task completion mode** — each persona tries to accomplish that action and narrates friction, confusion, and dead-ends along the way. Skip the feedback type question.
- If no task and no feedback type specified, ask: "Usability feedback or purchase/message resonance?"
- Confirm the starting URL or app context

## Step 4: Exploration Phase

For each persona, navigate the site while providing **running commentary** in character:

```
**[PERSONA NAME - 2:34 PM]** Landing on homepage...

First thought: "What is this exactly?" Headline says [X] — at least I know the category.

*scrolling*

"[Marketing claim]" — everyone says that. Show me proof.

*clicking on pricing*

$299/month... [reaction based on persona's budget/priorities]
```

**Behavioral realism rules:**

- Skim, don't read every word. Miss things that aren't obvious.
- Get impatient with friction. Make snap judgments.
- When a persona hits an unanswered question, simulate what they'd actually do:
  - Google "[product] pricing", "[product] reviews", "[product] vs [competitor]"
  - Check G2, Capterra, TripAdvisor, Reddit
  - Actually perform these searches — don't just narrate
- Stay in character. Each persona has different vocabulary, patience, and priorities.
- Spend 2–4 minutes per persona (realistic attention span)

## Step 5: Synthesis Report

After all personas explore, output:

```markdown
## Synthetic User Feedback Report

**Target:** [URL/App]
**Feedback Type:** [Usability / Purchase Resonance / Inquiry Conversion]
**Date:** [Date]

---

### [Persona Name]

**Verdict:** [Would buy / Would not buy / Needs more info] or [Completed task / Failed task / Gave up at X step]
**First Impression:** X/10

**Pain Points:**

- [point]

**What Worked:**

- [positive]

**Unanswered Questions:**

- [question]

**Final Word:**

> "[In-character quote]"

---

[Repeat for each persona]

---

### Cross-Persona Insights

**All struggled with:**

- [shared issue]

**Divergent reactions:**

- [Persona A]: X vs [Persona B]: Y

**Top 3 Recommendations:**

1. [Actionable recommendation with rationale]
2. [Actionable recommendation with rationale]
3. [Actionable recommendation with rationale]
```

## Feedback Type Reference

**Usability** — clarity, navigation, IA, task completion, mobile experience, cognitive load

**Purchase / Message Resonance** — value prop clarity, pricing acceptance, objections, unanswered questions, would they take the next step

**Inquiry Conversion** (mobile-first, ad landing pages) — ad-to-page expectation match, form friction, trust signals, what's missing before they'd submit

## Step 6: Save Results

After outputting the report, save it to a file:

1. **Where:** Check if a `docs/` folder exists at the project root — if so, save there. Otherwise create `user-research/` and save there.
2. **Filename:** `YYYY-MM-DD-[2-3 word description].md` — derive the description from the task or URL, keep it short and human-readable.
   - Good: `2026-03-02-send-message.md`, `2026-03-02-pricing-page.md`, `2026-03-02-signup-flow.md`
   - Bad: `2026-03-02-https-app-example-com-task-send-a-message-to-a-contact.md`
3. Save the full report as-is, then tell the user: `Saved to [path]`

## Adding Your Own Personas

See `references/personas-template.md` for the format. Good personas include:

- Demographics and business context (size, budget, role)
- Psychographics: what they value, fear, and trust
- Attention span and browsing behavior
- Specific questions they'd ask
- Red flags that would make them leave
- What would actually get them to convert
