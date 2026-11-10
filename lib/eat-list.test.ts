// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_KEY, parseList, readList, toggle } from "./eat-list";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("eat-list", () => {
  it("parses garbage to []", () => {
    for (const raw of [null, "", "{", "42", '{"a":1}', "[1,2]"]) expect(parseList(raw)).toEqual([]);
  });

  it("filters bad slugs, dedupes, caps 30", () => {
    const many = Array.from({ length: 40 }, (_, i) => `p-${i}`);
    expect(parseList(JSON.stringify(["A", "../x", "ok", "ok", ...many]))).toEqual([
      "ok",
      ...many.slice(0, 29),
    ]);
  });

  it("toggle adds to front then removes", () => {
    localStorage.clear();
    expect(toggle("a")).toBe(true);
    toggle("b");
    expect(readList()).toEqual(["b", "a"]);
    expect(toggle("a")).toBe(false);
    expect(readList()).toEqual(["b"]);
  });

  it("survives setItem throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota");
    });
    expect(toggle("z")).toBe(true);
    expect(readList()).toContain("z");
  });

  it("full list drops the oldest", () => {
    localStorage.setItem(LIST_KEY, JSON.stringify(Array.from({ length: 30 }, (_, i) => `p-${i}`)));
    toggle("new");
    const l = readList();
    expect(l).toHaveLength(30);
    expect(l[0]).toBe("new");
    expect(l).not.toContain("p-29");
  });
});
