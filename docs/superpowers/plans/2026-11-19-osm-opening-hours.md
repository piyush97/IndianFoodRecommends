# OSM opening hours

Spec: docs/superpowers/specs/2026-11-19-osm-opening-hours-design.md (read it first; every step obeys its Constraints).

Shared types, owned by step 1:
- `type Week = [number, number][][]`: 7 entries, index 0 = Monday. Each entry is a list of `[openMin, closeMin]` intervals in minutes after midnight Asia/Kolkata. `closeMin` may be > 1440 for past-midnight closing. 24/7 is `[[0,1440]]` on every day.
- `type OpenStatus = { open: true; until: string } | { open: false; opensAt: string } | null` (times like "11 PM", "8:30 AM").

Review focus (each needs a test in its step): past-midnight hours ("18:00-02:00" open at 01:00 the next day), 24/7, an unparseable tag gives null without throwing, an Overpass failure for one city must not wipe that city's stored hours, and approx pins are never matched.

## 1 Pure hours logic
files: lib/opening-hours.ts, lib/opening-hours.test.ts, lib/open-status.ts, lib/open-status.test.ts, package.json, pnpm-lock.yaml
do: Add the `opening_hours` npm dependency, used only in lib/opening-hours.ts. lib/opening-hours.ts exports `weekSchedule(tag: string, from: Date): Week | null`, which evaluates the tag over the 7 days from the Monday of `from`'s IST week and returns null if the tag throws or is empty. It also exports `type OsmFood = { id: number; name: string; lat: number; lng: number; openingHours: string }`, `parseOverpass(json: unknown): OsmFood[]` (nodes use lat/lon, ways/relations use `center`; skip elements without name or opening_hours), and `matchOsm(place: { name: string; lat: number; lng: number; osmId: string }, candidates: OsmFood[]): OsmFood | null`. matchOsm matches when the candidate id equals the numeric `osmId`, or when it is ≤150 m away (`haversineKm` from components/near-me) and `sameName()` passes (lib/google-rating.ts). When several qualify, take the nearest. lib/open-status.ts has no imports and exports `openStatus(week: Week, now: Date): OpenStatus`, which converts `now` to IST and checks yesterday's past-midnight intervals too.
done-when: `pnpm vitest run lib/opening-hours.test.ts lib/open-status.test.ts` passes. Tests cover: "Mo-Su 08:00-23:00" at 12:00 IST → open until "11 PM"; at 23:30 → closed, opens "8 AM"; "Mo-Su 18:00-02:00" at 01:00 → open until "2 AM"; "24/7" → open; "garbage ;;" → null; matchOsm by id; match at 100 m with the same name; reject at 100 m with a different name; reject at 300 m with the same name.
difficulty: medium
kind: change

## 2 Store hours nightly
files: db/schema.ts, db/migrations/, lib/worker/osm-hours.ts, lib/worker/osm-hours.test.ts, worker/cli.ts
needs: 1
do: Add nullable `openingHours text("opening_hours")`, `openingWeek jsonb("opening_week").$type<Week>()` and `openingHoursChecked date("opening_hours_checked")` to `places`, then run `pnpm db:generate` for the migration. lib/worker/osm-hours.ts exports `importOsmHours(db: Db, onlyCity?: string, fetchImpl = fetch)`, modelled on `importOsmAreas` in lib/worker/osm-areas.ts: same city extent query, User-Agent, timeout and 20 MB guard. The Overpass query is `[out:json][timeout:60];nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"]["opening_hours"](box);out center tags;`. For each place in the city with lat/lng and an `osm_id` that is not null and not `approx:`, set opening_hours and opening_week from `matchOsm` + `weekSchedule`, or null when there is no match. Set opening_hours_checked to today. When a city's fetch or parse fails, record the error and leave that city's rows untouched. Register a worker command `"osm-hours"` (exitCode 1 on any city error, `notifyRevalidate(["public"])` when anything changed), and call it from `ingest()` after `geo()` with `.catch(console.error)`, like the other niceties.
done-when: `pnpm vitest run lib/worker/osm-hours.test.ts` passes with a mocked fetch: a matched exact-pin place gets hours, an approx-pin place stays null, and a failed fetch leaves the existing hours unchanged. `pnpm run typecheck` passes.
difficulty: medium
kind: change

## 3 Show status on the place page
files: components/OpenStatus.tsx, app/(public)/[city]/place/[slug]/page.tsx, the query that loads the place for that page
needs: 1, 2
do: Load `openingWeek` with the place. When it is set, render `<OpenStatus week={...} />` near Directions. It is a client component that imports only lib/open-status.ts. It computes the status after mount, rechecks every minute, and reserves its line height before mount so CLS stays 0. Text: "Open now · until 11 PM" or "Closed · opens 8 AM", followed by a link "Hours: © OpenStreetMap contributors" to https://www.openstreetmap.org/copyright. Status is text, not colour alone, with AA contrast. Render nothing when there is no week or the status is null. Remove the `GOOGLE_MAPS_API_KEY` gate only if it blocks this; leave GoogleRating otherwise untouched.
done-when: `pnpm run typecheck` and `pnpm lint` pass.
difficulty: easy
kind: change
