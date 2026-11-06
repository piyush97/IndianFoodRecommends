# IndianFoodRecommends Plan 4: Growth (Sprint 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three cities instead of one, visitors can submit picks, places can be sorted by distance, stale places get flagged, and creators get a share kit.

**Architecture:** A city registry (`lib/cities.ts`) replaces every hard-coded "Delhi": auto-review, Jev screening, geocoding, admin and public pages read the city from data. Public submissions go through Vercel BotID + the existing per-IP rate limit, land as `origin='community'` pending picks, and are decided by the same Jev auto-review used for LLM picks. "Near me" sorting runs in the browser on already-loaded coordinates (no location leaves the device). A stale-places check is a SQL view surfaced in admin.

**Tech Stack:** Next.js 16.4, Drizzle, `botid` (Vercel BotID, basic mode, no extra account), Jev, MapLibre (existing).

**Spec:** `docs/06-sprints.md` S4-1..S4-5, `docs/02-wireframes.md` W5, `docs/04-prd.md` (S1 story, content rules, privacy), Plan 2 deferred minor "creator page hardcodes delhi".

## Global Constraints

- Cities #2 and #3 are Mumbai and Kolkata (already shown as "soon" in the header). A city page shows "soon" until it has ≥ 1 visible pick.
- City registry is the single source of a city's slug, name, state and match names (e.g. Delhi NCR → Gurgaon, Noida). No other file names a city.
- Submissions: no login; BotID `checkBotId()` must pass (dev: always human); IP rate limit 3 per hour per IP hash; URL must parse with `parseSourceUrl`; creator must exist (picked from a list); place name 2-80 chars, dish 2-60 chars, timestamp optional `m:ss` or `h:mm:ss`. Stored as pending, `origin='community'`, never published without the auto-review pass. No video text is stored.
- Near me: opt-in button; uses `navigator.geolocation` only after click; coordinates never sent to the server or analytics; denied/unsupported → list stays in rank order with a message.
- Stale: a place is stale when `last_verified` is null or older than 365 days and it has a visible pick; admin page lists them oldest first.
- Creator kit: `/creator/[slug]/kit` shows a share link and an embeddable badge (`<a><img src="/creator/[slug]/badge.svg">`); badge SVG text-only, escaped, counts from public data. Outreach itself (contacting 3 creators) is the owner's step.
- All earlier constraints stand: only approved + not-opted-out data is public, builds pass without a DB, axe 0 serious, CSP unchanged except BotID's same-origin endpoints.

## Review Focus

1. A Mumbai pick approved under Delhi (or vice versa) because a city name is matched loosely → strict registry match (Task 1 test).
2. Submission flood / bot / duplicate URL → BotID 403, 429 after 3/h, duplicate source reuses row without double pick (Task 3 tests).
3. Community submission auto-approved with a place the video does not mention → same Jev grounding gate as LLM picks, using the creator's feed text; video not in feed → rejected (Task 3 test).
4. Location denied or a place without coordinates in "near me" → no crash, coordinate-less places sort last (Task 4 test).
5. Badge SVG with a creator name containing `<` or `&` → escaped (Task 6 test).

---

### Task 1: City registry, multi-city pipeline and pages (S4-2 code)

**Files:** Create `lib/cities.ts`, `lib/cities.test.ts`; modify `db/seed-data.ts` (cities from registry + Mumbai/Kolkata creators), `lib/auto-review.ts`, `lib/jev.ts`, `lib/worker/ingest.ts`, `app/(public)/page.tsx`, `app/(public)/layout.tsx`, `app/(public)/creator/[slug]/page.tsx`, `components/PickList.tsx`, `lib/public/queries.ts` (`PickCard.citySlug`), `app/admin/review/page.tsx`.

**Interfaces — Produces:**

```ts
export type City = { slug: string; name: string; state: string; aliases: string[] };
export const CITIES: readonly City[]; // delhi, mumbai, kolkata
export function cityFromName(name: string | null | undefined): City | null; // normalizeName exact match on name or alias
```

Auto-review: `decidePick` approves when `cityFromName(pick.city)` is a known city (not only Delhi), `in_city` Jev question asks about that city; unstated city → Jev choice over the 3 cities + "other" (≥ 0.8). `publish` uses the matched city's id and geocodes with `", {city.name}"`. Jev video screen: `city` choice is `known` (any registry city) / `other` / `unknown`. Home page renders sections for every city with ≥ 1 pick, Delhi first. Header: cities with picks are links, others "(soon)". Creator page: per-card `citySlug`, title "…food picks" without a city.

