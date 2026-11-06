# IndianFoodRecommends Plan 2: Public Site (Sprint 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors can find approved Delhi picks by dish, place, creator or search, watch the exact video moment, get directions, and report a wrong place.

**Architecture:** Pure data functions in `lib/public/*.ts` take a `Db` and are tested against Postgres. Thin cached wrappers in `app/(public)/data.ts` add `'use cache'` + `cacheTag`. Pages read `params` inside `<Suspense>` (Cache Components; no `generateStaticParams`, so builds never touch the DB). The home-machine worker invalidates tags through a secret-protected `/api/revalidate` after each run.

**Tech Stack:** Next.js 16.4 App Router with `cacheComponents: true`, Drizzle + postgres-js, Tailwind 4 tokens in `app/globals.css`, MapLibre GL + OpenFreeMap tiles (no key), Playwright.

**Spec:** `docs/02-wireframes.md` (W1-W4), `docs/04-prd.md` (P1-P6, ranking, content rules, non-functional), `docs/05-tech-design.md` §4-5, `docs/06-sprints.md` S2-1..S2-10.

## Global Constraints

- Only `recommendations.status = 'approved'` rows are public, and only for creators with `opted_out = false`.
- Ranking: `score = distinct_creators_count * 10 + recency_bonus(0-5)`; shown as "Picked by N creators". `recency_bonus` = 5 if newest pick ≤ 30 days old, 3 if ≤ 90, 1 if ≤ 365, else 0.
- Every pick shows the creator name and a link to the original video/post.
- Our note ≤ 140 chars; never render video titles or descriptions (we do not store them).
- Embeds: `https://www.youtube-nocookie.com/embed/{id}?start={ts}` and Instagram, both behind a click facade (nothing third-party loads before click).
- Directions: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`; hidden when lat/lng is null. Places with `osm_id` starting `approx:` show "Approximate location (neighbourhood)".
- WCAG 2.2 AA: 4.5:1 contrast (existing tokens), visible `:focus-visible`, 44px tap targets, no horizontal overflow at 360px, map always has the list alternative.
- Every list has loading, empty ("No picks yet for X in Y") and error states.
- Copy: no generic CTAs, no invented numbers. Placeholder cities (Mumbai, Kolkata) render as non-links labelled "soon".
- Routes: `/`, `/[city]`, `/[city]/[dish]`, `/[city]/place/[slug]`, `/creator/[slug]`, `/search?q=`, `POST /api/report`, `POST /api/revalidate`. Unknown slug → `notFound()`.
- Cache tags: `city:{slug}`, `dish:{slug}`, `place:{slug}`, `creator:{slug}`, `public` (everything). `revalidateTag(tag, 'max')` (two-arg form; one-arg is deprecated).
- Reports: no login; zod body `{ placeId: int, kind: "closed"|"moved"|"wrong-info"|"other", message?: string ≤ 500 }`; IP stored only as SHA-256 of `ip + REPORT_SALT`; 6th report per IP hash per minute → 429.
- Tests colocated as `*.test.ts`; DB suites use `testDb()` and skip when `DATABASE_URL_TEST` is unset (`handle?.db`, never `handle!.db`).

## Review Focus

1. Opted-out creator's picks or a rejected/pending pick reaching any public page or search → excluded (Task 1 tests).
2. Same creator recommending one place in two videos counted twice in "Picked by N" → counts distinct creators (Task 1 test).
3. Search input with `%`, `_`, quotes, 500+ chars or only spaces → no SQL error, length capped at 100, blank returns empty (Task 6 test).
4. Place with null lat/lng on the map or directions → omitted from map pins, no directions button, still listed (Task 3 and Task 4 tests).
5. `/api/revalidate` or `/api/report` called with wrong secret, bad JSON or burst traffic → 401 / 400 / 429, DB unchanged (Task 7 and Task 8 tests).

---

## File Structure

```
lib/public/rank.ts          rankPlaces, recencyBonus (pure)
lib/public/queries.ts       getHome, getCity, getDishInCity, getPlace, getCreator (Db in, plain objects out)
lib/public/search.ts        searchAll
lib/public/links.ts         directionsUrl, youtubeEmbedUrl, sourceUrl, formatTs
lib/report.ts               ReportInput, createReport, hashIp
app/(public)/data.ts        'use cache' + cacheTag wrappers around lib/public
app/(public)/layout.tsx     header (city switcher), footer (credit + opt-out)
app/(public)/page.tsx       W1 home
app/(public)/[city]/page.tsx
app/(public)/[city]/[dish]/page.tsx   W2
app/(public)/[city]/place/[slug]/page.tsx  W3
app/(public)/creator/[slug]/page.tsx  W4
app/(public)/search/page.tsx
components/EmbedFacade.tsx  client, click-to-load YT/IG
components/PlaceMap.tsx     client, MapLibre
components/ReportForm.tsx   client
app/api/report/route.ts
app/api/revalidate/route.ts
lib/revalidate-client.ts    worker → /api/revalidate
e2e/public.spec.ts, playwright.config.ts, e2e/seed.ts
```

`app/page.tsx` (placeholder) is deleted; `(public)` group owns `/`.

---

### Task 1: Public data layer + ranking (S2-3 data, Review Focus 1-2)

**Files:** Create `lib/public/rank.ts`, `lib/public/rank.test.ts`, `lib/public/queries.ts`, `lib/public/queries.test.ts`, `lib/public/links.ts`, `lib/public/links.test.ts`

**Interfaces — Produces:**

```ts
// rank.ts
export function recencyBonus(newest: Date, now: Date): 0 | 1 | 3 | 5;
export function rankScore(creators: number, newest: Date, now: Date): number;
// links.ts
export function directionsUrl(lat: number | null, lng: number | null): string | null;
export function youtubeEmbedUrl(videoId: string, ts: number | null): string;
export function sourceUrl(platform: "youtube" | "instagram", id: string, ts: number | null): string;
export function formatTs(seconds: number | null): string | null; // 252 → "4:12", 3725 → "1:02:05"
// queries.ts
export type PickCard = {
  placeSlug: string;
  placeName: string;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  approx: boolean;
  creators: { slug: string; name: string }[];
  dishes: string[];
  proof: {
    platform: "youtube" | "instagram";
    externalId: string;
    tsSeconds: number | null;
    creator: string;
  };
  score: number;
};
export function getHome(
  db: Db,
  citySlug: string,
  now?: Date,
): Promise<{
  city: { slug: string; name: string };
  dishes: { slug: string; name: string; picks: number }[];
  creators: { slug: string; name: string; picks: number }[];
  recent: PickCard[];
} | null>;
export function getDishInCity(
  db: Db,
  citySlug: string,
  dishSlug: string,
  now?: Date,
): Promise<{ city; dish: { slug; name }; places: PickCard[]; creatorCount: number } | null>;
export function getCity(
  db: Db,
  citySlug: string,
  now?: Date,
): Promise<{ city; dishes; places: PickCard[] } | null>;
export function getPlace(
  db: Db,
  citySlug: string,
  placeSlug: string,
): Promise<{
  place: { slug; name; locality; lat; lng; approx; lastVerified: string | null };
  dishes: { name: string; slug: string; creators: number }[];
  proofs: {
    platform;
    externalId;
    tsSeconds;
    note: string | null;
    creator: { slug; name };
    dish: string;
  }[];
} | null>;
export function getCreator(
  db: Db,
  slug: string,
  dishSlug?: string,
): Promise<{
  creator: { slug; name; ytChannelId; igHandle };
  dishes: { slug; name }[];
  picks: PickCard[];
} | null>; // null when not found OR opted out
```

`approx` = `osm_id` starts with `approx:`. `PickCard.proof` = that place's earliest approved pick with a timestamp, else earliest. Places sorted by `score` desc, then name.

- [ ] **Step 1: Failing tests.** `rank.test.ts`: `recencyBonus` at 10/60/200/400 days → 5/3/1/0; `rankScore(3, …10 days)` → 35. `links.test.ts`: `directionsUrl(null, 77)` → null; `directionsUrl(28.6, 77.2)` → `"https://www.google.com/maps/dir/?api=1&destination=28.6,77.2"`; `youtubeEmbedUrl("abc", 252)` → `"https://www.youtube-nocookie.com/embed/abc?start=252"`; `youtubeEmbedUrl("abc", null)` has no `start`; `sourceUrl("youtube","abc",252)` → `"https://www.youtube.com/watch?v=abc&t=252s"`; `sourceUrl("instagram","C9x",null)` → `"https://www.instagram.com/reel/C9x/"`; `formatTs(252)` → `"4:12"`, `formatTs(3725)` → `"1:02:05"`, `formatTs(null)` → null. `queries.test.ts` (DB): seed Delhi, 3 creators (one `opted_out`), places A (2 creators, one creator twice via 2 videos), B (1 creator), C (only a pending pick), D (only an opted-out creator's pick):
  - `getDishInCity` returns A then B; A `creators.length === 2`; C and D absent
  - `getHome(...).dishes[0].picks` counts approved, non-opted-out rows only
  - `getPlace` for C → null (no approved picks); for A → proofs exclude the opted-out creator
  - `getCreator(optedOutSlug)` → null; `getCreator(slug, dishSlug)` filters picks to that dish
  - unknown city/dish/place slug → null
- [ ] **Step 2:** `DATABASE_URL_TEST=… pnpm vitest run lib/public` → FAIL (modules missing).
- [ ] **Step 3:** Implement. Queries in Drizzle with one shared `approvedVisible` join condition (`status='approved'` and `creators.opted_out=false`); aggregate with `count(distinct creator_id)` and `max(sources.published_on)` per place.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5: Commit** `feat(public): data layer and ranking (S2-3)`.

---

### Task 2: Layout, home, city page (S2-1, S2-2)

**Files:** Create `app/(public)/data.ts`, `app/(public)/layout.tsx`, `app/(public)/page.tsx`, `app/(public)/[city]/page.tsx`, `app/(public)/loading.tsx`, `app/(public)/error.tsx`, `components/PickList.tsx`. Delete `app/page.tsx`.

**Interfaces — Consumes:** Task 1 `getHome`, `getCity`, `PickCard`. **Produces:** `app/(public)/data.ts` exports `cachedHome(city)`, `cachedCity(city)`, `cachedDish(city, dish)`, `cachedPlace(city, slug)`, `cachedCreator(slug, dish?)`, each `'use cache'`, `cacheLife('hours')`, `cacheTag('public', …specific tags)`. `components/PickList.tsx` (server): `PickList({ cards, citySlug, emptyText })` renders one card per `PickCard`: rank number, place link, locality, "Picked by N creator(s)", creator names, "Watch moment (4:12)" link to `sourceUrl`, Directions link when `directionsUrl` non-null.

- [ ] **Step 1:** Layout: header with site name link and city switcher (Delhi link; Mumbai, Kolkata as non-links "soon"); footer: "Picks come from the creators credited on each page." plus, when `NEXT_PUBLIC_OPTOUT_EMAIL` is set, "Creators can ask us to remove their picks: {mailto link}"; when unset, "Creator opt-out contact coming soon" as plain text (no dead link).
- [ ] **Step 2:** Home (W1) for Delhi: search form (GET `/search`, `name="q"`, label "Search dish, place or creator"), Popular dishes (top 8, links `/delhi/{dish}`, "N picks"), Creators (links `/creator/{slug}`), Recently added (`PickList` of 6). `/[city]`: dishes list + `PickList` of top places; unknown city → `notFound()`.
- [ ] **Step 3:** `loading.tsx` skeleton (3 grey blocks, `aria-busy`), `error.tsx` client with "Could not load picks." + Retry button calling `reset()`.
- [ ] **Step 4: Verify** `pnpm typecheck && pnpm lint && env -u DATABASE_URL pnpm build` → exit 0 (build must not need a DB). Then `pnpm dev` against local DB with picks, `curl -s localhost:3000/ | grep -c "Picked by"` ≥ 1 and `curl -s -o /dev/null -w '%{http_code}' localhost:3000/nowhere` → 404.
- [ ] **Step 5: Commit** `feat(public): layout, home and city pages (S2-1, S2-2)`.

---

### Task 3: Dish page + map (S2-3 UI, S2-4)

**Files:** Create `app/(public)/[city]/[dish]/page.tsx`, `components/PlaceMap.tsx`, `components/ListMapToggle.tsx`, `components/map-points.ts`, `components/map-points.test.ts`. Add dependency `maplibre-gl`.

**Interfaces — Produces:** `mapPoints(cards: PickCard[]): { slug: string; name: string; lat: number; lng: number; approx: boolean }[]` (drops null coords). `PlaceMap({ points, citySlug })` client component: OpenFreeMap style `https://tiles.openfreemap.org/styles/liberty`, fits bounds to points, marker popup links to the place page; renders nothing but a note when `points` is empty.

