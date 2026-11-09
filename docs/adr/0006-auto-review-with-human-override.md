# ADR-0006: Automatic review of picks, humans can still override

## Status

Accepted (2026-11-06, back-filled 2026-11-09)

## Context

A creator video can yield several candidate picks. The founder is one person, so a manual queue for every
pick does not scale to 8 cities and about 36 creators.

## Options

| Option                                                                   | For                      | Against                                 |
| ------------------------------------------------------------------------ | ------------------------ | --------------------------------------- |
| Human approves every pick                                                | highest precision        | does not scale, backlog stalls the site |
| LLM extracts and publishes                                               | fast                     | no check against the video              |
| LLM extracts, a second model verifies, code decides, humans can override | scales, reasons recorded | false approvals possible                |

## Decision

Jev verifies each LLM pick (named in the video, is a venue, is a recommendation, is in the city). Code
thresholds in `lib/auto-review.ts` approve or reject in the same run and store the reason in
`extracted.autoReview`. Dish names like "street food" or "breakfast" are rejected as `generic-dish`. Matched
places are reused, new ones geocoded. Admin pages can still reject, merge places and merge dishes. Extraction
quality has a gate: `pnpm worker eval` exits 2 below 0.85 precision.

## Consequences

- Known misses exist. Non-Indian dishes were found in Chennai ("burrata-pizza", "pollo-ligure") and are not
  yet cleaned up.
- Dish duplicates are handled by `canonicalDishName` and an admin merge page (PR #68).

## Revisit when

An audit of a random sample of approved picks finds more than a few percent wrong. Add that audit first.
