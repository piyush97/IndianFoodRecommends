export type Week = [number, number][][];

export type OpenStatus = { open: true; until?: string } | { open: false; opensAt: string } | null;

const IST_OFFSET_MS = 330 * 60_000;
const MINUTES_PER_DAY = 1440;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

function formatTime(minutes: number): string {
  const minuteOfDay = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const hour = hour24 % 12 || 12;
  const suffix = hour24 < 12 ? "AM" : "PM";
  return minute === 0
    ? `${hour} ${suffix}`
    : `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** Open/closed now, computed from a stored week schedule in Asia/Kolkata wall time. */
export function openStatus(week: Week, now: Date): OpenStatus {
  if (week.length !== 7) return null;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const t =
    MINUTES_PER_WEEK +
    ((ist.getUTCDay() + 6) % 7) * MINUTES_PER_DAY +
    ist.getUTCHours() * 60 +
    ist.getUTCMinutes();

  // Three copies of the week, so a past-midnight close (also Sunday into Monday) joins its neighbour.
  const spans = [0, 1, 2]
    .flatMap((w) =>
      week.flatMap((intervals, d) =>
        intervals.map(
          ([open, close]) =>
            [
              w * MINUTES_PER_WEEK + d * MINUTES_PER_DAY + open,
              w * MINUTES_PER_WEEK + d * MINUTES_PER_DAY + close,
            ] as const,
        ),
      ),
    )
    .sort((a, b) => a[0] - b[0]);

  let closes: number | null = null;
  for (const [open, close] of spans) {
    if (closes === null) {
      if (open > t) return { open: false, opensAt: formatTime(open) };
      if (close > t) closes = close;
    } else if (open <= closes) closes = Math.max(closes, close);
    else break;
  }
  if (closes === null) return null;
  // Open all week long (24/7): there is no closing time to show.
  return closes - t >= MINUTES_PER_WEEK
    ? { open: true }
    : { open: true, until: formatTime(closes) };
}
