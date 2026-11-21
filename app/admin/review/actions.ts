"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../../../db";
import { requireAdmin } from "../../../lib/auth";
import {
  addManualRecommendation,
  approveRecommendation,
  mergeDishes,
  mergePlaces,
  rejectRecommendation,
  suggestLocation,
  type ApproveInput,
} from "../../../lib/review";
import { resolvePlace } from "../../../lib/reports-admin";
import { approveCandidate, rejectCandidate } from "../../../lib/worker/discover-creators";
import { parseApproveForm, parseManualForm } from "../../../lib/review-form";
import { addMissAsAlias } from "../../../lib/search-misses";

// Server actions accept arbitrary client JSON: validate every argument.
const Id = z.coerce.number().int().positive();

export async function approveAction(input: ApproveInput): Promise<void> {
  const { email } = await requireAdmin();
  await approveRecommendation(db, input, email);
  revalidatePath("/admin/review");
  revalidateTag("public", "max");
}

export async function rejectAction(id: number): Promise<void> {
  await requireAdmin();
  await rejectRecommendation(db, Id.parse(id));
  revalidatePath("/admin/review");
  revalidateTag("public", "max");
}

export async function mergeAction(fromId: number, intoId: number): Promise<void> {
  await requireAdmin();
  await mergePlaces(db, Id.parse(fromId), Id.parse(intoId));
  revalidatePath("/admin/review");
  revalidatePath("/admin/places");
  revalidateTag("public", "max");
}

export async function mergeDishAction(fromId: number, intoId: number): Promise<void> {
  await requireAdmin();
  await mergeDishes(db, Id.parse(fromId), Id.parse(intoId));
  revalidatePath("/admin/dishes");
  revalidateTag("public", "max");
}

const PlaceId = z.number().int().positive().max(2_147_483_647);
const Outcome = z.enum(["open", "closed", "moved"]);
// Bound action arguments cross the server-action boundary as strings.
const SeenThrough = z.string().datetime().optional();

export async function resolveReportAction(
  placeId: number,
  outcome: "open" | "closed" | "moved",
  seenThrough?: string,
): Promise<void> {
  await requireAdmin();
  const seen = SeenThrough.parse(seenThrough);
  await resolvePlace(
    db,
    PlaceId.parse(placeId),
    Outcome.parse(outcome),
    new Date(),
    seen ? new Date(seen) : undefined,
  );
  revalidatePath("/admin/reports");
  revalidateTag("public", "max");
}

const MissQuery = z.string().trim().min(1).max(100);
const DishSlug = z.string().trim().toLowerCase().min(1).max(80);

export async function aliasMissAction(form: FormData): Promise<void> {
  await requireAdmin();
  const query = MissQuery.parse(form.get("query"));
  // A blank or malformed slug is a typo, not an attack: do nothing instead of the error page.
  const slug = DishSlug.safeParse(form.get("dishSlug"));
  if (!slug.success) return;
  await addMissAsAlias(db, query, slug.data);
  revalidatePath("/admin/searches");
  revalidateTag("public", "max");
}

function backWithError(message: string): never {
  redirect(`/admin/review?error=${encodeURIComponent(message)}`);
}

export async function approveFormAction(form: FormData): Promise<void> {
  const { email } = await requireAdmin();
  let input: ApproveInput;
  try {
    input = parseApproveForm(form, Id.parse(form.get("cityId")));
  } catch {
    backWithError("Check the fields: new places need a name, lat 6 to 37.5 and lng 68 to 97.5.");
  }
  try {
    await approveRecommendation(db, input, email);
  } catch (error) {
    console.error("approve failed:", error);
    backWithError(
      error instanceof Error && /not pending/.test(error.message)
        ? "This pick was already reviewed."
        : "Approve failed. Check the place and dish, then try again.",
    );
  }
  revalidatePath("/admin/review");
  revalidateTag("public", "max");
  redirect("/admin/review");
}

export async function rejectFormAction(form: FormData): Promise<void> {
  await requireAdmin();
  await rejectRecommendation(db, Id.parse(form.get("id")));
  revalidatePath("/admin/review");
  revalidateTag("public", "max");
  redirect("/admin/review");
}

export async function suggestLocationFormAction(form: FormData): Promise<void> {
  await requireAdmin();
  const query = z.string().trim().min(1).max(200).parse(form.get("query"));
  const hit = await suggestLocation(query);
  if (!hit) backWithError(`No OpenStreetMap result for "${query}". Enter lat/lng by hand.`);
  const params = new URLSearchParams({
    lat: String(hit.lat),
    lng: String(hit.lng),
    found: hit.displayName,
  });
  redirect(`/admin/review?${params}`);
}

export async function manualAddFormAction(form: FormData): Promise<void> {
  await requireAdmin();
  try {
    await addManualRecommendation(db, parseManualForm(form, Id.parse(form.get("cityId"))));
  } catch (error) {
    console.error("manual add failed:", error);
    backWithError(
      error instanceof Error && /URL must be/.test(error.message)
        ? "Use a YouTube video or an Instagram post or reel URL."
        : "Manual add failed. Check the URL, place and dish fields.",
    );
  }
  revalidatePath("/admin/review");
  revalidateTag("public", "max");
  redirect("/admin/review?added=1");
}

export async function approveCandidateFormAction(form: FormData): Promise<void> {
  await requireAdmin();
  await approveCandidate(db, Id.parse(form.get("id")));
  revalidatePath("/admin/creators");
}

export async function rejectCandidateFormAction(form: FormData): Promise<void> {
  await requireAdmin();
  await rejectCandidate(db, Id.parse(form.get("id")));
  revalidatePath("/admin/creators");
}
