# ADR-0008: Search our own areas before asking OpenStreetMap

## Status

Accepted (2026-11-09, back-filled 2026-11-09)

## Context

Typing "chandini chowk" on `/delhi` said "Could not find that place". Nominatim does no fuzzy matching and the
app ignored its own `places.locality`. Nominatim's policy also allows one request per second, and the typed
text leaves the site.

## Options

| Option                                                                   | For                          | Against                                                                           |
| ------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------- |
| Nominatim only (before)                                                  | no data to maintain          | 87 of 144 test queries resolved, 12 of 20 nonsense queries still returned a place |
| Own `areas` table, trigram prefilter, code rerank, Nominatim as fallback | 143 of 144, 20 of 20 refused | list must be kept in sync                                                         |
| Full OSM import first                                                    | complete                     | large, belongs to Sprint 7                                                        |

## Decision

`areas` and `area_aliases` (migration 0009) are built from `places.locality` by `pnpm worker areas`, plus a
curated nickname list (`db/area-aliases.ts`). `matchAreas` takes candidates from a `pg_trgm` GIN index and
reranks them in code (whole-word containment, bounded edit distance, sound-alike skeleton), because trigram
similarity alone matched "besant nagar" to "T. Nagar". `findArea` tries our areas, then Nominatim (the
answer is written back so the next visitor stays local), then returns "Did you mean" choices.

## Consequences

- The UI says whether the text stayed on the site or went to OpenStreetMap.
- Known gap: a spelling with trigram similarity under 0.3 ("bhawanipur") never reaches the rerank. Fix is a
  stored, indexed skeleton column.
- The eval (`pnpm eval:area`, 164 queries) fails the test run below 95 percent.

## Revisit when

The OSM import (S7-1) lands, or the miss list grows.
