# 06 · GitHub Project: Sprints, Tasks, Model Assignment

Project board columns: `Backlog → Ready → In progress → Review → Done`.
Labels: `area:web` `area:worker` `area:db` `area:admin` `area:seo` `area:legal` `area:design` `type:feat` `type:chore` `type:test`.
Estimate = engineer-hours. Model = which AI model builds it (via Claude Code / cliproxyapi). Human = needs a person.

Model key:

- **Opus 5.5**: design calls, tricky logic, security, reviews (hard)
- **Sonnet 5.5**: normal features + tests (medium)
- **Haiku 5.5**: mechanical, config, seed data, copy (easy)
- **Human**: legal, creator outreach, data review, accounts/keys

## Sprint 0 · Foundations (week 1)

| ID   | Task                                                                    | Est | Model                | Acceptance                                      |
| ---- | ----------------------------------------------------------------------- | --- | -------------------- | ----------------------------------------------- |
| S0-1 | Init Next.js + TS + Tailwind + pnpm, ESLint, Prettier                   | 1   | Haiku                | `pnpm build` passes                             |
| S0-2 | GitHub Actions CI: lint, typecheck, test                                | 1   | Haiku                | CI green on PR                                  |
| S0-3 | Drizzle schema + migrations from TDD §2, pg_trgm                        | 4   | Sonnet               | migrate up/down works on local Docker PG        |
| S0-4 | Seed: Delhi city, 30 dishes + aliases, 8 creators                       | 2   | Haiku + Human check  | seed idempotent                                 |
| S0-5 | Design tokens (2-3 colours + accent, type scale, radius)                | 2   | Sonnet               | tokens in Tailwind config, contrast AA verified |
| S0-6 | Read YouTube policy III.E.4, decide video-ID retention                  | 2   | Human (Opus summary) | decision written in TDD §2                      |
| S0-7 | Accounts: Neon, Vercel, Google Cloud API key, cliproxyapi key in `.env` | 1   | Human                | `.env.example` committed, secrets not           |

## Sprint 1 · Data pipeline (weeks 2-3)

| ID    | Task                                                         | Est | Model               | Acceptance                                  |
| ----- | ------------------------------------------------------------ | --- | ------------------- | ------------------------------------------- |
| S1-1  | `yt-sync`: uploads playlist paging, store new `source` rows  | 4   | Sonnet              | re-run inserts 0 duplicates                 |
| S1-2  | LLM client for cliproxyapi + JSON schema + zod parse + retry | 4   | Sonnet              | malformed output fixtures handled           |
| S1-3  | Extraction prompt + 50-video labelled eval set + eval script | 8   | Opus + Human labels | precision report printed; ≥85% target       |
| S1-4  | Matcher: trigram place/dish match with aliases               | 5   | Opus                | unit tests on spelling variants pass        |
| S1-5  | Nominatim geocode suggest (1 rps, UA, cache)                 | 3   | Sonnet              | respects rate limit in test                 |
| S1-6  | `ingest_run` logging + per-video error isolation             | 2   | Sonnet              | one bad video doesn't stop run              |
| S1-7  | Cron on this machine (systemd timer) + runbook               | 1   | Haiku               | timer listed, runbook in docs               |
| S1-8  | Admin auth (Auth.js allowlist)                               | 3   | Opus                | non-allowlisted → 403, tested               |
| S1-9  | Review queue UI (W6) with keyboard shortcuts                 | 8   | Sonnet              | approve/edit/reject in ≤3 actions; E2E test |
| S1-10 | Place merge + manual add (incl. IG URL)                      | 5   | Sonnet              | merge moves recs, keeps alias               |
| S1-11 | Review first 300 picks                                       | 10  | Human               | 300 approved                                |

## Sprint 2 · Public site (weeks 4-5)

