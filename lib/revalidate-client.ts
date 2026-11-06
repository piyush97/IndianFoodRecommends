/** Asks the deployed site to refresh cached pages. Never throws: a failed refresh only delays freshness. */
export async function notifyRevalidate(
  tags: string[],
  opts: { url?: string; secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const base = opts.url ?? process.env.SITE_URL ?? "";
  const secret = opts.secret ?? process.env.REVALIDATE_SECRET ?? "";
  if (!base || !secret) {
    console.log("revalidate: SITE_URL or REVALIDATE_SECRET unset, skipping");
    return false;
  }
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${base.replace(/\/+$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) console.error(`revalidate: site answered ${res.status}`);
    return res.ok;
  } catch (error) {
    console.error("revalidate: request failed:", error);
    return false;
  }
}
