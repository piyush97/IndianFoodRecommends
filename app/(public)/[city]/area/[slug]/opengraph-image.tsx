import { connection } from "next/server";
import { ogCard, ogContentType, ogSize } from "../../../../../lib/seo/og";
import { cachedArea } from "../../../data";
export const alt = "Neighbourhood food picks";
export const size = ogSize;
export const contentType = ogContentType;
export default async function Image({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}) {
  await connection();
  const { city, slug } = await params;
  const data = await cachedArea(city, slug).catch(() => null);
  return ogCard({
    title: data ? `Food in ${data.area.name}, ${data.area.cityName}` : "Neighbourhood food picks",
    ...(data && { subline: `${data.places.length} places picked by food vloggers` }),
  });
}
