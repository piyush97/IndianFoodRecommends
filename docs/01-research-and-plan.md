# 01 · Research + Plan (draft v0.1, 2026-11-06)

Working name: **Indian Food Recommends** (placeholder, not final brand).

## 1. Idea in one line
One site: pick an Indian city → see places + dishes that YouTube/Instagram food vloggers recommended, each linked to the exact video moment.

Example record:
| Creator | Place | Dish | City | Proof |
|---|---|---|---|---|
| Delhi food vlogger (see note) | Chache Di Hatti, Kamla Nagar | Chole Bhature | Delhi | YouTube link @ timestamp |

> Confirmed by owner 2026-11-06: seed creator is **Ayush Sapra** (YouTube channel `UC2UWtuZR3kH-5C26HVMMB6A`, Instagram `@aayushsapra2`). Launch city: Delhi only. Domain: placeholder. Legal risk accepted by owner.

## 2. Market check
- No site found that maps India restaurants by vlogger recommendation. Closest: Mapiefood (friend-based maps), generic "top food YouTubers" listicles.
- Creator pool is big: Curly Tales, Aapka Bhai Foody, Foodie We, Delhi Food Walks, Dilsefoodie, Bhooka Saand, Foody Vishal, Chahat Anand, Foody Monk, Khaane Mein Kya Hai (from listicles; subscriber numbers not verified by us).
- Users already search "chole bhature delhi youtuber" style queries → programmatic SEO pages (dish × city, creator × city) are the main growth lever.

## 3. Hard constraints found (these shape the design)
| Constraint | Impact | Decision |
|---|---|---|
| YouTube API Developer Policies: data fetched with API key stored max **30 days**, then refresh or delete. Merging YouTube API data with other data restricted. | Cannot keep titles, descriptions, view counts in our DB long term. | Store **our own facts** (place, dish, creator, timestamp, our own one-line note). Use API only transiently during ingestion. Embed player for video display. Legal review item. |
| YouTube captions API: download only for videos you own. | No transcripts via official API. | Extraction from title + description + chapters (transient) + human review. Manual/community entry as backup. |
| Instagram: no public search API. oEmbed for public reels (reports say tokenless since Jun 2026, Meta docs conflict). | Cannot auto-ingest IG. | IG = manual/community submission of reel URL, rendered via oEmbed/embed. |
| Google Places ToS: only `place_id` storable long term. | Lock-in + caching rules. | Use OpenStreetMap (Nominatim + MapLibre). Lat/lng verified by admin, stored as our data. |
| LLM extraction can hallucinate place names. | Wrong place = trust lost. | Nothing public without human approval. Confidence + source shown. |
| cliproxyapi on `localhost:8317` (OpenAI-compatible, key required). | LLM only reachable from this machine. | Ingestion worker runs **on this machine** (cron), writes to hosted DB. Web app never calls LLM. |

## 4. Scope
- **Goals (MVP):** 1 city (Delhi), 5-10 creators, 300+ approved recommendations, search by dish/place/creator, map view, video-at-timestamp proof, admin review queue, SEO pages.
- **Non-goals (MVP):** user accounts, user ratings, delivery/booking, mobile app, cities outside India.
- **Anti-goals:** unverified recommendations, scraping in breach of ToS, paid placement disguised as creator picks, re-hosting creator thumbnails/video.

## 5. Phased plan
| Sprint | Weeks | Outcome |
|---|---|---|
| S0 Foundations | 1 | Repo, CI, DB schema, design tokens, legal check of YouTube policy |
| S1 Data pipeline | 2 | YouTube ingest → LLM extract (cliproxyapi) → review queue → approved records |
| S2 Public site | 2 | City, place, dish, creator pages, search, map, embeds |
| S3 SEO + launch | 2 | Programmatic pages, sitemap, perf, a11y, analytics, Delhi launch |
| S4 Growth | 2 | Community submissions (IG reels), 2nd + 3rd city, creator opt-out page |

## 6. Staff engineer scrutiny (risks + calls)
1. **Legal is the #1 risk, not tech.** Stored data = our editorial facts + link. Read YouTube Developer Policies III.E.4 before S1 ends.
2. **Quality over volume.** 300 correct records beat 5,000 noisy ones. Review queue is core, not an afterthought.
3. **Entity resolution is the hard problem.** "Chache Di Hatti" vs "Chachi Di Hatti" vs "Chache Di Hatti Kamla Nagar". Fuzzy match (pg_trgm) + alias table + admin merge.
4. **Places close/move.** `status` (open/closed/moved) + "last verified" date + "report issue" button.
5. **Boring stack.** One Next.js app + Postgres. No microservices, vector DB, or Redis in MVP.
6. **Creators are partners.** Always link back, never re-host, offer opt-out.

## Sources
- [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [YouTube derived metrics + storage policy](https://developers.google.com/youtube/terms/derived-metrics-policy)
- [Complying with YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide)
- [Meta: Embed an Instagram Post (oEmbed)](https://developers.facebook.com/documentation/instagram-platform/oembed)
- [Spotlight: Meta 2026 tokenless oEmbed change](https://spotlightwp.com/instagram-embed-wordpress/)
- [Top 20 Food YouTubers India 2026](https://www.inditubedb.com/guides/top-20-food-cooking-youtubers-india)
- [Brands Chronicle: Top food YouTubers India](https://brandschronicle.com/top-10-food-youtubers-in-india/)
- [Mapiefood](https://www.mapiefood.com/)
