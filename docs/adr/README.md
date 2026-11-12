# Architecture Decision Records

One decision per file, in `template.md` format. An accepted record is never edited; a decision
that changes gets a new record that supersedes it and names the one it replaces.

Eight records, written 2026-11-09, covering the choices that are expensive to reverse. Each
records the options that were rejected and why, so a reviewer can see the trade-off that was made
rather than only the outcome.

| ADR                                                | Decision                                                   | Date       |
| -------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| [0001](0001-rss-feed-not-youtube-data-api.md)      | RSS feed instead of the YouTube Data API                   | 2026-11-06 |
| [0002](0002-ingest-worker-runs-on-this-machine.md) | Ingest worker on this machine, not on Vercel               | 2026-11-06 |
| [0003](0003-vercel-hobby-and-neon.md)              | Vercel Hobby and Neon, functions in `sin1`                 | 2026-11-08 |
| [0004](0004-store-only-google-place-id.md)         | Store only the Google place ID                             | 2026-11-08 |
| [0005](0005-proxy-for-real-404s.md)                | Real 404 status from `proxy.ts`                            | 2026-11-08 |
| [0006](0006-auto-review-with-human-override.md)    | Automatic review with human override                       | 2026-11-06 |
| [0007](0007-earthdistance-then-postgis.md)         | `earthdistance` first, PostGIS once boundaries were needed | 2026-11-09 |
| [0008](0008-local-gazetteer-before-nominatim.md)   | Match our own gazetteer before calling OpenStreetMap       | 2026-11-09 |

New records: copy `template.md`, number it next, and open a pull request. If a record contradicts
a line in [`../ARCHITECTURE.md`](../ARCHITECTURE.md), the record wins and the architecture page
needs updating in the same pull request.
