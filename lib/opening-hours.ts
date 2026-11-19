import OpeningHours from "opening_hours";
import { haversineKm } from "../components/near-me";
import { sameName } from "./google-rating";
import type { Week } from "./open-status";

export type OsmFood = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  openingHours: string;
};

const IST_OFFSET_MS = 330 * 60_000;
const DAY = 1440;
const MATCH_KM = 0.15;

/** Wall-clock minutes of a local Date, immune to the host's DST. */
const wallMinutes = (d: Date) =>
  Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) / 60_000;

/**
 * Turn an OSM opening_hours tag into minutes for the IST week starting Monday.
 * The parser reads Dates as host-local wall time, so IST days are built as local dates.
 */
export function weekSchedule(tag: string, from: Date): Week | null {
  // Sun events need coordinates; the parser would silently guess 06:00-18:00.
  if (!tag.trim() || /sunrise|sunset|dawn|dusk/i.test(tag)) return null;
  try {
    const ist = new Date(from.getTime() + IST_OFFSET_MS);
    const weekday = (ist.getUTCDay() + 6) % 7;
    const day = (i: number) =>
      new Date(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - weekday + i);
    const monday = wallMinutes(day(0));
    const queryStart = day(-1);
    const week: Week = [[], [], [], [], [], [], []];

    for (const [start, end, unknown] of new OpeningHours(tag).getOpenIntervals(
      queryStart,
      day(8),
    )) {
      if (unknown) continue;
      let s = wallMinutes(start) - monday;
      const e = wallMinutes(end) - monday;
      // Started before this week: a past-midnight tail of last Sunday, unless it was open all along.
      if (s < 0) {
        if (start.getTime() !== queryStart.getTime()) continue;
        s = 0;
      }
      const first = Math.floor(s / DAY);
      if (first > 6) continue;
      if (s > first * DAY && e <= (first + 2) * DAY) {
        week[first].push([s - first * DAY, e - first * DAY]);
        continue;
      }
      for (let d = first; d < 7 && d * DAY < e; d++) {
        week[d].push([Math.max(s, d * DAY) - d * DAY, Math.min(e, (d + 1) * DAY) - d * DAY]);
      }
    }

    return week.some((intervals) => intervals.length) ? week : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parse the subset of Overpass output needed for matching food places. */
export function parseOverpass(json: unknown): OsmFood[] {
  if (!isRecord(json) || !Array.isArray(json.elements)) {
    throw new Error("Invalid Overpass response");
  }
  if (typeof json.remark === "string") throw new Error(`Overpass: ${json.remark}`);

  const foods: OsmFood[] = [];
  for (const raw of json.elements) {
    if (!isRecord(raw) || !isRecord(raw.tags)) continue;
    if (typeof raw.id !== "number") continue;
    const tags = raw.tags;
    const name = typeof tags.name === "string" ? tags.name.trim() : "";
    const nameEn = typeof tags["name:en"] === "string" ? tags["name:en"].trim() : "";
    const openingHours = typeof tags.opening_hours === "string" ? tags.opening_hours.trim() : "";
    if ((!name && !nameEn) || !openingHours) continue;

    const center = isRecord(raw.center) ? raw.center : null;
    const lat = typeof raw.lat === "number" ? raw.lat : center?.lat;
    const lng = typeof raw.lon === "number" ? raw.lon : center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    foods.push({ id: raw.id, name: name || nameEn, lat, lng, openingHours });
  }
  return foods;
}

/** Match one of our places to an OSM food place by id, else within 150 m with the same name; nearest wins. */
export function matchOsm(
  place: { name: string; lat: number; lng: number; osmId: string },
  candidates: OsmFood[],
): OsmFood | null {
  const id = Number(place.osmId);
  let best: { food: OsmFood; km: number } | null = null;

  for (const candidate of candidates) {
    const km = haversineKm(place, candidate);
    const qualifies =
      (Number.isFinite(id) && candidate.id === id) ||
      (km <= MATCH_KM && sameName(place.name, candidate.name));
    if (qualifies && (!best || km < best.km)) best = { food: candidate, km };
  }

  return best?.food ?? null;
}
