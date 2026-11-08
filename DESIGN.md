---
name: Indian Food Recommends
description: Creator-backed food picks for Delhi, Mumbai and Kolkata, marked with painted dabba-lid route codes.
colors:
  ink: "#1d1a16"
  ink-hover: "#3a342c"
  muted: "#5c554c"
  paper: "#f2eee5"
  field: "#fbf9f4"
  cloth: "#e8e2d4"
  line: "#cfc6b4"
  accent: "#b8361d"
  accent-soft: "#f4dccf"
  route-delhi: "#b8361d"
  route-mumbai: "#2a6b45"
  route-kolkata: "#e2a823"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "'wdth' 62"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "'wdth' 62"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "'wdth' 62"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.5
    fontFeature: "'tnum'"
rounded:
  step: "4px"
spacing:
  gutter: "16px"
  tile-gap: "8px"
  row-y: "16px"
  section: "32px"
  target: "44px"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.step}"
    padding: "0 14px"
    height: "44px"
  button-ink-hover:
    backgroundColor: "{colors.ink-hover}"
  button-line:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.step}"
    padding: "0 14px"
    height: "44px"
  button-line-hover:
    backgroundColor: "{colors.cloth}"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.step}"
    padding: "0 12px"
    height: "44px"
  city-tab-delhi:
    backgroundColor: "{colors.route-delhi}"
    textColor: "{colors.paper}"
    rounded: "{rounded.step}"
    padding: "0 12px"
    height: "44px"
  city-tab-mumbai:
    backgroundColor: "{colors.route-mumbai}"
    textColor: "{colors.paper}"
    rounded: "{rounded.step}"
    padding: "0 12px"
    height: "44px"
  city-tab-kolkata:
    backgroundColor: "{colors.route-kolkata}"
    textColor: "{colors.ink}"
    rounded: "{rounded.step}"
    padding: "0 12px"
    height: "44px"
  lid-code:
    backgroundColor: "{colors.route-delhi}"
    textColor: "{colors.paper}"
    rounded: "{rounded.step}"
    padding: "6px 8px"
    width: "64px"
  map-pin:
    backgroundColor: "{colors.route-delhi}"
    textColor: "{colors.paper}"
    rounded: "{rounded.step}"
    size: "32px"
---

# Design System: Indian Food Recommends

## Overview

**Creative North Star: "Dabba Lid Codes"**

Mumbai's dabbawalas paint short route codes on tiffin lids so a box is sorted at a glance. This site does the same for food picks: every place carries a painted enamel tile in its city's route colour, showing the city code, how many creators agree, and the video moment. The world sits on unbleached cotton (a warm off-white, not cream paper) with soot-black ink, and it is light only because the use scene is a phone in daylight.

The surface is an operating list, not a showcase. One column (max 768px), ranked rows divided by hairline rules, two 44px actions per row, and nothing floating above the page. Depth comes from flat colour and inset painted borders, never drop shadows. One typeface, Archivo, carries both voices through its width axis: condensed 800-weight caps for headings and codes, normal width for everything you read. The world refuses the white-card, star-rating-badge food-app list.

No raster images ship. There are no food or place photos; video thumbnails appear only inside a clicked embed. Raster provenance: none.

**Key Characteristics:**

- Warm cotton ground, soot ink, three enamel route colours bound to cities.
- Archivo variable: condensed caps (wdth 62%, weight 800) for lid voice, normal width for body.
- Hairline rules divide rows; no cards, no chips, no drop shadows.
- 4px corners on every interactive surface.
- Lid tile is the signature: city code, creator count, the word "creator(s)", optional video time.
- List rank and map pin share one number and one colour.
- Tabular numerals everywhere; 44px minimum targets.

## Colors

A muted, warm neutral field carrying three saturated enamel route colours, each owned by exactly one city.

### Primary

- **Delhi Vermilion** (route-delhi / accent): Delhi's route colour on its city tab, lid tiles and map pins; also the single site accent (the "Recommends" half of the wordmark, the embed play tile, the input caret). Paper text on it reaches 5.3:1; as text on paper, 5.3:1.

### Secondary

- **Mumbai Leaf** (route-mumbai): Mumbai's route colour on tab, tiles and pins only. Paper text on it reaches 5.6:1.

### Tertiary

- **Kolkata Turmeric** (route-kolkata): Kolkata's route colour, always with ink text (9.7:1), never paper. Also the text-selection highlight.

### Neutral

