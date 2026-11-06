import { ApproveInput, ManualInput } from "./review";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(form: FormData, key: string): number | null {
  const raw = text(form, key);
  return raw === "" ? null : Number(raw);
}

function pickFields(form: FormData, cityId: number) {
  const placeId = text(form, "placeId");
  const dishId = text(form, "dishId");
  return {
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
  };
}

/** Turns the review card's form fields into a validated ApproveInput. */
export function parseApproveForm(form: FormData, cityId: number): ApproveInput {
  return ApproveInput.parse({ id: Number(text(form, "id")), ...pickFields(form, cityId) });
}

/** Turns the manual-add form into a validated ManualInput. */
export function parseManualForm(form: FormData, cityId: number): ManualInput {
  return ManualInput.parse({
    url: text(form, "url"),
    creatorId: Number(text(form, "creatorId")),
    ...pickFields(form, cityId),
  });
}
