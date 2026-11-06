import { checkBotId } from "botid/server";
import { db } from "../../../db";
import { hashIp } from "../../../lib/report";
import { createSubmission } from "../../../lib/submit";

const MESSAGES = {
  400: "Check the fields: a YouTube or Instagram link, a place and a dish.",
  404: "We do not list that creator yet.",
  429: "You have sent 3 suggestions this hour. Try again later.",
} as const;

export async function POST(request: Request): Promise<Response> {
  // Vercel BotID: invisible challenge, attached by instrumentation-client.ts. It only works
  // on Vercel deployments; local and CI builds fall back to the per-IP rate limit.
  if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
    const verification = await checkBotId();
    if (verification.isBot) return Response.json({ error: "Request blocked." }, { status: 403 });
  }

  const salt = process.env.REPORT_SALT;
  if (!salt) return Response.json({ error: "Suggestions are not configured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: MESSAGES[400] }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const result = await createSubmission(db, body, hashIp(ip, salt));
  if (result.ok) return Response.json({ ok: true }, { status: 201 });
  return Response.json({ error: MESSAGES[result.status] }, { status: result.status });
}