- [ ] **Step 1: Failing test** `map-points.test.ts`: cards with one null-lat place → that place omitted, others kept with `approx` flag.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `mapPoints`, page (heading "{Dish} in {City}", subline "{N} places picked by {M} food vloggers", `ListMapToggle` with List default and Map tab; map loaded via `next/dynamic` with `ssr: false` so the list renders first), empty text "No picks yet for {Dish} in {City}". **Step 4:** Run → PASS; `pnpm build` (no DB) → exit 0.
- [ ] **Step 5: Commit** `feat(public): dish page with list and map (S2-3, S2-4)`.

---

### Task 4: Place page + embed facades (S2-5)

**Files:** Create `app/(public)/[city]/place/[slug]/page.tsx`, `components/EmbedFacade.tsx`, `components/EmbedFacade.test.tsx` (vitest + `@testing-library/react` + jsdom for this file only via `// @vitest-environment jsdom`).

**Interfaces — Produces:** `EmbedFacade({ platform, externalId, tsSeconds, creator })` client: before click renders a `<button>` "Play {creator}'s video at 4:12" (or "Open {creator}'s reel" for Instagram) and no `<iframe>`; after click renders the YouTube iframe (`youtubeEmbedUrl`) or, for Instagram, an iframe to `https://www.instagram.com/reel/{id}/embed`.

