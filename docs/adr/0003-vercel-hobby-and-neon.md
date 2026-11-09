# ADR-0003: Vercel Hobby and Neon, functions in sin1

## Status

Accepted (2026-11-08, back-filled 2026-11-09)

## Context

The user asked for a free platform. The app is Next.js 16 with `cacheComponents` and Postgres.

## Options

| Option              | For                                 | Against                                                                     |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Cloudflare Workers  | free tier, edge                     | needs an adapter for Next 16 and Hyperdrive for Postgres, more moving parts |
| Vercel Hobby + Neon | native Next support, free, Postgres | Hobby terms are for non-commercial use, functions default to `iad1`         |

## Decision

Vercel Hobby with Neon Postgres (ap-southeast-1). `vercel.json` pins `regions: ["sin1"]` so functions sit
next to the database (PR #66). Measured total load before and after: home 1.75 s to 0.36 to 0.79 s,
`/delhi` 1.92 s to 0.36 to 0.86 s.

## Consequences

- Moving functions next to the database cut load times by about half or more, so the round trip per query was the main cost.
- Public data is cached with tags (`public`, `city:<slug>`) and the worker revalidates after writes.
- Hobby is not allowed for commercial use.

## Revisit when

The site earns money or ads, traffic exceeds Hobby limits, or most readers are outside India.
