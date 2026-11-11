# Growth Five Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make usage measurable, add a WhatsApp-shareable eat list, a home "Near me", closed-place trust signals, creator story images and Hinglish/Hindi dish search.

**Architecture:** Everything stays inside the existing Next.js 16 app. Lists and location live on the device (`localStorage`, geolocation). The server only gets public slugs in URLs and a cached, coordinate-free index. One migration adds `reports.resolved_at` and `places.status_changed_at`. Closed places get filtered out in one place, `visibleRows`, through an `includeClosed` option, plus the raw-SQL readers.

**Tech Stack:** Next.js 16.4 App Router (Cache Components), React 19.3, Drizzle 0.45 + Postgres/PostGIS (Neon), Vitest 5 + Testing Library, Playwright, Umami Cloud, `next/og` ImageResponse.

**Spec:** `docs/superpowers/specs/2026-11-10-growth-five-design.md`

## Global Constraints

- No cookies, no accounts. `localStorage` key `ifr:list:v1` only.
- No coordinates in any request. Near-me sorting happens on the device.
- Never invent hours, prices, ratings or photos. "Closed" text appears only after admin confirmation; anonymous reports produce "Visitors reported this closed. We are checking."
- Opted-out creators, unapproved picks and closed places never appear in lists, search, sitemap, map or near-me. Direct place URLs and `/list` still show closed places, labelled.
- WCAG 2.2 AA, 44px targets (`min-h-11`), no overflow at 360px, CLS 0, Lighthouse mobile >= 90.
- Dynamic reads (`searchParams`, `connection()`) sit inside `<Suspense>`. Cached reads use `"use cache"` + `cacheTag("public", ...)`.
- Event names are exactly: `watch`, `directions`, `share`, `play`, `find-on`, `google-rating`, `search`, `near-me`, `save`, `unsave`, `list-share`, `list-open`, `list-save-all`, `report`.
- Slug rule for URL input: `^[a-z0-9-]{1,80}$`, max 30 per list.
- Commits: GitButler (`but commit`), no Co-Authored-By trailer.
- After each task: `pnpm typecheck && pnpm lint && pnpm test` green.

## Review Focus

1. **A shared `/list` URL with tampered slugs** (unknown, opted-out creator, unapproved, 500 slugs, `../`) must render only the valid visible places and must never throw. Test in Task 4.
2. **Corrupt `localStorage`** (non-JSON, wrong type, 200 entries, key missing because of private mode or a `setItem` quota error) must give an empty or trimmed list, and the Save button must still work in memory. Test in Task 3.
3. **A place closed after someone saved or shared it** must still show on `/list` and its own page, labelled, and must disappear from city lists and search. Test in Task 7.
4. **Near-me with no place within 50 km** (a traveller abroad) or with denied permission must leave the home page usable and announce why. Test in Task 5.
5. **Synonym queries that overlap** (e.g. "chicken biryani" containing the "biryani" group, a Devanagari query with a trailing space) must not drop direct matches. Test in Task 9.

---

## Sequencing and model per task

| #   | Task                                                         | Feature | Depends on | Est.  | Model                                 |
| --- | ------------------------------------------------------------ | ------- | ---------- | ----- | ------------------------------------- |
| 1   | `track()` helper + new events + UTM links                    | 1       | none       | 3 h   | Sonnet                                |
| 2   | Owner setup: Umami site, Vercel env, `docs/metrics.md`       | 1       | 1          | 0.5 h | **You** + Haiku for doc               |
| 3   | Eat list store + Save button                                 | 2       | 1          | 4 h   | Sonnet                                |
| 4   | `/list` page, share, OG image                                | 2       | 3          | 6 h   | Opus (URL trust boundary, caching)    |
| 5   | `/api/near-index` + band sort + `HomeNearMe`                 | 3       | 1          | 6 h   | Sonnet                                |
| 6   | Migration: `reports.resolved_at`, `places.status_changed_at` | 4       | none       | 1 h   | Haiku                                 |
| 7   | Closed filter everywhere + flag + labels                     | 4       | 6          | 6 h   | Opus (touches every read path)        |
| 8   | `/admin/reports` queue + actions + "Closed or moved?" link   | 4       | 7          | 4 h   | Sonnet                                |
| 9   | Dish synonyms + `expandQuery` in search                      | 5b      | none       | 4 h   | Sonnet (Devanagari list: Opus review) |
| 10  | Admin "Add as alias" on search misses                        | 5b      | 9          | 2 h   | Haiku                                 |
| 11  | Creator story image + kit links + `docs/outreach.md`         | 5a      | 1          | 4 h   | Sonnet                                |
| 12  | E2E + a11y + Lighthouse pass, PR                             | all     | 1-11       | 3 h   | Sonnet                                |

Total about 44 hours of build time. Suggested PRs: A = 1-2, B = 3-4, C = 5, D = 6-8, E = 9-11, then 12 on the last PR. Each PR ships alone.

---

### Task 1: `track()` helper, new events, UTM on share links

**Files:**

- Create: `lib/track.ts`, `lib/track.test.ts`
- Modify: `components/ShareButton.tsx`, `components/ShareButton.test.tsx`, `components/NearMeList.tsx`, `components/HeaderSearch.tsx` or `app/(public)/search/page.tsx` (whichever renders results client-side; if server-only, add a tiny `<TrackSearch results=... />` client island), `components/ReportForm.tsx`

**Interfaces:**

- Produces: `type TrackEvent = "search" | "near-me" | "save" | "unsave" | "list-share" | "list-open" | "list-save-all" | "report" | "share"`; `track(event: TrackEvent, data?: Record<string, string>): void`; `withUtm(url: string, medium: "native" | "copy" | "whatsapp"): string`; `resultBucket(n: number): "0" | "1-5" | "6+"`.

- [ ] **Step 1: Write failing tests** in `lib/track.test.ts`:

```ts
it("calls umami when present", () => {
  const spy = vi.fn();
  (globalThis as any).window = { umami: { track: spy } };
  track("save", { place: "a" });
  expect(spy).toHaveBeenCalledWith("save", { place: "a" });
});
it("is a no-op without umami", () => {
  (globalThis as any).window = {};
  expect(() => track("save")).not.toThrow();
});
it("never throws when umami throws", () => {
  (globalThis as any).window = {
    umami: {
      track: () => {
        throw new Error("x");
      },
    },
  };
  expect(() => track("save")).not.toThrow();
});
it("adds utm and keeps existing params", () =>
  expect(withUtm("https://x.app/list?p=a,b", "whatsapp")).toBe(
    "https://x.app/list?p=a%2Cb&utm_source=share&utm_medium=whatsapp",
  ));
it("buckets results", () => {
  expect(resultBucket(0)).toBe("0");
  expect(resultBucket(5)).toBe("1-5");
  expect(resultBucket(6)).toBe("6+");
});
```

Add to `ShareButton.test.tsx`: the copied URL ends with `utm_source=share&utm_medium=copy`; `navigator.share` receives `utm_medium=native`.

- [ ] **Step 2:** `pnpm vitest run lib/track.test.ts components/ShareButton.test.tsx`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `lib/track.ts` (wrap in try/catch, guard `typeof window`). Declare `window.umami?: { track(e: string, d?: Record<string,string>): void }` in the same file. In `ShareButton`, wrap the URL with `withUtm` per path. `NearMeList.locate/search`: `track("near-me", { result })` with `granted|denied|area`. `ReportForm` on success: `track("report", { kind })`. Search: `track("search", { results: resultBucket(total) })` once per query.
- [ ] **Step 4:** run the same command. Expected: PASS. Then `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 5:** `but commit -b growth-analytics -m "feat: typed track() helper, search/near-me/report events, utm on shares"`

### Task 2: Owner setup and metrics doc

**Files:** Create `docs/metrics.md`. Modify `.env.example` (comment only).

- [ ] **Step 1 (you, about 10 min):** in Umami Cloud, add the site with domain = the production host. Copy the website ID.
- [ ] **Step 2 (you):** `vercel env add NEXT_PUBLIC_UMAMI_WEBSITE_ID production` and `vercel env add NEXT_PUBLIC_SITE_URL production` (value `https://indian-food-recommends.vercel.app` until a domain exists). Redeploy: `vercel --prod` or merge any PR.
- [ ] **Step 3: Verify:** open the prod site and click "Watch moment". The Umami realtime view must show a `watch` event within 60 s. In DevTools, the CSP must report no violations.
- [ ] **Step 4:** write `docs/metrics.md` with the 4 numbers from the spec (§1), each showing which Umami report and filter to open, plus a weekly log table (`week | sessions | action rate | share rate | share visits | zero-result %`).
- [ ] **Step 5:** `but commit -b growth-analytics -m "docs: weekly metrics and Umami setup"`. Comment on #58 that the env vars are set.

### Task 3: Eat list store + Save button

**Files:**

- Create: `lib/eat-list.ts`, `lib/eat-list.test.ts`, `components/SaveButton.tsx`, `components/SaveButton.test.tsx`, `components/ListLink.tsx`
- Modify: `components/PickList.tsx` (add `<SaveButton slug placeName />` in the action row), `app/(public)/[city]/place/[slug]/page.tsx` (next to Share), `app/(public)/layout.tsx` (header `<ListLink />`)

**Interfaces:**

- Produces from `lib/eat-list.ts`: `LIST_KEY = "ifr:list:v1"`, `MAX_LIST = 30`, `SLUG_RE = /^[a-z0-9-]{1,80}$/`, `parseList(raw: string | null): string[]` (dedupe, filter `SLUG_RE`, cap 30, never throws), `readList(): string[]`, `writeList(slugs: string[]): void` (swallows quota/private-mode errors, keeps an in-memory copy, dispatches `window` event `"ifr:list"`), `toggle(slug: string): boolean` (returns saved state; adds to front), `useEatList(): string[]` (React `useSyncExternalStore` over `storage` + `"ifr:list"` events; server snapshot `[]`), `listParam(slugs: string[]): string` (comma join).
- `SaveButton({ slug, placeName }: { slug: string; placeName: string })`: `<button aria-pressed>`, label "Save" / "Saved", sr-only " {placeName} to my list". Calls `track("save"|"unsave", { place: slug })`.
- `ListLink()`: link to `/list`, text "My list" + count in a `min-w-[2ch] tabular-nums` span. The span is empty before mount, so there's no layout shift.

- [ ] **Step 1: Failing tests** `lib/eat-list.test.ts`:

```ts
it("parses garbage to []", () => {
  for (const raw of [null, "", "{", "42", '{"a":1}', "[1,2]"]) expect(parseList(raw)).toEqual([]);
});
it("filters bad slugs, dedupes, caps 30", () => {
  const many = Array.from({ length: 40 }, (_, i) => `p-${i}`);
  expect(parseList(JSON.stringify(["A", "../x", "ok", "ok", ...many]))).toEqual([
    "ok",
    ...many.slice(0, 29),
  ]);
});
it("toggle adds to front then removes", () => {
  localStorage.clear();
  expect(toggle("a")).toBe(true);
  toggle("b");
  expect(readList()).toEqual(["b", "a"]);
  expect(toggle("a")).toBe(false);
  expect(readList()).toEqual(["b"]);
});
it("survives setItem throwing", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("quota");
  });
  expect(toggle("z")).toBe(true);
  expect(readList()).toContain("z");
});
it("full list drops the oldest", () => {
  localStorage.setItem(LIST_KEY, JSON.stringify(Array.from({ length: 30 }, (_, i) => `p-${i}`)));
  toggle("new");
  const l = readList();
  expect(l).toHaveLength(30);
  expect(l[0]).toBe("new");
  expect(l).not.toContain("p-29");
});
```

`SaveButton.test.tsx`: clicking toggles `aria-pressed` false→true→false. Two rendered buttons for the same slug stay in sync.

- [ ] **Step 2:** `pnpm vitest run lib/eat-list.test.ts components/SaveButton.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Vitest env for these files: add `// @vitest-environment jsdom` at the top (match `ShareButton.test.tsx`). `PickList` stays a server component and only embeds the client `SaveButton`.
- [ ] **Step 4:** run again, PASS. Then the full checks.
- [ ] **Step 5:** `but commit -b growth-eat-list -m "feat: device-only eat list with Save buttons and header count"`

### Task 4: `/list` page, share, OG preview

**Files:**

- Create: `lib/list-params.ts`, `lib/list-params.test.ts`, `app/(public)/list/page.tsx`, `app/(public)/list/ListActions.tsx` (client), `app/api/og/list/route.tsx`, `lib/public/list.db.test.ts`
- Modify: `lib/public/queries.ts` (`getPlaceCards` accepts `{ includeClosed?: boolean }` and keeps input order when asked; see Interfaces), `app/(public)/data.ts`, `lib/seo/known-paths.ts` if it lists public routes

**Interfaces:**

- Consumes: `parseList`, `SLUG_RE`, `MAX_LIST`, `useEatList`, `writeList`, `listParam` (Task 3); `withUtm`, `track` (Task 1); `ogCard` from `lib/seo/og.tsx`.
- Produces: `parseListParam(p: string | string[] | undefined): string[]` (split on `,`, apply the same rules as `parseList`); `getListCards(db: Db, slugs: string[], now?: Date): Promise<PickCard[]>`, which returns cards in `slugs` order and includes closed places (adds `closed: boolean` to those cards; see Task 7); `cachedList(key: string)` where key = sorted-preserving joined slugs; `listShareText(cards: PickCard[]): string`.
- `listShareText` exact copy: one city → `"<N> places to eat in <City>, picked by <M> food vloggers"`; several → `"<N> places to eat across <K> cities, picked by <M> food vloggers"`. M = distinct creators across cards. Singular forms: `place`, `vlogger`.

- [ ] **Step 1: Failing tests.**
      `lib/list-params.test.ts`:

```ts
it("parses and sanitises", () => expect(parseListParam("b,a,,A,../x,b")).toEqual(["b", "a"]));
it("caps at 30", () =>
  expect(parseListParam(Array.from({ length: 500 }, (_, i) => `p${i}`).join(","))).toHaveLength(
    30,
  ));
it("takes the first value of an array", () =>
  expect(parseListParam(["a,b", "c"])).toEqual(["a", "b"]));
it("share text, one city", () =>
  expect(listShareText([card("delhi", ["x"]), card("delhi", ["x", "y"])])).toBe(
    "2 places to eat in Delhi, picked by 2 food vloggers",
  ));
it("share text, many cities", () =>
  expect(listShareText([card("delhi", ["x"]), card("mumbai", ["x"])])).toBe(
    "2 places to eat across 2 cities, picked by 1 food vlogger",
  ));
```

`lib/public/list.db.test.ts` (uses `testDb()`, skip when null): seed 3 visible places (slugs `a`, `b`, `c`), one place with only a pending pick (`p`), one from an opted-out creator (`o`). `getListCards(db, ["c","p","a","o","zz","b"])` → slugs `["c","a","b"]` in that order.

- [ ] **Step 2:** `pnpm vitest run lib/list-params.test.ts lib/public/list.db.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `getListCards` calls `visibleRows` with `inArray(places.slug, slugs)` plus `{ includeClosed: true }` (Task 7 adds that option; until then call it without). Then `toCards` and reorder by `slugs.indexOf`.
  - Page: `generateMetadata` reads `searchParams.p` and sets `title` from `listShareText`, `robots: { index: false }`, and `openGraph.images: [/api/og/list?p=...]`. The body is inside `<Suspense>`. With no `p`, render `<ListActions mode="redirect" />`, which reads the device list and calls `router.replace("/list?p=...")`. If the device list is empty, it shows "Your list is empty. Tap Save on any place to add it." with a link home. With `p`, render the `<PickList cards numbered={false} />` and `<ListActions slugs={slugs} text={...} />`.
  - `ListActions`: if `slugs` equals `useEatList()` (same order), show Share (native share, else copy) with `track("list-share", { size })`, the "Send on WhatsApp" link `https://wa.me/?text=${encodeURIComponent(text + " " + withUtm(url,"whatsapp"))}`, and Clear (with a `confirm()`). Otherwise show "Save all to my list" (merge into the front, dedupe, cap 30, `track("list-save-all")`). On mount, `track("list-open", { size, own })`.
  - OG route: `GET`, parse `p`, `getListCards`; on 0 cards return the default OG. Otherwise `ogCard({ title: "<N> places to eat", subline: first 5 names joined " · ", lid: { city: first card's city, count: M, label: "vloggers" } })`. Headers: `cache-control: public, s-maxage=86400, stale-while-revalidate=604800`.
- [ ] **Step 4:** tests PASS. Manual: `pnpm build && pnpm start`, open `/list?p=<3 real slugs>` and `/api/og/list?p=<same>`. The PNG renders.
- [ ] **Step 5:** `but commit -b growth-eat-list -m "feat: shareable /list with WhatsApp link and OG preview"`

### Task 5: Home "Near me"

**Files:**

- Create: `app/api/near-index/route.ts`, `components/HomeNearMe.tsx`, `components/HomeNearMe.test.tsx`
- Modify: `components/near-me.ts` + `components/near-me.test.ts`, `app/(public)/data.ts`, `app/(public)/page.tsx`, `lib/public/queries.ts` (export `getAllCards(db, now?)`)

**Interfaces:**

- Consumes: `haversineKm`, `Point`, `PickCard`, `track`.
- Produces: `nearMe(cards: PickCard[], origin: Point): { mode: "near" | "far" | "none"; cards: (PickCard & { km: number })[] }`. Rules:
  - `near`: the cards with a pin within 5 km. Sort by `Math.floor(km / 0.5)` ascending, then `creators.length` descending, then `km`. Take 10.
  - Else `far`: the 5 nearest, if the nearest is < 50 km.
  - Else `none` with `[]`.
  - Cards with `lat === null` are ignored.
- `GET /api/near-index` → `{ cards: PickCard[] }` from `cachedAllCards()` (`"use cache"`, `cacheLife("hours")`, `cacheTag("public")`), with header `cache-control: public, s-maxage=300, stale-while-revalidate=300`. Strip `proof` and `distanceM` to save bytes: return `Omit<PickCard, "proof">`. `nearMe` must not read `proof`.

- [ ] **Step 1: Failing tests** in `near-me.test.ts`:

```ts
const at = (slug: string, lat: number, lng: number, n = 1) => ({
  ...base,
  placeSlug: slug,
  lat,
  lng,
  creators: Array.from({ length: n }, (_, i) => ({ slug: `c${i}`, name: "" })),
});
const o = { lat: 28.6562, lng: 77.2303 }; // Chandni Chowk
it("bands then creators", () => {
  const r = nearMe(
    [
      at("far1", 28.66, 77.2303, 1),
      at("close1", 28.6563, 77.2303, 1),
      at("close3", 28.658, 77.2303, 3),
    ],
    o,
  );
  expect(r.mode).toBe("near");
  expect(r.cards.map((c) => c.placeSlug)).toEqual(["close3", "close1", "far1"]);
});
it("far mode under 50 km", () => {
  const r = nearMe([at("gurgaon", 28.4595, 77.0266)], o);
  expect(r.mode).toBe("far");
});
it("none beyond 50 km", () => expect(nearMe([at("mumbai", 19.07, 72.87)], o).mode).toBe("none"));
it("ignores unpinned", () =>
  expect(nearMe([{ ...at("x", 0, 0), lat: null, lng: null }], o).mode).toBe("none"));
it("caps 10", () =>
  expect(
    nearMe(
      Array.from({ length: 15 }, (_, i) => at(`p${i}`, 28.6562 + i * 0.0001, 77.2303)),
      o,
    ).cards,
  ).toHaveLength(10));
```

`HomeNearMe.test.tsx` (mock `navigator.geolocation`, `fetch`):

- Granted + near → a list heading "Picks near you" and a status line "Nearest first, more creators first within each 500 m. Your location stays on this device."
- Denied → status "Location is off. Type an area instead." and the area form keeps focus.
- `none` → "No picks near you yet. Browse a city below."
- `fetch` is called only after the click, and its URL contains no `lat` or `lng`.
- [ ] **Step 2:** `pnpm vitest run components/near-me.test.ts components/HomeNearMe.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `HomeNearMe` states: `idle | locating | loading | result | denied | failed`.
  - The button is "Picks near me", class `btn btn-ink`, full width on mobile.
  - The area fallback has a city `<select>` (default `delhi`, from `CITIES`) plus a text field. It posts to the existing `/api/geocode`, then runs `nearMe` on the result point.
  - Results reuse `<PickList cards numbered={false} />`, with distance shown via `distanceM = km * 1000`.
  - Track `near-me` with `granted|denied|area|none-nearby`.
  - Put it in `page.tsx` between the intro and the `<Suspense>` city lists, in a container with a fixed `min-h` for the idle state so nothing shifts.
- [ ] **Step 4:** PASS. Check the size: `curl -s localhost:3000/api/near-index | gzip | wc -c` must be < 81920. Note the number in the PR.
- [ ] **Step 5:** `but commit -b growth-near-me -m "feat: home Picks near me with on-device sort and cached index"`

### Task 6: Migration for trust columns

**Files:** Modify `db/schema.ts` (`reports.resolvedAt: timestamp("resolved_at", { withTimezone: true })`, `places.statusChangedAt: timestamp("status_changed_at", { withTimezone: true })`, index `reports_place_open_idx` on `(placeId, resolvedAt, createdAt)`). Generated: `db/migrations/0016_*.sql`.

- [ ] **Step 1:** edit the schema, then `pnpm db:generate`. Expected: the new SQL file has 2 `ADD COLUMN` lines and 1 `CREATE INDEX`, all nullable, no defaults (safe on a live table).
- [ ] **Step 2:** `pnpm db:migrate` against `DATABASE_URL_TEST`, then `pnpm test`. Expected: PASS.
- [ ] **Step 3:** `but commit -b growth-trust -m "db: reports.resolved_at, places.status_changed_at"`. The CI Neon-branch check (#97) runs it against a prod branch.

### Task 7: Closed filter, visitor flag, freshness labels

**Files:**

- Create: `lib/trust.ts`, `lib/trust.db.test.ts`
- Modify: `lib/public/queries.ts` (`visibleRows`, `PickCard`), `lib/public/search.ts`, `lib/public/spatial.ts` (`visible` const), `lib/seo/sitemap.ts`, `lib/geo.ts`, `components/PickList.tsx`, `app/(public)/[city]/place/[slug]/page.tsx`, `lib/public/queries.test.ts`

**Interfaces:**

- Produces:
  - `visibleRows(db, opts: { includeClosed?: boolean }, ...filters: SQL[])`. **Signature change:** update every caller in `queries.ts`.
  - `PickCard` gains `status: "open" | "closed" | "moved"` and `flagged: boolean`.
  - `flaggedPlaceIds(db: Db, placeIds: number[], now?: Date): Promise<Set<number>>`, implementing the spec's exact rule: kinds `closed|moved`, distinct non-null `ip_hash`, 60 days, `resolved_at is null`, count >= 3.
  - `FLAG_MIN = 3`, `FLAG_DAYS = 60`.
- Card label copy (exact):
  - `"Last in a video: <Mon YYYY>"` from `pickedOn`, on every card.
  - `"Visitors reported this closed. We are checking."` when `flagged` (or `"...reported this moved..."` if the majority kind is moved; keep it simple and use the closed text unless all reports are `moved`).
  - `"Reported moved: check the location before you go."` when `status === "moved"`.
  - `"Closed (confirmed <Mon YYYY>)"` when `status === "closed"`, using `statusChangedAt`.
  - Text, not colour only.
- Closed place page: banner with the closed copy, `robots: { index: false }`. Directions and Save stay.

- [ ] **Step 1: Failing tests** `lib/trust.db.test.ts`:

```ts
it("flags at 3 distinct hashes", async () => { await reports(placeId, ["h1", "h2", "h3"], "closed"); expect(await flaggedPlaceIds(db, [placeId])).toEqual(new Set([placeId])); });
it("same hash 3 times does not flag", ...reports(["h1","h1","h1"]) → empty);
it("null hashes do not count", ...["h1","h2",null,null] → empty);
it("older than 60 days ignored", ...3 reports at now-61d → empty);
it("resolved ignored", ...3 reports with resolved_at set → empty);
it("wrong-info does not count", ...3 'wrong-info' → empty);
```

Add to `queries.test.ts`, for a place with `status='closed'`: `getCity` omits it, `getPlace` returns it with `status: "closed"`, `getListCards` returns it, `searchAll` omits it, `getSpatialPicks` omits it, the sitemap omits it, and `nearbyPlaces` omits it.

- [ ] **Step 2:** `pnpm vitest run lib/trust.db.test.ts lib/public/queries.test.ts lib/public/search.test.ts lib/public/spatial.test.ts lib/seo/sitemap.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - In `visibleRows`, add `ne(places.status, "closed")` unless `includeClosed`.
  - In raw SQL (`search.ts` VISIBLE, `spatial.ts` visible, `sitemap.ts`, `geo.ts`), add `and p.status <> 'closed'`. In `search.ts` and `geo.ts`, join `places` where it isn't joined yet.
  - `toCards` takes `status` and `statusChangedAt` from `Row`. Callers then set `flagged` from one `flaggedPlaceIds` call per page (a single query, not per card).
  - Don't filter `moved`.
- [ ] **Step 4:** PASS. Then `pnpm e2e:seed && pnpm build && pnpm e2e`: the existing specs still pass.
- [ ] **Step 5:** `but commit -b growth-trust -m "feat: hide confirmed-closed places from lists, visitor flag and freshness labels"`

### Task 8: Admin reports queue + "Closed or moved?" link

**Files:**

- Create: `lib/reports-admin.ts`, `lib/reports-admin.db.test.ts`, `app/admin/reports/page.tsx`
- Modify: `app/admin/review/actions.ts` (3 actions), `app/admin/layout.tsx` (nav link "Reports"), `components/ReportForm.tsx` (accept `initialKind`, give the form `id="report"`), place page (link "Closed or moved?" → `#report`, which a client handler uses to set the kind to `closed` and focus the select)

**Interfaces:**

- Consumes: `flaggedPlaceIds`, `FLAG_MIN` (Task 7); `requireAdmin` (`lib/auth`).
- Produces:
  - `openReports(db): Promise<{ place: { id, slug, name, citySlug, status }, flagged: boolean, reports: { kind, message, createdAt }[] }[]>`, sorted flagged first, then by newest report.
  - `resolvePlace(db, placeId: number, outcome: "open" | "closed" | "moved", now?: Date): Promise<void>`. In one transaction it sets `places.status`, sets `status_changed_at = now` when the status changes, sets `last_verified = now::date`, and sets `resolved_at = now` on all the place's unresolved reports.
  - Server actions `resolveReportAction(placeId, outcome)`: `requireAdmin()`, `resolvePlace`, `revalidateTag("public", "max")`.
- [ ] **Step 1: Failing tests** in `reports-admin.db.test.ts`:
  - "closed sets status, date, resolves all".
  - "open keeps status, updates last_verified, resolves".
  - "only that place's reports resolved".
  - `openReports` puts flagged first and excludes resolved.
  - In `actions.test.ts`: the action throws when not admin (match the existing pattern).
- [ ] **Step 2:** run them. Expected: FAIL.
- [ ] **Step 3: Implement.** The page is a table per place with three submit buttons: "Still open", "Mark closed", "Mark moved". Each is a `<form action>`, 44px tall.
- [ ] **Step 4:** PASS, plus full checks.
- [ ] **Step 5:** `but commit -b growth-trust -m "feat: admin reports queue and one-tap closed/moved report link"`

### Task 9: Dish synonyms in search

**Files:**

- Create: `lib/synonyms.ts`, `lib/synonyms.test.ts`
- Modify: `lib/public/search.ts`, `lib/public/search.test.ts`

**Interfaces:**

- Produces:
  - `SYNONYM_GROUPS: readonly (readonly string[])[]`, with all terms stored already passed through `normalizeName`.
  - `expandQuery(q: string): string[]`: normalized `q` first, then the deduped terms of every group with a term that equals `q`, or appears in `q` as whole words (`(^| )term( |$)`).
- Group content: at least the 40 dishes with the most approved picks (query in Step 3), plus street-food staples. Each group needs at least one Devanagari form where a common one exists. Examples:
  - `["pani puri","gol gappe","golgappa","golgappe","puchka","phuchka","पानी पूरी","गोलगप्पे"]`
  - `["chole bhature","chhole bhature","chole bhatoore","छोले भटूरे"]`
  - `["biryani","biriyani","briyani","बिरयानी"]`
  - `["momos","momo","मोमोज"]`
  - `["vada pav","wada pav","vadapav","वड़ा पाव"]`
  - `["nihari","nahari","निहारी"]`
  - `["kathi roll","kati roll","काठी रोल"]`
  - Don't merge variants into one group: "chicken biryani" is not the same as "mutton biryani". Those stay separate dishes that both match "biryani" through whole-word containment.
- [ ] **Step 1: Failing tests:**

```ts
it("expands a spelling", () =>
  expect(expandQuery("Golgappe")).toEqual(
    expect.arrayContaining(["golgappe", "pani puri", "puchka"]),
  ));
it("expands Devanagari with trailing space", () =>
  expect(expandQuery("पानी पूरी ")).toContain("pani puri"));
it("keeps the raw query first", () =>
  expect(expandQuery("chicken biryani")[0]).toBe("chicken biryani"));
it("whole words only", () => expect(expandQuery("momoland")).toEqual(["momoland"]));
it("every group term is normalized", () => {
  for (const g of SYNONYM_GROUPS) for (const t of g) expect(normalizeName(t)).toBe(t);
});
it("no term in two groups", () => {
  const all = SYNONYM_GROUPS.flat();
  expect(new Set(all).size).toBe(all.length);
});
```

Add to `search.test.ts` (DB): seed dish "Gol Gappe" with an approved pick. `searchAll(db, "puchka")` finds it. `searchAll(db, "chicken biryani")` returns "Chicken Biryani" first when both "Chicken Biryani" and "Biryani" exist.

- [ ] **Step 2:** run them. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Get the dish list: `psql "$DATABASE_URL" -Atc "select d.name from recommendations r join dishes d on d.id=r.dish_id where r.status='approved' group by 1 order by count(*) desc limit 40"`.
  - In `searchAll`, the dish query becomes `where ... and (${sql.join(terms.map(t => hitFor(t)), sql` or `)})`, with score `greatest(...)` over the terms. The raw `q` term gets a `+0.01` tie-break, so direct matches win ties.
  - Cap the expanded terms at 12.
- [ ] **Step 4:** PASS. Run `EXPLAIN` on the dish query for one expanded query against the 50k perf seed (`db/perf-seed.ts`). It must still use the trigram GIN indexes, with no seq scan on `dishes`/`dish_aliases`. Paste the plan in the PR.
- [ ] **Step 5:** `but commit -b growth-search -m "feat: Hinglish and Hindi dish synonyms in search"`

### Task 10: "Add as alias" on search misses

**Files:** Modify `lib/search-misses.ts` (+ test), `app/admin/searches/page.tsx`, `app/admin/review/actions.ts`.

**Interfaces:** `addMissAsAlias(db, query: string, dishSlug: string): Promise<"added" | "exists" | "no-dish">` inserts into `dish_aliases` (`onConflictDoNothing`), then deletes the `search_misses` row. Action `aliasMissAction(form)`: `requireAdmin`, call it, `revalidateTag("public","max")`, `revalidatePath("/admin/searches")`.

- [ ] **Step 1: Failing DB tests:** "adds alias and removes miss", "unknown dish → no-dish, miss kept", "duplicate alias → exists, miss removed".
- [ ] **Step 2:** FAIL. **Step 3:** implement. The row form has a `<input list="dishes">` datalist of dish slugs/names plus an "Add alias" button. **Step 4:** PASS.
- [ ] **Step 5:** `but commit -b growth-search -m "feat: turn a dead-end search into a dish alias in one click"`

### Task 11: Creator story image, kit links, outreach doc

**Files:**

- Create: `app/(public)/creator/[slug]/story/route.tsx`, `lib/seo/story.tsx`, `lib/seo/story.test.ts`, `docs/outreach.md`
- Modify: `lib/seo/og.tsx` (export the font loader so both use it), `app/(public)/creator/[slug]/kit/page.tsx`, `e2e/kit.spec.ts`

**Interfaces:**

- Produces:
  - `storySize = { width: 1080, height: 1920 }`.
  - `storyLines(data: { creator: { name }, picks: PickCard[] }): { title: string; places: { name: string; city: string }[] }`, with at most 5 places, in rank order, and closed places excluded (already the case through `visibleRows`).
  - `storyCard(lines): Promise<ImageResponse>`.
- Story copy (exact):
  - Title: `"<Name>'s picks"`.
  - Subline: `"On Indian Food Recommends"`.
  - Footer: the host part of `SITE_URL`.
  - No photos.
- Kit page additions:
  - A "Download story image" link (`href=/creator/<slug>/story`, `download="<slug>-story.png"`).
  - A tracking link: `absoluteUrl("/creator/<slug>") + "?utm_source=creator&utm_campaign=<slug>"`, in a read-only field with a copy button.
- [ ] **Step 1: Failing tests:**
  - `storyLines` caps at 5 and keeps the order.
  - The route returns `content-type: image/png`, and 404 for an unknown or opted-out slug.
  - Kit e2e: the download link exists, and its href returns a 200 PNG.
- [ ] **Step 2:** FAIL. **Step 3:** implement with the same `ImageResponse` approach and fonts as `ogCard`. Headers: `cache-control: public, s-maxage=86400`. **Step 4:** PASS. Open the PNG and check by eye that the text fits at 1080 px and no name overflows (truncate at 40 chars with "…").
- [ ] **Step 5:** write `docs/outreach.md`:
  - A message template (under 80 words, Hinglish-friendly, naming the creator's pick count and linking their kit).
  - A table: `creator | channel | picks | kit link | contacted on | reply | shared?`, pre-filled with the top 15 creators by approved picks (from a `psql` query you run).
  - `but commit -b growth-creators -m "feat: creator story image and tracked kit link; outreach doc"`

### Task 12: End-to-end, a11y, performance, PR

**Files:** Create `e2e/list.spec.ts`, `e2e/home-near-me.spec.ts`, `e2e/trust.spec.ts`. Modify `e2e/seed.ts` (add 1 closed place, 1 flagged place with 3 reports, and the "Gol Gappe" dish), `e2e/a11y.spec.ts` (add `/list?p=...`, `/admin/reports` excluded as auth-only).

- [ ] **Step 1: Write the specs.**
  - **list:** Save 2 places on the city page, open "My list", and the URL becomes `/list?p=b,a`. Share copies a URL containing `utm_source=share`. A second browser context opening that URL sees "Save all to my list"; clicking it shows header count 2.
  - **home-near-me:** use `context.grantPermissions(["geolocation"])` and `setGeolocation(Chandni Chowk)`. The list shows within 5 s and its first item is the seeded nearest place. Assert no request URL contains `lat=`.
  - **trust:** the closed place is absent from `/delhi` and present at its URL with a "Closed (confirmed" banner and `noindex`. The flagged place shows "Visitors reported this closed".
- [ ] **Step 2:** `pnpm e2e:seed && pnpm build && pnpm e2e`. Expected: all pass, axe 0 serious.
- [ ] **Step 3:** Lighthouse mobile on `/` and `/list?p=...` against the preview: score >= 90, CLS 0. Record both in the PR.
- [ ] **Step 4:** push the branch and open a draft PR with `but pr`. Link the spec and plan, and list the owner steps (Task 2, outreach).

---

## Self-review notes

- Spec coverage: §1 → T1, T2. §2 → T3, T4. §3 → T5. §4 → T6, T7, T8. §5a → T11. §5b → T9, T10. The anti-goals map to the Global Constraints, and their tests are in T4, T5 and T7.
- Type names checked across tasks: `getListCards`, `visibleRows(db, opts, ...filters)`, `flaggedPlaceIds`, `nearMe`, `expandQuery`, `track`, `withUtm`.
- Ordering risk: Task 4 calls `visibleRows` before Task 7 changes its signature. Task 7 owns updating all callers, including `getListCards`.
