#!/usr/bin/env bash
# Merge a PR only once every CI check is green.
# GitHub cannot enforce this for us: required checks need Pro or a public repo.
set -euo pipefail
pr=${1:?usage: ops/merge-pr.sh <pr-number>}
gh pr checks "$pr" --watch --fail-fast >/dev/null ||
  { echo "CI is not green on #$pr, not merging" >&2; exit 1; }
gh pr merge "$pr" --merge
