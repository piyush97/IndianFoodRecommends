import { describe, expect, it } from "vitest";
import { parseApproveForm } from "./review-form";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseApproveForm", () => {
  it("links existing place and dish when ids are chosen", () => {
    const input = parseApproveForm(
      form({ id: "7", placeId: "3", dishId: "5", tsSeconds: "252", note: "Go early" }),
      1,
    );
    expect(input).toEqual({
      id: 7,
      place: { existingId: 3 },
      dish: { existingId: 5 },
      tsSeconds: 252,
      note: "Go early",
    });
  });

  it("builds a new place in the given city from typed fields", () => {
    const input = parseApproveForm(
      form({
        id: "7",
        placeId: "new",
        placeName: " Chache Di Hatti ",
        locality: "Kamla Nagar",
        lat: "28.68",
        lng: "77.2",
        dishId: "new",
        dishName: "Chole Bhature",
        tsSeconds: "",
        note: "",
      }),
      1,
    );
    expect(input.place).toEqual({
      name: "Chache Di Hatti",
      locality: "Kamla Nagar",
      cityId: 1,
      lat: 28.68,
      lng: 77.2,
    });
    expect(input.dish).toEqual({ name: "Chole Bhature" });
    expect(input.tsSeconds).toBeNull();
  });

  it("rejects a new place without coordinates", () => {
    expect(() =>
      parseApproveForm(form({ id: "7", placeId: "new", placeName: "X", dishId: "5", note: "" }), 1),
    ).toThrow();
  });
});
