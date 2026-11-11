# Case study: Indian Food Recommends

A site that answers one question: _where did food vloggers say to eat this, and
show me the proof?_ Every listing links to the moment in the creator's own video,
and places rank by how many **different** creators picked them, not by stars or
paid placement.

## The problem with the obvious build

Food discovery sites rank on anonymous ratings. The people this app serves (a
local foodie on a phone, deciding where to eat this weekend) trust a specific
vlogger more than a 4.2-star average. So the product's unit is not a rating, it
is **a creator's assertion plus a timestamp**, and the ranking is a count of
distinct creators.

That constraint decides the architecture: picks must be attributable, verifiable
and deduplicated per video, which means ingestion, verification and public pages
are three separate concerns.

## How the data stays honest

1. Creator uploads are pulled daily, and each video's picks are extracted.
2. A pick is verified against that video's own title and description. If the
   text cannot ground the place and dish, the pick is rejected, not published.
3. One pick per (video, place, dish, timestamp) is enforced by a unique index,
   so re-running ingest never duplicates a place or inflates a rank.
4. Rough locations are labelled as approximate, in the list and on the map.

## What is built

- Public: home, city, dish-in-city, place, creator, neighbourhood, food walk,
  search, suggest a pick, about, creator share kit. No accounts, no cookies.
- Ingest worker: feed + LLM extraction + verification + geocoding, with an
  archive fallback when YouTube's RSS is unavailable.
- Admin: review queue, stale places, search misses, and `/admin/ops` for worker
  runs.
- Visual system: a "dabba lid code" world, where each place carries a painted
  route code in its city's colour, and the map pin shares the list's rank.

## What was measured

Against a production build and the production database:

| Metric                      | Result                                                      |
| --------------------------- | ----------------------------------------------------------- |
| Approved picks              | 590 (2026-11-11; 454 at the first measurement)              |
| Read page p95, single user  | 254–269 ms (home, place, dish), 709 ms city, 1362 ms search |
| Database round trip (floor) | 232 ms                                                      |
| Load test, 10 readers       | 0 failures in 1163 requests, p95 2.25 s                     |
| Search after index fix      | 1836 → 1357 ms, 76 → 39 KB                                  |
| Daily ingest                | 8.5 min average, 65 min worst                               |

Each figure has a command next to it in `docs/slo.md` and
`docs/perf/2026-11-10-load.md`.

## Three bugs the "prove" pass found

1. **Search never used its indexes.** The query filtered on `lower(name)` while
   every trigram index was built on `name`, and the fuzzy branch used
   `similarity() >= 0.3`, which no GIN index can serve. A 50k-row plan test
   caught it; expression indexes and the `%` operator cut a quarter of the time
   and half the payload.
2. **Migrations failed on an empty database.** `0013` recreated tables already
   created by `0011` and `0012`. CI and a first production deploy would both
   have failed. This is now a test, not a habit: `scripts/check-migrations.mjs`
   runs on every pull request.
3. **Runs could look alive forever.** A killed worker left `running` rows that
   never closed. Stale runs are now failed after two hours and surfaced on
   `/admin/ops`.

## Still open

- **Round trips, not SQL, set page latency.** Every query costs ~232 ms to a
  remote database, and search issues five in sequence. The next win is batching
  queries, not tuning them.
- **Load test is local.** It has not been re-run against a deployed preview, so
  the 2.25 s p95 reflects one Node process, not Vercel's fleet.
- **Kolkata and most Mumbai dishes are thin.** Ranking by distinct creators is
  only interesting once several creators cover the same dish in the same city.
- **Approximate pins** remain approximate where OpenStreetMap has no shop entry;
  the UI says so rather than inventing a location.
