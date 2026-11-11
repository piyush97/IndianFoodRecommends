// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "../lib/track";
import { TrackSearch } from "./TrackSearch";

vi.mock("../lib/track", async (importActual) => ({
  ...(await importActual<typeof import("../lib/track")>()),
  track: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

describe("TrackSearch", () => {
  it("sends one event per query with the result bucket", () => {
    const { rerender } = render(<TrackSearch query="biryani" total={7} />);
    expect(track).toHaveBeenCalledWith("search", { results: "6+" });
    rerender(<TrackSearch query="momos" total={0} />);
    expect(track).toHaveBeenLastCalledWith("search", { results: "0" });
    expect(track).toHaveBeenCalledTimes(2);
  });

  it("does not count a filter change on the same query as a new search", () => {
    const { rerender } = render(<TrackSearch query="biryani" total={7} />);
    rerender(<TrackSearch query="biryani" total={2} />);
    expect(track).toHaveBeenCalledTimes(1);
  });
});
