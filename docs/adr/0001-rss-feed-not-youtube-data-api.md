# ADR-0001: RSS feed instead of the YouTube Data API

## Status

Accepted (2026-11-06, back-filled 2026-11-09)

## Context

We need each tracked creator's new uploads daily. The YouTube Data API needs a key and a quota, and its
Developer Policies limit how long API data may be stored (30 days, III.E.4). Our database is meant to keep
creator, place, dish and a short note of our own, not YouTube's text.

## Options

| Option                                      | For                                    | Against                                                              |
| ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Data API `playlistItems`/`videos.list`      | official, full descriptions            | key and quota to manage, 30-day storage rule applies to what we keep |
| Public channel RSS `videos.xml?channel_id=` | no key, no quota, outside API Services | latest 15 uploads only, title and description come from the feed     |
| Scraping transcripts                        | richest text                           | terms-of-service risk                                                |

## Decision

Use the public RSS feed. Keep video ID, publish date and our own extracted fields. Title and description
are read in memory for one LLM call and discarded. `lib/youtube.ts` holds the client.

## Consequences

- Depth is 15 videos. The archive is reached with `yt-dlp` (`listArchive`, `worker/backfill.ts`),
  which is unofficial and can break when YouTube changes its pages.
- Because descriptions are not stored, a pending pick must be reviewed while its video is still reachable.
  `autoReviewPending` falls back to `listArchive` once per channel (PR #62).
- Video IDs are stored and shown as embeds. This is the S0-6 decision in `docs/05-tech-design.md` section 2.

## Revisit when

YouTube removes or rate-limits the feed, `yt-dlp` stops working for a week, or a lawyer reads the
policy differently.
