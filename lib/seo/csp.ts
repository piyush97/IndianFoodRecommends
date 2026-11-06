const MAP = "https://tiles.openfreemap.org";
const UMAMI_SCRIPT = "https://cloud.umami.is";
const UMAMI_API = "https://api-gateway.umami.dev";

/**
 * Content Security Policy. `'unsafe-inline'` scripts are required: pages are
 * partially prerendered, so a per-request nonce cannot be embedded. Everything
 * else is pinned to the hosts the site actually uses.
 */
export function buildCsp({
  analytics,
  dev = false,
}: {
  analytics: boolean;
  dev?: boolean;
}): string {
  const script = ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])];
  const connect = ["'self'", MAP];
  if (analytics) {
    script.push(UMAMI_SCRIPT);
    connect.push(UMAMI_SCRIPT, UMAMI_API);
  }
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MAP}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self' blob:",
    "frame-src https://www.youtube-nocookie.com https://www.instagram.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    // Auth.js posts to its own route, then GitHub's authorize page.
    "form-action 'self' https://github.com",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
