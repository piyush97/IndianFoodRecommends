# IndianFoodRecommends Plan 1: Foundations, Ingest Pipeline, Review Queue

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a pipeline that pulls new videos from tracked YouTube channels, extracts place/dish picks with an LLM via cliproxyapi, and lets an allowlisted editor approve them into the database (Delhi, seed creator Ayush Sapra).

**Architecture:** One pnpm repo. `/app` is Next.js (admin only in this plan). `/db` is Drizzle schema + migrations. `/worker` is a Node/TS CLI run daily by a systemd timer on this machine because cliproxyapi is `localhost:8317`. Shared logic lives in `/lib`. Nothing public is shown unless `recommendations.status = 'approved'`.

**Tech Stack:** Node >= 20, pnpm, Next.js App Router (latest stable at scaffold time), TypeScript strict, Tailwind, Drizzle ORM + `pg`, Postgres 16 with `pg_trgm`, zod, `openai` SDK (pointed at cliproxyapi), Auth.js (`next-auth` v5), Vitest, GitHub Actions.

**Spec:** `docs/01-research-and-plan.md`, `docs/03-architecture.md`, `docs/04-prd.md`, `docs/05-tech-design.md`, `docs/06-sprints.md` (this plan = Sprint 0 + Sprint 1). Public pages, SEO, map, search, E2E are **Plan 2**.

## Global Constraints

- YouTube API data (titles, descriptions, stats) is never persisted. Persist only `video_id`, channel ID, and our own derived facts. Fetched text lives in memory for the LLM call only.
- Use `playlistItems.list` on the uploads playlist (`"UU" + channelId.slice(2)`), never `search.list` (100 quota units vs 1).
- LLM base URL from env `LLM_BASE_URL` (default `http://localhost:8317/v1`), key from `LLM_API_KEY`, model from `LLM_MODEL`. The Next.js app never calls the LLM. Only `/worker` does.
- Nominatim: max 1 request/second, descriptive `User-Agent` from env `NOMINATIM_UA`. Results are suggestions only; an editor confirms lat/lng.
- Coordinates must fall inside India bounds: lat 6.0 to 37.5, lng 68.0 to 97.5.
- Editor note max 140 characters, our own words.
- `recommendations.status` in `pending|approved|rejected`; `origin` in `llm|manual|community`; `places.status` in `open|closed|moved`.
- Admin = emails in env `ADMIN_EMAILS` (comma separated). Every `/admin` page and every server action re-checks the session server-side.
- Zod validation at every trust boundary (LLM output, form input, env).
- Secrets only in `.env` (gitignored); commit `.env.example`.
- No Co-Authored-By trailer in commits. Use GitButler (`but`), not git write commands.
- Tests run only for the file a task touches. Postgres for tests: `DATABASE_URL_TEST`.

## Review Focus

Failure modes the spec implies but nothing else exercises. Each has a test in the owning task.

1. LLM returns prose, markdown fences, empty list, or JSON with wrong types → retry once, then `ExtractionError`; one bad video never aborts the run (Task 5, 7).
2. Same video ingested twice, or the daily timer overlaps a manual run → zero duplicate sources/recommendations (Task 7).
3. Place spelled differently (`Chache Di Hatti` / `Chachey di Hatti`) or Devanagari (`चाचे दी हट्टी`) → matcher suggests the existing place instead of creating a duplicate (Task 4).
4. Video mentions a non-Delhi city or no place at all → stored as pending with `extracted.city` visible, or no row; never auto-approved (Task 7).
5. Unauthenticated or non-allowlisted caller invokes an admin server action directly → rejected, DB unchanged (Task 9, 10).
6. YouTube quota exhausted (HTTP 403 `quotaExceeded`) → run stops cleanly with a logged `QuotaExceededError`, already-saved work kept (Task 6, 7).
7. Lat/lng outside India or note > 140 chars on approve → validation error, no write (Task 10).