| ID    | Task                                                                  | Est | Model  | Acceptance                            |
| ----- | --------------------------------------------------------------------- | --- | ------ | ------------------------------------- |
| S2-1  | Layout, header, city switcher, footer (creator credit + opt-out link) | 3   | Sonnet | keyboard nav, 360px no overflow       |
| S2-2  | Home (W1)                                                             | 4   | Sonnet | loading/empty/error states            |
| S2-3  | City + dish page (W2) list + ranking                                  | 5   | Sonnet | sorted by creator count               |
| S2-4  | Map view MapLibre + list alternative                                  | 5   | Sonnet | pins = list items; a11y list fallback |
| S2-5  | Place page (W3), embed facades YT(start=ts)/IG                        | 5   | Sonnet | embed loads only on click             |
| S2-6  | Creator page (W4)                                                     | 3   | Sonnet | dish filter works                     |
| S2-7  | Search (trigram + aliases)                                            | 4   | Opus   | "chole bature" finds chole bhature    |
| S2-8  | Report issue API + form (zod, rate limit)                             | 3   | Sonnet | 6th report/min/IP → 429               |
| S2-9  | ISR + revalidateTag on approve                                        | 2   | Opus   | approved pick visible < 1 min         |
| S2-10 | Playwright E2E: search→place→watch                                    | 3   | Sonnet | passes in CI                          |

## Sprint 3 · SEO + launch (weeks 6-7)

| ID   | Task                                            | Est | Model         | Acceptance                     |
| ---- | ----------------------------------------------- | --- | ------------- | ------------------------------ |
| S3-1 | JSON-LD Restaurant/ItemList, meta, canonical    | 3   | Sonnet        | Rich Results test passes       |
| S3-2 | sitemap.xml + robots from approved data         | 2   | Haiku         | all public URLs listed         |
| S3-3 | OG images via next/og                           | 2   | Sonnet        | per-page image                 |
| S3-4 | Perf pass: LCP < 2.5s, CLS < 0.1                | 4   | Opus          | Lighthouse mobile ≥ 90         |
| S3-5 | A11y audit WCAG 2.2 AA                          | 3   | Opus          | axe 0 serious issues           |
| S3-6 | Cookieless analytics (Plausible/Umami) + events | 2   | Haiku         | watch/directions click tracked |
| S3-7 | Security review (CSP, auth, inputs)             | 3   | Opus          | review findings closed         |
| S3-8 | About + content policy + creator opt-out page   | 2   | Human + Haiku | published                      |
| S3-9 | Domain, prod deploy, backups                    | 2   | Human         | site live                      |

## Sprint 4 · Growth (weeks 8-9)

| ID   | Task                                               | Est | Model          | Acceptance                   |
| ---- | -------------------------------------------------- | --- | -------------- | ---------------------------- |
| S4-1 | Public submit form (W5) + captcha + queue          | 5   | Sonnet         | spam blocked, lands in queue |
| S4-2 | Add city #2 + #3 (data + creators)                 | 6   | Haiku + Human  | 100 approved picks per city  |
| S4-3 | "Near me" sort (browser geolocation, opt-in)       | 3   | Sonnet         | works without location too   |
| S4-4 | Stale data job: flag places unverified > 12 months | 2   | Sonnet         | flagged list in admin        |
| S4-5 | Creator outreach kit (share link, embed badge)     | 3   | Human + Sonnet | 3 creators contacted         |

## Sprint 5 · Hardening + highest-ROI features (weeks 10-11)

Ranked by return per hour. State at planning (2026-11-08): 40 approved picks, 112 pending, 61 dishes (variants split, e.g. "Desi Ghee Chole Bhature"), 18 creators, no failure alerts on the ingest/backup timers, unknown slugs return 200 + noindex instead of 404.

