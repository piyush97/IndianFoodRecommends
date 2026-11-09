import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LocalityRow } from "../lib/areas";
import type { AreaResult } from "../lib/geocode-area";

export type AreaQuery = {
  city: string;
  q: string;
  /** Area name the query must resolve to, or null when it must not resolve at all. */
  expect: string | null;
  kind: "exact" | "typo" | "nickname" | "extra" | "city" | "script" | "none";
};

const dir = join(process.cwd(), "eval");

export const loadQueries = (): AreaQuery[] =>
  readFileSync(join(dir, "area-queries.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AreaQuery);

/** Real locality groups from prod (2026-11-09), so the gazetteer under test is the real one. */
export const loadLocalities = (): LocalityRow[] =>
  JSON.parse(readFileSync(join(dir, "localities.snapshot.json"), "utf8")) as LocalityRow[];

export type Outcome = { query: AreaQuery; got: string | null; pass: boolean };

/** A resolvable query passes on the expected local answer; a `none` query passes on no answer. */
export function judge(query: AreaQuery, res: AreaResult): Outcome {
  const got = res.ok ? res.label : null;
  const pass =
    query.expect === null ? !res.ok : res.ok && res.via === "local" && res.label === query.expect;
  return { query, got, pass };
}

export type Summary = {
  resolvable: { total: number; passed: number; rate: number };
  rejected: { total: number; passed: number };
  byKind: Record<string, { total: number; passed: number }>;
  failures: Outcome[];
};

export function summarise(outcomes: Outcome[]): Summary {
  const byKind: Summary["byKind"] = {};
  for (const o of outcomes) {
    const k = (byKind[o.query.kind] ??= { total: 0, passed: 0 });
    k.total += 1;
    if (o.pass) k.passed += 1;
  }
  const resolvable = outcomes.filter((o) => o.query.expect !== null);
  const rejected = outcomes.filter((o) => o.query.expect === null);
  const passed = resolvable.filter((o) => o.pass).length;
  return {
    resolvable: { total: resolvable.length, passed, rate: passed / resolvable.length },
    rejected: { total: rejected.length, passed: rejected.filter((o) => o.pass).length },
    byKind,
    failures: outcomes.filter((o) => !o.pass),
  };
}
