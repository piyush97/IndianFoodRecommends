// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "../lib/track";
import { SaveButton } from "./SaveButton";

vi.mock("../lib/track", () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
  localStorage.clear();
});

describe("SaveButton", () => {
  it("toggles aria-pressed", () => {
    render(<SaveButton slug="x" placeName="Chache Di Hatti" />);
    const btn = screen.getByRole("button", { name: /Save/ });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.textContent).toContain("Saved");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps two buttons for the same slug in sync", () => {
    render(
      <>
        <SaveButton slug="x" placeName="A" />
        <SaveButton slug="x" placeName="A" />
      </>,
    );
    const [a, b] = screen.getAllByRole("button");
    fireEvent.click(a);
    expect(b.getAttribute("aria-pressed")).toBe("true");
  });

  it("tracks save then unsave, and nothing for an invalid slug", () => {
    const { unmount } = render(<SaveButton slug="x" placeName="A" />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(vi.mocked(track).mock.calls).toEqual([
      ["save", { place: "x" }],
      ["unsave", { place: "x" }],
    ]);
    unmount();
    vi.mocked(track).mockClear();
    render(<SaveButton slug="Bad Slug!" placeName="B" />);
    fireEvent.click(screen.getByRole("button"));
    expect(track).not.toHaveBeenCalled();
  });
});
