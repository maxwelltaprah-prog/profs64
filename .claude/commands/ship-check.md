---
description: Run all mechanical checks, then the security and code reviewers on the current diff, and summarize blockers
---

Run the ship check for the current diff.

1. Run `npm run ship-check`. It runs typecheck, lint, format check, unit tests, integration tests (when local Supabase is running), e2e tests, `npm audit --audit-level=high` and a gitleaks secret scan, and prints a summary. Steps that were skipped are reported as skipped; do not describe them as passing.
2. If any step failed, stop here, list the failures and fix them first.
3. Invoke the `security-reviewer` subagent on the current diff, then the `code-reviewer` subagent.
4. Summarize blockers as a table with columns: finding, severity, source (step or reviewer), status. Critical and high findings block the milestone. Medium and low findings are fixed or logged in `docs/KNOWN_ISSUES.md` with a rationale.
5. State plainly which checks passed, which failed and which could not be run.
