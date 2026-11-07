#!/usr/bin/env bash
# Mechanical half of /ship-check. The reviewer subagents are invoked by the
# /ship-check slash command after this passes (see .claude/commands/ship-check.md).
# Every step runs even if an earlier one fails, so the summary is complete.
set -uo pipefail

declare -a names=()
declare -a results=()
failed=0

run_step() {
  local name="$1"; shift
  echo ""
  echo "=== ${name} ==="
  if "$@"; then
    names+=("$name"); results+=("pass")
  else
    names+=("$name"); results+=("FAIL")
    failed=1
  fi
}

skip_step() {
  names+=("$1"); results+=("skipped ($2)")
}

run_step "typecheck" npm run --silent typecheck
run_step "lint" npm run --silent lint
run_step "format check" npm run --silent format:check
run_step "unit tests" npm run --silent test

if ls tests/integration/*.test.ts >/dev/null 2>&1; then
  # Uses TEST_DATABASE_URL when set (CI), otherwise starts a throwaway local Postgres with a
  # Supabase shim. Fails loudly if neither is possible instead of skipping.
  run_step "integration tests" npm run --silent test:integration
else
  skip_step "integration tests" "none written yet"
fi

if ls e2e/*.spec.ts >/dev/null 2>&1; then
  run_step "e2e tests" npm run --silent test:e2e
else
  skip_step "e2e tests" "none written yet"
fi

run_step "dependency audit" npm run --silent audit:deps
run_step "secret scan" scripts/secret-scan.sh repo

echo ""
echo "=== ship-check summary ==="
for i in "${!names[@]}"; do
  printf '%-22s %s\n' "${names[$i]}" "${results[$i]}"
done

if [ "$failed" -ne 0 ]; then
  echo ""
  echo "Blockers found. Fix the failing steps before running the reviewers."
  exit 1
fi
echo ""
echo "Mechanical checks passed. Run the security-reviewer and code-reviewer on the diff next."
