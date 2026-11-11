/**
 * Vercel previews share production's DATABASE_URL (the Neon integration sets it for all
 * environments). Sessions opened by a preview are read-only so a preview of an admin action or
 * a report cannot change production rows. Production, local and CI keep full access. Set
 * PREVIEW_DB_WRITES=1 on a preview that points at its own Neon branch.
 */
export function readOnlySession(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === "preview" && env.PREVIEW_DB_WRITES !== "1";
}

/** Shown when a preview refuses a write. */
export const READ_ONLY = "This preview is read-only. Use the live site to send this.";

/** Postgres error code for a write inside a read-only transaction. */
export const READ_ONLY_SQL_STATE = "25006";

export function isReadOnlyError(error: unknown): boolean {
  let e: unknown = error;
  for (let depth = 0; e && depth < 4; depth++) {
    if ((e as { code?: unknown }).code === READ_ONLY_SQL_STATE) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