- [ ] **Step 1: Failing test:** no iframe before click; after `click` exactly one iframe whose `src` equals `youtubeEmbedUrl(id, 252)`; Instagram variant src ends `/reel/{id}/embed`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement facade and page (W3): name, locality, "Last verified {Mon YYYY}" when set, approx note, Directions (hidden without coords), "What creators ordered" (dish × creators), Proof list (facade + creator link + our note + "Open original" link via `sourceUrl`), small `PlaceMap` with one point, `ReportForm` slot (Task 7 fills it; render nothing until then).
- [ ] **Step 4:** Run → PASS; build → exit 0.
- [ ] **Step 5: Commit** `feat(public): place page with click-to-load embeds (S2-5)`.

---

### Task 5: Creator page (S2-6)

**Files:** Create `app/(public)/creator/[slug]/page.tsx`.

**Interfaces — Consumes:** `cachedCreator(slug, dish?)`.

- [ ] **Step 1:** Page (W4): name, YouTube channel link (`https://www.youtube.com/channel/{id}`), Instagram link when `igHandle`, "{N} picks · Delhi", dish filter as a GET form (`<select name="dish">` + submit "Filter") so it works without JS, `PickList`. Opted-out or unknown → `notFound()`. `searchParams` read inside Suspense.
- [ ] **Step 2: Verify** with local DB: `/creator/bhooka-saand` 200 and contains "Bhooka Saand"; `/creator/bhooka-saand?dish=butter-chicken` lists only butter-chicken picks (Task 1 test already pins the filter).
- [ ] **Step 3: Commit** `feat(public): creator page with dish filter (S2-6)`.

