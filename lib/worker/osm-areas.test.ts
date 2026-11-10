import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import { parseOsmAreas, saveOsmAreas } from "./osm-areas";

const bounds: [number, number, number, number] = [77, 28, 78, 29];
const ring = [
  { lat: 28.64, lon: 77.22 },
  { lat: 28.64, lon: 77.24 },
  { lat: 28.67, lon: 77.24 },
  { lat: 28.67, lon: 77.22 },
  { lat: 28.64, lon: 77.22 },
];
const relation = {
  type: "relation",
  id: 123,
  tags: { name: "Chandni Chowk", place: "neighbourhood" },
  members: [{ type: "way", role: "outer", geometry: ring }],
};

describe("OSM neighbourhood parsing", () => {
  it("keeps relation linework and node-only neighbourhoods with OSM provenance", () => {
    const out = parseOsmAreas(
      {
        elements: [
          relation,
          {
            type: "node",
            id: 7,
            lat: 28.6,
            lon: 77.2,
            tags: { name: "Karol Bagh" },
          },
        ],
      },
      bounds,
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: "Chandni Chowk", osmId: "relation/123" });
    expect(out[0].linework?.coordinates[0][0]).toEqual([77.22, 28.64]);
    expect(out[1]).toMatchObject({ slug: "karol-bagh", lat: 28.6, lng: 77.2, linework: null });
  });

  it("refuses malformed responses and drops unsafe or out-of-bounds features", () => {
    expect(() => parseOsmAreas({ remark: "runtime error: timeout" }, bounds)).toThrow();
    expect(
      parseOsmAreas(
        {
          elements: [
            { type: "node", id: 1, lat: 0, lon: 0, tags: { name: "Elsewhere" } },
            { type: "node", id: 2, lat: 28.6, lon: 77.2, tags: {} },
            { ...relation, id: -1 },
          ],
        },
        bounds,
      ),
    ).toEqual([]);
  });
});

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
describeDb("OSM boundary import", () => {
  const db = handle?.db as Db;
  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.areas).values({
      cityId: 1,
      name: "Chandni Chowk",
      key: "chandni chowk",
      slug: "chandni-chowk",
      lat: 28.65,
      lng: 77.23,
      source: "manual",
      weight: 4,
    });
  });
  afterAll(() => handle?.close());

  it("builds a valid boundary, preserves manual centroids, and imports idempotently", async () => {
    const features = parseOsmAreas({ elements: [relation] }, bounds);
    await saveOsmAreas(db, 1, features);
    await saveOsmAreas(db, 1, features);
    const rows = await db.execute(sql`select name, lat, weight, source, osm_id,
      ST_IsValid(boundary) valid,
      ST_Covers(boundary, ST_SetSRID(ST_MakePoint(77.23, 28.65),4326)) covers
      from areas`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Chandni Chowk",
      lat: expect.closeTo(28.65, 3),
      weight: 4,
      source: "manual",
      osm_id: "relation/123",
      valid: true,
      covers: true,
    });
  });

  it("does not destroy an existing boundary when a node-only result arrives later", async () => {
    await saveOsmAreas(
      db,
      1,
      parseOsmAreas(
        {
          elements: [
            {
              type: "node",
              id: 9,
              lat: 28.65,
              lon: 77.23,
              tags: { name: "Chandni Chowk" },
            },
          ],
        },
        bounds,
      ),
    );
    const [row] = await db.execute(
      sql`select boundary is not null has_boundary, osm_id from areas`,
    );
    expect(row).toMatchObject({ has_boundary: true, osm_id: "relation/123" });
  });
});
