import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { haversineKm } from "../../components/near-me";
import { cityBySlug } from "../cities";

const eligible = sql`p.geom is not null and p.status='open' and p.osm_id is not null
  and p.osm_id not like 'approx:%' and exists (select 1 from recommendations r
    join sources s on s.id=r.source_id join creators c on c.id=s.creator_id
    where r.place_id=p.id and r.status='approved' and c.opted_out=false)`;

/** DBSCAN uses one local UTM projection per city, so 500 means ground metres. */
export async function refreshWalks(db: Db, onlyCity?: string): Promise<number> {
  if (onlyCity && !cityBySlug(onlyCity)) throw new Error("Unknown city");
  const cities = await db
    .select()
    .from(schema.cities)
    .where(onlyCity ? eq(schema.cities.slug, onlyCity) : sql`true`);
  let count = 0;
  for (const city of cities)
    count += await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ifr:walks'),${city.id})`);
      const rows = await tx.execute<{
        id: number;
        slug: string;
        locality: string | null;
        lat: number;
        lng: number;
        cluster: number;
      }>(sql`
      with candidates as (select p.* from places p where p.city_id=${city.id} and ${eligible}),
      projected as (select *,ST_Transform(geom::geometry,32600+floor((avg(lng) over()+180)/6)::int+1) metric from candidates),
      clustered as (select *,ST_ClusterDBSCAN(metric,eps:=500,minpoints:=4) over(order by id) cluster from projected)
      select id,slug,locality,lat,lng,cluster from clustered where cluster is not null order by cluster,lng,lat,id`);
      const groups = new Map<number, (typeof rows)[number][]>();
      for (const p of rows) groups.set(p.cluster, [...(groups.get(p.cluster) ?? []), p]);
      const walks = [...groups.values()]
        .filter((g) => g.length >= 4)
        .map((group) => {
          const remaining = [...group];
          const stops = [remaining.shift()!];
          // Five stops fit Google Maps' three-waypoint limit on mobile browsers.
          while (remaining.length && stops.length < 5) {
            const last = stops[stops.length - 1];
            remaining.sort((a, b) => haversineKm(last, a) - haversineKm(last, b) || a.id - b.id);
            stops.push(remaining.shift()!);
          }
          const meters = Math.round(
            stops.slice(1).reduce((n, p, i) => n + haversineKm(stops[i], p) * 1000, 0),
          );
          return {
            cityId: city.id,
            slug: `${stops[0].slug}-walk`,
            name: `${stops[0].locality || city.name} food walk`,
            stopIds: stops.map((p) => p.id),
            meters,
          };
        });
      await tx.delete(schema.foodWalks).where(eq(schema.foodWalks.cityId, city.id));
      if (walks.length) await tx.insert(schema.foodWalks).values(walks);
      return walks.length;
    });
  return count;
}

/** Only the worker does H3 work. Readers get stored GeoJSON and integer counts. */
export async function refreshHeatmap(db: Db, onlyCity?: string) {
  if (onlyCity && !cityBySlug(onlyCity)) throw new Error("Unknown city");
  const [{ available }] = await db.execute<{
    available: boolean;
  }>(sql`select count(*)=2 as available
    from pg_available_extensions where name in ('h3','h3_postgis')`);
  if (!available) return { available: false, cells: 0 };
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS h3`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS h3_postgis CASCADE`);
  const cities = await db
    .select()
    .from(schema.cities)
    .where(onlyCity ? eq(schema.cities.slug, onlyCity) : sql`true`);
  let cells = 0;
  for (const city of cities)
    cells += await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ifr:heat'),${city.id})`);
      await tx.delete(schema.heatCells).where(eq(schema.heatCells.cityId, city.id));
      const rows = await tx.execute(sql`
      with picked as (select distinct p.id,p.city_id,c.id creator_id,h3_latlng_to_cell(p.geom,8)::text cell
        from places p join recommendations r on r.place_id=p.id join sources s on s.id=r.source_id
        join creators c on c.id=s.creator_id where p.city_id=${city.id} and p.geom is not null
        and p.status='open' and r.status='approved' and c.opted_out=false)
      insert into heat_cells(city_id,creator_id,cell,count,geometry)
      select city_id,creator_id,cell,count(*)::int,ST_AsGeoJSON(h3_cell_to_boundary_geometry(cell::h3index))::jsonb
      from picked group by city_id,creator_id,cell returning id`);
      return rows.length;
    });
  return { available: true, cells };
}
