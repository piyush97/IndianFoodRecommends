# Architecture decision records

One file per decision that is expensive to reverse. Format in `template.md`. Numbers never change.
A reversed decision gets a new ADR that supersedes the old one; the old one stays.

The first 8 were written on 2026-11-09 from the commits and PRs that made the decisions.

| ADR                                                | Decision                                             | Date       |
| -------------------------------------------------- | ---------------------------------------------------- | ---------- |
| [0001](0001-rss-feed-not-youtube-data-api.md)      | RSS feed instead of the YouTube Data API             | 2026-11-06 |
| [0002](0002-ingest-worker-runs-on-this-machine.md) | Ingest worker runs on one machine, not on Vercel     | 2026-11-06 |
| [0003](0003-vercel-hobby-and-neon.md)              | Vercel Hobby and Neon, functions in sin1             | 2026-11-08 |
| [0004](0004-store-only-google-place-id.md)         | Store only the Google place ID                       | 2026-11-08 |
| [0005](0005-proxy-for-real-404s.md)                | Real 404 status from `proxy.ts`                      | 2026-11-08 |
| [0006](0006-auto-review-with-human-override.md)    | Automatic review of picks, humans can still override | 2026-11-06 |
| [0007](0007-earthdistance-then-postgis.md)         | earthdistance first, then PostGIS                    | 2026-11-09 |
| [0008](0008-local-gazetteer-before-nominatim.md)   | Search our own areas before asking OpenStreetMap     | 2026-11-09 |
