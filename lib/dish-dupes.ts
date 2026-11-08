import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { canonicalDishName, normalizeName } from "./text";

export type DishRef = { id: number; name: string; picks: number };
export type DishDupe = { from: DishRef; into: DishRef };

/** Dishes that are a qualified copy of another dish ("Desi Ghee Chole Bhature" next to "Chole Bhature"). */
export async function dishDuplicates(db: Db): Promise<DishDupe[]> {
  const dishes = (await db.execute(sql`
    select d.id, d.name, count(r.id)::int as picks
    from dishes d left join recommendations r on r.dish_id = d.id
    group by d.id order by d.name
  `)) as unknown as DishRef[];
  const byName = new Map(dishes.map((d) => [normalizeName(d.name), d]));
  return dishes.flatMap((from) => {
    const into = byName.get(normalizeName(canonicalDishName(from.name)));
    return into && into.id !== from.id ? [{ from, into }] : [];
  });
}
