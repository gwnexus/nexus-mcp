#!/usr/bin/env bash
# scripts/check-gitleaks-config.sh — Regression check for .gitleaks.toml
#
# Runs gitleaks with the repo config against a fixture holding a synthetic
# GitHub PAT and expects exactly one finding. Guards against a config that
# silently drops the built-in ruleset (missing [extend] useDefault = true).
# The token is assembled at runtime so no fixture with a secret pattern is
# ever committed.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir "$TMP/src"
printf 'token = "%s%s"\n' 'ghp_' 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dF3gH5' > "$TMP/src/fixture.txt"

gitleaks detect --no-git --no-banner --redact --exit-code 0 \
  --config "$ROOT/.gitleaks.toml" --source "$TMP/src" \
  --report-format json --report-path "$TMP/report.json"

COUNT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).length)' "$TMP/report.json")"

if [ "$COUNT" -ne 1 ]; then
  echo "!! gitleaks config check failed: expected 1 finding for the synthetic GitHub PAT, got $COUNT"
  exit 1
fi
echo "gitleaks config check passed (1 finding)."