| ID    | Task                                                                             | Est (h) | Model  | Done when                                                         |
| ----- | -------------------------------------------------------------------------------- | ------- | ------ | ----------------------------------------------------------------- |
| S5-1  | Alert on ingest/backup failure (systemd `OnFailure=` → email or webhook)         | 1       | Sonnet | a forced failing run sends an alert                               |
| S5-2  | Re-run auto-review on pending picks every night; drain the 112                   | 2       | Sonnet | pending < 20, nothing older than 48 h                             |
| S5-3  | Dish canonicalisation: variants become aliases of one dish, admin merge          | 3       | Opus   | "Desi Ghee Chole Bhature" searches/ranks with Chole Bhature; test |
| S5-4  | Log zero-result searches (query text only, no IP), admin list                    | 2       | Sonnet | admin shows top zero-result queries, 7 days                       |
| S5-5  | Real 404 status for unknown place/dish/creator slugs + `app/not-found.tsx`       | 3       | Opus   | `curl -I` unknown slug on prod → 404                              |
| S5-6  | `app/global-error.tsx` + server error logging with route context                 | 1       | Haiku  | thrown test error shows branded page, logged in Vercel            |
| S5-7  | Monthly backup restore drill (restore latest dump to scratch DB, check counts)   | 1       | Sonnet | timer runs, drill passes                                          |
| S5-8  | Share button on place + dish pages (Web Share API, copy-link fallback)           | 2       | Sonnet | works on mobile and desktop, keyboard reachable                   |
| S5-9  | Search results link to the dish's city page ("All chole bhature in Delhi")       | 1       | Haiku  | link per city with picks, e2e covers it                           |
| S5-10 | Set `NEXT_PUBLIC_OPTOUT_EMAIL`, custom domain + `NEXT_PUBLIC_SITE_URL` in Vercel | 0.5     | Human  | about page shows a working opt-out address                        |

Carried over: #39 (100 approved picks per city), #42 (contact 3 creators).

## Sprint 6 · Area search fix + PostGIS (week 12)

Plan: `docs/superpowers/plans/2026-11-09-plan-geo-and-engineering.md`. Trigger: "chandini chowk" returned "Could not find that place in Delhi" because Nominatim has no fuzzy match and `findArea` ignores our own `places.locality`.

| ID   | Task                                                                                           | Est (h) | Model                | Done when                                                      |
| ---- | ---------------------------------------------------------------------------------------------- | ------- | -------------------- | -------------------------------------------------------------- |
| S6-1 | Area-query eval set: 100 queries over 8 cities + baseline hit rate of the Nominatim path       | 3       | Sonnet + Human       | `eval/area-queries.jsonl` committed, baseline number in the PR |
| S6-2 | `areas` table seeded from `places.locality`, `unaccent` + `pg_trgm` GIN indexes                | 4       | Sonnet               | ~260 areas on prod, EXPLAIN test uses the trigram index        |
| S6-3 | `findArea()`: exact/alias, trigram, Nominatim with write-back, "Did you mean" links            | 5       | Opus                 | "chandini chowk" resolves on prod; a miss shows 3 suggestions  |
| S6-4 | Run the area eval in CI with a 95% gate                                                        | 2       | Haiku                | CI fails when hit rate < 95%                                   |
| S6-5 | PostGIS in local dev, test DB and CI (`postgis/postgis` image)                                 | 2       | Sonnet               | `pnpm test` with DB passes locally and in CI on PostGIS        |
| S6-6 | `places.geom` generated column + GiST, port `nearbyPlaces` to `ST_DWithin`, drop earthdistance | 4       | Opus                 | geo tests pass, plan uses `places_geom_idx`, old index dropped |
| S6-7 | ADR backfill: 8 decisions in `docs/adr/`                                                       | 3       | Sonnet + Human edits | 8 records with context, options, decision, revisit trigger     |

## Sprint 7 · Geo features (weeks 13-14)