---

## File Structure

```
.env.example
docker-compose.yml            # postgres:16 for dev + test
drizzle.config.ts
db/schema.ts                  # all tables
db/client.ts                  # getDb()
db/seed.ts                    # Delhi, dishes, aliases, Ayush Sapra
lib/env.ts                    # zod-validated env
lib/text.ts                   # slugify, normalizeName
lib/matcher.ts                # matchPlace, matchDish
lib/llm/extract.ts            # extractPicks, ExtractedPickSchema, ExtractionError
lib/youtube.ts                # listUploads, getSnippets, QuotaExceededError
lib/geocode.ts                # suggestLocation
lib/review.ts                 # approve/reject/merge/manualAdd (db-level)
lib/auth.ts                   # Auth.js config, isAdminEmail, requireAdmin
worker/ingest.ts              # runIngest
worker/cli.ts                 # entrypoint: ingest | eval
worker/eval.ts                # scoreExtraction + runner
worker/eval/labelled.json     # human labelled videos
ops/ifr-ingest.service|timer  # systemd units
app/admin/review/page.tsx     # queue UI
app/admin/review/actions.ts   # server actions
middleware.ts                 # gate /admin
tests/**                      # mirrors lib/ and worker/
.github/workflows/ci.yml
```

---

### Task 1: Scaffold, CI, dev database

**Model:** Haiku 5.5 (S0-1, S0-2) · **Difficulty:** easy

**Files:**
- Create: Next.js app via `pnpm create next-app@latest . --ts --tailwind --eslint --app --no-src-dir --use-pnpm`, `vitest.config.ts`, `docker-compose.yml`, `.env.example`, `.gitignore` additions, `.github/workflows/ci.yml`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: scripts `pnpm dev|build|lint|typecheck|test`, `pnpm db:up` (docker compose up -d), Postgres at `postgresql://ifr:ifr@localhost:5432/ifr` and `ifr_test`.

- [ ] **Step 1:** Scaffold into the existing dir (keep `docs/`). Add scripts `typecheck: tsc --noEmit`, `test: vitest run`, `db:up: docker compose up -d`.
- [ ] **Step 2:** `docker-compose.yml`: `postgres:16`, user/password/db `ifr`, port 5432, init script creating `ifr_test` and `CREATE EXTENSION pg_trgm` in both DBs.
- [ ] **Step 3:** `.env.example` lists `DATABASE_URL`, `DATABASE_URL_TEST`, `YOUTUBE_API_KEY`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `NOMINATIM_UA`, `ADMIN_EMAILS`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`. `.gitignore` ignores `.env`.
- [ ] **Step 4:** Smoke test `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 5:** CI workflow on PR/push: pnpm install, `lint`, `typecheck`, `test`; Postgres service container with pg_trgm for later tasks.
- [ ] **Step 6: Verify.** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Expected: all exit 0.
- [ ] **Step 7: Commit** on branch `feat/scaffold`: `chore: scaffold next app, vitest, ci, dev postgres`.

---

### Task 2: Database schema, migrations, env, seed

**Model:** Sonnet 5.5 (S0-3, S0-4) · **Difficulty:** medium

**Files:**
- Create: `db/schema.ts`, `db/client.ts`, `drizzle.config.ts`, `db/seed.ts`, `lib/env.ts`, `tests/db/schema.test.ts`, `tests/helpers/db.ts`