---

### Task 6: Search (S2-7, Review Focus 3)

**Files:** Create `lib/public/search.ts`, `lib/public/search.test.ts`, `app/(public)/search/page.tsx`.

**Interfaces — Produces:** `searchAll(db: Db, q: string): Promise<{ dishes: {slug; name; citySlug: "delhi"}[]; places: {slug; name; locality; citySlug}[]; creators: {slug; name}[] }>`. Input trimmed, cut to 100 chars, lowercased; blank → all empty. Matches `similarity(...) >= 0.3` or `ILIKE '%' || q || '%'` (q passed as a bind parameter; `%`/`_` escaped) against dish names + dish aliases, place names + place aliases, creator names. Only entities with ≥1 public pick. Each list max 10, by best score.

- [ ] **Step 1: Failing tests:** `"chole bature"` → Chole Bhature first; `"chachey"` → Chache Di Hatti; `"bhooka"` → creator; `"   "` → all empty; `"100%_'; drop"` → no throw, empty; a 500-char string → no throw; a dish whose only pick is pending → absent.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement + page (results grouped Dishes / Places / Creators, empty text "Nothing found for “{q}”. Try a dish like chole bhature."). Search is uncached (dynamic), inside Suspense. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(public): typo-tolerant search (S2-7)`.

---

### Task 7: Report a problem (S2-8, Review Focus 5)

**Files:** Create `lib/report.ts`, `lib/report.test.ts`, `app/api/report/route.ts`, `components/ReportForm.tsx`; wire `ReportForm` into the place page.

**Interfaces — Produces:** `ReportInput` (zod, per Global Constraints); `hashIp(ip: string, salt: string): string` (hex SHA-256); `createReport(db, input, ipHash, now?): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 429 }>`. Route: `POST` JSON → `createReport`, IP from `x-forwarded-for` first entry, salt `REPORT_SALT` (env; route returns 503 if unset in production).

- [ ] **Step 1: Failing tests (DB):** valid → row with `ip_hash` ≠ raw IP; unknown `placeId` → 404, no row; `kind: "spam"` → 400; message 501 chars → 400; 6th call same hash within 60 s → 429 and still 5 rows; other hash unaffected.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; `ReportForm` client: `<details>` "Report a problem" → radio kinds + optional textarea + Send; shows "Thanks, we will check this place." or the error text; `aria-live="polite"`. Add `REPORT_SALT` to `.env.example` and Vercel (production, preview). **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(public): report a problem with rate limit (S2-8)`.

