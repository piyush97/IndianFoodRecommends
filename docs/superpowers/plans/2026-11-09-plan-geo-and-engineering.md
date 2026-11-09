# Plan: geospatial search + staff-level engineering (Sprints 6-8)

Status: draft, awaiting owner approval. Written 2026-11-09.

## 0. Trigger and root cause

Owner typed `chandini chowk` into "Or sort from an area or landmark" on `/delhi` and got
"Could not find that place in Delhi".

Root cause, reproduced:

| Query sent to Nominatim | Result                    |
| ----------------------- | ------------------------- |
| `chandini chowk, Delhi` | `[]`                      |
| `chandni chowk, Delhi`  | node 3268564739, 28.656 N |

Nominatim does no fuzzy matching. Our own DB already has a place with locality `Chandni Chowk`,
but `lib/geocode-area.ts` never looks at it. So a spelling slip that any Delhi user makes fails,
even though the answer is in our data.

Measured facts this plan relies on:

- Prod Neon is PostgreSQL 18.6. `postgis 3.6.4`, `h3 4.2.3`, `unaccent` are available but not
  installed. `pg_trgm 1.6`, `cube`, `earthdistance` are installed.
- 441 places, 262 distinct localities, 317 with a pin.
- Local dev Postgres 17 has `pg_trgm` but not PostGIS. CI `db` job uses a plain Postgres image.
  Both need changing before any PostGIS migration.

## 1. Goals

1. **G1. Area search never dead-ends.** A misspelt or local name ("chandini chowk", "CP",
   "bandra west") resolves to a point, or the UI offers named suggestions. Target: 0 dead-ends
   for any locality we already store; at least 95% hits on a 100-query test set of real typos
   and nicknames.
2. **G2. Geospatial as a feature, not only a sort.** Search inside a map area, dish-near-area
   queries, neighbourhood pages, food walks.
3. **G3. Portfolio-grade engineering.** Each big decision gets a written record. Performance and
   correctness are proven by tests in CI, the system is observable, and a reviewer can read
   a case study and verify every number in it.

Non-goals: user accounts, ratings we cannot get for free (see Google decision still open),
native apps, paid infrastructure.

## 2. Design

### 2.1 Local gazetteer (fixes the bug, G1)

New table `areas` (one row per named area we can resolve without calling anyone):

| column   | type                         | notes                                     |
| -------- | ---------------------------- | ----------------------------------------- |
| id       | serial                       |                                           |
| city_id  | int fk                       |                                           |
| name     | text                         | display name, e.g. "Chandni Chowk"        |
| slug     | text                         | unique per city                           |
| aliases  | text[]                       | "CP" for Connaught Place, Hindi spellings |
| geom     | geography(Point)             | centroid                                  |
| boundary | geography(MultiPolygon) null | from OSM when available                   |
| source   | text                         | `places` / `osm` / `manual`               |

Seeding:

1. From our own `places.locality`: one area per distinct locality, centroid = average of its
   pinned places. Free, about 260 rows now.
2. From OSM, once per city: `place=suburb|neighbourhood|quarter` inside the city boundary,
   pulled via Overpass by a worker command and stored (ODbL, attribution already on the site).
3. Manual aliases file `db/area-aliases.ts` for nicknames (CP, Bandra W, Koramangala 5th Block).

Lookup order in `findArea()`:

1. Exact match on normalised name or alias (`unaccent`, lowercased, punctuation stripped).
2. Trigram similarity on name and aliases, `similarity > 0.35`, best first (GIN index
   `gin_trgm_ops`). "chandini chowk" vs "chandni chowk" = high similarity.
3. Nominatim, as today, and cache the hit as a `source = 'nominatim'` area so the second user
   with that typo never leaves our DB.
4. On a miss: return the top 3 trigram suggestions and render "Did you mean Chandni Chowk?"
   links. Never a bare failure.

API stays `GET /api/geocode?q=&city=`. Response gains `suggestions[]`. The client shows them
as buttons.

### 2.2 PostGIS (replaces earthdistance)

Why switch: `earthdistance` handles only point-radius queries. Everything in 2.3 needs polygons,
envelopes, clustering and MVT tiles, which only PostGIS has. Keep the current index until
the new one is proven, then drop it.

Migration steps (each its own migration, all reversible):

1. `CREATE EXTENSION postgis;`
2. `places.geom geography(Point,4326) GENERATED ALWAYS AS (ST_MakePoint(lng,lat)::geography) STORED`
   plus a GiST index. `lat`/`lng` stay the source of truth, so no app write path changes.
3. Port `nearbyPlaces()` to `ST_DWithin` + `<->` KNN. Same tests, plus a test asserting plan
   uses `places_geom_idx`.
