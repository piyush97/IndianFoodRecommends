# 05 · Tech Design Doc

Status: draft · Owner: TBD · Depends on: 01, 03, 04

## 1. Repo layout (single repo, pnpm)
```
/app            Next.js App Router (public pages, /admin, /api)
/db             Drizzle schema + migrations + seed
/worker         ingest CLI: yt-sync, extract, geocode
/docs           these docs
```
Worker shares `/db` code. No monorepo tool needed.

## 2. Data model
```mermaid
erDiagram
  CITY ||--o{ PLACE : has
  CREATOR ||--o{ SOURCE : publishes
  SOURCE ||--o{ RECOMMENDATION : contains
  PLACE ||--o{ RECOMMENDATION : receives
  DISH ||--o{ RECOMMENDATION : about
  PLACE ||--o{ PLACE_ALIAS : known_as
  DISH ||--o{ DISH_ALIAS : known_as
  PLACE ||--o{ REPORT : flagged_by

  CITY { int id PK; text slug UK; text name; text state }
  CREATOR { int id PK; text slug UK; text name; text yt_channel_id; text ig_handle; bool opted_out }
  SOURCE { int id PK; text platform "youtube|instagram"; text external_id UK; int creator_id FK; date published_on }
  PLACE { int id PK; text slug UK; text name; int city_id FK; text locality; float lat; float lng; text osm_id; text status "open|closed|moved"; date last_verified }
  DISH { int id PK; text slug UK; text name; text cuisine }
  RECOMMENDATION { int id PK; int source_id FK; int place_id FK; int dish_id FK; int ts_seconds; text note; text status "pending|approved|rejected"; text origin "llm|manual|community"; float confidence; jsonb extracted; timestamptz reviewed_at }
  PLACE_ALIAS { int place_id FK; text alias }
  DISH_ALIAS { int dish_id FK; text alias }
  REPORT { int id PK; int place_id FK; text kind; text message; timestamptz created_at }
```
- `pending` rows: `place_id` / `dish_id` nullable until review; raw guess in `extracted` jsonb (our LLM output, not YouTube text).
- Indexes: `gin_trgm_ops` on `place.name`, `dish.name`, aliases; `(status, place_id)`, `(status, dish_id)`.
- YouTube compliance: we persist only `external_id` (video ID), creator channel ID, and our derived facts. No titles/descriptions/stats. **Verify with policy review that video IDs are allowed beyond 30 days; if not, add 30-day refresh job.**

## 3. Ingestion pipeline (`/worker`)
1. `yt-sync`: for each tracked creator, `playlistItems.list` on uploads playlist (1 quota unit/page, not `search.list` at 100). Collect new video IDs since last run.
2. `extract`: fetch `videos.list` snippet (title, description) in memory → prompt LLM via cliproxyapi (`OPENAI_BASE_URL=http://localhost:8317/v1`) with JSON schema output:
   `{ items: [{ place_name, locality, city, dishes[], timestamp_seconds|null, confidence }] }`. Discard YouTube text after call.
3. `match`: trigram match place + dish against existing rows/aliases (threshold 0.6) → suggest id.
4. `geocode`: Nominatim (1 req/s, custom UA) for new places → suggestion only.
5. Insert `recommendation(status=pending)`.
Run: cron daily 03:00 IST on this machine. Idempotent via `source.external_id` unique.
Failure: per-video try/catch, log to `ingest_run` table, never abort whole run.

## 4. Web app
| Route | Render | Notes |
|---|---|---|
| `/` | ISR 1h | city picker, popular dishes, creators |
| `/[city]` | ISR | top dishes + places |
| `/[city]/[dish]` | ISR | SEO money page "X in City recommended by food vloggers" |
| `/[city]/place/[slug]` | ISR | embeds, directions, report |
| `/creator/[slug]` | ISR | |
| `/search?q=` | SSR | trigram over place/dish/creator + aliases |
| `/admin/*` | SSR, auth | review, merge, manual add |
| `/api/report` | POST | zod validation, rate limit by IP (Vercel KV or simple DB table) |
On approve → `revalidateTag('place:ID','dish:ID','city:ID','creator:ID')`.

Embeds: `youtube-nocookie.com/embed/{id}?start={ts}` lazy-loaded behind a click facade (perf + privacy). IG via `blockquote.instagram-media` + embed.js, facade first.

SEO: `schema.org/Restaurant` JSON-LD on place pages, `ItemList` on dish pages, sitemap.xml generated from approved data, canonical URLs, OG images via `next/og`.

## 5. Security
- Admin: Auth.js, email allowlist env var; all `/admin` + mutating API routes check session server-side.
- Input validation with zod at every API boundary. Parameterised queries via Drizzle.
- Secrets: `.env` local, Vercel env for prod. cliproxyapi key never leaves this machine.
- CSP allowing only youtube-nocookie, instagram, map tile host.

## 6. Testing
- Unit: matcher, slug, score, LLM output parser (fixtures of real-ish JSON incl. malformed).
- Integration: worker against Postgres in Docker, YouTube + LLM mocked.
- E2E (Playwright): search → place → watch; admin approve flow.
- LLM eval set: 50 hand-labelled videos, track precision of place extraction per prompt/model change. Gate: ≥ 85% precision.

## 7. Alternatives rejected
| Option | Why not |
|---|---|
| Google Places for geodata | storage limits, cost, lock-in |
| Separate backend (FastAPI/Nest) | 2 deployables for no gain |
| Vector search | trigram enough for names; add later if semantic search needed |
| Scraping YouTube transcripts | ToS risk |

## 8. Open technical questions
1. Video ID retention under YouTube policy (legal read).
2. Which cliproxyapi model is best for extraction (eval set decides).
3. Neon vs Supabase (either works; pick by free tier limits at signup).