- **Soot Ink** (ink): body text, primary buttons, the 2px rule that opens every list and the footer, focus outlines. 16.2:1 on paper.
- **Pressed Soot** (ink-hover): hover state of the ink button only.
- **Faded Ink** (muted): secondary lines (locality, dish lists, sublines, "soon" tabs, placeholders, rank numerals). 6.0:1 on paper.
- **Unbleached Cotton** (paper): page ground and text on vermilion/leaf/ink.
- **Bleached Field** (field): inside text inputs and textareas only, a half-step lighter than the ground.
- **Washed Cloth** (cloth): hover fill for outline buttons and the inactive List/Map segment.
- **Thread Line** (line): hairline row dividers, field borders, inactive "soon" tab borders, link underlines at rest.
- **Vermilion Wash** (accent-soft): admin warning panels only; not used on public routes.

### Named Rules

**The One City, One Colour Rule.** A route colour appears only where it names its city: the city tab, that city's lid tiles, that city's map pins. Never use a route colour as decoration or for status.

**The Turmeric Takes Ink Rule.** Text on Kolkata turmeric is always ink. Paper on turmeric fails contrast.

## Typography

**Display Font:** Archivo variable (wdth axis), with ui-sans-serif, system-ui fallback
**Body Font:** Archivo variable at normal width
**Label/Mono Font:** none distinct; numerals use tabular figures

**Character:** One grotesque in two widths. Condensed heavy caps read like paint on a lid; the normal width is plain and quiet for reading on the move.

### Hierarchy

- **Display** (800, 2.6rem rising to 3.2rem from 640px, line-height 0.95, wdth 62%, uppercase): page H1 via the page head.
- **Headline** (800, 1.65rem, 0.95, wdth 62%, uppercase): place name in each ranked row, with an inline "No.N" rank in muted 0.9375rem raised 0.18em.
- **Title** (800, 1.25rem on wide screens / 1.0625rem tabs, wdth 62%, uppercase): wordmark and city tabs.
- **Body** (400, 1.0625rem, 1.5, tabular numerals, `text-wrap: pretty`): running text; row details sit at 0.9375rem.
- **Label** (700, 0.9375rem): buttons. The List/Map segment uses bold uppercase with wide tracking at normal width.

Scale steps in use: 0.8125, 0.9375, 1.0625, 1.25, 1.5, 1.875, 2.5rem.

### Named Rules

**The Lid Voice Rule.** Condensed caps (wdth 62%, weight 800, uppercase, zero tracking, 0.95 leading) are for headings, the wordmark, city tabs, lid tiles and pins. Never for sentences, buttons or body copy.

**The Whole-Pixel Rule.** Body and form controls render with `text-rendering: geometricPrecision`, because hinting Archivo's width axis rounds advances to whole pixels and opens holes inside words. Form controls must inherit it.

## Layout

Single centred column, max-width 768px (48rem), 16px side gutters, full-height flex with the footer pushed down. Header: wordmark left and "Suggest a pick" right on one row, enamel city tabs wrapping below with 8px gaps. Main content stacks in 32px sections.

Ranked lists open with a 2px ink rule; each row is closed by a 1px thread-line rule with 16px vertical padding. Inside a row the text block flexes and the lid tile sits to the right, top-aligned; the two actions wrap below at 8px gaps. The dish row scrolls sideways on phones (bleeding into the gutters) and wraps from 640px. Nothing may overflow horizontally at 360px. Every target is at least 44px tall; the report disclosure summary is 48px.

### Named Rules

**The Rank Is the Pin Rule.** A place's list position N appears as "No.N" in its row heading and as N on its map pin. Never renumber one without the other.

## Elevation & Depth

Flat. There are no drop shadows anywhere. Depth is conveyed by flat colour blocks, 1px and 2px rules, and inset hairlines that read as painted borders.

### Shadow Vocabulary

- **Enamel edge** (`box-shadow: inset 0 0 0 1.5px rgb(0 0 0 / 0.18)`): on every enamel tile (city tabs, lid tiles, map pins, embed play tile).
- **Ink outline** (`box-shadow: inset 0 0 0 1.5px #1d1a16`): outline button and List/Map segment border.
- **Field outline** (`box-shadow: inset 0 0 0 1.5px #cfc6b4`, focus `inset 0 0 0 2.5px #1d1a16`): inputs and "soon" tabs.

### Named Rules

**The Flat Enamel Rule.** Enamel is flat. Only inset strokes are allowed; any offset or blurred outer shadow is out of world.

## Shapes

Crisp 4px corners on tiles, buttons, fields, tabs and the embed facade. Rows have no corners at all because they are not boxes; they are bands between rules. Icons are 14-16px inline SVG strokes (1.8 width, round caps) or solid play triangles. An approximate map pin swaps its fill for paper and draws a 2px dashed border in the route colour.

