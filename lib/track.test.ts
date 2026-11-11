import { afterEach, describe, expect, it, vi } from "vitest";
import { resultBucket, track, withUtm } from "./track";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("track", () => {
  it("calls umami when present", () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { umami: { track: spy } });
    track("save", { place: "a" });
    expect(spy).toHaveBeenCalledWith("save", { place: "a" });
  });

  it("is a no-op without umami", () => {
    vi.stubGlobal("window", {});
    expect(() => track("save")).not.toThrow();
  });

  it("is a no-op without a window", () => {
    expect(() => track("save")).not.toThrow();
  });

  it("never throws when umami throws", () => {
    vi.stubGlobal("window", {
      umami: {
        track: () => {
          throw new Error("x");
        },
      },
    });
    expect(() => track("save")).not.toThrow();
  });
});

describe("withUtm", () => {
  it("adds utm and keeps existing params", () => {
    expect(withUtm("https://x.app/list?p=a,b", "whatsapp")).toBe(
      "https://x.app/list?p=a,b&utm_source=share&utm_medium=whatsapp",
    );
  });

  it("leaves no escaped comma in a shared list link", () => {
    expect(withUtm("https://x.app/list?p=a%2Cb", "copy")).not.toContain("%2C");
  });
});

describe("resultBucket", () => {
  it("buckets results", () => {
    expect(resultBucket(0)).toBe("0");
    expect(resultBucket(5)).toBe("1-5");
    expect(resultBucket(6)).toBe("6+");
  });
});