4. Drop `places_geo_idx` and the `earthdistance`/`cube` extensions.

Environments: local dev gets `postgresql-17-postgis-3` via apt; test DB the same; CI `db` job
switches image to `postgis/postgis:17-3.5`. Neon has it available.

### 2.3 Geo features (G2)

| Feature                                            | How                                                                                                                                                                                                                    | Index used                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Dish near area: "chole bhature near chandni chowk" | Parse query into dish part + area part (split on " near " / " in ", else try longest area-suffix match), then filter by `ST_DWithin(area, 2 km)`                                                                       | `places_geom_idx` + trigram                            |
| Search this map area                               | Map sends its viewport bbox, server `geom && ST_MakeEnvelope(...)`, list re-renders                                                                                                                                    | GiST bbox                                              |
| Neighbourhood pages `/[city]/area/[slug]`          | Picks inside the OSM boundary, else within 1 km of the centroid. Indexable SEO pages for "best food in Chandni Chowk"                                                                                                  | `ST_Covers(boundary, geom)`                            |
| Food walks                                         | `ST_ClusterDBSCAN(eps 500 m, minpoints 4)` over approved pinned places. Order stops by nearest-neighbour from the westmost stop. Show total walking distance, stops, creators. Export as a Google Maps multi-stop link | cluster query, precomputed by worker into `food_walks` |
| Creator heatmap                                    | H3 resolution 8 cells on the city map, density of approved picks. Toggle on map. Uses the `h3` extension, precomputed                                                                                                  | none at request time                                   |
| Map vector tiles                                   | `/api/tiles/[z]/[x]/[y]` returns `ST_AsMVT`. Lets the map scale past a few hundred pins without shipping GeoJSON                                                                                                       | GiST                                                   |

Pins marked `approx:` (neighbourhood-level) are excluded from walks and shown dashed elsewhere, as
today. Food walks only use exact pins so the route is honest.

## 3. Engineering showcase (G3)

Each item is chosen because a staff reviewer would ask for it, not for decoration.

1. **Architecture decision records** in `docs/adr/`. Back-fill the 8 decisions already made, each
   with context, options, decision and what we would revisit:
   RSS feed over YouTube Data API, local worker because the LLM proxy is local, Vercel+Neon over
   Cloudflare, only a Google place ID is stored, Proxy for real 404s, auto-review with a
   human override, earthdistance then PostGIS, local gazetteer before Nominatim.
2. **SLOs with a budget**, in `docs/slo.md`. Proposed: city page p95 TTFB < 800 ms from India,
   area lookup p95 < 300 ms for gazetteer hits, ingest freshness < 26 h, error rate < 0.5%.
   Measured, not guessed: the plan starts by recording the current numbers.
3. **Observability.** `@vercel/otel` traces on DB queries and outbound calls (Nominatim, LLM),
   with `onRequestError` already in place. Worker emits one JSON summary per run (counts,
   durations, LLM tokens) into a `runs` table, rendered on `/admin/ops`.
4. **Query performance as tests.** Every hot query has an `EXPLAIN` test asserting its index
   (pattern already in `lib/geo.test.ts`). Seed a 50k-place synthetic dataset in CI for these
   tests so a plan regression shows at realistic size, not on 7 rows.
5. **Load test.** k6 script against a preview deployment: city page, search, area lookup.
   Results committed as a dated report so the case study number is reproducible.
6. **Search quality eval.** `eval/area-queries.jsonl`: 100 real queries (typos, Hindi
   transliterations, nicknames) with the expected area. CI fails if hit rate drops below 95%.
   Same pattern as the existing extraction eval.
7. **Abuse limits without paid services.** Postgres-backed token bucket for `/api/geocode` and
   search (per IP hash, per minute), replacing the per-instance in-memory 1/s limiter that resets
   on every cold start.
8. **Preview databases.** Neon branch per PR (free tier allows 10), migrations run on the branch
   in CI, e2e runs against the preview URL. Proves migrations before prod.
9. **Migration safety.** CI check that rejects `CREATE INDEX` without `CONCURRENTLY` on existing
   tables and column type changes on large tables.
10. **Case study** `docs/case-study.md` + README section: problem, architecture diagram, three
    hard problems (data rights, LLM extraction quality, geo search), numbers with how to
    reproduce them, what I would do next.

## 4. Sprints

Estimates are focused hours. Model column follows the existing convention in
`docs/06-sprints.md`: Opus for design and tricky correctness, Sonnet for normal feature work,
Haiku for mechanical work, Human where only the owner can act.

### Sprint 6: fix area search, move to PostGIS (about 1 week)

