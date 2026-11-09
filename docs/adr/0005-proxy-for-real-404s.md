# ADR-0005: Real 404 status from `proxy.ts`

## Status

Accepted (2026-11-08, back-filled 2026-11-09)

## Context

Unknown URLs like `/pune` or `/delhi/place/nope` returned 200 with `noindex`. Next's docs say the status stays
200 when `notFound()` fires inside streamed Suspense under `cacheComponents`. Search engines treat that as a
soft 404.

## Options

| Option                                       | Result                                                                |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `notFound()` before Suspense                 | works for `/[city]` only, deep pages stayed 200                       |
| `generateStaticParams`                       | the build then queries the DB, and CI builds without one, so it fails |
| `proxy.ts` rewrite to `/404` with status 404 | works for every route, needs a way to know valid paths                |

## Decision

`proxy.ts` (Node runtime) asks `lib/seo/known-paths.ts` whether a path is real and rewrites to `/404` with
status 404 when not. The index holds approved place and dish slugs per city plus creators. It is cached 60 s
per instance, rechecked at most every 10 s on a miss, and fails open on a database error.

## Consequences

- A new top-level route must be added to `STATIC_ROUTES`. A test fails if one is missing.
- A page published in the last few seconds can 404 until the index is rechecked (at most every 10 s on a miss).
- Failing open means a database outage serves soft 404s, never blocks real pages.

## Revisit when

Next returns a real status for streamed `notFound()`.
