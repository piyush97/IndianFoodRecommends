import { initBotId } from "botid/client/core";

// Vercel BotID attaches its invisible challenge headers to these requests only.
// Its challenge script is served by Vercel, so it only runs in Vercel builds, where
// NEXT_PUBLIC_VERCEL_ENV is inlined. The server enforces checkBotId() whenever VERCEL=1.
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  initBotId({
    protect: [
      { path: "/api/submit", method: "POST" },
      { path: "/api/report", method: "POST" },
    ],
  });
}
