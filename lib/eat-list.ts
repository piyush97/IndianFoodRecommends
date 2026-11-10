import { useSyncExternalStore } from "react";

export const LIST_KEY = "ifr:list:v1";
export const MAX_LIST = 30;
export const SLUG_RE = /^[a-z0-9-]{1,80}$/;

const EVENT = "ifr:list";
const EMPTY: string[] = [];

/** Never throws: corrupt storage reads as an empty list. */
export function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: string[] = [];
    for (const s of data) {
      if (typeof s === "string" && SLUG_RE.test(s) && !out.includes(s)) out.push(s);
      if (out.length === MAX_LIST) break;
    }
    return out;
  } catch {
    return [];
  }
}

// In-memory copy: keeps the list working when storage throws, and gives
// useSyncExternalStore a stable snapshot until the stored value changes.
let mem: string[] = EMPTY;
let memRaw: string | null | undefined;
let failedAt: string | null | undefined; // stored value when the last write failed

export function readList(): string[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null;
  try {
    raw = localStorage.getItem(LIST_KEY);
  } catch {
    return mem;
  }
  if (failedAt !== undefined) {
    if (raw === failedAt) return mem;
    failedAt = undefined;
  }
  if (raw !== memRaw) {
    memRaw = raw;
    mem = parseList(raw);
  }
  return mem;
}

export function writeList(slugs: string[]): void {
  const next = slugs.slice(0, MAX_LIST);
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(LIST_KEY, raw);
    failedAt = undefined;
    memRaw = raw;
  } catch {
    failedAt = readStored();
  }
  mem = next;
  window.dispatchEvent(new Event(EVENT));
}

function readStored(): string | null {
  try {
    return localStorage.getItem(LIST_KEY);
  } catch {
    return null;
  }
}

/** Returns the new saved state for `slug`. New saves go to the front. */
export function toggle(slug: string): boolean {
  const list = readList();
  const saved = !list.includes(slug);
  writeList(saved ? [slug, ...list] : list.filter((s) => s !== slug));
  return saved;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useEatList(): string[] {
  return useSyncExternalStore(subscribe, readList, () => EMPTY);
}

export function listParam(slugs: string[]): string {
  return slugs.join(",");
}
