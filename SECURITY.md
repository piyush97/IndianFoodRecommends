# Security policy

## Reporting a vulnerability

Do not open a public issue for a security problem. Use GitHub's private reporting:

1. Go to the repository **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the issue, the impact, and the smallest steps that reproduce it.

If private reporting is unavailable, email the maintainer listed on the GitHub profile and say
that it is a security report. Please do not include live credentials in the first message.

You can expect an acknowledgement within a few days and a decision on a fix within two weeks.
There is no bug bounty.

## What is in scope

- The deployed site and its API routes (`/api/*`).
- Credential handling: leaked keys, tokens in logs, secrets in error responses.
- Access control on `/admin` and the preview-deployment read-only guard.
- Server actions, form handling, rate limiting, and anything that writes to the database.
- Dependency vulnerabilities that are actually reachable from this code.

## What is not in scope

- The accuracy of a creator's recommendation, or a place that turned out to be closed. Use the
  "Closed or moved?" link on the place page.
- Creator opt-out requests. Use the process on the about page.
- Findings that need a compromised device, browser extension or physical access.
- Reports from an automated scanner with no demonstrated impact.
- Denial of service by volume against a personal project; tell us, but it is not a vulnerability.

## How secrets are handled

- `.env` files are git-ignored; only `.env.example` is committed, and it holds no real values.
- Vercel, Neon and the worker read secrets from environment variables at runtime.
- The worker keeps the database password out of process arguments.
- Visitor IP addresses are hashed with `REPORT_SALT` and never stored raw.
- Preview deployments open the database read-only, so a preview cannot mutate production.

If you find a real secret in the repository history, report it privately. Rotation happens first;
history rewriting is a separate decision.
