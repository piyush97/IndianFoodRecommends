import type { ExtractedPick } from "../llm/extract";
import { normalizeName } from "../text";
import type { Upload } from "../youtube";

export type Labelled = {
  videoId: string;
  expected: { place: string; dishes: string[] }[];
};

export type Score = { tp: number; fp: number; fn: number; precision: number; recall: number };

function trigrams(s: string): Set<string> {
  const padded = `  ${normalizeName(s)} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Dice coefficient over character trigrams; robust to `Chachey` vs `Chache`. */
export function placeSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 && right.size === 0) return 1;
  let shared = 0;
  for (const t of left) if (right.has(t)) shared++;
  return (2 * shared) / (left.size + right.size);
}

export function samePlace(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b) || placeSimilarity(a, b) >= 0.6;
}

export function scoreExtraction(
  expected: Labelled["expected"],
  actual: ExtractedPick[],
): Score {
  const used = new Set<number>();
  let tp = 0;
  for (const want of expected) {
    const index = actual.findIndex((got, i) => !used.has(i) && samePlace(want.place, got.place_name));
    if (index >= 0) {
      used.add(index);
      tp++;
    }
  }
  const fp = actual.length - tp;
  const fn = expected.length - tp;
  return {
    tp,
    fp,
    fn,
    precision: actual.length === 0 ? 1 : tp / actual.length,
    recall: expected.length === 0 ? 1 : tp / expected.length,
  };
}

export type EvalDeps = {
  channelId: string;
  listUploads: (channelId: string) => Promise<Upload[]>;
  extract: (i: { title: string; description: string }) => Promise<ExtractedPick[]>;
};

export async function runEval(
  labelled: Labelled[],
  deps: EvalDeps,
): Promise<{ precision: number; recall: number; perVideo: unknown[] }> {
  const uploads = await deps.listUploads(deps.channelId);
  const byId = new Map(uploads.map((u) => [u.videoId, u]));
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const perVideo: unknown[] = [];

  for (const item of labelled) {
    const upload = byId.get(item.videoId);
    if (!upload) {
      perVideo.push({ videoId: item.videoId, error: "not in channel feed (latest 15 only)" });
      fn += item.expected.length;
      continue;
    }
    const actual = await deps.extract({ title: upload.title, description: upload.description });
    const score = scoreExtraction(item.expected, actual);
    tp += score.tp;
    fp += score.fp;
    fn += score.fn;
    perVideo.push({ videoId: item.videoId, ...score });
  }

  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return { precision, recall, perVideo };
}
