import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import { buildCsp } from "./lib/seo/csp";

const csp = buildCsp({
  analytics: Boolean(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID),
  dev: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // geolocation=(self): the opt-in "near me" sort; embeds and other origins stay blocked.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

// Adds BotID's challenge rewrites (botid README, step 1).
export default withBotId(nextConfig);