| ID   | Task                                                                                                               | Est | Model                       |
| ---- | ------------------------------------------------------------------------------------------------------------------ | --- | --------------------------- |
| S6-1 | Area-query eval set: 100 queries across 8 cities, expected area, baseline hit rate of today's Nominatim-only path  | 3 h | Sonnet + Human review of 20 |
| S6-2 | `areas` table + seed from `places.locality` + `unaccent`/`pg_trgm` indexes                                         | 4 h | Sonnet                      |
| S6-3 | `findArea()` lookup order (exact, trigram, Nominatim with write-back) + "Did you mean" suggestions in `NearMeList` | 5 h | Opus                        |
| S6-4 | Eval in CI with 95% gate                                                                                           | 2 h | Haiku                       |
| S6-5 | PostGIS in local, test and CI (`postgis/postgis` image)                                                            | 2 h | Sonnet                      |
| S6-6 | `places.geom` generated column + GiST, port `nearbyPlaces` to `ST_DWithin`, EXPLAIN tests, then drop earthdistance | 4 h | Opus                        |
| S6-7 | ADR backfill (8 records)                                                                                           | 3 h | Sonnet, Human edits         |

Exit: "chandini chowk" sorts from Chandni Chowk on prod; eval >= 95%; all geo queries on PostGIS.

### Sprint 7: geo features (about 1.5 weeks)

| ID   | Task                                                                                 | Est | Model  |
| ---- | ------------------------------------------------------------------------------------ | --- | ------ |
| S7-1 | OSM neighbourhood import (Overpass, worker command, boundaries) for 8 cities         | 5 h | Sonnet |
| S7-2 | Dish-near-area query parsing + search page integration + e2e                         | 5 h | Opus   |
| S7-3 | "Search this area" on map (bbox endpoint, list sync, keyboard reachable)             | 5 h | Sonnet |
| S7-4 | Neighbourhood pages `/[city]/area/[slug]` + sitemap + OG card + known-paths for 404s | 5 h | Sonnet |
| S7-5 | Food walks: DBSCAN job, `food_walks` table, page, Google Maps multi-stop link        | 8 h | Opus   |
| S7-6 | H3 heatmap layer (precomputed)                                                       | 4 h | Sonnet |
| S7-7 | MVT tile route, map switches to tiles above 300 pins                                 | 5 h | Opus   |

Exit: each feature has unit + e2e coverage and passes axe and the 360 px no-overflow check.

### Sprint 8: prove it (about 1 week)

| ID   | Task                                                       | Est | Model                   |
| ---- | ---------------------------------------------------------- | --- | ----------------------- |
| S8-1 | Record current numbers, then write `docs/slo.md`           | 3 h | Sonnet                  |
| S8-2 | OpenTelemetry tracing + worker `runs` table + `/admin/ops` | 6 h | Sonnet                  |
| S8-3 | 50k synthetic places seed for EXPLAIN tests in CI          | 3 h | Sonnet                  |
| S8-4 | k6 load test vs preview + committed report                 | 3 h | Sonnet                  |
| S8-5 | Postgres token-bucket rate limit for geocode + search      | 4 h | Opus                    |
| S8-6 | Neon branch per PR + migration safety check in CI          | 5 h | Opus                    |
| S8-7 | Case study + architecture diagram + README                 | 4 h | Opus, Human edits voice |

Exit: every number in the case study has a command that reproduces it.

## 5. Risks

| Risk                                                  | Mitigation                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Trigram picks the wrong area for short queries ("GK") | Aliases first; min length 3 for trigram; eval set includes short codes                                       |
| OSM boundary coverage is uneven across cities         | Fall back to centroid + 1 km; boundary is optional in schema                                                 |
| PostGIS migration on prod                             | Generated column is additive; old index kept until the new tests pass on prod; restore drill already monthly |
| Neon free tier limits (branches, compute hours)       | Delete preview branch on PR close; measure compute use in Sprint 8                                           |
| Overpass rate limits                                  | One import per city, cached, run from the worker, not per request                                            |
| Scope creep from "creative stuff"                     | Sprint 7 ordered by user value; walks and tiles can slip to Sprint 9                                         |

## 6. Skills checked

Searched with `npx skills find`:

| Skill                                                     | Installs | Use                                                                                  |
| --------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `postgis/postgis@postgis`                                 | 278      | Official PostGIS repo; useful for S6-6 and S7. Low install count but official source |
| `wshobson/agents@architecture-decision-records`           | 24.4K    | ADR format for S6-7                                                                  |
| `mapbox/mapbox-agent-skills@mapbox-geospatial-operations` | 2.3K     | Mapbox-specific; we use MapLibre + OSM, so skip                                      |

Not installed yet. Install the first two on approval.

## 7. Decisions needed from owner

1. Approve Sprints 6-8 as scoped, or cut Sprint 7 items.
2. OK to install the two skills above.
3. OK to create GitHub issues + add them to project board 5.
