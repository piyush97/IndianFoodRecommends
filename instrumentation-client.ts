import { initBotId } from "botid/client/core";

// Vercel BotID attaches its invisible challenge headers to these requests only.
// Its challenge script is served by Vercel's edge, so it is off for local and CI
// production builds; the server skips checkBotId() there too (app/api/submit).
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  initBotId({
    protect: [{ path: "/api/submit", method: "POST" }],
  });
}
