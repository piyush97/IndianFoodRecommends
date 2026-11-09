import { connection } from "next/server";
import { ogCard, ogContentType, ogSize } from "../../../../../lib/seo/og";
import { cachedPlace } from "../../../data";

export const alt = "Place picked by food vloggers";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}) {
  await connection();
  const { city, slug } = await params;
  const data = await cachedPlace(city, slug).catch(() => null);
  if (!data) return ogCard({ title: "Where Indian food vloggers say to eat" });
  const where = [data.place.locality, data.city.name].filter(Boolean).join(", ");
  return ogCard({
    title: data.place.name,
    subline: `${where} · ${data.dishes.map((d) => d.name).join(", ")}`,
    lid: { city: data.city.slug, count: new Set(data.proofs.map((p) => p.creator.slug)).size },
  });
}
