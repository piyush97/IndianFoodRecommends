# Daily ingest timer

The pipeline runs from this machine because cliproxyapi listens on `localhost:8317`.

## Install

```bash
sudo systemctl link /root/Projects/IndianFoodRecommends/ops/ifr-ingest.service
sudo systemctl link /root/Projects/IndianFoodRecommends/ops/ifr-ingest.timer
sudo systemctl enable --now ifr-ingest.timer
```

## Check

```bash
systemctl list-timers ifr-ingest.timer
sudo systemctl start ifr-ingest.service   # run once now
journalctl -u ifr-ingest -n 100 --no-pager
```

## Notes

- `.env` must hold `DATABASE_URL` (Neon, the live DB), `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `TYPESAFE_API_KEY`.
- No YouTube API key: ingest reads the public channel feed.
- Enabled 2026-11-06. Each run: ingest new videos, then auto-review every pending pick with Jev
  (`lib/auto-review.ts`). No human queue; `/admin/review` only shows picks left pending when Jev was down.
- Every decision is stored in `recommendations.extracted.autoReview` (reason + Jev scores).
  Audit rejects: `select extracted->>'place_name', extracted->'autoReview'->>'reason' from recommendations where status='rejected';`
- Manual run: `pnpm worker ingest`.

# Nightly backups

`ops/backup.sh` dumps the production database (Neon, `DATABASE_URL_UNPOOLED` from `/etc/ifr/backup.env`, mode 600, that one line only) to
`/var/backups/ifr/ifr-<UTC time>.dump` (custom format, mode 600) and keeps the newest 14.
A failed dump exits non-zero and deletes nothing. Neon runs Postgres 18, so the PGDG
`postgresql-client-18` package is installed; the script picks the newest local `pg_dump`.

```bash
sudo systemctl link /root/Projects/IndianFoodRecommends/ops/ifr-backup.service
sudo systemctl link /root/Projects/IndianFoodRecommends/ops/ifr-backup.timer
sudo systemctl enable --now ifr-backup.timer      # daily 02:30 IST
bash ops/backup.test.sh                           # stubbed pg_dump, 3 cases
```

Restore into a scratch database:

```bash
/usr/lib/postgresql/18/bin/pg_restore --no-owner --dbname "$SCRATCH_URL" /var/backups/ifr/<file>.dump
```

## Failure alerts

`ifr-ingest`, `ifr-backup` and `ifr-restore-drill` set `OnFailure=ifr-alert@%n.service`. `ops/alert.sh` then
pushes to ntfy and keeps one open GitHub issue (label `ops-alert`) per failing unit; a repeat failure adds a comment.
Only the unit name leaves the machine.

```bash
sudo systemctl link /root/Projects/IndianFoodRecommends/ops/ifr-alert@.service
sudo install -m 600 /dev/stdin /etc/ifr/alert.env <<< $'ALERT_NTFY_TOPIC=ifr-<random>\nGH_REPO=piyush97/IndianFoodRecommends'
# subscribe to the topic in the ntfy app (https://ntfy.sh/<topic>)
systemd-run --unit ifr-failtest --wait --collect -p Type=oneshot \
  -p OnFailure=ifr-alert@ifr-failtest.service /bin/false   # end-to-end test
```

The nightly ingest also exits non-zero when an LLM pick has stayed `pending` over 48 h, so a stuck review alerts too.
`pnpm worker review` runs only the review step (no ingest), using yt-dlp for videos older than the feed window.

## Restore drill

`ops/restore-drill.sh` restores the newest dump into a scratch database `ifr_drill` (any server where
`DRILL_ADMIN_URL` can create databases; default is the local dev server), checks that creators, places and approved
picks are non-empty, and fails if the newest dump is older than 36 h. Monthly via `ifr-restore-drill.timer`
(1st, 04:00 IST).

```bash
sudo systemctl link /root/Projects/IndianFoodRecommends/ops/ifr-restore-drill.{service,timer}
sudo systemctl enable --now ifr-restore-drill.timer
sudo systemctl start ifr-restore-drill.service   # run now
```

## Merging

`ops/merge-pr.sh <pr-number>` waits for CI and merges only if it is green. Use it instead of `gh pr merge`: GitHub rejects branch protection on a private free repo, so nothing else stops a red merge.
