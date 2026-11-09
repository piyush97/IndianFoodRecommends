# ADR-0002: Ingest worker runs on one machine, not on Vercel

## Status

Accepted (2026-11-06, back-filled 2026-11-09)

## Context

Pick extraction calls an LLM through cliproxyapi at `localhost:8317`. That port exists only on this machine.
The website must stay fast and must never wait for a model.

## Options

| Option                                      | For                          | Against                                            |
| ------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| Worker on Vercel cron                       | one platform                 | cannot reach the local proxy, function time limits |
| Hosted worker with its own LLM key          | no single machine            | new cost and secret, proxy no longer used          |
| Local worker, systemd timer, writes to Neon | uses the proxy, free, simple | this machine is a single point of failure          |

## Decision

Run `pnpm worker ingest` from `ops/ifr-ingest.timer` (21:30 UTC). It writes to Neon, then tells the site to
revalidate. The web app reads the database only and never calls the LLM.

## Consequences

- Failures must be loud. Every unit has `OnFailure=ifr-alert@%n.service` (ntfy push plus one GitHub issue,
  PR #62). The run exits 1 when LLM picks stay pending over 48 h.
- Neon is backed up nightly (`ops/ifr-backup.timer`) and a monthly restore drill proves the dump restores.
- If the machine is off, the site keeps serving the last data. Freshness is the only thing that degrades.

## Revisit when

The LLM gateway gets a public endpoint, or the machine misses more than one scheduled run a month.
