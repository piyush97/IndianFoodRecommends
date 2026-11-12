# 014 findings: missing and leftover indexes (EXPLAIN first)

Base commit `47f81aa4`. Outcome: **no migration**. The measured plans do not
justify a new index, and the four leftover trigram indexes need production
statistics before they can be dropped. Both decisions are recorded below.

## Method

- Scratch database `ifr_scratch` on the same local Postgres server as
  `DATABASE_URL_TEST` (no Neon, no production access). Extensions `postgis` and
  `pg_trgm` created, then `pnpm db:migrate` applied all 16 migrations.
- Data: `pnpm db:seed` (8 cities, 47 creators, 30 dishes), `db/perf-seed.ts`
  with 50,000 synthetic places, plus **synthetic** `sources` (2,000 rows) and
  `recommendations` (20,000 rows, 16,000 approved) inserted with SQL. The
  recommendation/source volumes are invented for this investigation, not
  production measurements.
- Plans captured with `EXPLAIN (ANALYZE, BUFFERS)`, three warm runs each.
  Timings are a local single-process Postgres, so they are comparable to each
  other, not to `docs/slo.md` production numbers (232 ms network floor).

## Plans

| #   | Query                                                                                                     | Plan shape                                                                          | Rows out | Baseline (ms)      | With candidate index (ms) |
| --- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- | ------------------ | ------------------------- |
| a   | `visibleRows` join, no filter, `ORDER BY r.id`                                                            | Seq Scan `recommendations` 16k, Seq Scan `places` 50k, hash joins, quicksort 3.5 MB | 16,000   | 38.2 / 39.7 / 39.0 | 34.3 / 33.7 / 35.1        |
| b   | same + `p.city_id = 10`                                                                                   | Seq Scan `recommendations`, Seq Scan `places`, hash joins, quicksort 3.5 MB         | 15,650   | 40.6 / 64.7 / 88.6 | 34.7 / 34.3 / 38.9        |
| c   | `sources` for a creator: `creator_id = 7 AND published_on IS NOT NULL ORDER BY published_on DESC LIMIT 1` | Seq Scan `sources` 2k + sort                                                        | 1        | 0.29 / 0.27 / 0.17 | 0.05 / 0.04 / 0.05        |
| d   | `visibleRows` + `d.slug = 'butter-chicken'`                                                               | Seq Scan `recommendations` 16k, hash joins, sort 25 kB                              | 667      | 10.2 / 5.7 / 5.5   | 3.2 / 3.1 / 5.0           |

Candidate indexes measured in (a)-(d) were created on the scratch database only
and dropped again: `sources(creator_id, published_on)`,
`recommendations(dish_id)`, `recommendations(source_id)`.

Reading the plans:

- (a) is the whole visible set, so it scans `recommendations` because it returns
  essentially every approved row. No index on `status`, `dish_id` or
  `source_id` can replace that scan; the cost is the 16k-row sort (3.5 MB,
  quicksort) plus the 50k-place scan.
- (b) is not representative of a public city page: the synthetic places all sit
  in one city, so the filter removed 16 rows of 16,666. It still shows the
  planner declining the candidate indexes.
- (c) is the ingest query in `lib/worker/ingest.ts:58-61`. At 2,000 sources it
  costs 0.2 ms; the composite index makes it 0.05 ms. Both are noise.
- (d) is the only case where a candidate index halves the time (5.5 ms → 3.2 ms)
  by fetching 667 rows instead of scanning 16,000. Still far below the 50 ms bar.

## Existing index usage

`pg_stat_user_indexes` on the scratch database after `pnpm vitest run
lib/public lib/matcher.test.ts` (7 files, 95 tests, pass):

| Index / table                                     | idx_scan        |
| ------------------------------------------------- | --------------- |
| `recommendations_pkey`, `recs_dedupe_uk`          | 20,000 / 20,000 |
| `sources_pkey`, `sources_platform_external_id_uk` | 22,004 / 2,000  |
| `recs_status_place_idx`                           | 0               |
| all 11 `*trgm*` indexes                           | 0               |

The trigram zeros are **not** evidence of waste on their own: the test suite
truncates these tables and seeds fixture-sized rows, so the planner seq-scans
them. Only production `pg_stat_user_indexes` (read-only) settles that question.

## Decision

No new index is justified by the tested plans. Rule applied: an index is added
only when a table of roughly 10k rows shows a sequential scan costing about
50 ms, or when the scan dominates a page's query chain.

| Candidate                           | Evidence                                              | Revisit when                                                        |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| `sources(creator_id, published_on)` | (c) 0.2 ms at 2,000 sources; save 0.15 ms             | `sources` passes ~10k rows and the ingest lookup exceeds 50 ms      |
| `recommendations(dish_id)`          | (d) 5.5 ms at 20k recommendations; 667 rows           | dish pages exceed 50 ms with a seq scan on >50k recommendations     |
| `recommendations(source_id)`        | never chosen: (a) returns all rows, hash join is fine | a source-scoped read or delete plan starts scanning recommendations |

`recs_status_place_idx` earns its keep only in the zero-row city case today, but
it is the only index on `status`, so it stays.

### Leftover trigram indexes

`db/migrations/0001_trgm.sql` created four raw-column GIN indexes
(`places_name_trgm_idx`, `dishes_name_trgm_idx`,
`place_aliases_alias_trgm_idx`, `dish_aliases_alias_trgm_idx`).
`0014_lethal_frank_castle.sql` added `lower(...)` replacements but did not drop
the originals, and `db/schema.ts` only declares the `lower(...)` versions, so
the four are undeclared drift.

Query paths all wrap the column in `lower(...)` before comparing
(`lib/public/search.ts:33-48`, `lib/matcher.ts:36-40`,
`lib/place-dupes.ts:23`), except the areas key, which has its own index and is
out of scope. On the 50k-place scratch database each of the two `places` GIN
indexes is 6.3 MB (heap 3.3 MB); the four raw ones had `idx_scan = 0`.

Recommended follow-up, not part of this plan: a separate
`DROP INDEX CONCURRENTLY IF EXISTS` migration, after a maintainer confirms
`idx_scan = 0` for the four names in production `pg_stat_user_indexes`. Dropping
them now would rest on fixture-sized statistics, and the plan's scope is
investigation plus only evidence-backed index migrations.

## Reproduce

```bash
# scratch database on the DATABASE_URL_TEST server, never production
psql "$DATABASE_URL_TEST" -c "create database ifr_scratch"
psql "$SCRATCH_URL" -c "create extension if not exists postgis; create extension if not exists pg_trgm;"
DATABASE_URL="$SCRATCH_URL" pnpm db:migrate
DATABASE_URL="$SCRATCH_URL" pnpm db:seed
# db/perf-seed.ts seedPerfPlaces(db, 50_000), then the synthetic sources/recommendations SQL
psql "$SCRATCH_URL" -c "explain (analyze, buffers) <query>"
```

`node scripts/check-migrations.mjs 47f81aa4` reports
`migrations: 0 changed file(s), no unsafe statements`.