## Components

### Buttons

Squat, solid, thumb-sized.

- **Shape:** 4px corners, min-height 44px, 14px inline padding, 8px icon gap.
- **Ink (primary):** soot ink fill, cotton text, bold 0.9375rem. Used for "Watch moment (m:ss)", Search, Send.
- **Line (secondary):** transparent with a 1.5px inset ink stroke. Used for Directions.
- **Hover / Focus:** ink darkens to pressed soot; line fills with washed cloth; 160ms `cubic-bezier(0.16, 1, 0.3, 1)` on colour only. Focus is a 3px ink outline offset 2px. Disabled drops to 55% opacity.

### Inputs / Fields

- **Style:** bleached field fill, 1.5px inset thread-line stroke, 4px corners, 44px min height, 12px inline padding. Search adds a 16px muted magnifier inset 12px from the left.
- **Focus:** the inset stroke thickens to 2.5px ink (no outer ring). Caret is vermilion. Placeholder is faded ink at full opacity.

### Navigation

- **City tabs:** enamel tiles in each city's route colour, lid voice at 1.0625rem, 44px tall, 12px padding. Cities without picks render as an un-filled tile with a thread-line stroke, muted text and a lowercase "soon".
- **Wordmark:** lid voice, "Indian Food" in ink and "Recommends" in vermilion.
- **Dish row:** text links, semibold 0.9375rem, thread-line underline that turns ink on hover, muted tabular pick count beside each.
- **List/Map segment:** two 44px buttons inside one 1.5px ink outline; the pressed one is ink-filled.
- **Footer:** opens with a 2px ink rule; muted 0.9375rem text, underlined 44px links.

### Lid Code (signature)

A painted tiffin-lid tile at the right of every ranked row and the place page. Stacked and centred in the lid voice: city code (DL / MB / KL), the creator count large (1.5rem, or 2.25rem at large size), the word "creator" or "creators" in normal case, and the video time when there is one. Background and text follow the city's route pair. It is `aria-hidden`; the row always states the same facts in words ("Picked by N creators: ..." and "Watch moment (m:ss)"), so the tile never stands alone. Minimum width 64px (88px large).

### Ranked Row

Bands between rules, not cards. Heading in the headline voice with inline muted "No.N"; locality and "approximate pin" in muted; "Picked by N creator(s):" with underlined creator links; dishes joined with middots; then the ink Watch and line Directions buttons. Empty lists show one muted line between rules.

### Map Pin

A 32px enamel tile in the city's route colour carrying the row's rank number in the lid voice. Approximate locations use a paper fill, ink number and a 2px dashed route-colour border, and the popup says so. The map frame sits behind a thread-line border; MapLibre attribution is collapsed to its info button and restyled in Archivo 500 at 11px on 90% cotton.

### Embed Facade

A 16:9 ink block with 4px corners; centred 64px vermilion enamel play tile (scales to 105% on hover, 200ms) above the label "Play {creator}'s video at m:ss". Nothing from YouTube or Instagram loads until pressed; focus moves into the frame.

### Report Disclosure

A details/summary band between two thread-line rules, 48px summary with a chevron that rotates on open; radios each on a 44px row; textarea uses the field style.

## Do's and Don'ts

### Do:

- **Do** bind each route colour to its city: Delhi #b8361d, Mumbai #2a6b45, Kolkata #e2a823, Hyderabad #2e4a86, Bengaluru #6b3a7d, Chennai #1f6f78, Lucknow #7a4a1d, Jaipur #a8336a with ink text.
- **Do** divide rows with hairline rules (1px thread line) and open lists with a 2px ink rule.
- **Do** put the rank inline in the heading as "No.N" and put the same N on the map pin.
- **Do** show city code, creator count and the word "creator(s)" on every lid tile, plus the video time when known, and repeat those facts in words beside it.
- **Do** keep every target at least 44px and keep 4px corners on tiles, buttons and fields.
- **Do** use tabular numerals for counts and times.
- **Do** mark approximate pins with a dashed border and say "approximate pin" in text.

### Don't:

- **Don't** use cards, chips, rating badges or boxed list items.
- **Don't** use drop shadows; the only shadows are inset hairlines on enamel and outlined controls.
- **Don't** let a lid tile stand alone without the words beside it.
- **Don't** put paper-coloured text on turmeric.
- **Don't** use the condensed lid voice for sentences or buttons.
- **Don't** ship food or place photos or other raster imagery; none are licensed.
- **Don't** add a dark theme; the world is light only.
