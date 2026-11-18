// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PickCard } from "../lib/public/queries";
import { PickList } from "./PickList";

const card = (): PickCard => ({
  citySlug: "delhi",
  placeSlug: "p",
  placeName: "Place",
  locality: null,
  lat: 28.6,
  lng: 77.2,
  approx: false,
  creators: [
    { slug: "alice", name: "Alice", avatarUrl: "https://yt3.googleusercontent.com/avatar" },
    { slug: "bob", name: "Bob", avatarUrl: null },
  ],
  dishes: ["Chole Bhature"],
  videos: 2,
  proof: { platform: "youtube", externalId: "v", tsSeconds: null, creator: "Alice" },
  score: 0,
  pickedOn: "2026-01-01",
  status: "open",
  statusChangedAt: null,
  flagged: false,
});

describe("PickList", () => {
  it("shows a channel avatar next to a creator name, and an initial fallback", () => {
    const { container } = render(<PickList cards={[card()]} emptyText="No picks" />);
    const link = screen.getByRole("link", { name: "Alice" });
    expect(link).toBeTruthy();
    expect(link.querySelector("img")?.getAttribute("src")).toContain("yt3.googleusercontent.com");
    // Bob has no avatar: his initial stands in for it.
    expect(screen.getByText("B")).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});
