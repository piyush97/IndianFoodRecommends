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