**Interfaces:**
- Produces: `getDb(url?: string): NodePgDatabase<typeof schema>`; Drizzle tables `cities, creators, sources, places, placeAliases, dishes, dishAliases, recommendations, reports, ingestRuns` with columns exactly per `docs/05-tech-design.md §2` plus `ingest_runs(id, started_at, finished_at, videos int, picks int, errors int, error_log jsonb)`; `tests/helpers/db.ts` exports `resetTestDb(): Promise<NodePgDatabase>` (migrates `DATABASE_URL_TEST`, truncates all tables). `env: { DATABASE_URL, ... }` from `lib/env.ts` (zod, throws on missing in non-test).
- Constraints: unique index `sources(platform, external_id)`; `places.slug`, `dishes.slug`, `cities.slug`, `creators.slug` unique; gin trigram indexes on `places.name`, `dishes.name`, `place_aliases.alias`, `dish_aliases.alias`; CHECKs for the status/origin enums and `lat between 6 and 37.5`, `lng between 68 and 97.5`; `recommendations.note` CHECK `char_length(note) <= 140`.

- [ ] **Step 1: Write failing test** `tests/db/schema.test.ts`:
  - `inserting a place with lat 51.5 throws` (check constraint)
  - `inserting two sources with same (platform, external_id) throws`
  - `a 141-char note on a recommendation throws`
  - `similarity('chole bhature','chole bature') > 0.5` via `sql` (proves pg_trgm loaded)
- [ ] **Step 2:** Run `pnpm vitest run tests/db/schema.test.ts`. Expected: FAIL (no schema).
- [ ] **Step 3:** Implement schema + `pnpm drizzle-kit generate`, commit generated migration. Add `db:migrate` and `db:seed` scripts.
- [ ] **Step 4:** `db/seed.ts` (idempotent via `onConflictDoNothing`): city Delhi (`delhi`, state `Delhi`); creator Ayush Sapra (`ayush-sapra`, `yt_channel_id=UC2UWtuZR3kH-5C26HVMMB6A`, `ig_handle=aayushsapra2`); ~30 Delhi dishes (chole bhature, butter chicken, momos, parantha, kachori, chaat, kebab, nihari, etc.) with aliases for spelling variants (`chole bature`, `chhole bhature`, `momo`).
- [ ] **Step 5:** Run the schema test. Expected: PASS. Run `pnpm db:seed` twice; row counts unchanged on second run.
- [ ] **Step 6: Commit** on `feat/db-schema`: `feat(db): schema, migrations, seed for Delhi`.

---

### Task 3: Text utilities

**Model:** Haiku 5.5 · **Difficulty:** easy

**Files:** Create `lib/text.ts`, `tests/lib/text.test.ts`

**Interfaces:**
- Produces: `slugify(s: string): string` (lowercase ascii, hyphens, strips diacritics; Devanagari-only input falls back to `"item"`); `normalizeName(s: string): string` (lowercase, NFKD, strip combining marks except Devanagari, non-alphanumeric → single space, trim).

- [ ] **Step 1: Write failing tests:** `slugify("Chache Di Hatti")` → `"chache-di-hatti"`; `slugify("  Sita Ram's  Diwan-Chand!! ")` → `"sita-rams-diwan-chand"`; `slugify("चाचे")` → `"item"`; `normalizeName("Chāche  Dī-Hatti")` → `"chache di hatti"`; `normalizeName("चाचे दी हट्टी")` unchanged apart from whitespace.
- [ ] **Step 2:** Run `pnpm vitest run tests/lib/text.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement both functions.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5: Commit** on `feat/text-utils`: `feat: slugify and normalizeName`.

---

### Task 4: Trigram matcher

**Model:** Opus 5.5 (S1-4) · **Difficulty:** hard

**Files:** Create `lib/matcher.ts`, `tests/lib/matcher.test.ts`

**Interfaces:**
- Consumes: Task 2 `schema`, `resetTestDb`; Task 3 `normalizeName`.
- Produces:
  ```ts
  export type Match = { id: number; name: string; score: number; via: "name" | "alias" };
  export function matchPlace(db: Db, name: string, cityId: number): Promise<Match[]>;
  export function matchDish(db: Db, name: string): Promise<Match[]>;
  ```
  Returns up to 5 matches with `similarity >= 0.6` sorted by score desc, checking both canonical name and aliases (best score per entity). `Db = NodePgDatabase<typeof schema>`.

- [ ] **Step 1: Write failing tests** (seed a place "Chache Di Hatti" in Delhi with alias "चाचे दी हट्टी", a place of the same name in another city, dishes "Chole Bhature" with alias "chole bature"):
  - `matchPlace("Chachey di Hatti", delhi)` returns the Delhi place, score >= 0.6
  - `matchPlace("चाचे दी हट्टी", delhi)` returns it via `"alias"`
  - `matchPlace("Chache Di Hatti", otherCity)` does not return the Delhi place
  - `matchPlace("Karim's", delhi)` returns `[]`
  - `matchDish("chole bature")` returns Chole Bhature
  - input is normalized before comparison (extra spaces, case)
- [ ] **Step 2:** Run `pnpm vitest run tests/lib/matcher.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement with a single SQL per call using `similarity()` over `normalizeName`d input; `DISTINCT ON (id)` to keep the best score per entity. Note: Devanagari trigram works on raw characters; test 2 pins it.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5: Commit** on `feat/matcher`: `feat: trigram place and dish matcher with aliases`.

