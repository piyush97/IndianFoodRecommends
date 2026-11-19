# Opening hours from OpenStreetMap (design)

Approved 2026-11-19 (option A).

## Intent

A visitor deciding whether to leave now sees "Open now · until 11 PM" next to Directions. Open data only: no Google key, no paid API.

## Goals / non-goals / anti-goals

- Goal: show open/closed status plus the next change time for places whose hours OpenStreetMap knows.
- Non-goal: full coverage. About 10% of Delhi food places in OSM have `opening_hours`, so expect a few dozen places at first.
- Non-goal: hours typed in by an admin (option B, rejected).
- Anti-goal: a wrong match. Showing another shop's hours is worse than showing none. Never guess or show placeholder hours (PRODUCT.md).

## Constraints

- OSM data is ODbL: storing it is allowed, and the page must credit "© OpenStreetMap contributors".
- Use the public Overpass server politely: one query per city per night, with a `User-Agent` from `NOMINATIM_USER_AGENT`, the same way `lib/worker/osm-areas.ts` does.
- Place pages are cached (Cache Components), so open/closed is computed in the browser from a stored weekly schedule, never at render time.
- Lighthouse mobile ≥ 90 and CLS 0: the OSM hours parser (`opening_hours` npm, LGPL-3.0) runs only in the worker and is never shipped to the client.
- Show status as text, not colour alone; WCAG 2.2 AA.

## Approaches considered

- A (picked): a nightly OSM match stores the raw tag plus a precomputed week. No ongoing work; coverage grows as OSM improves.
- B: A plus admin-entered hours. More coverage, but manual work and hours go stale.
- C: no hours.
- Google Places hours: rejected because the user does not want a Google key.

## Design

- `places` gets `opening_hours text`, `opening_week jsonb`, and `opening_hours_checked date`.
- Matching only uses places with an exact pin (`osm_id` set and not `approx:`). An OSM food place matches when its numeric id equals our `osm_id`, or when it is within 150 m and passes `sameName()` (`lib/google-rating.ts`).
- The worker turns the OSM tag into a week schedule (Monday first, minutes after midnight IST, with closing times after midnight kept as > 1440). An unparseable tag gives no hours.
- The client shows "Open now · until 11 PM", "Closed · opens 8 AM", or nothing, with an OSM credit link.

## Left to the builder

Copy wording within the patterns above, component placement near Directions, and the test fixtures.
