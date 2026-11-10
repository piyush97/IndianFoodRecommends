#!/usr/bin/env node
// Fails a pull request whose new migration locks a table or rewrites a column.
// Usage: node scripts/check-migrations.mjs [base-rev]
// Compares *.sql in db/migrations against the base revision (default origin/main).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "origin/main";

/** Each rule: a pattern that is dangerous on a large, live table and why. */
const RULES = [
  {
    id: "blocking-index",
    test: /create\s+(unique\s+)?index\s+(?!concurrently)/i,
    why: "CREATE INDEX locks writes for the whole build; use CREATE INDEX CONCURRENTLY in a separate file.",
  },
  {
    id: "column-type",
    test: /alter\s+table\s+\S+\s+alter\s+column\s+\S+\s+type/i,
    why: "Changing a column type rewrites the table and blocks it; add a new column and backfill instead.",
  },
  {
    id: "set-not-null",
    test: /alter\s+column\s+\S+\s+set\s+not\s+null/i,
    why: "SET NOT NULL scans the table under a lock; add a NOT VALID check constraint, validate, then set it.",
  },
  {
    id: "drop-column",
    test: /alter\s+table\s+\S+\s+drop\s+column/i,
    why: "DROP COLUMN breaks running code during a rolling deploy; deploy the code that stops reading it first.",
  },
  {
    id: "add-not-null-no-default",
    test: /add\s+column\s+\S+\s+[^;]*not\s+null(?![^;]*default)/i,
    why: "Adding a NOT NULL column without a default fails on a table with rows.",
  },
];

/** Statements drizzle emits for constant defaults are safe; these are checked separately. */
const SAFE = [/create\s+table/i, /create\s+extension/i, /^\s*--/];

function changedMigrations() {
  let files;
  try {
    files = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", "db/migrations"],
      { encoding: "utf8" },
    );
  } catch (error) {
    // Without the base commit we cannot tell new files from old ones, and checking
    // all 16 historical migrations would fail on code that is already deployed.
    console.error(
      `migrations: cannot compare against ${base} (${String(error).split("\n")[0]}).\n` +
        "Fetch full history, e.g. `git fetch origin main --depth=50`.",
    );
    process.exit(1);
  }
  const list = files.split("\n").filter((f) => f.trim().endsWith(".sql"));
  return list.length > 0 ? list : [];
}

function staticsOf(sql) {
  // Split on drizzle's breakpoint marker so each statement is judged alone.
  return sql
    .split("--> statement-breakpoint")
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

const files = changedMigrations();
const problems = [];

for (const file of files) {
  const sql = readFileSync(file, "utf8");
  // Small tables may take a brief write lock; the marker is a deliberate opt-out,
  // not a default, so it must name why.
  const allowed = sql.includes("ifr:allow-locking-index");
  for (const statement of staticsOf(sql)) {
    if (allowed && /create\s+(unique\s+)?index/i.test(statement)) continue;
    if (SAFE.some((s) => s.test(statement))) continue;
    for (const rule of RULES) {
      if (rule.test.test(statement)) {
        problems.push({ file, rule: rule.id, why: rule.why, statement: statement.slice(0, 120) });
      }
    }
  }
}

if (problems.length === 0) {
  console.log(`migrations: ${files.length} changed file(s), no unsafe statements`);
  process.exit(0);
}

console.error(
  `migrations: ${problems.length} unsafe statement(s) in ${files.length} changed file(s)`,
);
for (const p of problems) {
  console.error(`\n  ${p.file} [${p.rule}]\n    ${p.statement}\n    ${p.why}`);
}
process.exit(1);
