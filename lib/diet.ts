import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { schema, type Db } from "../db";
import { makeChat, type ChatFn } from "./llm/extract";

export type Diet = "veg" | "non-veg" | "mixed";
/** What a visitor can filter by. Mixed dishes (thali, buffet) match neither. */
export type DietFilter = "veg" | "non-veg";

export function parseDiet(v: string | string[] | undefined): DietFilter | undefined {
  return v === "veg" || v === "non-veg" ? v : undefined;
}

const NON_VEG =
  /\b(chicken|mutton|lamb|beef|pork|fish|prawns?|shrimp|crab|seafood|eggs?|keema|gosht|nihari|haleem|paya|bheja|kaleji|liver|tangdi|non[- ]?veg)\b/i;
const VEG = /\b(veg|vegetarian|vegetable|paneer)\b/i;

/** Sure cases only. Anything else goes to the LLM, which reads the whole name. */
export function dietFromName(name: string): Diet | null {
  if (NON_VEG.test(name)) return "non-veg";
  if (VEG.test(name)) return "veg";
  return null;
}

const SYSTEM_PROMPT = `You label Indian dishes. Answer one of:
"veg": no meat, fish or egg.
"non-veg": made with meat, fish or egg. A dish normally made with meat counts as non-veg unless its name says veg (biryani, kebab, korma, nihari, keema).
"mixed": a meal or platter that can hold both, or a name too vague to tell (thali, buffet, unlimited meals).
Reply with JSON only: {"items":[{"name":"<name exactly as given>","diet":"veg"}]}.`;

const ReplySchema = z.object({
  items: z.array(z.object({ name: z.string(), diet: z.enum(["veg", "non-veg", "mixed"]) })),
});

const BATCH = 40;

export async function classifyDiets(
  names: string[],
  chat: ChatFn = makeChat(),
): Promise<Map<string, Diet>> {
  const out = new Map<string, Diet>();
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH);
    const raw = await chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(batch) },
    ]);
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim());
    for (const item of ReplySchema.parse(JSON.parse(fenced ? fenced[1] : raw)).items) {
      if (batch.includes(item.name)) out.set(item.name, item.diet);
    }
  }
  return out;
}

/** Labels every dish that has no diet yet. Names the LLM skips stay null and are retried next run. */
export async function fillDiets(db: Db, chat?: ChatFn): Promise<number> {
  const rows = await db
    .select({ id: schema.dishes.id, name: schema.dishes.name })
    .from(schema.dishes)
    .where(isNull(schema.dishes.diet));
  const labels = new Map<string, Diet>();
  const ask: string[] = [];
  for (const { name } of rows) {
    const diet = dietFromName(name);
    if (diet) labels.set(name, diet);
    else ask.push(name);
  }
  if (ask.length) for (const [name, diet] of await classifyDiets(ask, chat)) labels.set(name, diet);
  let n = 0;
  for (const { id, name } of rows) {
    const diet = labels.get(name);
    if (!diet) continue;
    await db.update(schema.dishes).set({ diet }).where(eq(schema.dishes.id, id));
    n++;
  }
  return n;
}
