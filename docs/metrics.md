# Metrics

Four numbers, read once a week from Umami Cloud (cloud.umami.is). Definitions come from `docs/superpowers/specs/2026-11-10-growth-five-design.md`, section 1.

## Setup (owner)

Umami records nothing until these are done. Tracking issue: #58.

- [ ] In Umami Cloud, add a site with domain = the production host. Copy the website ID. (about 10 min)
- [ ] `vercel env add NEXT_PUBLIC_UMAMI_WEBSITE_ID production`
- [ ] `vercel env add NEXT_PUBLIC_SITE_URL production` (value `https://indian-food-recommends.vercel.app` until a domain exists)
- [ ] Redeploy: `vercel --prod`, or merge any PR.
- [ ] Verify: open the prod site, click "Watch moment". Umami Realtime must show a `watch` event within 60 s. DevTools must show no CSP violations.
- [ ] Comment on #58 that the env vars are set.

## The 4 weekly numbers

Set the date range to the last 7 days (Mon to Sun) before reading each one.

### 1. Action rate

Sessions with a `watch` or `directions` event / all sessions.

- Sessions: Overview page, "Visits" total.
- Numerator: Filters > Event is `watch`, read Visits. Repeat for `directions`. Umami may offer an OR filter or a Segment for "watch or directions" (read Visits once); this is not verified against the live Umami UI, so check when you set it up. If it does not, take the larger of the two counts as a floor and note that in the log.
- Cross-check: Events page, event counts per name.

### 2. Share rate

(`share` events + `list-share` events) / sessions.

- Events page: read the count for `share` and for `list-share`. Add them.
- Divide by Visits from Overview.
- `share` carries `place`. `list-share` carries `size`. Click an event name to see the property breakdown.

### 3. Share-driven visits

Sessions that arrived through a shared link.

- Overview with Filters > UTM Source is `share`. Read Visits.
- Split by medium: Filters > UTM Medium is `native`, `copy` or `whatsapp`.
- Shared URLs carry `utm_source=share&utm_medium=<native|copy|whatsapp>`. Canonical tags strip them, so SEO is not affected.

### 4. Zero-result search rate

`search` events with `results=0` / all `search` events.

- Events page, open `search`, view the property `results`. Values: `0`, `1-5`, `6+`.
- Rate = count of `0` / sum of all three.
- For which queries return nothing, use `/admin/searches` (backed by the `search_misses` table). `/search` is disallowed in robots.txt, so Search Console does not see those queries. Umami does not record the query text, by design.

## Weekly log

Add one row per week. Rates as percent, one decimal.

| week | sessions | action rate | share rate | share visits | zero-result % |
| ---- | -------- | ----------- | ---------- | ------------ | ------------- |
|      |          |             |            |              |               |

## Events

All names are kebab-case. Fired from `lib/track.ts` (`track(event, data)`, a no-op when Umami is absent or blocked) or from `data-umami-event` attributes.

| event           | fires when                                                                        | data                        |
| --------------- | --------------------------------------------------------------------------------- | --------------------------- |
| `watch`         | "Watch moment" link clicked on a pick card                                        | `place`                     |
| `directions`    | Directions link clicked on a pick card or the place page                          | `place`                     |
| `share`         | Share button clicked on a place or dish page                                      | `place`                     |
| `play`          | Video facade clicked to load the embed                                            | `platform`                  |
| `find-on`       | "Find it on" app link clicked on the place page                                   | `app`, `place`              |
| `google-rating` | Google Maps rating link clicked on the place page                                 | none                        |
| `search`        | Search results page rendered with a query                                         | `results`: `0`, `1-5`, `6+` |
| `near-me`       | Near me used: location granted, denied or unavailable, or an area typed or picked | `result`, see below         |
| `report`        | Report form submitted successfully                                                | `kind`                      |
| `save`          | Place saved to the eat list                                                       | `place`                     |
| `unsave`        | Place removed from the eat list                                                   | `place`                     |
| `list-share`    | Eat list shared                                                                   | `size`                      |
| `list-open`     | `/list?p=...` opened                                                              | `size`, `own`: `yes`, `no`  |
| `list-save-all` | "Save all to my list" clicked on a friend's list                                  | none                        |
| `kit-copy`      | Copy button clicked on the creator share kit (`/creator/<slug>/kit`)              | `kind`, `creator`           |

`near-me` `result` values by emitter:

- `HomeNearMe` (home page): `granted`, `denied`, `area`, `none-nearby`, `unavailable` (position error or timeout). `none-nearby` replaces `granted` or `area` when nothing is within range.
- `NearMeList` (city and dish pages): `granted`, `denied`, `area` only.

`kit-copy` `kind` values: `link` (bio link), `text` (description text), `html` and `markdown` (badge snippets). `creator` is the creator slug.

Kit links carry `utm_source=creator&utm_campaign=<slug>`, plus `utm_medium=badge` from the badge snippets and `utm_medium=post` from the description text. The bio link has no medium. Filters > UTM Source is `creator` shows those visits.

No cookies, no accounts, and no coordinates are sent with any event.
