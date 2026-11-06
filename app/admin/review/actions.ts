"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../../../db";
import { requireAdmin } from "../../../lib/auth";
import {
  approveRecommendation,
  mergePlaces,
  rejectRecommendation,
  suggestLocation,
  type ApproveInput,
} from "../../../lib/review";
import { parseApproveForm } from "../../../lib/review-form";

// Server actions accept arbitrary client JSON: validate every argument.
const Id = z.coerce.number().int().positive();

export async function approveAction(input: ApproveInput): Promise<void> {
  const { email } = await requireAdmin();
  await approveRecommendation(db, input, email);
  revalidatePath("/admin/review");
}

export async function rejectAction(id: number): Promise<void> {
  await requireAdmin();
  await rejectRecommendation(db, Id.parse(id));
  revalidatePath("/admin/review");
}

export async function mergeAction(fromId: number, intoId: number): Promise<void> {
  await requireAdmin();
  await mergePlaces(db, Id.parse(fromId), Id.parse(intoId));
  revalidatePath("/admin/review");
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
    backWithError(error instanceof Error ? error.message : "Approve failed.");
  }
  revalidatePath("/admin/review");
  redirect("/admin/review");
}

export async function rejectFormAction(form: FormData): Promise<void> {
  await requireAdmin();
  await rejectRecommendation(db, Id.parse(form.get("id")));
  revalidatePath("/admin/review");
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
