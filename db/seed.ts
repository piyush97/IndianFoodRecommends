import { sql } from "drizzle-orm";
import { client, db, schema } from "./index";
import { cities as cityRows, dishes as dishRows } from "./seed-data";

// Idempotent: safe to re-run. Slugs are the conflict keys.
export async function seed() {
  await db
    .insert(schema.cities)
    .values(cityRows.map((c) => ({ ...c })))
    .onConflictDoUpdate({
      target: schema.cities.slug,
      set: { name: sql`excluded.name`, state: sql`excluded.state` },
    });

  const saved = await db
    .insert(schema.dishes)
    .values(dishRows.map(({ slug, name, cuisine }) => ({ slug, name, cuisine })))
    .onConflictDoUpdate({
      target: schema.dishes.slug,
      set: { name: sql`excluded.name`, cuisine: sql`excluded.cuisine` },
    })
    .returning({ id: schema.dishes.id, slug: schema.dishes.slug });

  const bySlug = new Map(saved.map((d) => [d.slug, d.id]));
  const aliases = dishRows.flatMap((d) =>
    (d.aliases ?? []).map((alias) => ({ dishId: bySlug.get(d.slug)!, alias })),
  );

  if (aliases.length > 0) {
    await db.insert(schema.dishAliases).values(aliases).onConflictDoNothing();
  }

  return { cities: cityRows.length, dishes: saved.length, aliases: aliases.length };
}

async function main() {
  const counts = await seed();
  console.log(
    `seeded ${counts.cities} cities, ${counts.dishes} dishes, ${counts.aliases} dish aliases`,
  );
  await client.end();
}

if (process.argv[1]?.includes("db/seed")) {
  main().catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
    await client.end();
  });
}
