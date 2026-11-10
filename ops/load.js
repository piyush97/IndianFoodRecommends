// Load test for the read-only public pages.
// Usage: BASE=https://your-host k6 run ops/load.js
// Protected Vercel preview: also set BYPASS to the project's automation bypass secret.
// Keep it read-only: it never submits, reports or geocodes, so it costs nothing
// on the paid endpoints and does not write rows.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE;
// Browsers ask for compression; without it k6 times uncompressed bodies on our own link.
const headers = { "accept-encoding": "br, gzip" };
if (__ENV.BYPASS) headers["x-vercel-protection-bypass"] = __ENV.BYPASS;
if (!BASE) throw new Error("Set BASE to the host under test, e.g. BASE=https://example.com");

export const options = {
  scenarios: {
    // A steady stream of visitors reading pages, no bursts.
    readers: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "60s", target: 10 },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    // Budgets from docs/slo.md; a breach fails the run.
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const PATHS = [
  "/",
  "/delhi",
  "/delhi/butter-chicken",
  "/delhi/place/gulati-restaurant",
  "/search?q=chole",
];

export default function () {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(`${BASE}${path}`, { headers, tags: { path } });
  check(res, {
    "status is 200": (r) => r.status === 200,
    "not an error page": (r) => !String(r.body).includes("Application error"),
  });
}
