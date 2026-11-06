import { ApproveInput } from "./review";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(form: FormData, key: string): number | null {
  const raw = text(form, key);
  return raw === "" ? null : Number(raw);
}

/** Turns the review card's form fields into a validated ApproveInput. */
export function parseApproveForm(form: FormData, cityId: number): ApproveInput {
  const placeId = text(form, "placeId");
  const dishId = text(form, "dishId");

  return ApproveInput.parse({
    id: Number(text(form, "id")),
    place:
      placeId === "new"
        ? {
            name: text(form, "placeName"),
            locality: text(form, "locality") || null,
            cityId,
            lat: optionalNumber(form, "lat"),
            lng: optionalNumber(form, "lng"),
          }
        : { existingId: Number(placeId) },
    dish: dishId === "new" ? { name: text(form, "dishName") } : { existingId: Number(dishId) },
    tsSeconds: optionalNumber(form, "tsSeconds"),
    note: text(form, "note"),
  });
}
