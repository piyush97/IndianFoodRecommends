---
version: 1
slug: "app-public-layout-tsx"
primary_target: "app/(public)/layout.tsx"
related_targets:
  [
    "app/(public)/page.tsx",
    "app/(public)/[city]/[dish]/page.tsx",
    "app/(public)/[city]/place/[slug]/page.tsx",
  ]
---

Scope: every public route (home, city, dish, place, creator, search, submit, about, kit) plus the shared header/footer. Mode: Operate. Admin inherits tokens only.

Audience/job: phone-first local foodie deciding where to eat; shortlist + proof (creator, dish, video moment) + directions, one-handed, daylight.

Constraints: PRODUCT.md. Keep every feature, route, test-visible label (search label, "Picked by N creator(s)", "Watch moment", "Directions", "Sort by distance from me", "Show map", "List"/"Map", "Report a problem", "Send for review", Play button names) and a11y contracts.

## Direction contract

THESIS: Every place carries a painted route code, like a dabba lid, so a creator-backed pick is recognisable at a glance; refuses the white-card/rating-badge food-app list.

OWN-WORLD: Unbleached cotton ground (warm off-white, not cream paper), soot-black ink, three enamel route colours bound to cities (Delhi vermilion, Mumbai leaf green, Kolkata turmeric). One condensed grotesque (Archivo, width-axis) for codes and headings, its normal width for body. Hairline rules divide; no cards, no shadows, small 4px radii, enamel tiles with slightly chipped corners.

STORY: Visitor sees the city's colour, the dish, how many creators agree, and the moment to watch; taps Watch or Directions within one screen.

FIRST VIEWPORT: Top bar: wordmark left, city tabs as enamel tiles. Search field full-width. H1 in condensed caps, count subline. Ranked rows below with a lid-code tile on the right (city letters / creator count / video time) and two 44px actions.

FORM: Dabba Lid Codes, assigned index 5 of 7; seed:27363d0e1181c0b3. Raises: whole-cell 4px rhythm (Crouwel), one grotesque + hairlines (annual), list and map share code colour/number (doujin), right-aligned tabular times (j-card).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
