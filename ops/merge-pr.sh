#!/usr/bin/env bash
# Merge a PR only once every CI check is green.
# GitHub cannot enforce this for us: required checks need Pro or a public repo.
set -euo pipefail
pr=${1:?usage: ops/merge-pr.sh <pr-number>}
# `gh pr checks --watch` returns success when no check has registered yet (CI queue lag or an
# Actions outage), so wait until both CI jobs exist before trusting it.
for _ in $(seq 24); do
  names=$(gh pr checks "$pr" --json name --jq '.[].name' 2>/dev/null || true)
  grep -qx check <<<"$names" && grep -qx db <<<"$names" && break
  sleep 10
done
grep -qx check <<<"$names" && grep -qx db <<<"$names" ||
  { echo "CI jobs 'check' and 'db' never started on #$pr, not merging" >&2; exit 1; }
gh pr checks "$pr" --watch --fail-fast >/dev/null ||
  { echo "CI is not green on #$pr, not merging" >&2; exit 1; }
gh pr merge "$pr" --merge