---

### Task 5: LLM extraction client

**Model:** Sonnet 5.5 (S1-2) · **Difficulty:** medium

**Files:** Create `lib/llm/extract.ts`, `tests/lib/llm-extract.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const ExtractedPickSchema: z.ZodObject<{
    place_name: z.ZodString; locality: z.ZodNullable<z.ZodString>; city: z.ZodNullable<z.ZodString>;
    dishes: z.ZodArray<z.ZodString>; timestamp_seconds: z.ZodNullable<z.ZodNumber>; confidence: z.ZodNumber }>;
  export type ExtractedPick = z.infer<typeof ExtractedPickSchema>;
  export class ExtractionError extends Error {}
  export type ChatFn = (messages: {role: "system"|"user"; content: string}[]) => Promise<string>;
  export function extractPicks(input: { title: string; description: string }, chat?: ChatFn): Promise<ExtractedPick[]>;
  export function makeChat(): ChatFn; // openai SDK, baseURL=LLM_BASE_URL, model=LLM_MODEL
  ```
  Schema rules: `dishes` min 1 item, `timestamp_seconds` int >= 0 or null, `confidence` 0..1. Description truncated to 6000 chars before prompting. Response may be wrapped in a ```json fence; strip it. Root is `{ "items": [...] }`.

- [ ] **Step 1: Write failing tests** with a fake `ChatFn`:
  - valid JSON → parsed picks
  - fenced JSON → parsed
  - first reply is prose, second is valid → returns picks (exactly 2 calls)
  - two invalid replies → rejects with `ExtractionError`
  - `{"items": []}` → returns `[]` (no error)
  - item with `dishes: []` → whole reply invalid → retry path
  - description of 20k chars → the prompt sent to `chat` contains at most 6000 description chars
- [ ] **Step 2:** Run `pnpm vitest run tests/lib/llm-extract.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. System prompt demands JSON only, India context, one item per distinct place, `timestamp_seconds` only from chapter lines like `04:12 Chache Di Hatti`, otherwise null.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5: Commit** on `feat/llm-extract`: `feat: LLM pick extraction via cliproxyapi with zod and retry`.

---

### Task 6: YouTube client

**Model:** Sonnet 5.5 (S1-1) · **Difficulty:** medium

**Files:** Create `lib/youtube.ts`, `tests/lib/youtube.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class QuotaExceededError extends Error {}
  export const uploadsPlaylistId: (channelId: string) => string; // "UU" + channelId.slice(2)
  export type YtFetch = typeof fetch;
  export function listUploads(channelId: string, apiKey: string,
    opts?: { since?: Date; maxPages?: number; fetchImpl?: YtFetch }): Promise<{ videoId: string; publishedAt: Date }[]>;
  export function getSnippets(videoIds: string[], apiKey: string,
    fetchImpl?: YtFetch): Promise<{ videoId: string; title: string; description: string }[]>;
  ```
  `listUploads` pages `playlistItems.list` (maxResults 50, default `maxPages` 4), stops once items older than `since`. `getSnippets` batches 50 ids per `videos.list?part=snippet`.

