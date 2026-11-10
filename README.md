# Indian Food Recommends

Where Indian food vloggers say to eat, ranked by how many different creators
picked each place, with a link to the exact moment in the video.

Live pages: city, dish-in-city, place, creator, neighbourhood, food walk,
search, suggest-a-pick, about. Picks come from creator uploads, are verified
against the video, and are never bought or ranked by payment.

## How it works

```
creator channels ──► worker ingest ──► sources + recommendations (pending)
                          │                    │
                          │                    ▼
                          │            auto-review (LLM check
                          │            against the video text,
                          │            then code decides)
                          │                    │
                          ▼                    ▼
                    ingest_runs        places, dishes, aliases
                                               │
                                               ▼
                                      Next.js public pages
                                     (cached, no cookies)
```

- **Ingest** (`pnpm worker ingest`) reads each creator's channel, extracts picks
  with an LLM, and matches place and dish names against aliases.
- **Auto-review** verifies every pick against the video's own title and
  description. A pick that cannot be grounded is rejected, never published.
- **Public pages** read only approved picks, cached; a report or a new pick
  triggers revalidation.
- **Ops** (`/admin/ops`) shows the last 30 worker runs; `ingest_runs` keeps the
  full history.

## Local development

```bash
pnpm install
cp .env.example .env          # then fill the values below
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Two databases are needed locally: one for the app, one for tests. Tests skip
themselves cleanly when `DATABASE_URL_TEST` is unset.

```bash
createdb ifr_test && createdb ifr_e2e
DATABASE_URL_TEST=postgres://ifr:ifr@localhost:5432/ifr_test pnpm test
```

The database needs PostGIS and pg_trgm. `db/migrations/` creates both.

## Environment

| Variable                                   | Required   | What it is                                           |
| ------------------------------------------ | ---------- | ---------------------------------------------------- |
| `DATABASE_URL`                             | yes        | Postgres (PostGIS + pg_trgm)                         |
| `DATABASE_URL_TEST`                        | for tests  | Separate database; integration tests skip without it |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | for ingest | Pick extraction                                      |
| `TYPESAFE_API_KEY`                         | for ingest | Video screening and pick verification                |
| `REPORT_SALT`                              | yes        | Salt for hashing reporter addresses                  |
| `AUTH_SECRET`, `AUTH_TRUST_HOST`           | for admin  | Admin sign-in                                        |
| `ADMIN_EMAILS`                             | for admin  | Who may open `/admin`                                |
| `REVALIDATE_SECRET`                        | yes        | Worker → site cache revalidation                     |
| `SITE_URL`                                 | yes        | Canonical origin                                     |
| `YTDLP_BIN`                                | optional   | Fallback when YouTube's RSS feed is down             |

## Worker commands

```bash
pnpm worker ingest      # pull new uploads, extract, auto-review
pnpm worker review      # auto-review picks still pending
pnpm worker geo         # geocode places without a pin
pnpm worker areas       # import OSM neighbourhood boundaries
pnpm worker diet        # classify dish veg / non-veg
pnpm worker eval        # precision/recall against a labelled set
```

Deep backfill of a channel's history (past the RSS feed's latest 15):

```bash
YTDLP_BIN=~/.local/bin/yt-dlp pnpm tsx worker/backfill.ts 60 [creator-slug...]
```

Every command writes a row to `worker_runs`. A run still marked running after two
hours is closed as failed, so a killed process never looks alive.

## Testing

```bash
pnpm lint && pnpm typecheck
pnpm test                       # unit + integration (needs DATABASE_URL_TEST)
pnpm e2e:seed && pnpm e2e       # browser tests, including axe accessibility
```

The browser suite checks accessibility with axe on ten pages and asserts no
horizontal overflow at 360 px.

## Operations

- **SLOs and measured baselines:** [`docs/slo.md`](docs/slo.md)
- **Load test and result:** [`docs/perf/2026-11-10-load.md`](docs/perf/2026-11-10-load.md), run with `BASE=… k6 run ops/load.js`
- **Migration safety:** `node scripts/check-migrations.mjs origin/main` fails a PR
  that adds a blocking index, rewrites a column type, adds a `NOT NULL` column
  without a default, or drops a column. CI runs it on every pull request.
- **Tracing:** OpenTelemetry via `@vercel/otel`; `db.search` and
  `nominatim.search` spans, plus `onRequestError` JSON logs.
- **Rate limiting:** Postgres token bucket (`lib/rate-limit.ts`) on geocode and
  search, so the limit survives cold starts and applies across instances.
- **Not yet wired:** the Neon branch-per-PR step needs `NEON_API_KEY`. Today the
  migration check runs against the CI Postgres service, which still proves the
  migrations apply to an empty database and that unsafe statements fail.

## Deployment

Deploys run on Vercel. Migrations are applied before the build:

```bash
DATABASE_URL=… pnpm db:migrate
vercel deploy --prod
```

Migrations must run against an empty database without error; CI proves that on
every pull request.

## Case study

[`docs/case-study.md`](docs/case-study.md) covers what was built, what was
measured, and what is still open.
