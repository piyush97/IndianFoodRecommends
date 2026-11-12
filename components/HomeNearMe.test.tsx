// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PickCard } from "../lib/public/queries";
import { track } from "../lib/track";
import { HomeNearMe, LOCATE_GIVE_UP_MS } from "./HomeNearMe";

vi.mock("../lib/track", () => ({ track: vi.fn() }));

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
  videos: 1,
  proof: { platform: "youtube", externalId: "x", tsSeconds: null, creator: "C" },
  score: 0,
  pickedOn: "2026-01-01",
  status: "open",
  statusChangedAt: null,
  flagged: false,
});

const fetchMock = vi.fn();
const getCurrentPosition = vi.fn();

function indexResponse(cards: PickCard[]) {
  return { ok: true, json: async () => ({ cards }) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(track).mockClear();
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
    expect(track).toHaveBeenCalledWith("near-me", { result: "denied" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Area or landmark")),
    );
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
        ? {
            ok: true,
            json: async () => ({
              lat: 28.6562,
              lng: 77.2303,
              label: "Chandni Chowk",
              via: "local",
            }),
          }
        : indexResponse([card("close", 28.6563, 77.2303)]),
    );
    render(<HomeNearMe />);
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "delhi" } });
    fireEvent.change(screen.getByLabelText("Area or landmark"), {
      target: { value: "Chandni Chowk" },
    });
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

  it.each([
    [2, "position unavailable"],
    [3, "timeout"],
  ])("treats geolocation error code %i (%s) as unavailable, not denied", async (code) => {
    getCurrentPosition.mockImplementation((_ok, fail) => fail({ code }));
    render(<HomeNearMe />);
    fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
    expect(
      await screen.findByText("Could not find your location. Type an area instead."),
    ).toBeTruthy();
    expect(track).toHaveBeenCalledWith("near-me", { result: "unavailable" });
    expect(track).not.toHaveBeenCalledWith("near-me", { result: "denied" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Area or landmark")),
    );
  });

  it("frees the button when the browser never answers the location prompt", () => {
    vi.useFakeTimers();
    try {
      getCurrentPosition.mockImplementation(() => {});
      render(<HomeNearMe />);
      fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
      expect(track).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(LOCATE_GIVE_UP_MS));
      expect(screen.getByText("Could not find your location. Type an area instead.")).toBeTruthy();
      expect(track).toHaveBeenCalledWith("near-me", { result: "unavailable" });
      expect(
        (screen.getByRole("button", { name: "Picks near me" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a late position after giving up", () => {
    vi.useFakeTimers();
    try {
      let late: ((p: unknown) => void) | undefined;
      getCurrentPosition.mockImplementation((ok) => (late = ok));
      render(<HomeNearMe />);
      fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
      act(() => vi.advanceTimersByTime(LOCATE_GIVE_UP_MS));
      act(() => late?.({ coords: { latitude: 28.6, longitude: 77.2 } }));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("announces when the browser has no geolocation", async () => {
    delete (navigator as { geolocation?: unknown }).geolocation;
    render(<HomeNearMe />);
    fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
    expect(await screen.findByText("Location is off. Type an area instead.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Location is off");
    expect(track).toHaveBeenCalledWith("near-me", { result: "denied" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the closest picks when none are within 5 km", async () => {
    // About 11 km north of the only pick: outside the 5 km radius, inside the 50 km cap.
    grant(28.7562, 77.2303);
    fetchMock.mockResolvedValue(indexResponse([card("farther", 28.6563, 77.2303)]));
    render(<HomeNearMe />);
    fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
    expect(await screen.findByRole("heading", { name: "Closest picks" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Nothing within 5 km");
    expect(screen.getByRole("link", { name: "farther" })).toBeTruthy();
  });

  it("reports a failed index download", async () => {
    grant(28.6562, 77.2303);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<HomeNearMe />);
    fireEvent.click(screen.getByRole("button", { name: "Picks near me" }));
    expect(await screen.findByText("Could not load picks. Try again.")).toBeTruthy();
  });

  const search = () => {
    fireEvent.change(screen.getByLabelText("Area or landmark"), {
      target: { value: "Chandni Chowk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search area" }));
  };

  it("shows the server message for a rate limit, never the code", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "rate",
        message: "Too many location lookups. Try again in a moment.",
      }),
    });
    render(<HomeNearMe />);
    search();
    expect(
      await screen.findByText("Too many location lookups. Try again in a moment."),
    ).toBeTruthy();
    expect(screen.queryByText("rate")).toBeNull();
  });

  it("survives a non-JSON 500 without leaking a parse error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });
    render(<HomeNearMe />);
    search();
    expect(await screen.findByText("Could not search right now. Try again.")).toBeTruthy();
    expect(screen.queryByText(/Unexpected token/)).toBeNull();
  });

  it("offers geocode suggestions and uses the chosen point", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith("/api/geocode")
        ? {
            ok: false,
            json: async () => ({
              error: "Not sure which area you mean.",
              suggestions: [{ name: "Chandni Chowk", lat: 28.6562, lng: 77.2303 }],
            }),
          }
        : indexResponse([card("close", 28.6563, 77.2303)]),
    );
    render(<HomeNearMe />);
    search();
    fireEvent.click(await screen.findByRole("button", { name: "Chandni Chowk" }));
    expect(await screen.findByRole("link", { name: "close" })).toBeTruthy();
    expect(track).toHaveBeenCalledWith("near-me", { result: "area" });
  });

  it("ignores a second click while locating", () => {
    getCurrentPosition.mockImplementation(() => {});
    render(<HomeNearMe />);
    const button = screen.getByRole("button", { name: "Picks near me" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("keeps the status in one polite region and links it to the field", async () => {
    render(<HomeNearMe />);
    const status = screen.getByRole("status");
    expect(screen.getByLabelText("Area or landmark").getAttribute("aria-describedby")).toBe(
      status.id,
    );
  });
});