- [ ] **Step 1: Write failing tests** with fake fetch:
  - `uploadsPlaylistId("UC2UWtuZR3kH-5C26HVMMB6A")` → `"UU2UWtuZR3kH-5C26HVMMB6A"`
  - `listUploads` follows `nextPageToken` and stops at `since`
  - `getSnippets` with 120 ids makes 3 requests
  - HTTP 403 with `error.errors[0].reason === "quotaExceeded"` → throws `QuotaExceededError`
  - other non-2xx → throws generic `Error` including status
  - API key is sent only as `key` query param and never appears in thrown error messages
- [ ] **Step 2:** Run `pnpm vitest run tests/lib/youtube.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement with plain `fetch`, no googleapis dependency.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5: Commit** on `feat/youtube-client`: `feat: youtube uploads and snippet client`.

---

### Task 7: Ingest orchestration, CLI, timer

**Model:** Sonnet 5.5 (S1-6, S1-7) · **Difficulty:** medium

**Files:** Create `worker/ingest.ts`, `worker/cli.ts`, `ops/ifr-ingest.service`, `ops/ifr-ingest.timer`, `ops/README.md`, `tests/worker/ingest.test.ts`

**Interfaces:**
- Consumes: Task 2 tables + `resetTestDb`, Task 4 `matchPlace/matchDish`, Task 5 `extractPicks`/`ExtractedPick`, Task 6 `listUploads/getSnippets/QuotaExceededError`.
- Produces:
  ```ts
  export type IngestDeps = {
    db: Db;
    listUploads: typeof listUploads; getSnippets: typeof getSnippets;
    extract: (i: {title: string; description: string}) => Promise<ExtractedPick[]>;
    now: () => Date; apiKey: string;
  };
  export type IngestSummary = { videos: number; picks: number; errors: number; stoppedByQuota: boolean };
  export function runIngest(deps: IngestDeps): Promise<IngestSummary>;
  ```
  Behavior: for each non-opted-out creator with `yt_channel_id`: `since` = latest `sources.published_on` for that creator (or 90 days ago if none). Skip video IDs already in `sources`. For each new video: insert `sources` row, extract, then insert one `recommendations` row per pick: `status='pending'`, `origin='llm'`, `confidence`, `ts_seconds`, `extracted` jsonb = `{...pick, suggestions: {places: Match[], dishes: Match[]}}`, `place_id/dish_id` NULL. Per-video try/catch increments `errors`. `QuotaExceededError` stops the loop, sets `stoppedByQuota`. Writes one `ingest_runs` row (finish in a finally block). Holds a Postgres advisory lock (`pg_try_advisory_lock(727001)`); if not acquired, returns `{videos:0,picks:0,errors:0,stoppedByQuota:false}` without work.
  `worker/cli.ts`: `pnpm worker ingest` wires real deps; exits 1 only on unexpected crash.

- [ ] **Step 1: Write failing tests** with fakes:
  - 2 videos, 3 picks → 2 sources, 3 pending recommendations, summary matches
  - run twice → counts unchanged on second run (no duplicates)
  - one video's `extract` throws `ExtractionError` → other video still ingested, `errors: 1`
  - `listUploads` throws `QuotaExceededError` after first creator → `stoppedByQuota: true`, earlier rows kept
  - opted-out creator skipped
  - existing place "Chache Di Hatti" → pending row's `extracted.suggestions.places[0].id` is that place, `place_id` still NULL
  - pick with `city: "Mumbai"` is stored pending with `extracted.city === "Mumbai"`
  - second concurrent `runIngest` while lock held returns zeroed summary
  - no field of `extracted` or any table contains the video title/description text (assert by searching JSON for the fixture's unique description token)
- [ ] **Step 2:** Run `pnpm vitest run tests/worker/ingest.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Systemd timer `OnCalendar=*-*-* 03:00:00 Asia/Kolkata`, `Persistent=true`, service `WorkingDirectory` repo path, `EnvironmentFile` `.env`, `ExecStart=pnpm worker ingest`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** `ops/README.md`: install with `systemctl link`, `systemctl enable --now ifr-ingest.timer`, check with `systemctl list-timers`, logs via `journalctl -u ifr-ingest`. Do not enable the timer yet; Task 11 verifies manually first.
- [ ] **Step 6: Commit** on `feat/ingest`: `feat(worker): daily ingest with dedupe, lock, quota stop`.

