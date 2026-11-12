# Service level objectives

Numbers here are measured, not aspirational. Every figure names the command that
reproduces it, so a reviewer can rerun it instead of trusting this file.

Measured 2026-11-10 against a production build (`pnpm build && pnpm start`) with
the production database (Neon, `eu-central-1` region family). Local machine, so
no CDN, no edge caching, single Node process: these are pessimistic for Vercel
and honest for the app code.

## Why the numbers look the way they do

A trivial query against the production database takes **232 ms** (`select 1`,
below). That network round trip is the floor for every page, because every page
reads Postgres at least once. A page that issues four sequential queries cannot
beat ~900 ms no matter how good the SQL is. This is a database-latency problem
before it is a code problem.

## Objectives

| Objective                                      | Target           | Measured                                                            | Status               |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------------------- | -------------------- |
| Read page latency, p95 (single user)           | < 400 ms         | 269 ms home, 256 ms place, 254 ms dish, 709 ms city, 1362 ms search | City and search miss |
| Read page latency, p95 (10 concurrent readers) | < 800 ms         | 2.25 s                                                              | Miss                 |
| Error rate                                     | < 1% of requests | 0% of 1163 load-test requests                                       | Met                  |
| Search payload                                 | < 60 KB          | 39 KB                                                               | Met                  |
| Daily ingest completes                         | < 15 min         | average 8.5 min, worst 65 min                                       | Met on average       |
| Ingest runs that never finish                  | 0                | 2 stale `running` rows before the fix                               | Fixed, see below     |
| Migrations apply to an empty database          | exit 0           | exit 0, 17 migrations, 18 tables                                    | Met                  |
| Unsafe migrations reaching review              | 0                | `scripts/check-migrations.mjs` fails the PR                         | Met                  |

### Where the target is missed, and why

- **City page, 709 ms.** It is ~3 round trips: the city row, the picks, and the
  dish counts. Each trip is ~232 ms.
- **Search, 1.36 s.** Five sequential round trips plus the rate-limit check.
  Fixed in this sprint: the fuzzy branch used `similarity() >= 0.3`, which no
  trigram index can serve, so every search scanned all names. Switching to the
  `%` operator and adding `lower(name)` expression indexes took search from
  **1836 ms to 1357 ms** and **76 KB to 39 KB**. The remaining time is round
  trips, not query work.
- **p95 at 10 readers, 2.25 s.** One Node process renders every response; time to
  first byte stays flat (247 ms p95) while body streaming grows (2.0 s p95), so
  the CPU is saturated, not the database. A Vercel deployment scales across
  instances and does not share this ceiling; the local number is a floor.

The obvious next move is to reduce round trips per page, not to tune SQL.

## Reproducing

```bash
# Route latency (p50/p95 per route, 40 samples after 3 warmups)
BASE=http://localhost:3000 SAMPLES=40 node scripts/bench-latency.mjs

# Database round-trip floor
psql "$DATABASE_URL" -c '\timing on' -c 'select 1'

# Ingest duration history
psql "$DATABASE_URL" -c "select count(*), round(avg(extract(epoch from (finished_at-started_at)))) avg_s,
  round(max(extract(epoch from (finished_at-started_at)))) max_s
  from ingest_runs where status='ok' and finished_at is not null"

# Load test (see docs/perf/2026-11-10-load.md)
BASE=http://localhost:3000 k6 run ops/load.js

# Migration safety on a pull request
node scripts/check-migrations.mjs origin/main
```

## Operational fixes shipped with these numbers

- **Stale runs.** Two ingest runs were stuck `running` because a killed process
  cannot update its own row. `lib/worker/run-log.ts` closes any run still marked
  running after two hours, and `/admin/ops` shows the last 30 runs.
- **Duplicate migration.** `0013` recreated tables that `0011` and `0012` had
  already created, so `pnpm db:migrate` failed on every empty database, including
  CI and a first production deploy. It now contains only `rate_limits`.
- **Search index.** Trigram indexes were on `name`/`alias` while every query
  filtered on `lower(name)`, so no index could be used. `0014` adds the
  expression indexes the queries actually need.

## Tracing

`instrumentation.ts` registers OpenTelemetry (`@vercel/otel`). Two spans are
emitted where work is slow and external: `db.search` around the search query set
and `nominatim.search` around the geocoder call. Worker commands are recorded in
`worker_runs` and listed at `/admin/ops`.

## Deployed site, measured 2026-11-11

Lighthouse 13.6 (mobile emulation, simulated throttling) against the production
deployment on `indian-food-recommends.vercel.app`, after the growth features shipped:

| Page                      | Performance | Accessibility | Best practices | SEO | CLS | LCP   | TBT    |
| ------------------------- | ----------- | ------------- | -------------- | --- | --- | ----- | ------ |
| `/`                       | 91          | 100           | 96             | 100 | 0   | 1.0 s | 190 ms |
| `/delhi`                  | 94          | 100           | 96             | 91  | 0   | 2.7 s | 190 ms |
| `/list?p=<3 places>`      | 96          | 100           | 96             | 91  | 0   | 2.6 s | 110 ms |
| `/delhi/place/rpjs-shack` | 97          | 100           | 96             | 91  | 0   | 2.6 s | 30 ms  |

All pages meet the Lighthouse mobile >= 90 and CLS 0 targets in `PRODUCT.md`.

- **Best practices 96:** the only failing audit is a console error from loading
  `cloud.umami.is/script.js` in the test environment, which cannot reach Umami.
- **SEO 91:** the description `<meta>` streams after `<head>` for clients Next.js
  does not list as HTML-limited. Real crawlers on that list (Googlebot's renderer,
  Bingbot, WhatsApp, Facebook, Twitter, Slack) receive it in `<head>`; check with
  `curl -A WhatsApp/2 <url> | sed 's#</head>.*##' | grep description`.

```bash
# Needs Chromium; Playwright's copy works.
CHROME_PATH=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | tail -1) \
  npx lighthouse https://indian-food-recommends.vercel.app/delhi --quiet \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless=new --no-sandbox"
```

Data at the same time: 590 approved picks across 552 places, 36 active creators.

```bash
psql "$DATABASE_URL" -Atc "select count(*) from recommendations where status='approved'"
psql "$DATABASE_URL" -Atc "select count(*) from places p where exists
  (select 1 from recommendations r where r.place_id=p.id and r.status='approved')"
```

## Preview deployments are read-only

Vercel previews receive production's `DATABASE_URL` from the Neon integration.
`db/guard.ts` makes every preview session read-only
(`options=-c default_transaction_read_only=on`), so an admin action, report or
suggestion tried on a preview cannot change production rows: report and suggest
answer 503 with a message, and the search and geocode rate limit is skipped
instead of failing. Set `PREVIEW_DB_WRITES=1` on a preview that points at its
own Neon branch to allow writes there. Verified by `db/guard.test.ts` against a
real Postgres.
