#!/usr/bin/env bash
# Nightly logical backup of the production database (Neon) to this machine.
# Keeps the newest $KEEP dumps. A failed dump never deletes older ones.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ifr}"
KEEP="${KEEP:-14}"
# Unpooled endpoint when available: pg_dump needs a session, not a pooler.
URL="${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}"

if [ -z "$URL" ]; then
  echo "backup: DATABASE_URL is not set" >&2
  exit 2
fi

# Neon runs Postgres 18; pg_dump must be the same major or newer.
PG_DUMP="${PG_DUMP:-$(ls -d /usr/lib/postgresql/*/bin/pg_dump 2>/dev/null | sort -V | tail -1)}"
PG_DUMP="${PG_DUMP:-pg_dump}"

umask 077
mkdir -p "$BACKUP_DIR"
target="$BACKUP_DIR/ifr-$(date -u +%Y%m%dT%H%M%SZ).dump"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

# Keep the password out of argv (readable by any local user via ps): strip it
# from the URL in pure bash and pass it through PGPASSWORD instead.
scheme="${URL%%://*}"
rest="${URL#*://}"
userinfo=""
if [[ "$rest" == *@* ]]; then
  userinfo="${rest%%@*}"
  rest="${rest#*@}"
fi
user="${userinfo%%:*}"
password=""
[[ "$userinfo" == *:* ]] && password="${userinfo#*:}"
printf -v password '%b' "${password//%/\\x}" # percent-decode
safe_url="${scheme}://${user:+${user}@}${rest}"

PGPASSWORD="$password" "$PG_DUMP" --format=custom --no-owner --no-privileges "$safe_url" > "$partial"
mv "$partial" "$target"
chmod 600 "$target"

# Prune only after a successful dump.
ls -1t "$BACKUP_DIR"/ifr-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "backup: wrote $target ($(stat -c %s "$target") bytes)"