---

### Task 8: Eval harness

**Model:** Opus 5.5 for scorer + prompt iteration (S1-3); labels by **Human** · **Difficulty:** medium

**Files:** Create `worker/eval.ts`, `worker/eval/labelled.example.json`, `tests/worker/eval.test.ts`. (`worker/eval/labelled.json` is created by the human, 50 videos, committed; contains video IDs + expected picks only, no YouTube text. The runner fetches snippets live.)

**Interfaces:**
- Produces:
  ```ts
  export type Labelled = { videoId: string; expected: { place: string; dishes: string[] }[] };
  export function scoreExtraction(expected: Labelled["expected"], actual: ExtractedPick[]):
    { tp: number; fp: number; fn: number; precision: number; recall: number };
  export function runEval(labelled: Labelled[], deps: { getSnippets; extract }): Promise<{ precision: number; recall: number; perVideo: unknown[] }>;
  ```
  A pick is a true positive when `normalizeName(place)` of expected and actual are equal or their word-set Jaccard similarity is >= 0.6 (pure function, no DB). Gate: precision >= 0.85 before enabling the timer.

- [ ] **Step 1: Write failing tests:** perfect match → precision 1, recall 1; extra hallucinated place → precision 0.5; missed place → recall 0.5; spelling variant `Chachey di Hatti` vs `Chache Di Hatti` counts as TP; empty actual and empty expected → precision 1, recall 1.
- [ ] **Step 2:** Run `pnpm vitest run tests/worker/eval.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement; add `pnpm worker eval` printing precision/recall and per-video misses.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5: Commit** on `feat/eval`: `feat(worker): extraction eval harness`.
- [ ] **Step 6 (Human):** Label 50 Ayush Sapra Delhi videos in `labelled.json`. Run `pnpm worker eval`; if precision < 0.85, iterate the Task 5 prompt or `LLM_MODEL` (try each model cliproxyapi exposes) and re-run. Record the chosen model and score in `docs/05-tech-design.md §8`.

Note on the spelling-variant test: word-set Jaccard on `chachey`/`chache` is 0.5 per word, so use trigram-style character similarity (>= 0.6) per word, not exact word equality. The test pins the behavior.

---

### Task 9: Admin auth

**Model:** Opus 5.5 (S1-8) · **Difficulty:** medium

**Files:** Create `lib/auth.ts`, `middleware.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/admin/layout.tsx`, `tests/lib/auth.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function isAdminEmail(email: string | null | undefined, allowlist: string): boolean; // case-insensitive, trims, empty allowlist → false
  export function requireAdmin(): Promise<{ email: string }>; // throws AuthError("forbidden") if no session or not allowlisted
  export class AuthError extends Error {}
  ```
  Auth.js GitHub provider; `signIn` callback rejects emails failing `isAdminEmail`. Middleware redirects unauthenticated `/admin/*` to sign-in. Layout also calls `requireAdmin()` (defense in depth).

- [ ] **Step 1: Write failing tests:** `isAdminEmail("A@x.com", "a@x.com, b@y.com")` true; `isAdminEmail("c@z.com", "a@x.com")` false; `isAdminEmail(null, "a@x.com")` false; `isAdminEmail("a@x.com", "")` false; `isAdminEmail("a@x.com.evil.io", "a@x.com")` false (exact match, not prefix).
- [ ] **Step 2:** Run `pnpm vitest run tests/lib/auth.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. `requireAdmin` reads session via Auth.js `auth()`.
- [ ] **Step 4:** Run the test. Expected: PASS. Then `pnpm build` passes.
- [ ] **Step 5: Commit** on `feat/admin-auth`: `feat(admin): allowlisted GitHub auth`.

---

### Task 10: Review operations and geocode

**Model:** Opus 5.5 for `lib/review.ts` (merge + validation), Sonnet 5.5 for `lib/geocode.ts` · **Difficulty:** hard

**Files:** Create `lib/review.ts`, `lib/geocode.ts`, `app/admin/review/actions.ts`, `tests/lib/review.test.ts`, `tests/lib/geocode.test.ts`, `tests/lib/review-actions.test.ts`

**Interfaces:**
- Consumes: Task 2 tables, Task 3 `slugify`, Task 9 `requireAdmin`.
- Produces (db-level, no auth, no Next imports):
  ```ts
  export const ApproveInput: z.ZodObject<{
    id: z.ZodNumber;
    place: z.ZodUnion<[{existingId: number}, {name: string; locality: string; cityId: number; lat: number; lng: number}]>;
    dish: z.ZodUnion<[{existingId: number}, {name: string}]>;
    tsSeconds: z.ZodNullable<z.ZodNumber>; note: z.ZodString /* <=140 */ }>;
  export function approveRecommendation(db: Db, input: z.infer<typeof ApproveInput>, reviewer: string): Promise<void>;
  export function rejectRecommendation(db: Db, id: number): Promise<void>;
  export function mergePlaces(db: Db, fromId: number, intoId: number): Promise<void>;
  export function addManualRecommendation(db: Db, input: ManualInput): Promise<number>;
  // ManualInput = { platform: "youtube"|"instagram"; externalId: string; creatorId: number } & Omit<z.infer<typeof ApproveInput>, "id">
  export function suggestLocation(query: string, deps?: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; ua?: string }): Promise<{ lat: number; lng: number; osmId: string; displayName: string } | null>;
  ```
  Server actions in `actions.ts` call `requireAdmin()` first, then the db function, then `revalidatePath("/admin/review")` (public revalidation comes in Plan 2).
  `approveRecommendation`: transaction; creates place/dish if `name` given (unique slug with `-2` suffix on collision, adds the typed name as alias when matching an existing id); sets `status='approved'`, `reviewed_at`, `places.last_verified=today`. `mergePlaces`: moves all recommendations and aliases to `intoId`, adds `from.name` as alias of `into`, deletes `from`. Rejects when `fromId === intoId`.
  `suggestLocation`: waits >= 1000 ms between calls (module-level last-call timestamp), sends `User-Agent`, returns null on empty result, restricts with `countrycodes=in`.

- [ ] **Step 1: Write failing tests (review):**
  - approve with new place+dish creates rows, recommendation `approved`, `reviewed_at` set
  - approve with `existingId` links without creating a place
  - approve with lat 51.5 → rejects (ZodError), recommendation still `pending`
  - note of 141 chars → rejects, nothing written
  - approving an already approved id → rejects
  - two new places with same slug get `-2` suffix
  - reject sets `rejected`
  - `mergePlaces(a, b)` moves recs, adds alias, deletes `a`; `mergePlaces(a, a)` rejects
  - transactional: failure during approve leaves no orphan place
- [ ] **Step 2: Write failing tests (geocode):** two consecutive calls call `sleep` with >= 1000 total; UA header present; empty array → `null`; request URL has `countrycodes=in`.
- [ ] **Step 3: Write failing test (actions)** in `tests/lib/review-actions.test.ts`: import the server action module with `requireAdmin` mocked to throw `AuthError`; calling approve/reject/merge actions rejects and DB is unchanged (Review Focus #5).
- [ ] **Step 4:** Run `pnpm vitest run tests/lib/review.test.ts tests/lib/geocode.test.ts tests/lib/review-actions.test.ts`. Expected: FAIL.
- [ ] **Step 5:** Implement all functions + actions.
- [ ] **Step 6:** Re-run the three files. Expected: PASS.
- [ ] **Step 7: Commit** on `feat/review-ops`: `feat(admin): approve, reject, merge, manual add, geocode suggest`.

---

### Task 11: Review queue UI and first live run

**Model:** Sonnet 5.5 (S1-9, S1-10) · **Difficulty:** medium

**Files:** Create `app/admin/review/page.tsx`, `app/admin/review/ReviewCard.tsx`, `app/admin/review/ManualAdd.tsx`, `app/admin/review/merge/page.tsx`

**Interfaces:**
- Consumes: Task 10 actions (`approveAction`, `rejectAction`, `mergePlacesAction`, `manualAddAction`, `suggestLocationAction`), `extracted.suggestions` from Task 7.
- Produces: `/admin/review` showing oldest pending first, 1 card at a time: YouTube embed (`youtube-nocookie.com/embed/{id}?start={ts}`) beside editable fields (creator, place with suggestion chips, dish with suggestion chips, timestamp, note with live 140 counter, "Suggest location" button, lat/lng inputs). Keyboard: `A` approve, `R` reject, `E` focus edit, `J/K` next/prev, shortcuts disabled while typing in an input. States: loading skeleton, empty ("Queue clear."), error banner with retry. Visible `:focus-visible`, 44px targets, no color-only status.

- [ ] **Step 1:** Build page + card + manual add + merge page with the states above.
- [ ] **Step 2:** `pnpm lint && pnpm typecheck && pnpm build`. Expected: exit 0.
- [ ] **Step 3: Live smoke (human + agent):** `pnpm db:up && pnpm db:migrate && pnpm db:seed`, set `.env`, run `pnpm worker ingest`, then `pnpm dev`, sign in, approve 3 picks, confirm approved rows in DB with `psql -c "select status,count(*) from recommendations group by 1"`.
- [ ] **Step 4:** Enable the timer per `ops/README.md` only after the Task 8 gate (precision >= 0.85) is met.
- [ ] **Step 5: Commit** on `feat/review-ui`: `feat(admin): review queue UI`.

---

## Self-Review

- **Spec coverage:** S0-1..S0-5 → Tasks 1-3; S0-6 (legal) accepted by owner, noted in `01`; S0-7 accounts → human prerequisites below; S1-1 → T6; S1-2 → T5; S1-3 → T8; S1-4 → T4; S1-5 → T10; S1-6/S1-7 → T7; S1-8 → T9; S1-9/S1-10 → T10/T11; S1-11 (review 300 picks) → human, after Task 11. Out of this plan: S2-S4, admin E2E (needs a test-auth strategy that does not weaken prod auth; decide in Plan 2).
- **Type consistency:** `Db`, `Match`, `ExtractedPick`, `IngestDeps` names match across tasks 4-8, 10.
- **Proportion:** signatures + tests; bodies left to the implementer.

## Human prerequisites before Task 7 and 11

1. YouTube Data API key (Google Cloud, enable YouTube Data API v3) → `YOUTUBE_API_KEY`.
2. cliproxyapi key → `LLM_API_KEY`; pick `LLM_MODEL` from `curl -H "Authorization: Bearer $LLM_API_KEY" localhost:8317/v1/models`.
3. GitHub OAuth app for Auth.js (`AUTH_GITHUB_ID/SECRET`), `ADMIN_EMAILS` set to your email.
4. Docker available for `pnpm db:up`.
