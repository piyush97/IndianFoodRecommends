# 03 · Full-stack Architecture

## Diagram

```mermaid
flowchart LR
  subgraph Sources
    YT[YouTube Data API v3]
    IG[Instagram oEmbed]
    OSM[Nominatim / OSM]
  end

  subgraph HomeServer["This machine (cron)"]
    ING[Ingest worker<br/>Node/TS script]
    LLM[cliproxyapi<br/>localhost:8317<br/>OpenAI-compatible]
    ING -->|title+desc+chapters, transient| LLM
    LLM -->|JSON: place, dish, ts, conf| ING
  end

  subgraph Cloud
    DB[(Postgres<br/>Neon/Supabase<br/>pg_trgm + postgis optional)]
    WEB[Next.js app on Vercel<br/>SSR/ISR pages + API routes]
    ADMIN[/admin review UI<br/>same app, auth-gated/]
  end

  USER((Visitor)) --> WEB
  EDITOR((Editor)) --> ADMIN
  YT --> ING
  OSM --> ING
  ING -->|pending recommendations| DB
  ADMIN -->|approve/edit/reject| DB
  WEB -->|read approved only| DB
  WEB -->|client embed| YT
  WEB -->|client embed| IG
  WEB -->|map tiles| OSM
```

## Data flow (one recommendation)

```mermaid
sequenceDiagram
  participant C as Cron (daily)
  participant Y as YouTube API
  participant L as cliproxyapi LLM
  participant D as Postgres
  participant A as Admin
  participant V as Visitor
  C->>Y: list new uploads for tracked channels
  Y-->>C: videoId, title, desc (not persisted)
  C->>L: extract {place, dish, city, timestamp}
  L-->>C: JSON + confidence
  C->>D: insert recommendation(status=pending, video_id, extracted)
  A->>D: approve (fix place match, lat/lng, note)
  D-->>V: page revalidated (ISR tag)
```

## Components

| Component         | Tech                                                          | Why                                                 |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Web + API + admin | Next.js (App Router, TS), Tailwind                            | One deployable, SSR for SEO                         |
| DB                | Postgres + Drizzle ORM, `pg_trgm`                             | Fuzzy search + entity match, no extra search engine |
| Map               | MapLibre GL + OSM tiles (or MapTiler free tier)               | No Google lock-in                                   |
| Ingest            | Node/TS script in same repo (`/worker`), cron on this machine | cliproxyapi is local                                |
| LLM               | cliproxyapi `localhost:8317` via OpenAI SDK                   | Already installed                                   |
| Auth (admin only) | Auth.js with GitHub/Google allowlist                          | Simple, no user accounts                            |
| Hosting           | Vercel (web), Neon (DB)                                       | Free tiers cover MVP                                |
| Observability     | Vercel logs + Sentry free                                     | Enough for MVP                                      |
