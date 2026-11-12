# Contributing

Thanks for helping. This project is a Next.js app plus a Node worker over one Postgres database,
so most changes need a database to be meaningful.

## Before you start

- For anything larger than a bug fix, open an issue first so we agree on the shape before code.
- Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and skim [`docs/adr/`](docs/adr/). The ADRs
  explain why the ingest pipeline looks the way it does, including options that were rejected.
- Never point `DATABASE_URL` at a shared or production database while developing. Use your own
  local Postgres.

## Setup

```bash
pnpm install
cp .env.example .env
docker run --rm -d --name ifr-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ifr postgis/postgis:17-3.5
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Tests need a second database:

```bash
createdb ifr_test
DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/ifr_test pnpm test
```

Integration tests skip when `DATABASE_URL_TEST` is unset, so a bare `pnpm test` still runs the
pure unit tests.

## Checks a pull request must pass

```bash
pnpm lint
pnpm format:check
pnpm typecheck
DATABASE_URL_TEST=… pnpm test
pnpm e2e:seed && pnpm e2e     # when a page or the seed changed
```

CI runs all of these plus a production build. Keep the diff focused; unrelated cleanups belong in
their own pull request.

## Conventions

- **Tests first.** Write the failing test, watch it fail for the right reason, then implement.
  Tests that pass the moment you write them prove nothing.
- **Assert on behaviour, not mocks.** Database tests use `db/test-db.ts` helpers; do not mock
  Postgres.
- **No secrets in the repository.** `.env` files are ignored; keep them that way. CI uses
  throwaway values only.
- **Migrations are append-only.** Add a new file in `db/migrations/`; never edit one that has run
  in production. `scripts/check-migrations.mjs` rejects statements that lock a live table.
- **Style.** Prettier and ESLint are configured. TypeScript is strict; no `any` without a reason.
- **Accessibility is a requirement, not a follow-up.** Tap targets at least 44 px, visible focus,
  WCAG AA contrast, no horizontal overflow at 360 px. The e2e suite runs axe and fails on serious
  findings.
- **Copy.** Write plainly, name the actor, never invent a statistic, rating or quote. Places we
  have not verified are labelled as unverified rather than padded.

## Changing the ranking

The ranking rule is published to visitors on `/about`, so a change is a product change, not only
a code change. Update the rule, the tests, and that page together, and say in the pull request why
the new order is more honest than the old one.

## Adding a creator or a city

Creators are a row in `db/seed-data.ts` with a channel ID; cities are defined only in
`lib/cities.ts`. Adding either makes new pages possible, so include a test for links and sitemap
entries. Do not add a creator whose picks are not about named shops.

## Reporting a security issue

Do not open a public issue. See [`SECURITY.md`](SECURITY.md).
