#!/usr/bin/env bash
# Tests ops/backup.sh with a stub pg_dump. Run: bash ops/backup.test.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*"; exit 1; }

mkdir -p "$tmp/bin" "$tmp/backups"
for i in $(seq -w 1 16); do
  touch -d "2026-10-${i} 00:00" "$tmp/backups/ifr-202610${i}T000000Z.dump"
done

# 1. Successful dump: new file written, only newest 14 kept.
cat > "$tmp/bin/pg_dump" <<'EOF'
#!/usr/bin/env bash
echo "fake dump of $*"
EOF
chmod +x "$tmp/bin/pg_dump"
PG_DUMP="$tmp/bin/pg_dump" PATH="$tmp/bin:$PATH" BACKUP_DIR="$tmp/backups" DATABASE_URL="postgres://x" bash "$here/backup.sh"
count=$(find "$tmp/backups" -name 'ifr-*.dump' | wc -l)
[ "$count" -eq 14 ] || fail "expected 14 dumps, got $count"
newest=$(ls -t "$tmp/backups" | head -1)
grep -q "fake dump" "$tmp/backups/$newest" || fail "newest file is not the new dump"
[ "$(stat -c %a "$tmp/backups/$newest")" = "600" ] || fail "dump is not mode 600"
[ ! -e "$tmp/backups/ifr-20261001T000000Z.dump" ] || fail "oldest dump not pruned"

# 1b. Password never appears in pg_dump's argv (visible in ps); it goes via PGPASSWORD.
cat > "$tmp/bin/pg_dump" <<'EOF'
#!/usr/bin/env bash
echo "ARGS:$*" > "$ARGS_FILE"
echo "PW:${PGPASSWORD:-}" >> "$ARGS_FILE"
echo dump
EOF
chmod +x "$tmp/bin/pg_dump"
ARGS_FILE="$tmp/args" PG_DUMP="$tmp/bin/pg_dump" BACKUP_DIR="$tmp/backups" \
  DATABASE_URL='postgresql://neondb_owner:s3cr%40t@ep-x.neon.tech/neondb?sslmode=require' \
  bash "$here/backup.sh" >/dev/null
grep -q "s3cr" <(grep '^ARGS:' "$tmp/args") && fail "password leaked into pg_dump argv"
grep -q '^PW:s3cr@t$' "$tmp/args" || fail "PGPASSWORD not set from URL (decoded)"
grep -q 'ep-x.neon.tech' "$tmp/args" || fail "host missing from connection string"
grep -q 'neondb_owner@' "$tmp/args" || fail "user missing from connection string"

# 2. Failing dump: non-zero exit, nothing deleted, no partial file left.
before=$(ls "$tmp/backups" | sort)
printf '#!/usr/bin/env bash\necho boom >&2\nexit 3\n' > "$tmp/bin/pg_dump"
if PG_DUMP="$tmp/bin/pg_dump" PATH="$tmp/bin:$PATH" BACKUP_DIR="$tmp/backups" DATABASE_URL="postgres://x" bash "$here/backup.sh" 2>/dev/null; then
  fail "expected failure exit"
fi
after=$(ls "$tmp/backups" | sort)
[ "$before" = "$after" ] || fail "failed run changed the backup set"

# 3. Missing DATABASE_URL: refuses.
if BACKUP_DIR="$tmp/backups" env -u DATABASE_URL -u DATABASE_URL_UNPOOLED bash "$here/backup.sh" 2>/dev/null; then
  fail "expected refusal without DATABASE_URL"
fi

echo "PASS backup.sh (4 cases)"
