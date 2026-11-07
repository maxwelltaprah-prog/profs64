#!/usr/bin/env bash
# Secret scan with gitleaks. Usage: scripts/secret-scan.sh [staged|repo]
set -euo pipefail

mode="${1:-repo}"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is not installed. Install it (https://github.com/gitleaks/gitleaks#installing)" >&2
  echo "or build it with: go install github.com/zricethezav/gitleaks/v8@latest" >&2
  exit 1
fi

case "$mode" in
  staged) exec gitleaks git --staged --config .gitleaks.toml --redact --no-banner ;;
  repo) exec gitleaks dir . --config .gitleaks.toml --redact --no-banner ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac
