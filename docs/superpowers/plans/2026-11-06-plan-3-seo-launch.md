# IndianFoodRecommends Plan 3: SEO + Launch (Sprint 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The live site is findable (metadata, JSON-LD, sitemap, share images), measurably fast and accessible, locked down with security headers, explains itself (about, content policy, opt-out), and its data is backed up nightly.

**Architecture:** Pure builders in `lib/seo/*.ts` (metadata, JSON-LD, sitemap URL list) are unit-tested; pages call them from `generateMetadata` and render JSON-LD in a `<script>`. Sitemap, robots and OG image routes read cached data after `connection()` so builds never touch the DB. Security headers live in `next.config.ts`. Accessibility is checked by axe inside the existing Playwright suite. Backups run on the home machine beside the ingest timer.

**Tech Stack:** Next.js 16.4 metadata files (`sitemap.ts`, `robots.ts`, `opengraph-image.tsx` with `next/og`), `@axe-core/playwright`, Lighthouse CLI, Umami Cloud (optional, env-gated), `pg_dump` 17 + systemd.

**Spec:** `docs/06-sprints.md` S3-1..S3-9, `docs/05-tech-design.md` §4 (SEO line) and §5 (CSP), `docs/04-prd.md` (non-functional, content rules, privacy), Plan 2 ledger deferred minors.

## Global Constraints

- Site origin from `NEXT_PUBLIC_SITE_URL`, default `https://indian-food-recommends.vercel.app`; every canonical, sitemap URL and JSON-LD `url` is absolute on that origin.
- JSON-LD is serialised with `JSON.stringify(x).replace(/</g, "\\u003c")` (Next JSON-LD guide).
- Only public data (approved picks, not opted-out creators) reaches metadata, JSON-LD, sitemap and OG images.
- Builds must pass with no `DATABASE_URL` (CI `check` job).
- No cookies, no personal data in analytics; analytics loads only when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set.
- CSP allows only: self, `www.youtube-nocookie.com` and `www.instagram.com` frames, `tiles.openfreemap.org` (styles, tiles, fonts, sprites), `cloud.umami.is` + `api-gateway.umami.dev` when analytics is on. Inline scripts are allowed (`'unsafe-inline'`) because PPR pages are prerendered and cannot carry per-request nonces.
- Lighthouse mobile performance ≥ 90 on `/`, a dish page and a place page; axe: 0 `serious`/`critical` violations on every public page.
- Copy rules from earlier plans: no invented numbers, no generic CTAs, honest placeholders.

## Review Focus

1. Place or creator name containing `</script>` or quotes breaking JSON-LD or OG image → escaped (Task 1 test).
2. Opted-out creator or place with no visible picks appearing in sitemap → excluded (Task 2 test).
3. CSP blocking the YouTube/Instagram embed or map tiles in production → E2E clicks play and loads map under the real headers (Task 6).
4. Analytics script loading when env unset, or setting cookies → absent without env (Task 5 test).
5. Backup script writing into the repo or keeping unbounded files → writes to `/var/backups/ifr`, keeps 14 (Task 7 test).

---

### Task 1: Metadata, canonical, JSON-LD (S3-1)

**Files:** Create `lib/seo/site.ts`, `lib/seo/jsonld.ts`, `lib/seo/jsonld.test.ts`; modify each public page to export `generateMetadata` and render `<JsonLd data={…} />` (`components/JsonLd.tsx`).

**Interfaces — Produces:**

```ts
// site.ts
export const SITE_URL: string; // env or default, no trailing slash
export function absoluteUrl(path: string): string;
// jsonld.ts
export function serializeJsonLd(data: object): string; // escapes "<"
export function dishItemList(input: {
  city: string;
  dish: string;
  path: string;
  places: { name: string; path: string }[];
}): object; // schema.org ItemList of ListItem{position,url,name}
export function restaurantLd(input: {
  name: string;
  path: string;
  locality: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  dishes: string[];
}): object; // schema.org Restaurant, geo only when coords, servesCuisine omitted, address {addressLocality, addressRegion: city, addressCountry: "IN"}
```

Metadata per page: title `"{Dish} in {City}: where food vloggers eat"`, `"{Place}, {Locality}: picked by {N} food vloggers"`, `"{Creator}'s food picks in Delhi"`, `"Food vlogger picks in {City}"`; description from counts only (no invented claims); `alternates.canonical` = absolute path; `/search` gets `robots: { index: false }`.

- [ ] **Step 1: Failing tests:** `serializeJsonLd({ name: "</script><b>" })` contains no `</script>` and contains `\u003c/script>`; `dishItemList` positions are 1..n and urls absolute; `restaurantLd` with null coords has no `geo`; with coords has `geo: { "@type": "GeoCoordinates", latitude, longitude }`; `absoluteUrl("/delhi")` → `${SITE_URL}/delhi`.
- [ ] **Step 2:** `pnpm vitest run lib/seo` → FAIL. **Step 3:** Implement + wire pages. **Step 4:** PASS; `pnpm build` without `.env` → exit 0; prod start: dish page HTML has one `application/ld+json` script and `<link rel="canonical"`.
- [ ] **Step 5: Commit** `feat(seo): metadata, canonical URLs and JSON-LD (S3-1)`.

### Task 2: Sitemap + robots (S3-2)

**Files:** Create `lib/seo/sitemap.ts`, `lib/seo/sitemap.test.ts`, `app/sitemap.ts`, `app/robots.ts`.

**Interfaces — Produces:** `sitemapPaths(db: Db): Promise<{ path: string; lastModified: Date }[]>` — `/`, `/delhi`, every dish/place/creator with ≥1 visible pick; `lastModified` = newest visible pick's `reviewed_at ?? created_at`. `app/sitemap.ts` awaits `connection()` then maps to absolute URLs. `robots.ts`: allow `/`, disallow `/admin`, `/api`, `/search`; `sitemap: absoluteUrl("/sitemap.xml")`.

- [ ] **Step 1: Failing test (DB):** includes `/delhi/chole-bhature`, `/delhi/place/a`, `/creator/one`; excludes pending-only place, opted-out creator, a place visible only via an opted-out creator; no duplicates.
- [ ] **Step 2-4:** FAIL → implement → PASS; prod start `/sitemap.xml` lists ≥ 13 place URLs, `/robots.txt` disallows `/admin`.
- [ ] **Step 5: Commit** `feat(seo): sitemap and robots from approved data (S3-2)`.

### Task 3: Share images (S3-3)

**Files:** Create `lib/seo/og.tsx` (shared 1200×630 layout: site name, title line, subline, accent bar), `app/opengraph-image.tsx`, `app/(public)/[city]/[dish]/opengraph-image.tsx`, `app/(public)/[city]/place/[slug]/opengraph-image.tsx`, `app/(public)/creator/[slug]/opengraph-image.tsx`.

Each route: `size = { width: 1200, height: 630 }`, `contentType = "image/png"`, alt from the same title as metadata; awaits `connection()` then cached data; unknown slug → generic site card (never throws). Text only, system font (no font fetch).

- [ ] **Step 1:** Implement. **Step 2: Verify** prod start: each route returns `200`, `content-type: image/png`, body ≥ 5 KB; page HTML has `og:image` pointing at it. Unknown slug image → 200 generic.
- [ ] **Step 3: Commit** `feat(seo): per-page share images (S3-3)`.

### Task 4: Accessibility + performance (S3-4, S3-5)

**Files:** Add `@axe-core/playwright`; create `e2e/a11y.spec.ts`; fix findings in components; `ops/lighthouse.md` (scores + date).

Fixes carried from Plan 2 deferred minors: move focus into iframe after facade click (`EmbedFacade`), `PickList` heading level prop (`h2` on dish/creator pages, `h3` under section `h2`s), `/search` always has an `h1`, cap `?dish=` to slugs in `data.dishes` before calling `cachedCreator`.

- [ ] **Step 1: Failing E2E:** axe on `/`, `/delhi`, `/delhi/chole-bhature`, `/delhi/place/chache-di-hatti`, `/creator/e2e-creator`, `/search?q=chole` → `violations.filter(v => ["serious","critical"].includes(v.impact))` is `[]`; after clicking play, `document.activeElement.tagName === "IFRAME"`.
- [ ] **Step 2:** Run → record failures. **Step 3:** Fix. **Step 4:** Run → PASS.
- [ ] **Step 5:** Deploy preview; run `npx lighthouse <url> --preset=perf --form-factor=mobile --quiet --output=json` for `/`, a dish and a place page on production; record scores in `ops/lighthouse.md`; any score < 90 → fix the largest LCP/CLS opportunity and re-run.
- [ ] **Step 6: Commit** `feat(a11y,perf): axe in E2E, focus and heading fixes, Lighthouse record (S3-4, S3-5)`.

### Task 5: Cookieless analytics (S3-6)

**Files:** Create `components/Analytics.tsx`, `components/Analytics.test.tsx`; add `data-umami-event="watch"` / `"directions"` / `"play"` (with `data-umami-event-place={slug}`) to the relevant links/buttons.

`Analytics()` renders `<Script src="https://cloud.umami.is/script.js" data-website-id={id} data-do-not-track="true" strategy="afterInteractive" />` only when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is non-empty, else `null`.

- [ ] **Step 1: Failing test (jsdom):** env unset → renders nothing; set → one script with that id and `data-do-not-track`. **Step 2-4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: cookieless Umami analytics behind env, watch/directions events (S3-6)`. Account creation is the owner's step; site works unchanged without it.

### Task 6: Security headers + review (S3-7)

**Files:** Modify `next.config.ts` (`headers()`), create `lib/seo/csp.ts` + `lib/seo/csp.test.ts` (`buildCsp({ analytics: boolean }): string`), `e2e/csp.spec.ts`.

Headers on all routes: CSP from `buildCsp`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`. `poweredByHeader: false`.

- [ ] **Step 1: Failing unit test:** `buildCsp({analytics:false})` has `frame-src https://www.youtube-nocookie.com https://www.instagram.com`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, no `umami`; with analytics adds `https://cloud.umami.is` to `script-src` and `https://api-gateway.umami.dev` to `connect-src`.
- [ ] **Step 2: Failing E2E** (prod build): no `securitypolicyviolation` events on place page after clicking play and on dish page after opening Map; response has the CSP header.
- [ ] **Step 3-4:** Implement → both PASS.
- [ ] **Step 5:** Fresh-reviewer security pass over auth, inputs, headers (final review covers it); close findings.
- [ ] **Step 6: Commit** `feat(security): CSP and security headers (S3-7)`.

### Task 7: About, content policy, opt-out; backups (S3-8, S3-9)

**Files:** Create `app/(public)/about/page.tsx` (what the site is, how picks are chosen: RSS → LLM → Jev check → automatic approve; ranking formula; content rules: our notes only, link to originals, no video text stored; opt-out within 7 days via `NEXT_PUBLIC_OPTOUT_EMAIL` or "coming soon" text; report link explanation); footer link "About and opt-out". Create `ops/backup.sh`, `ops/backup.test.sh`, `ops/ifr-backup.service`, `ops/ifr-backup.timer` (daily 02:30 IST).

`backup.sh`: `pg_dump --format=custom "$DATABASE_URL_UNPOOLED|$DATABASE_URL" > /var/backups/ifr/ifr-$(date -u +%Y%m%dT%H%M%SZ).dump`, `chmod 600`, delete all but newest 14, exit non-zero on dump failure without deleting old dumps.

- [ ] **Step 1: Failing shell test:** with `BACKUP_DIR` temp dir and 16 fake old dumps + a stub `pg_dump` on `PATH`: after run, 14 files remain and the newest is the new one; stub failing → exit ≠ 0 and the 16 files untouched.
- [ ] **Step 2-4:** FAIL → implement → PASS. Install timer; run once for real against Neon; `pg_restore --list` on the dump shows `TABLE DATA public recommendations`.
- [ ] **Step 5:** Domain stays the Vercel subdomain (owner decision, placeholder). Production deploy from the merged branch.
- [ ] **Step 6: Commit** `feat: about and opt-out page, nightly Neon backups (S3-8, S3-9)`.

---

## Self-Review

- **Spec coverage:** S3-1 T1, S3-2 T2, S3-3 T3, S3-4/5 T4, S3-6 T5, S3-7 T6, S3-8/9 T7. Human parts: Umami account, domain purchase, opt-out email — code ships working without them.
- **Type consistency:** `SITE_URL`, `absoluteUrl`, `serializeJsonLd`, `sitemapPaths`, `buildCsp` used consistently.
- **Proportion:** signatures, values, assertions only.
