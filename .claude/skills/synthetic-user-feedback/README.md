# Synthetic User Feedback — Claude Code Skill

A Claude Code skill that simulates real user testing by having detailed personas browse your site or app, narrate their experience in real-time, and produce a structured synthesis report with friction points, conversion barriers, and actionable recommendations.

Works for any product or industry — you bring the personas.

## What This Does

Claude browses your URL as each persona would: skimming headlines, hunting for pricing, getting impatient with friction, Googling things your site didn't answer. After all personas explore, it produces a structured report with verdicts, pain points, and prioritized recommendations.

## Setup

### 1. Install the skill

Copy the skill folder into your project's `.claude/skills/` directory:

```bash
mkdir -p .claude/skills
cp -r synthetic-user-feedback .claude/skills/
```

### 2. Enable browser access (required)

**Option A — Playwright MCP** (add to `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-playwright"]
    }
  }
}
```

**Option B — Chrome Extension:**

```bash
claude --chrome
```

### 3. Run it

```
/synthetic-user-feedback https://yoursite.com purchase
```

If no personas are defined, Claude will ask you to describe them, point to a file, or let it draft proposals based on your product and market.

## Adding Your Own Personas

Copy `references/personas-template.md`, fill it in for your target customers, and save it as `references/[name]-personas.md` inside the skill folder. Future runs can load it by name.

Good personas include:

- Demographics and business context (role, company size, budget)
- Psychographics: what they value, fear, and trust
- Attention span and browsing behavior
- Specific questions they'd ask
- Red flags that would make them leave
- What would actually get them to convert

## Feedback Types

- **Usability** — clarity, navigation, task completion, cognitive load
- **Purchase / Message Resonance** — does the value prop land, pricing reaction, objections, would they buy
- **Inquiry Conversion** — mobile-first, ad landing pages, form friction, trust signals

## License

MIT
