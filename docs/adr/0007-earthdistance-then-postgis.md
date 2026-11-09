# ADR-0007: earthdistance first, then PostGIS

## Status

Accepted (2026-11-09, back-filled 2026-11-09)

## Context

"Nearby picks" needed a radius search with an index. Sprint 7 needs bounding boxes, polygons, clustering and
vector tiles.

## Options

| Option                        | For                                          | Against                        |
| ----------------------------- | -------------------------------------------- | ------------------------------ |
| Haversine in app code         | no extension                                 | scans every row                |
| `cube` + `earthdistance` GiST | built into Postgres                          | points and radius only         |
| PostGIS `geography` + GiST    | everything Sprint 7 needs, metres by default | extension on every environment |

## Decision

PR #76 shipped `cube` + `earthdistance` with a GiST on `ll_to_earth(lat, lng)` as the smallest thing that
worked, with an `EXPLAIN` test. PR #101 replaced it with `places.geom geography(Point,4326)`, a generated
column from `lat`/`lng` (they stay the source of truth), `places_geom_idx`, and `nearbyPlaces` on
`ST_DWithin` and `<->`. Migration 0010 is idempotent and drops the old index and both extensions. The
additive part ran on production before the deploy, the drops after it.

## Consequences

- CI `db` job uses `postgis/postgis:17-3.5`. Local runs `postgresql-18-postgis-3`. Neon has PostGIS 3.6.
- Production plan verified: `Index Scan using places_geom_idx`.

## Revisit when

Rows pass about a million, at which point partition or tile precomputation is worth a look.
