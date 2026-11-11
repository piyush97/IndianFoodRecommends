import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PathIndex } from "./lib/seo/known-paths";

const { loadIndex } = vi.hoisted(() => ({ loadIndex: vi.fn<() => Promise<PathIndex>>() }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./lib/seo/known-paths", async (importActual) => ({
  ...(await importActual<typeof import("./lib/seo/known-paths")>()),
  loadIndex,
}));

const TTL_MS = 60_000;
const indexOf = (...dishes: string[]): PathIndex => ({
  places: new Set(),
  dishes: new Set(dishes),
  creators: new Set(),
  areas: new Set(),
});
const OLD = "/delhi/chole-bhature";
const NEW = "/delhi/momos";
const old = indexOf("delhi/chole-bhature");
const both = indexOf("delhi/chole-bhature", "delhi/momos");

function deferred() {
  let resolve!: (index: PathIndex) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<PathIndex>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The response, or "pending" when the proxy is still waiting (only Date is faked, so this timer is real). */
const soon = (response: Promise<Response>) =>
  Promise.race([response, new Promise<"pending">((r) => setTimeout(() => r("pending"), 50))]);

/** A fresh module (its cache is module state) whose first request already loaded `old`. */
async function warm() {
  vi.resetModules();
  const { proxy } = await import("./proxy");
  const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
  const get = (path: string) =>
    proxy(new NextRequest(`http://localhost${path}`), { waitUntil } as unknown as NextFetchEvent);
  loadIndex.mockResolvedValueOnce(old);
  await get(OLD);
  return { get, waitUntil };
}

describe("proxy", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    loadIndex.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("awaits the load on the first request", async () => {
    vi.resetModules();
    const { proxy } = await import("./proxy");
    const load = deferred();
    loadIndex.mockReturnValueOnce(load.promise);
    const waitUntil = vi.fn();
    const response = proxy(new NextRequest(`http://localhost${NEW}`), {
      waitUntil,
    } as unknown as NextFetchEvent);
    expect(await soon(response)).toBe("pending");
    load.resolve(old);
    expect((await response).status).toBe(404);
    expect(loadIndex).toHaveBeenCalledTimes(1);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("answers a known path from the stale index and refreshes in the background", async () => {
    const { get, waitUntil } = await warm();
    vi.advanceTimersByTime(TTL_MS + 1);
    const load = deferred();
    loadIndex.mockReturnValueOnce(load.promise);

    const response = await soon(get(OLD));
    expect(response).not.toBe("pending");
    expect((response as Response).headers.get("x-middleware-next")).toBe("1");
    expect(loadIndex).toHaveBeenCalledTimes(2);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);

    load.resolve(both);
    await waitUntil.mock.calls[0][0];
    expect((await get(NEW)).status).toBe(200);
    expect(loadIndex).toHaveBeenCalledTimes(2);
  });

  it("awaits a forced refresh for an unknown path and answers 404 only if still unknown", async () => {
    const { get, waitUntil } = await warm();
    vi.advanceTimersByTime(TTL_MS + 1);
    const load = deferred();
    loadIndex.mockReturnValueOnce(load.promise);

    const response = get(NEW);
    expect(await soon(response)).toBe("pending");
    load.resolve(old);
    expect((await response).status).toBe(404);
    expect(waitUntil).not.toHaveBeenCalled();

    // Inside RETRY_MS of that refresh a second unknown path does not load again.
    expect((await get("/delhi/nope")).status).toBe(404);
    expect(loadIndex).toHaveBeenCalledTimes(2);
  });

  it("lets a path through when the forced refresh finds it", async () => {
    const { get } = await warm();
    vi.advanceTimersByTime(TTL_MS + 1);
    loadIndex.mockResolvedValueOnce(both);
    const response = await get(NEW);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("starts one load for concurrent requests after expiry", async () => {
    const { get, waitUntil } = await warm();
    vi.advanceTimersByTime(TTL_MS + 1);
    const load = deferred();
    loadIndex.mockReturnValue(load.promise);

    const known = await Promise.all([soon(get(OLD)), soon(get(OLD))]);
    const unknown = get(NEW);
    expect(known).not.toContain("pending");
    expect(await soon(unknown)).toBe("pending");
    expect(loadIndex).toHaveBeenCalledTimes(2);
    expect(waitUntil).toHaveBeenCalledTimes(2);

    load.resolve(both);
    expect((await unknown).status).toBe(200);
    expect(loadIndex).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the old index when the background load rejects", async () => {
    const { get, waitUntil } = await warm();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.advanceTimersByTime(TTL_MS + 1);
    loadIndex.mockRejectedValue(new Error("db down"));

    expect((await get(OLD)).status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBe(old);
    expect(logged).toHaveBeenCalled();

    expect((await get(OLD)).status).toBe(200);
    expect((await get(NEW)).status).toBe(404);
  });
});
