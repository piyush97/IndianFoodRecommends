import { connection } from "next/server";
import { ogCard, ogContentType, ogSize } from "../../../../lib/seo/og";
import { cachedDish } from "../../data";

export const alt = "Dish ranking by food vloggers";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({
  params,
}: {
  params: Promise<{ city: string; dish: string }>;
}) {
  await connection();
  const { city, dish } = await params;
  const data = await cachedDish(city, dish).catch(() => null);
  if (!data) return ogCard({ title: "Where Indian food vloggers say to eat" });
  const n = data.places.length;
  return ogCard({
    title: `${data.dish.name} in ${data.city.name}`,
    lid: { city: data.city.slug, count: data.creatorCount },
    subline: `${n} ${n === 1 ? "place" : "places"} picked by ${data.creatorCount} food ${data.creatorCount === 1 ? "vlogger" : "vloggers"}`,
  });
}