---

### Task 8: Revalidation on approve (S2-9, Review Focus 5)

**Files:** Create `app/api/revalidate/route.ts`, `app/api/revalidate/route.test.ts`, `lib/revalidate-client.ts`; modify `worker/cli.ts`, `app/admin/review/actions.ts`.

**Interfaces — Produces:** route `POST { tags: string[] }` with header `authorization: Bearer ${REVALIDATE_SECRET}`; tags must match `/^(public|(city|dish|place|creator):[a-z0-9-]{1,80})$/`, max 200; calls `revalidateTag(tag, 'max')` each; 401 wrong/missing secret, 400 bad body, 503 secret unset. `notifyRevalidate(tags: string[], opts?: { url?: string; secret?: string; fetchImpl? }): Promise<boolean>` (never throws; logs failures). Worker calls `notifyRevalidate(["public"])` after auto-review when `approved > 0`, using `SITE_URL` + `REVALIDATE_SECRET` from `.env`. Admin approve/merge/manual-add call `revalidateTag("public", "max")`.

- [ ] **Step 1: Failing tests:** route handler with `next/cache` mocked: no header → 401 and `revalidateTag` not called; bad tag `"place:../x"` → 400; valid → 200 and called once per tag with `'max'`. `notifyRevalidate` with fetch returning 500 → `false`, no throw.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; set `REVALIDATE_SECRET` (random 32 bytes) in Vercel prod/preview and local `.env`, `SITE_URL=https://indian-food-recommends.vercel.app` in `.env`. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: tag revalidation from worker and admin (S2-9)`.

---

### Task 9: E2E search → place → watch (S2-10)

**Files:** Create `playwright.config.ts`, `e2e/seed.ts`, `e2e/public.spec.ts`; modify `.github/workflows/ci.yml` (db job: migrate, `tsx e2e/seed.ts`, `pnpm build`, `pnpm exec playwright install --with-deps chromium`, `pnpm e2e`), `package.json` (`"e2e": "playwright test"`). Vitest must ignore `e2e/**`.

**Interfaces — Consumes:** all public routes. `e2e/seed.ts` inserts Delhi, creator "E2E Creator", place "Chache Di Hatti" (lat 28.68, lng 77.21), dish "Chole Bhature" + alias "chole bature", one approved YouTube pick `externalId: "dQw4w9WgXcQ"`, ts 252.

- [ ] **Step 1:** Spec: visit `/`, type `chole bature` in search, submit → Chole Bhature result → click → dish page lists "Chache Di Hatti" with "Picked by 1 creator" → open place → no iframe present → click "Play E2E Creator's video at 4:12" → iframe `src` contains `youtube-nocookie.com/embed/dQw4w9WgXcQ?start=252`. Second test at viewport 360×740: `document.documentElement.scrollWidth <= 360` on home, dish and place pages.
- [ ] **Step 2:** Run locally `pnpm build && pnpm e2e` against `ifr_test` seeded → PASS.
- [ ] **Step 3: Commit** `test(e2e): search to watch flow and 360px overflow (S2-10)`; push; CI `db` job green.

---

## Self-Review

- **Spec coverage:** P1 → T6 (+T1 ranking); P2 → T4; P3 → T3; P4 → T5; P5 → T1 links + T3/T4; P6 → T7; S2-1..S2-10 → T2, T2, T1+T3, T3, T4, T5, T6, T7, T8, T9. W1-W4 → T2-T5. Out of plan: SEO/JSON-LD/sitemap (Sprint 3), submit form (Sprint 4), Hindi UI (open question).
- **Type consistency:** `PickCard`, `cached*`, `directionsUrl`, `youtubeEmbedUrl`, `sourceUrl`, `formatTs`, `mapPoints`, `searchAll`, `createReport`, `notifyRevalidate` names match across tasks.
- **Proportion:** signatures, values and test assertions; bodies left to the implementer.
