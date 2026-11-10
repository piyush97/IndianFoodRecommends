# Growth Five: design

Date: 2026-11-10. Status: draft for owner review.

## Why

The site works and has 484 visible places in 8 cities, but it cannot answer "is anyone using it?" and nothing in it spreads by itself. These five features make usage measurable, make the site spread through WhatsApp and creators, and make picks trustworthy enough that people come back.

Order is fixed: each one depends on the one above for measurement.

1. Measure: analytics that actually records.
2. Spread: shareable eat list, built for WhatsApp.
3. Return: "Near me" on the home page.
4. Trust: freshness and closed-place signals.
5. Reach: creator story images and Hinglish/Hindi search.

## Facts found in the code (2026-11-10)

- Umami (cookie-free) is wired: `components/Analytics.tsx`, CSP in `lib/seo/csp.ts`, `data-umami-event` on watch, directions, share, play, find-on, google-rating. **`NEXT_PUBLIC_UMAMI_WEBSITE_ID` is not set in Vercel production**, so nothing is recorded. `NEXT_PUBLIC_SITE_URL` is also unset (issue #58).
- `components/NearMeList.tsx` already sorts a city's cards by distance on the device. `PRODUCT.md`: opt-in distance, location never leaves the device.
- `components/ShareButton.tsx` uses `navigator.share` with copy-link fallback.
- `places.status` enum (`open|closed|moved`) exists, but `visibleRows` in `lib/public/queries.ts` never filters on it. Only the worker (`lib/worker/geo.ts`) does; no public read path filters closed places today.
- `reports` table exists (kinds `closed|moved|wrong-info|other`, salted IP hash). 0 rows. No admin view lists reports.
- `dish_aliases`: 25 rows for 331 dishes. Search is pg_trgm on name and alias (`lib/public/search.ts`). Misses are logged (`lib/search-misses.ts`, `/admin/searches`), with no action to fix one.
- Creator kit (`/creator/[slug]/kit`) has page URL and SVG badge. #42 is outreach, not code.
- `places.slug` is globally unique.

## Owner decisions (2026-11-10)

- Keep Umami. Do not switch to Vercel Analytics.
- Home page: "Near me" control on top; city sections stay below, unchanged.
- Closed reports: flag only. Admin decides. No auto-hide.

## Global constraints (from PRODUCT.md, apply to every feature)

- No cookies, no accounts. `localStorage` is allowed for the eat list (device-only, never sent except inside a URL the user chooses to share).
- Location never leaves the device. No coordinates in any request.
- Never invent data: no hours, prices, ratings, photos. "Closed" shown only as "reported by visitors" until admin confirms.
- WCAG 2.2 AA, 44px tap targets, works at 360px and 200% zoom, CLS 0, Lighthouse mobile >= 90.
- Next.js 16 Cache Components: dynamic reads (`searchParams`, `localStorage`) inside `<Suspense>` or client islands.
- Opted-out creators and unapproved picks never appear, including in shared lists and the near-me index.

---

## 1. Analytics that records

**Goal:** know the action rate (sessions with a watch or directions click), share rate, and how many visits come from shares.

- One typed helper `track(event, data?)` in `lib/track.ts` that calls `window.umami?.track`. No-op when Umami absent. Existing `data-umami-event` attributes stay.
- Event names (exact, kebab-case): existing `watch`, `directions`, `share`, `play`, `find-on`, `google-rating`; new `search` (`{ results: "0"|"1-5"|"6+" }`), `near-me` (`{ result: "granted"|"denied"|"area"|"none-nearby" }`), `save` / `unsave` (`{ place }`), `list-share` (`{ size }`), `list-open` (`{ size, own: "yes"|"no" }`), `list-save-all`, `report` (`{ kind }`).
- Shared links carry `utm_source=share&utm_medium=<native|copy|whatsapp>` so Umami attributes share-driven visits. Canonical tags already strip them for SEO.
- Owner task: create the Umami Cloud site, set `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_SITE_URL` in Vercel production, redeploy. Closes #58 partially.
- `docs/metrics.md`: 4 weekly numbers and where to read each in Umami. (1) Action rate = sessions with `watch` or `directions` / sessions. (2) Share rate = `share` + `list-share` events / sessions. (3) Share-driven visits = sessions with `utm_source=share`. (4) Zero-result search rate = `search` events with `results=0` / all `search` events.

## 2. Eat list (save + share)

**Goal:** someone saves 3 to 10 places, sends one link to a WhatsApp group, friends open it and see a proper preview.

- Save: a heart toggle "Save" on every pick card (`PickList`) and the place page. Stored in `localStorage` key `ifr:list:v1` as a JSON array of place slugs, newest first, max 30. Cross-tab sync through the `storage` event.
- Header link "My list" with count (client island in a fixed-width slot so mounting causes no layout shift; count hidden until mounted).
- `/list` without params: client reads storage and replaces URL with `/list?p=slug1,slug2`. Empty list shows how to save.
- `/list?p=...`: server renders the cards with `getPlaceCards(..., { includeClosed: true })`, then re-sorts into URL order (saved order, not score). Hidden (unapproved, opted-out) or unknown slugs are dropped; closed places stay with a "Closed" label so the list owner sees why. Max 30 slugs, each must match `^[a-z0-9-]{1,80}$`; invalid ones ignored. `noindex`.
- If the URL list equals the visitor's own list: show Share, Remove per item, Clear. Otherwise ("a friend's list"): show "Save all to my list".
- Share text: `"<N> places to eat in <City>, picked by <M> food vloggers"` (or "across <K> cities"). Plus a direct "Send on WhatsApp" link (`https://wa.me/?text=<text> <url>`) for desktop.
- Preview image: `/api/og/list?p=...` route returning the existing `ogCard` style (1200x630) with up to 5 place names and the creator count. `generateMetadata` points `openGraph.images` there. Cached by CDN (`s-maxage=86400`).

**Non-goals:** accounts, server-stored lists, list names, collaborative editing.

## 3. "Near me" on the home page

**Goal:** someone on the street opens the site and in two taps sees what vloggers recommend within walking or auto distance.

- Home gets a `HomeNearMe` client island above the city sections: button "Picks near me", plus the existing area/landmark text search fallback (reuse `/api/geocode`, which needs a city: a city `<select>` next to the field, default `delhi`, first in `CITIES`).
- Data: `GET /api/near-index` returns all visible `PickCard`s across cities (approx 484 now). Public, CDN-cached (`s-maxage=300, stale-while-revalidate=300`, short so a place an admin confirms closed leaves near-me quickly), tag `public`. Fetched only after the tap. The sort happens on the device. No coordinates are ever sent.
- Ranking (explainable, shown in one line under the list): places within 5 km, grouped into 500 m bands, nearest band first; inside a band, more creators first. Show top 10 with distance.
- No place within 5 km: show the 5 nearest with distance if the nearest is under 50 km; otherwise "No picks near you yet" and the city list stays.
- The size budget: index response under 80 KB gzip. When it passes that (around 1,000 places), split per city by nearest city centroid. Out of scope now; noted in the code.
- Reuse `sortByDistance` and `haversineKm` from `components/near-me.ts`; add the band sort there.

**Non-goals:** meal or "open now" filters (no data; inventing hours is banned), background location, sending coordinates to the server.

## 4. Trust and freshness

**Goal:** a visitor can see how recent the proof is, and a closed place stops being recommended within a day of an admin confirming it.

- Card and place page show "Last in a video: Mar 2026" from the newest pick date (`pickedOn`, already on `PickCard`).
- Closed places: `visibleRows` gets an `includeClosed` option, default false, which adds `places.status <> 'closed'`. Every list path uses the default (home, city, dish, area, creator, near-me index, `nearbyCards`); `search.ts`, `spatial.ts`, `sitemap.ts` and `lib/geo.ts` add the same condition in SQL. `getPlace` and `/list` pass `includeClosed: true`. New column `places.status_changed_at timestamptz null`, set whenever admin changes status. The place page stays reachable by direct link with a "Closed (confirmed by the site, <month>)" banner and `noindex`, so shared links do not 404.
- Moved places: stay listed, with "Reported moved: check the location before you go".
- Flag: a place with reports of kind `closed` or `moved` from 3 or more distinct `ip_hash` in the last 60 days, unresolved, shows "Visitors reported this closed. We are checking." on the place page and card. Ranking unchanged.
- Flag rule, exact: count distinct non-null `ip_hash` among reports of kind `closed` or `moved` for the place with `created_at > now() - 60 days` and `resolved_at is null`; flagged when count >= 3. Null-hash reports do not count. Salt rotation resets counts; accepted.
- New column `reports.resolved_at timestamptz null`. Admin page `/admin/reports`: unresolved reports grouped by place, flagged ones first, with messages. Actions: "Still open" (resolve all, set `last_verified = today`), "Mark closed", "Mark moved" (set status, resolve all, `last_verified = today`). Each revalidates the `public` tag.
- Place page: a "Closed or moved?" link next to Directions that jumps to the existing report form with kind `closed` preselected (link `#report`, button sets the select value client-side).

## 5. Creator story images and better search

### 5a. Creator story image

**Goal:** a creator posts "I'm on this map" to Instagram Stories in one step.

- `/creator/[slug]/story` route returns a 1080x1920 PNG (same `ImageResponse` and fonts as `lib/seo/og.tsx`): creator name, "My picks on Indian Food Recommends", top 5 places by rank with city, site URL. No photos (we do not license any).
- Kit page adds "Download story image" and a page link with `utm_source=creator&utm_campaign=<slug>`.
- `docs/outreach.md`: message template, the tracking link per creator, a table to log who was contacted and when. Outreach itself is the owner's (#42).

### 5b. Hinglish and Hindi search

**Goal:** "golgappe", "puchka", "पानी पूरी", "chhole" all find the same dish.

- `lib/synonyms.ts`: hand-written groups of equivalent dish terms, Latin spellings plus Devanagari, for the top 40 dishes by approved picks and common street foods. Example group: `["pani puri", "gol gappe", "golgappa", "puchka", "phuchka", "पानी पूरी", "गोलगप्पे"]`.
- `expandQuery(q): string[]` returns `[q, ...group terms]` when `normalizeName(q)` equals a group term or contains one as a whole-word substring; otherwise `[q]`. No fuzzy matching in JS; pg_trgm still handles typos per term.
- `searchAll` runs the dish query with every expanded term OR'd, score = max similarity over terms. A synonym hit scores the same as a direct hit (the terms are equivalent by definition). Places and creators keep using only the raw `q`.
- `/admin/searches`: each miss gets "Add as alias of <dish>" (dish select by name search). Inserts into `dish_aliases`, deletes that miss row, revalidates `public`. The miss list becomes the to-do list for search.

**Non-goals:** general Devanagari transliteration, place-name synonyms, a Hindi UI.

---

## Anti-goals (a failure even if it works)

- Any location or list data stored on the server tied to a person.
- A shared link that shows a hidden, opted-out, or unapproved pick.
- A place shown as "closed" because of anonymous reports alone.
- New layout shift or Lighthouse drop on the home page from the near-me island.

## Left to the builder

Visual details within `DESIGN.md`, copy within the rules above, test fixture data, exact Umami dashboard setup.
