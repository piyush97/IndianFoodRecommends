# 04 · Product Requirements (PRD)

## Problem
Indians planning a food outing trust food vloggers more than star ratings, but picks are buried across hundreds of hour-long videos and reels. No single place answers "where did vloggers say to eat chole bhature in Delhi, and show me the proof".

## Users
| Persona | Need |
|---|---|
| Local foodie (Delhi, 18-35) | Weekend plan: best X near me, vetted by creators they follow |
| Traveller to a city | Short list of must-eat places, fast, on phone |
| Creator fan | Everything one creator recommended in a city |
| Editor (us) | Approve extracted picks quickly and correctly |

## User stories (MVP)
| ID | Story | Acceptance |
|---|---|---|
| P1 | As a visitor I search "chole bhature" and see Delhi places ranked by number of creators who picked them | Results < 300 ms p95 server time; typo-tolerant ("chole bature") |
| P2 | I open a place and watch the exact video moment | YouTube embed starts at stored timestamp; IG reel embeds |
| P3 | I switch list ↔ map | Map pins match list; works on 360px width |
| P4 | I browse a creator's picks in a city | Creator page lists approved picks, filter by dish |
| P5 | I get directions | Button opens Google Maps / OSM directions with lat/lng |
| P6 | I report a closed or wrong place | Form creates `report` row; no login |
| E1 | As editor I review pending LLM picks with video side by side | Approve/edit/reject in ≤ 3 actions, keyboard shortcuts |
| E2 | Editor merges duplicate places | Merge moves all recommendations, keeps alias |
| E3 | Editor adds a pick manually (incl. IG reel) | Same form as review |
| S1 | (S4) Visitor submits a pick | Goes to review queue; rate-limited; captcha |

## Ranking (MVP, simple, explainable)
`score = distinct_creators_count * 10 + recency_bonus(0-5)`. Shown to user as "Picked by N creators". No hidden paid boosts.

## Content rules
- Only approved records public.
- Our note is our own words, max 140 chars; never copy video description.
- Every pick shows creator + link to original.
- Creator opt-out honoured within 7 days.

## Non-functional
- Mobile first, LCP < 2.5s on 4G, CLS < 0.1.
- WCAG 2.2 AA: contrast 4.5:1, keyboard nav, focus visible, 44px tap targets, map has list alternative.
- Hindi transliteration tolerance in search (chole/chhole, bhature/bature) via trigram + alias table.
- Privacy: no user accounts, analytics cookieless (Plausible/Umami).

## Success metrics (targets to validate, not facts)
- Launch: 300 approved Delhi picks, 8+ creators.
- 3 months: 10k monthly visitors from organic search, ≥ 25% click "Watch moment" or "Directions".
- Data quality: < 2% of picks reported wrong.

## Out of scope
Accounts, reviews, booking, delivery, monetisation, native apps.

## Open questions
1. Correct creator in example: Anubhav Sapra (Delhi Food Walks) or another person?
2. Launch city: Delhi only?
3. Domain/brand name final?
4. Hindi UI needed at launch or English only?
5. Who reviews picks (you alone, or helpers)?
