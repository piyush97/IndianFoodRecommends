#!/usr/bin/env bash
# Called by ifr-alert@.service when a unit fails: ./alert.sh ifr-ingest.service
# Sends a push via ntfy (ALERT_NTFY_TOPIC) and keeps one open GitHub issue per unit (GH_REPO).
# Only the unit name is sent out; read the details with journalctl on this machine.
set -uo pipefail
unit="${1:?usage: alert.sh <unit>}"
msg="$unit failed at $(date -u +%FT%TZ). Run: journalctl -u ${unit%.service} -n 100 --no-pager"
echo "ALERT: $msg" >&2

if [ -n "${ALERT_NTFY_TOPIC:-}" ]; then
  curl -fsS -m 15 -H "Title: IndianFoodRecommends: $unit failed" -H "Priority: high" \
    -d "$msg" "https://ntfy.sh/$ALERT_NTFY_TOPIC" >/dev/null || echo "ntfy post failed" >&2
fi

if [ -n "${GH_REPO:-}" ] && command -v gh >/dev/null; then
  title="ops: $unit failed"
  open="$(gh issue list --repo "$GH_REPO" --label ops-alert --state open --search "\"$title\" in:title" \
    --json number --jq '.[0].number // empty' 2>/dev/null)"
  if [ -n "$open" ]; then
    gh issue comment "$open" --repo "$GH_REPO" --body "Failed again at $(date -u +%FT%TZ)." >/dev/null
  else
    gh issue create --repo "$GH_REPO" --label ops-alert --title "$title" \
      --body "$msg

Close this issue once the unit runs clean." >/dev/null
  fi
fi
