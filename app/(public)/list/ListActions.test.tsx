// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_KEY, readList } from "../../../lib/eat-list";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const track = vi.fn();
vi.mock("../../../lib/track", async (orig) => ({
  ...(await orig<typeof import("../../../lib/track")>()),
  track: (...a: unknown[]) => track(...a),
}));

import { ListActions } from "./ListActions";

const URL_ = "https://x.app/list?p=a%2Cb";
const TEXT = "2 places to eat in Delhi, picked by 1 food vlogger";

function view(slugs: string[], requested = slugs) {
  return render(
    <ListActions mode="view" slugs={slugs} requested={requested} text={TEXT} url={URL_} />,
  );
}
function device(slugs: string[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(slugs));
}

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
  replace.mockClear();
});
afterEach(cleanup);

describe("ListActions own detection", () => {
  it("still treats the owner as owner when a saved slug has since been hidden", () => {
    device(["a", "b", "gone"]);
    view(["a", "b"], ["a", "b", "gone"]);
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Send on WhatsApp/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Save all/ })).toBeNull();
    expect(track).toHaveBeenCalledWith("list-open", { size: "2", own: "yes" });
  });

  it("Clear removes the stale hidden slug too", () => {
    device(["a", "b", "gone"]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    view(["a", "b"], ["a", "b", "gone"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(readList()).toEqual([]);
    expect(replace).toHaveBeenCalledWith("/list");
  });

  it("shows only Save all for a friend's list", () => {
    device(["z"]);
    view(["a", "b"]);
    expect(screen.getByRole("button", { name: /Save all/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(track).toHaveBeenCalledWith("list-open", { size: "2", own: "no" });
  });
});

describe("ListActions clear mode (every requested place hidden)", () => {
  it("offers Clear my list when the device holds stale slugs, and empties it", () => {
    device(["gone", "gone2"]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ListActions mode="clear" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear my list" }));
    expect(readList()).toEqual([]);
    expect(replace).toHaveBeenCalledWith("/list");
  });

  it("keeps the list when the visitor cancels", () => {
    device(["gone"]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ListActions mode="clear" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear my list" }));
    expect(readList()).toEqual(["gone"]);
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders nothing when the device list is empty", () => {
    const { container } = render(<ListActions mode="clear" />);
    expect(container.textContent).toBe("");
  });
});

describe("ListActions save all", () => {
  it("puts incoming slugs first and dedupes", () => {
    device(["z", "b"]);
    view(["a", "b"]);
    fireEvent.click(screen.getByRole("button", { name: /Save all/ }));
    expect(readList()).toEqual(["a", "b", "z"]);
    expect(track).toHaveBeenCalledWith("list-save-all");
  });

  it("caps at 30", () => {
    const mine = Array.from({ length: 30 }, (_, i) => `m${i}`);
    device(mine);
    view(["a", "b"]);
    fireEvent.click(screen.getByRole("button", { name: /Save all/ }));
    const l = readList();
    expect(l).toHaveLength(30);
    expect(l.slice(0, 2)).toEqual(["a", "b"]);
    expect(l).not.toContain("m29");
  });
});

describe("ListActions WhatsApp link", () => {
  it("encodes the text plus the utm url, and leaves out hidden slugs", () => {
    device(["a", "b", "gone"]);
    view(["a", "b"], ["a", "b", "gone"]);
    const href = screen.getByRole("link", { name: /Send on WhatsApp/ }).getAttribute("href");
    const shared = `${URL_}&utm_source=share&utm_medium=whatsapp`;
    expect(href).toBe(`https://wa.me/?text=${encodeURIComponent(`${TEXT} ${shared}`)}`);
    expect(decodeURIComponent(href ?? "")).not.toContain("gone");
  });
});
