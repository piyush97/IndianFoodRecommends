import { z } from "zod";

export const ExtractedPickSchema = z.object({
  place_name: z.string().min(1),
  locality: z.string().nullable(),
  city: z.string().nullable(),
  dishes: z.array(z.string().min(1)).min(1),
  timestamp_seconds: z.number().int().min(0).nullable(),
  confidence: z.number().min(0).max(1),
});

export type ExtractedPick = z.infer<typeof ExtractedPickSchema>;

export class ExtractionError extends Error {
  override name = "ExtractionError";
}

export type ChatFn = (messages: { role: "system" | "user"; content: string }[]) => Promise<string>;

const ReplySchema = z.object({ items: z.array(ExtractedPickSchema) });

const MAX_DESCRIPTION = 6000;
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT = `You extract food recommendations from Indian YouTube videos.
Reply with JSON only, no prose and no markdown: {"items":[{...}]}.
One item per distinct place the video recommends. Fields:
place_name (string), locality (string or null), city (string or null),
dishes (non-empty array of dish names), timestamp_seconds (integer from a chapter
line such as "04:12 Chache Di Hatti", otherwise null), confidence (0 to 1).
Skip places outside India and skip spots with no place name. Never invent places or dishes.`;

function parseReply(raw: string): ExtractedPick[] {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim());
  const parsed: unknown = JSON.parse(fenced ? fenced[1] : raw);
  return ReplySchema.parse(parsed).items;
}

export async function extractPicks(
  input: { title: string; description: string },
  chat: ChatFn = makeChat(),
): Promise<ExtractedPick[]> {
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Title: ${input.title}\nDescription:\n${input.description.slice(0, MAX_DESCRIPTION)}`,
    },
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return parseReply(await chat(messages));
    } catch (error) {
      lastError = error;
    }
  }
  throw new ExtractionError(
    `no usable JSON after ${MAX_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/** OpenAI-compatible client pointed at cliproxyapi. Plain fetch keeps the dep list small. */
export function makeChat(): ChatFn {
  const baseUrl = (process.env.LLM_BASE_URL ?? "http://localhost:8317/v1").replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "";

  return async (messages) => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0 }),
    });
    if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM response had no content");
    return content;
  };
}
