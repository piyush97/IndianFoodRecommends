// Latency baseline: samples real routes and prints p50/p95 in ms.
// Usage: BASE=http://localhost:3000 SAMPLES=40 pnpm node scripts/bench-latency.mjs
// Numbers in docs/slo.md come from this command; do not edit them by hand.
const BASE = process.env.BASE ?? "http://localhost:3000";
const SAMPLES = Number(process.env.SAMPLES ?? 40);
const WARMUP = 3;

const paths = [
  "/",
  "/delhi",
  "/delhi/butter-chicken",
  "/delhi/place/gulati-restaurant",
  "/kolkata/place/royal-india-restaurant",
  "/kolkata/biryani",
  "/search?q=chole",
  "/search?q=biryani",
];

function pct(sorted, p) {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}

async function timeOnce(path) {
  const start = performance.now();
  const res = await fetch(BASE + path, { redirect: "manual" });
  const body = await res.arrayBuffer();
  return { ms: performance.now() - start, status: res.status, bytes: body.byteLength };
}

const rows = [];
for (const path of paths) {
  for (let i = 0; i < WARMUP; i++) await timeOnce(path);
  const samples = [];
  let status = 0;
  let bytes = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const r = await timeOnce(path);
    samples.push(r.ms);
    status = r.status;
    bytes = r.bytes;
  }
  samples.sort((a, b) => a - b);
  rows.push({
    path,
    status,
    kb: Math.round(bytes / 1024),
    p50: Math.round(pct(samples, 50)),
    p95: Math.round(pct(samples, 95)),
    max: Math.round(samples[samples.length - 1]),
  });
}

console.log(`base ${BASE} samples ${SAMPLES} warmup ${WARMUP}`);
console.table(rows);
const bad = rows.filter((r) => r.status !== 200);
if (bad.length) {
  console.error("non-200:", bad.map((r) => `${r.path} ${r.status}`).join(", "));
  process.exitCode = 1;
}
