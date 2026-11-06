import { db } from "../../../db";
import { createReport, hashIp } from "../../../lib/report";

export async function POST(request: Request): Promise<Response> {
  const salt = process.env.REPORT_SALT;
  if (!salt) return Response.json({ error: "Reports are not configured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const result = await createReport(db, body, hashIp(ip, salt));
  if (result.ok) return Response.json({ ok: true }, { status: 201 });

  const messages = {
    400: "Check the report fields.",
    404: "That place no longer exists.",
    429: "Too many reports. Try again in a minute.",
  } as const;
  return Response.json({ error: messages[result.status] }, { status: result.status });
}
