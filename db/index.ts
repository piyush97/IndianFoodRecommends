import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readOnlySession } from "./guard";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

// `next build` imports this module without runtime env, so fail on first use,
// not at import. postgres() connects lazily; the bogus host never resolves.
const missing = !url && process.env.NODE_ENV === "production";

// One connection pool per process. `prepare: false` keeps it compatible with
// transaction-pooled endpoints (Neon/Supabase poolers).
export const client = postgres(url ?? "postgres://localhost:5432/ifr", {
  max: 5,
  prepare: false,
  // Every transaction a preview opens is read-only. Neon's pooler ignores a bare startup
  // parameter but honours `options=-c ...`.
  ...(readOnlySession(process.env) && {
    connection: { options: "-c default_transaction_read_only=on" },
  }),
  ...(missing && {
    host: "missing-DATABASE_URL.invalid",
    onnotice: () => {},
  }),
});
if (missing) console.error("DATABASE_URL is required; database queries will fail.");

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
