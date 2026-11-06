# 02 · Wireframes (low-fi, mobile-first)

Layout follows content: search first, list + map, proof (video) always one tap away.

## W1 · Home `/`

```
┌──────────────────────────────────────┐
│ Indian Food Recommends      [Cities▾]│
├──────────────────────────────────────┤
│ What did food vloggers eat in…       │
│ ┌──────────────────────────────────┐ │
│ │ 🔍 dish, place or creator        │ │
│ └──────────────────────────────────┘ │
│ City: (Delhi) (Mumbai·soon) (Kolkata·soon)
│                                      │
│ Popular in Delhi                     │
│  Chole Bhature · 12 picks            │
│  Butter Chicken · 9 picks            │
│  Momos · 7 picks                     │
│                                      │
│ Creators                             │
│  (avatar) Delhi Food Walks · 64 picks│
│  (avatar) Dilsefoodie · 41 picks     │
│                                      │
│ Recently added                       │
│  Chache Di Hatti · Chole Bhature     │
│  by <creator> · ▶ 4:12               │
└──────────────────────────────────────┘
```

## W2 · City + dish page `/delhi/chole-bhature`

```
┌──────────────────────────────────────┐
│ ← Delhi                              │
│ Chole Bhature in Delhi               │
│ 12 places picked by 6 food vloggers  │
│ [List] [Map]     Sort: most picked ▾ │
├──────────────────────────────────────┤
│ 1. Chache Di Hatti · Kamla Nagar     │
│    Picked by 4 creators              │
│    (av)(av)(av)(av)                  │
│    ▶ Watch moment (4:12)   [Directions]
├──────────────────────────────────────┤
│ 2. Sita Ram Diwan Chand · Paharganj  │
│    Picked by 3 creators   ▶  [Dir]   │
└──────────────────────────────────────┘
Map tab: MapLibre pins, tap pin → same card as bottom sheet.
```

## W3 · Place page `/delhi/place/chache-di-hatti-kamla-nagar`

```
┌──────────────────────────────────────┐
│ Chache Di Hatti                      │
│ Kamla Nagar, Delhi · Last verified   │
│ Mar 2026 · [Directions] [Report issue]
├──────────────────────────────────────┤
│ What creators ordered                │
│  Chole Bhature  ×4 creators          │
│  Lassi          ×1                   │
├──────────────────────────────────────┤
│ Proof                                │
│ ┌──────────────┐ <creator>           │
│ │ ▶ YouTube    │ "Ordered chole      │
│ │  embed @4:12 │  bhature" (our note)│
│ └──────────────┘                     │
│ ┌──────────────┐ <creator>           │
│ │ ▶ IG reel    │ ...                 │
│ └──────────────┘                     │
│ Small map                            │
└──────────────────────────────────────┘
```

## W4 · Creator page `/creator/delhi-food-walks`

```
┌──────────────────────────────────────┐
│ (avatar) Delhi Food Walks            │
│ [YouTube ↗] [Instagram ↗]            │
│ 64 picks · Delhi                     │
│ Filter: [All dishes ▾] [List|Map]    │
│ - Chache Di Hatti · Chole Bhature ▶  │
│ - ...                                │
└──────────────────────────────────────┘
```

## W5 · Submit a pick `/submit` (S4)

```
┌──────────────────────────────────────┐
│ Saw a vlogger recommend a place?     │
│ Video / reel URL  [_______________]  │
│ Place name        [_______________]  │
│ Dish              [_______________]  │
│ Timestamp (opt.)  [__:__]            │
│ [Send for review]                    │
│ Reviewed by a person before it shows.│
└──────────────────────────────────────┘
```

## W6 · Admin review queue `/admin/review`

```
┌────────────────────────────────────────────────────────────┐
│ Review queue (37 pending)     Filter: [LLM][Community][City]│
├────────────────────────────────────────────────────────────┤
│ Video: ▶ embed            │ Extracted (conf 0.82)          │
│                           │ Creator: [Delhi Food Walks ▾]  │
│                           │ Place:   [Chache Di Hatti   ]  │
│                           │   ↳ match: existing #112 (0.91)│
│                           │ Dish:    [Chole Bhature ▾]     │
│                           │ Time:    [04:12]               │
│                           │ Lat/Lng: [pick on map]         │
│                           │ Note:    [_______________]     │
│                           │ [Approve] [Edit+Approve] [Reject]
└────────────────────────────────────────────────────────────┘
Keyboard: A approve · E edit · R reject · J/K next/prev
```

States required on every list: loading skeleton, empty ("No picks yet for X in Y"), error with retry.
Next step on approval: clickable HTML mock of W1-W3.
