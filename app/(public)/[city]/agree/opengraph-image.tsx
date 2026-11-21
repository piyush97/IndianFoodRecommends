import { connection } from "next/server";
import { agreeTitle } from "../../../../lib/public/queries";
import { ogCard, ogContentType, ogSize } from "../../../../lib/seo/og";
import { cachedAgree } from "../../data";

export const alt = "Places more than one food creator recommends";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ city: string }> }) {
  await connection();
  const { city } = await params;
  const data = await cachedAgree(city).catch(() => null);
  if (!data) return ogCard({ title: "Where Indian food vloggers say to eat" });
  const n = data.places.length;
  return ogCard({
    title: `Creators agree in ${data.city.name}`,
    subline: agreeTitle(n, data.city.name),
    lid: { city: data.city.slug, count: n, label: n === 1 ? "place" : "places" },
  });
}
