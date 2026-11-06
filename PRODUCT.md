# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a local foodie (18-35) in Delhi, Mumbai or Kolkata, on a phone, deciding where to eat this weekend. They trust the food vloggers they already watch more than star ratings, and want the shortlist plus proof: which creator picked the place, what they ordered, and the exact video moment.

Secondary: travellers who want a must-eat list for a city, and fans who browse one creator's picks. An admin (the owner) reviews leftovers in `/admin`.

## Product Purpose

One place that answers "where did food vloggers say to eat X in this city, and show me the proof". Picks are pulled from creators' YouTube uploads daily, checked automatically, and ranked by how many different creators recommended each place. Success: visitors click "Watch moment" or "Directions"; data quality stays high (few reports of wrong places).

## Positioning

Every listing is backed by a creator's own video at the moment they eat there, and ranking is the count of distinct creators, not paid placement or anonymous star ratings. No competitor maps vlogger picks this way (Mapiefood maps friends, not creators).

## Operating Context

- Mostly phones, often outdoors or on the move; 4G; one-handed.
- Visitors arrive from search ("chole bhature in Delhi"), shared links, or a creator's share badge.
- Data refreshes once a day (03:00 IST). Cities: Delhi (most data), Mumbai (few picks), Kolkata (none yet, shown as "soon").

## Capabilities and Constraints

- Pages: home, city, dish-in-city, place, creator, search, suggest a pick, about, creator share kit; admin review, stale places.
- Features to preserve: typo-tolerant search, list/map toggle (MapLibre, map loads on demand), click-to-load YouTube/Instagram embeds starting at the timestamp, Directions to Google Maps, opt-in "sort by distance" (location never leaves the device), report a problem, suggest a pick (BotID), share images, JSON-LD, sitemap.
- Constraints: Next.js 16 App Router with Cache Components, Tailwind 4, no cookies/accounts, CSP without nonces (inline scripts allowed, third parties pinned), Lighthouse mobile ≥ 90, CLS 0, WCAG 2.2 AA (axe 0 serious), 44px targets, no horizontal overflow at 360px.
- Undecided: final brand name and domain; Hindi UI.

## Brand Commitments

Name "Indian Food Recommends" is a placeholder. Nothing visual is binding; the current look may be replaced entirely.

## Evidence on Hand

- Real data: 19 approved picks (Delhi 16, Mumbai 3) from 13 creators; dish list of ~30+; places with locality and (often approximate) map pins.
- No photos of food or places are stored or licensed. Video thumbnails are YouTube's; we show embeds only after a click. Do not invent images, ratings, prices, opening hours, testimonials or visitor counts.

## Product Principles

1. Proof over opinion: every pick links to the creator's moment.
2. Count creators, not hype: ranking is explainable in one line.
3. Phone first, thumb first: fastest path from "what do I eat" to directions.
4. Honest gaps: empty cities and approximate pins are labelled, never padded.
5. Respect creators: credit always visible, opt-out honoured.

## Accessibility & Inclusion

WCAG 2.2 AA (contrast 4.5:1, keyboard, visible focus, 44px targets), map always has a list alternative, Indian English, works at 200% zoom and 360px width.
