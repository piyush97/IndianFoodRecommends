const DAY_MS = 86_400_000;

/** PRD ranking: newer picks get a small, explainable boost. */
export function recencyBonus(newest: Date, now: Date): 0 | 1 | 3 | 5 {
  const days = (now.getTime() - newest.getTime()) / DAY_MS;
  if (days <= 30) return 5;
  if (days <= 90) return 3;
  if (days <= 365) return 1;
  return 0;
}

/** `score = distinct_creators_count * 10 + recency_bonus(0-5)`. */
export function rankScore(creators: number, newest: Date, now: Date): number {
  return creators * 10 + recencyBonus(newest, now);
}

type Rankable = {
  score: number;
  videos: number;
  dishes: string[];
  approx: boolean;
  pickedOn: string;
  placeName: string;
};

/**
 * Card order. `score` decides first and is the only number shown; ties then fall back to facts a
 * visitor can check: more distinct videos, more distinct dishes, an exact pin over a
 * neighbourhood-level one, the newest pick, and finally the place name.
 */
export function compareCards(a: Rankable, b: Rankable): number {
  return (
    b.score - a.score ||
    b.videos - a.videos ||
    b.dishes.length - a.dishes.length ||
    Number(a.approx) - Number(b.approx) ||
    (a.pickedOn < b.pickedOn ? 1 : a.pickedOn > b.pickedOn ? -1 : 0) ||
    a.placeName.localeCompare(b.placeName)
  );
}
