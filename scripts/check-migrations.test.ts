import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Runs the checker against a scratch git repo holding one migration. */
function check(sql: string): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "ifr-mig-"));
  mkdirSync(join(dir, "db/migrations"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "db/migrations/0001_test.sql"), sql);
  execFileSync("cp", ["scripts/check-migrations.mjs", join(dir, "scripts/")]);
  const run = (base = "HEAD") => {
    try {
      return {
        code: 0,
        out: execFileSync("node", ["scripts/check-migrations.mjs", base], {
          cwd: dir,
          encoding: "utf8",
        }),
      };
    } catch (error) {
      const e = error as { status?: number; stderr?: string; stdout?: string };
      return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir });
  git("init", "-q");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "base");
  git("add", ".");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "migration");
  // Compare against the empty base commit, so the migration counts as changed.
  return run("HEAD~1");
}

describe("check-migrations", () => {
  it("passes a plain additive migration", () => {
    const { code } = check(`CREATE TABLE "widgets" ("id" serial PRIMARY KEY NOT NULL);`);
    expect(code).toBe(0);
  });

  it("fails a blocking index on a live table", () => {
    const { code, out } = check(`CREATE INDEX "w_idx" ON "widgets" ("id");`);
    expect(code).toBe(1);
    expect(out).toContain("blocking-index");
  });

  it("fails a column type change", () => {
    const { code, out } = check(`ALTER TABLE "widgets" ALTER COLUMN "id" TYPE bigint;`);
    expect(code).toBe(1);
    expect(out).toContain("column-type");
  });

  it("fails adding a NOT NULL column without a default", () => {
    const { code, out } = check(`ALTER TABLE "widgets" ADD COLUMN "name" text NOT NULL;`);
    expect(code).toBe(1);
    expect(out).toContain("add-not-null-no-default");
  });

  it("allows a documented opt-out for a small table", () => {
    const { code } = check(
      `-- ifr:allow-locking-index: fixture table has ten rows\nCREATE INDEX "w_idx" ON "widgets" ("id");`,
    );
    expect(code).toBe(0);
  });
});
