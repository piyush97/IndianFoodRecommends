import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { classifyDiets, dietFromName, fillDiets, parseDiet } from "./diet";

describe("dietFromName", () => {
  it.each([
    ["Butter Chicken", "non-veg"],
    ["Egg Roll", "non-veg"],
    ["Fish Fry", "non-veg"],
    ["Non-Veg Thali", "non-veg"],
    ["Veg Biryani", "veg"],
    ["Paneer Tikka", "veg"],
    ["Eggless Cake", null],
    ["Hara Bhara Kebab", null],
    ["Biryani", null],
  ])("%s -> %s", (name, diet) => {
    expect(dietFromName(name)).toBe(diet);
  });
});

describe("parseDiet", () => {
  it("accepts only the two filter values", () => {
    expect(parseDiet("veg")).toBe("veg");
    expect(parseDiet("non-veg")).toBe("non-veg");
    expect(parseDiet("mixed")).toBeUndefined();
    expect(parseDiet(["veg"])).toBeUndefined();
    expect(parseDiet(undefined)).toBeUndefined();
  });
});

describe("classifyDiets", () => {
  it("reads fenced JSON and ignores names it was not asked about", async () => {
    const chat = async () =>
      '```json\n{"items":[{"name":"Biryani","diet":"non-veg"},{"name":"Invented","diet":"veg"}]}\n```';
    const out = await classifyDiets(["Biryani", "Thali"], chat);
    expect([...out]).toEqual([["Biryani", "non-veg"]]);
  });

  it("rejects an unknown label", async () => {
    const chat = async () => '{"items":[{"name":"Biryani","diet":"maybe"}]}';
    await expect(classifyDiets(["Biryani"], chat)).rejects.toThrow();
  });
});

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("fillDiets", () => {
  const db = handle?.db as Db;
  beforeEach(() => truncateAll(db));
  afterAll(() => handle?.close());

  it("labels by name first, asks the LLM for the rest, and leaves set diets alone", async () => {
    await db.insert(schema.dishes).values([
      { slug: "butter-chicken", name: "Butter Chicken" },
      { slug: "idli", name: "Idli" },
      { slug: "thali", name: "Thali" },
      { slug: "chole", name: "Chole", diet: "veg" },
    ]);
    const asked: string[][] = [];
    const chat = async (messages: { content: string }[]) => {
      const names = JSON.parse(messages[1].content) as string[];
      asked.push(names);
      return JSON.stringify({ items: [{ name: "Idli", diet: "veg" }] });
    };
    expect(await fillDiets(db, chat as never)).toBe(2);
    expect(asked).toEqual([["Idli", "Thali"]]);
    const rows = await db.select().from(schema.dishes);
    const diets = Object.fromEntries(rows.map((r) => [r.slug, r.diet]));
    expect(diets).toEqual({ "butter-chicken": "non-veg", idli: "veg", thali: null, chole: "veg" });
  });
});
