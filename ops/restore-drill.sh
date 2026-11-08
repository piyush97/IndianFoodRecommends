#!/usr/bin/env bash
# Restores the newest dump into a throwaway database and sanity-checks the data.
# A backup that cannot be restored is not a backup: any failure exits non-zero,
# which fires the OnFailure alert. Needs a Postgres server where DRILL_ADMIN_URL can create databases.
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ifr}"
ADMIN_URL="${DRILL_ADMIN_URL:-postgres://ifr:ifr@localhost:5432/postgres}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-36}"
DB="ifr_drill"
PG_RESTORE="${PG_RESTORE:-$(ls -d /usr/lib/postgresql/*/bin/pg_restore 2>/dev/null | sort -V | tail -1)}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
DRILL_URL="${ADMIN_URL%/*}/$DB"

latest="$(ls -t "$BACKUP_DIR"/ifr-*.dump 2>/dev/null | head -1 || true)"
[ -n "$latest" ] || { echo "no dump in $BACKUP_DIR" >&2; exit 2; }
if [ -n "$(find "$latest" -mmin +$((MAX_AGE_HOURS * 60)))" ]; then
  echo "newest dump $latest is older than ${MAX_AGE_HOURS}h: backups stopped" >&2
  exit 3
fi

trap 'psql "$ADMIN_URL" -qc "drop database if exists $DB" >/dev/null 2>&1 || true' EXIT
psql "$ADMIN_URL" -qc "drop database if exists $DB" -c "create database $DB"
"$PG_RESTORE" --no-owner --no-privileges --exit-on-error --dbname "$DRILL_URL" "$latest"

read -r creators places approved < <(psql "$DRILL_URL" -Atc \
  "select (select count(*) from creators), (select count(*) from places), (select count(*) from recommendations where status = 'approved')" | tr '|' ' ')
echo "restored $(basename "$latest"): creators=$creators places=$places approved=$approved"
if [ "$creators" -lt 1 ] || [ "$places" -lt 1 ] || [ "$approved" -lt 1 ]; then
  echo "restore drill FAILED: restored data looks empty" >&2
  exit 4
fi
echo "restore drill ok"
