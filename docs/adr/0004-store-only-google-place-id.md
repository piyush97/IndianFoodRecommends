# ADR-0004: Store only the Google place ID

## Status

Accepted (2026-11-08, back-filled 2026-11-09)

## Context

Users asked for ratings. Google Places terms forbid caching its content other than the place ID.
Zomato has no public API and its search URL no longer works. Tripadvisor's content API is retired.

## Options

| Option                              | For             | Against                                                                 |
| ----------------------------------- | --------------- | ----------------------------------------------------------------------- |
| Store Google ratings                | fast, one query | breaks the terms                                                        |
| Scrape Zomato                       | has ratings     | terms risk, brittle                                                     |
| Live Google call, store only the ID | allowed, honest | 1,000 free Enterprise lookups a month, then $20 per 1,000, needs a card |
| No ratings                          | free            | missing feature                                                         |

## Decision

Ship the live path behind `GOOGLE_MAPS_API_KEY`. `lib/google-rating.ts` finds a place ID with one text search
(which also asks for the rating fields, so it is billable after the free quota), stores it in `places.google_place_id` (`"none"` when there is no confident match), and
`app/api/rating/route.ts` fetches the rating at request time with `no-store`. Bots get 204. Zomato and
Swiggy are plain search links, labelled as such.

## Consequences

- Key unset means zero cost and no rating shown. That is the current production state.
- The rating is never in the database, so it cannot go stale or be exported.

## Revisit when

The owner decides to add a key, sets a quota cap, or Google changes the terms.