S7-1..S7-7 are implemented and verified locally on `sprint7-geo`. Production acceptance remains open;
see [local validation and release gates](superpowers/plans/2026-11-09-plan-geo-and-engineering.md#sprint-7-local-validation).

| ID   | Task                                                                          | Est (h) | Model  | Done when                                                      |
| ---- | ----------------------------------------------------------------------------- | ------- | ------ | -------------------------------------------------------------- |
| S7-1 | OSM neighbourhood import (Overpass, worker command, boundaries) for 8 cities  | 5       | Sonnet | areas have boundaries where OSM has them, attribution shown    |
| S7-2 | Dish-near-area query ("chole bhature near chandni chowk") + search page + e2e | 5       | Opus   | e2e: query returns only picks within 2 km, sorted by distance  |
| S7-3 | "Search this area" on the map (bbox endpoint, list sync, keyboard reachable)  | 5       | Sonnet | pan + button re-lists picks in view, works by keyboard         |
| S7-4 | Neighbourhood pages `/[city]/area/[slug]` + sitemap + OG + known-paths        | 5       | Sonnet | page 200 on prod, unknown area 404, in sitemap                 |
| S7-5 | Food walks: DBSCAN job, `food_walks` table, page, Google Maps multi-stop link | 8       | Opus   | each walk has 4+ exact-pin stops, total distance, working link |
| S7-6 | H3 heatmap layer, precomputed by the worker                                   | 4       | Sonnet | toggle on city map, no request-time geo work                   |
| S7-7 | MVT tile route; map uses tiles above 300 pins                                 | 5       | Opus   | `/api/tiles/z/x/y` returns valid MVT, map renders from tiles   |

## Sprint 8 · Prove it (week 15)

| ID   | Task                                                       | Est (h) | Model              | Done when                                                        |
| ---- | ---------------------------------------------------------- | ------- | ------------------ | ---------------------------------------------------------------- |
| S8-1 | Record current numbers, then write `docs/slo.md`           | 3       | Sonnet             | SLOs written next to measured baselines                          |
| S8-2 | OpenTelemetry tracing + worker `runs` table + `/admin/ops` | 6       | Sonnet             | a trace shows DB + Nominatim spans, last 30 runs visible         |
| S8-3 | 50k synthetic places seed for EXPLAIN tests in CI          | 3       | Sonnet             | hot-query plan tests run at 50k rows in CI                       |
| S8-4 | k6 load test against a preview + committed report          | 3       | Sonnet             | report in `docs/perf/`, command reproduces it                    |
| S8-5 | Postgres token-bucket rate limit for geocode + search      | 4       | Opus               | limit survives cold starts, test covers burst and refill         |
| S8-6 | Neon branch per PR + CI migration safety check             | 5       | Opus               | PR migrations run on a branch DB, unsafe index/type change fails |
| S8-7 | Case study, architecture diagram, README section           | 4       | Opus + Human edits | every number has a command that reproduces it                    |

## Totals

~170 engineer-hours through Sprint 4, plus Sprints 6-8 at 88 h (23 + 37 + 28). With AI doing most build tasks, human time ≈ 40 h (labels, review, legal, accounts).

## Creating the board (when approved)

`gh project create` + `gh issue create` per row, script generated from this file. Not run yet: publishes to GitHub.

## Sprint 8 status (2026-11-10)

| Task                               | State            | Evidence                                                                                                                                           |
| ---------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| S8-1 SLOs                          | Done             | `docs/slo.md`, numbers from `scripts/bench-latency.mjs`                                                                                            |
| S8-2 Tracing + runs + `/admin/ops` | Done             | `instrumentation.ts`, `lib/tracing.ts`, `worker_runs`, `lib/worker/run-log.ts`, `app/admin/ops`                                                    |
| S8-3 50k plan tests                | Done             | `db/perf-seed.ts`, `db/plans.integration.test.ts` (runs in `pnpm test`)                                                                            |
| S8-4 k6 load report                | Done, local only | `ops/load.js`, `docs/perf/2026-11-10-load.md`; not yet run against a preview                                                                       |
| S8-5 Postgres rate limit           | Done             | `lib/rate-limit.ts`, `lib/rate-limit.integration.test.ts`, used by geocode and search                                                              |
| S8-6 CI migration safety           | Partial          | `scripts/check-migrations.mjs` runs on every PR against the CI Postgres service; the Neon branch-per-PR step needs `NEON_API_KEY` and is not wired |
| S8-7 Case study + README           | Done             | `docs/case-study.md`, `README.md`                                                                                                                  |
