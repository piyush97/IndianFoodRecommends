# Indian Food Recommends

Where Indian food vloggers say to eat, ranked by how many different creators picked each place,
with a link to the exact moment in the video.

**Live site:** https://indian-food-recommends.vercel.app

Every listing shows the creator, the dish, the timestamp and a link to the source video. Ranking
is the count of distinct creators who recommended the place, never payment or anonymous star
ratings. Picks are pulled from creator uploads, checked against the video before publishing, and
a creator can opt out.

## What is built

- **Public:** home, city, dish-in-city, place, creator, neighbourhood, food walk, search
  (typo-tolerant, Hindi transliteration aware), shareable eat list, suggest-a-pick, about.
- **Ranking:** `distinct_creators × 10 + recency bonus`, with documented tie-breaks. The rule is
  published on the about page.
- **Ingest worker:** channel feed plus a yt-dlp archive fallback, LLM extraction, verifier check,
  geocoding, deduplication, and a daily run recorded in `worker_runs`.
- **Admin:** review queue, stale places, visitor reports, duplicate dishes and places, search
  misses, and the last 30 worker runs.
- **Operations:** systemd timers, nightly backups with a monthly restore drill, failure alerting,
  migration safety checks in CI, OpenTelemetry spans, a Postgres rate limiter.

## How a pick gets published

```mermaid
flowchart LR
  A[Creator upload] --> B[Extract picks<br/>LLM]
  B --> C{Video text<br/>supports it?}
  C -- yes --> D[Match place + dish]
  D --> E[Publish<br/>approved]
  C -- no --> F[Rejected<br/>reason recorded]
  C -- text unavailable --> G[no-video-text<br/>retryable, never published]
  E --> H[Public pages<br/>revalidated]
```

Full diagrams, data model and failure behaviour: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Decisions and their trade-offs: [`docs/adr/`](docs/adr/).

## Local development

```bash
pnpm install
cp .env.example .env          # then fill the required values
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Two databases are needed locally: one for the app, one for tests. Tests skip cleanly when
`DATABASE_URL_TEST` is unset.

```bash
createdb ifr_test
DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/ifr_test pnpm test
```

The database needs PostGIS and pg_trgm; `db/migrations/` creates both. Easiest local option is
`postgis/postgis:17-3.5`.

## Environment

| Variable                                   | Required   | What it is                                              |
| ------------------------------------------ | ---------- | ------------------------------------------------------- |
| `DATABASE_URL`                             | yes        | Postgres (PostGIS + pg_trgm)                            |
| `DATABASE_URL_TEST`                        | for tests  | Separate database; integration tests skip without it    |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | for ingest | Any OpenAI-compatible endpoint for pick extraction      |
| `TYPESAFE_API_KEY`                         | for ingest | Verifier that checks a pick against its video           |
| `REPORT_SALT`                              | yes        | Salt for hashing reporter addresses                     |
| `AUTH_SECRET`, `AUTH_TRUST_HOST`           | for admin  | Admin sign-in                                           |
| `ADMIN_EMAILS`                             | for admin  | Who may open `/admin`                                   |
| `REVALIDATE_SECRET`                        | yes        | Worker to site cache revalidation                       |
| `SITE_URL`                                 | for ingest | Worker-to-site cache revalidation origin                |
| `NEXT_PUBLIC_SITE_URL`                     | yes        | Canonical origin for share links, OG images and sitemap |
| `NOMINATIM_USER_AGENT`                     | optional   | Contact string sent to OpenStreetMap Nominatim          |
| `NEXT_PUBLIC_OPTOUT_EMAIL`                 | optional   | Creator opt-out contact; unset shows "coming soon"      |
| `YTDLP_BIN`                                | optional   | Archive access past the feed window                     |

`GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID` are optional; without them the rating
line and analytics are simply absent.

## Worker commands

```bash
pnpm worker ingest            # pull new uploads, extract, auto-review
pnpm worker review            # decide picks still pending
pnpm worker retry-unchecked   # re-check picks rejected for lack of video text
pnpm worker dedupe-places     # list one shop saved twice; --apply merges
pnpm worker geo               # geocode places without a pin, refresh walks and heatmap
pnpm worker areas             # rebuild the neighbourhood list from localities
pnpm worker diet              # label dishes veg / non-veg
pnpm worker eval              # precision/recall against a labelled set
```

Deep backfill of a channel's history (past the feed's latest 15):

```bash
YTDLP_BIN=~/.local/bin/yt-dlp pnpm tsx worker/backfill.ts 200 [creator-slug...]
```

Every command writes a row to `worker_runs`. A run still marked running after two hours is closed
as failed, so a killed process never looks alive.

## Testing

```bash
pnpm lint && pnpm typecheck
pnpm test                     # unit + integration (needs DATABASE_URL_TEST)
pnpm e2e:seed && pnpm e2e     # browser tests, including axe accessibility
```

## Deploying

Deploys run on Vercel. Migrations are applied before the build:

```bash
DATABASE_URL=… pnpm db:migrate
vercel deploy --prod
```

CI proves every pull request migrates an empty database, and `scripts/check-migrations.mjs` fails
one that adds a blocking index, rewrites a column type, or adds a `NOT NULL` column without a
default.

## Content rules

- Only approved picks are public.
- Every pick credits the creator and links to the moment.
- We store the video ID, creator, place, dish and timestamp. We do not copy or display titles,
  descriptions, transcripts or thumbnails.
- Notes on a pick are written in our own words.
- Creator opt-out is honoured; no ratings, prices or opening hours are invented.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Please read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
and report security issues privately as described in [`SECURITY.md`](SECURITY.md).

## More reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - system diagrams, data model, failure modes
- [`docs/adr/`](docs/adr/) - eight architecture decisions with their rejected alternatives
- [`docs/slo.md`](docs/slo.md) - measured latency, ingest duration, migration safety
- [`docs/perf/2026-11-10-load.md`](docs/perf/2026-11-10-load.md) - load test and its honest gaps
- [`docs/case-study.md`](docs/case-study.md) - what was built, what broke, what is still open

## License

MIT. See [`LICENSE`](LICENSE).
