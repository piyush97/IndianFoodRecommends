"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../db";
import { requireAdmin } from "../../../lib/auth";
import {
  approveRecommendation,
  mergePlaces,
  rejectRecommendation,
  type ApproveInput,
} from "../../../lib/review";

// Server actions accept arbitrary client JSON: validate every argument.
const Id = z.number().int().positive();

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
