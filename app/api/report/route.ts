import { checkBotId } from "botid/server";
import { db } from "../../../db";
import { isReadOnlyError, READ_ONLY } from "../../../db/guard";
import { clientIp } from "../../../lib/rate-limit";
import { createReport, hashIp } from "../../../lib/report";

export async function POST(request: Request): Promise<Response> {
  // Vercel BotID: same invisible challenge as /api/submit. Skip off Vercel,
  // where the check cannot classify anyone and would only break local/CI.
  if (process.env.VERCEL === "1") {
    const verification = await checkBotId();
    if (verification.isBot) return Response.json({ error: "Request blocked." }, { status: 403 });
  }

  const salt = process.env.REPORT_SALT;
  if (!salt) return Response.json({ error: "Reports are not configured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ip = clientIp(request);
  let result: Awaited<ReturnType<typeof createReport>>;
  try {
    result = await createReport(db, body, hashIp(ip, salt));
  } catch (error) {
    if (isReadOnlyError(error)) return Response.json({ error: READ_ONLY }, { status: 503 });
    throw error;
  }
  if (result.ok) return Response.json({ ok: true }, { status: 201 });

  const messages = {
    400: "Check the report fields.",
    404: "That place no longer exists.",
    429: "Too many reports. Try again in a minute.",
  } as const;
  return Response.json({ error: messages[result.status] }, { status: result.status });
}
