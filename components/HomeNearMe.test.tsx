// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PickCard } from "../lib/public/queries";
import { HomeNearMe } from "./HomeNearMe";

const card = (slug: string, lat: number, lng: number): PickCard => ({
  citySlug: "delhi",
  placeSlug: slug,
  placeName: slug,
  locality: null,
  lat,
  lng,
  approx: false,
  creators: [{ slug: "c", name: "C" }],
  dishes: [],
  proof: { platform: "youtube", externalId: "x", tsSeconds: null, creator: "C" },
  score: 0,
  pickedOn: "2026-01-01",
});

const fetchMock = vi.fn();
const getCurrentPosition = vi.fn();

function indexResponse(cards: PickCard[]) {
  return { ok: true, json: async () => ({ cards }) };
}

beforeEach(() => {
  fetchMock.mockReset();
  getCurrentPosition.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const grant = (lat: number, lng: number) =>
  getCurrentPosition.mockImplementation((ok) => ok({ coords: { latitude: lat, longitude: lng } }));

describe("HomeNearMe", () => {
  it("does not fetch until the click", () => {
    render(<HomeNearMe />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("shows nearby picks and says the location stays on the device", async () => {
    grant(28.6562, 77.2303);
    fetchMock.mockResolvedValue(indexResponse([card("close", 28.6563, 77.2303)]));
    render(<HomeNearMe />);
    fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
    expect(await screen.findByRole("heading", { name: "Picks near you" })).toBeTruthy();
    expect(
      screen.getByText(
        "Nearest first, more creators first within each 500 m. Your location stays on this device.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "close" })).toBeTruthy();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe("/api/near-index");
    expect(url).not.toMatch(/lat|lng/);
  });

  it("explains denied permission and focuses the area field", async () => {
    getCurrentPosition.mockImplementation((_ok, fail) => fail({ code: 1 }));
    render(<HomeNearMe />);
    fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
    expect(await screen.findByText("Location is off. Type an area instead.")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Area or landmark")));
  });

  it("says so when nothing is near", async () => {
    grant(19.07, 72.87);
    fetchMock.mockResolvedValue(indexResponse([card("far", 28.6563, 77.2303)]));
    render(<HomeNearMe />);
    fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
    expect(await screen.findByText("No picks near you yet. Browse a city below.")).toBeTruthy();
  });

  it("searches an area through /api/geocode with the chosen city", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith("/api/geocode")
        ? { ok: true, json: async () => ({ lat: 28.6562, lng: 77.2303, label: "Chandni Chowk", via: "local" }) }
        : indexResponse([card("close", 28.6563, 77.2303)]),
    );
    render(<HomeNearMe />);
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "delhi" } });
    fireEvent.change(screen.getByLabelText("Area or landmark"), { target: { value: "Chandni Chowk" } });
    fireEvent.click(screen.getByRole("button", { name: "Search area" }));
    expect(await screen.findByRole("link", { name: "close" })).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/geocode?city=delhi&q=Chandni+Chowk");
    const status = screen.getByRole("status").textContent;
    expect(status).toContain("Matched against our own list of areas");
    expect(status).not.toContain("stays on this device");
    expect(track).toHaveBeenCalledWith("near-me", { result: "area" });
  });

  it("says a typed area went to OpenStreetMap when the lookup was not local", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith("/api/geocode")
        ? {
            ok: true,
            json: async () => ({ lat: 28.6562, lng: 77.2303, label: "X", via: "openstreetmap" }),
          }
        : indexResponse([card("close", 28.6563, 77.2303)]),
    );
    render(<HomeNearMe />);
    fireEvent.change(screen.getByLabelText("Area or landmark"), { target: { value: "Somewhere" } });
    fireEvent.click(screen.getByRole("button", { name: "Search area" }));
    expect(await screen.findByRole("link", { name: "close" })).toBeTruthy();
    const status = screen.getByRole("status").textContent;
    expect(status).toContain("The text you typed was sent to OpenStreetMap to find it.");
    expect(status).not.toContain("stays on this device");
  });
});