- [ ] **Step 1: Failing tests:** `cityFromName("Gurugram")` → delhi; `"Bombay"` → mumbai; `"Calcutta"` → kolkata; `"Pune"` → null; `decidePick({city:"Mumbai"},good)` approves; `{city:"Pune"}` → `not-supported-city`; auto-review DB test: Mumbai pick lands with `city_id` of Mumbai; `getCreator` cards carry their own `citySlug`.
- [ ] **Step 2-4:** FAIL → implement → PASS; build without DB; E2E still green.
- [ ] **Step 5:** Seed Mumbai + Kolkata and their creators (channel ids verified against live feeds) to Neon; run ingest; record approved counts per city in the ledger. The 100-picks-per-city target is reached over daily runs, not in this task.
- [ ] **Step 6: Commit** `feat: multi-city registry, Mumbai and Kolkata (S4-2)`.

### Task 2: Stale places (S4-4)

**Files:** Create `lib/stale.ts`, `lib/stale.test.ts`, `app/admin/stale/page.tsx`; link from admin header.

`stalePlaces(db, now?): Promise<{ slug; name; citySlug; lastVerified: string | null; picks: number }[]>`, oldest first (null first).

- [ ] **Step 1: Failing test (DB):** place verified 400 days ago listed; 100 days → absent; null → listed first; place with only pending picks → absent.
- [ ] **Step 2-4:** FAIL → implement (page calls `requireAdminPage()` first) → PASS.
- [ ] **Step 5: Commit** `feat(admin): stale places list (S4-4)`.

### Task 3: Public submit form (S4-1)

**Files:** Create `lib/submit.ts`, `lib/submit.test.ts`, `app/(public)/submit/page.tsx`, `components/SubmitForm.tsx`, `app/api/submit/route.ts`, `instrumentation-client.ts` (BotID protect `/api/submit` POST); modify `lib/auto-review.ts` (community picks use `extracted.submitted` + feed text), footer link "Suggest a pick".

**Interfaces — Produces:** `SubmitInput` (zod: `url`, `creatorSlug`, `placeName`, `dishName`, `timestamp?`, `city` one of registry slugs); `parseTimestamp("4:12")` → 252, `"1:02:05"` → 3725, invalid → error; `createSubmission(db, input, ipHash, now?) → { ok: true } | { ok: false; status: 400 | 404 | 429 }`.

Submission stores `sources` (reuse on conflict) + `recommendations { status:'pending', origin:'community', tsSeconds, extracted: { place_name, dishes:[dish], city, locality:null, timestamp_seconds, confidence: 0.6, submitted: true } }`. Auto-review processes `origin in ('llm','community')`.

- [ ] **Step 1: Failing tests:** valid → 1 pending community pick; same URL + same place again → no second row (dedupe) and `ok`; 4th from one IP within an hour → 429; unknown creator → 404; Instagram-free text URL → 400; `parseTimestamp` cases; route: `checkBotId` mocked `isBot:true` → 403 and no row.
- [ ] **Step 2-4:** FAIL → implement → PASS. Page copy per W5; success text "Thanks. We check every suggestion against the video before it shows."
- [ ] **Step 5: Commit** `feat: public submit form with BotID and rate limit (S4-1)`.

### Task 4: Near me (S4-3)

**Files:** Create `components/near-me.ts` (`sortByDistance(cards, origin): PickCard[]`, `haversineKm(a,b): number`), `components/near-me.test.ts`, `components/NearMeList.tsx` (client: "Sort by distance from me" button, wraps `PickList` cards); use on dish and city pages.

- [ ] **Step 1: Failing tests:** `haversineKm(Delhi, Gurgaon)` ≈ 25-35 km; sorted nearest first; null-coordinate cards last in original order.
- [ ] **Step 2-4:** FAIL → implement → PASS; E2E with Playwright `geolocation` permission granted sorts a seeded nearer place first; denied → message "Location is off, showing most picked first."
- [ ] **Step 5: Commit** `feat(public): opt-in near me sort (S4-3)`.

### Task 5 is folded into Task 1 (seed + ingest for new cities).

### Task 6: Creator kit (S4-5)

**Files:** Create `lib/badge.ts` (`badgeSvg({ name, picks }): string`), `lib/badge.test.ts`, `app/(public)/creator/[slug]/badge.svg/route.ts`, `app/(public)/creator/[slug]/kit/page.tsx` (noindex).

- [ ] **Step 1: Failing test:** name `A<b>&"c` → SVG contains `A&lt;b&gt;&amp;&quot;c` and no raw `<b>`; width grows with text; picks pluralised.
- [ ] **Step 2-4:** FAIL → implement → PASS; route returns `image/svg+xml`, cached; kit page shows share URL, badge preview and copyable HTML snippet.
- [ ] **Step 5: Commit** `feat: creator share kit and badge (S4-5)`. Contacting creators is the owner's step.

---

## Self-Review

- **Spec coverage:** S4-1 T3, S4-2 T1, S4-3 T4, S4-4 T2, S4-5 T6. Human: 100 picks/city accrues over daily runs; outreach to 3 creators.
- **Types:** `City`, `cityFromName`, `PickCard.citySlug`, `SubmitInput`, `sortByDistance`, `badgeSvg` consistent.
