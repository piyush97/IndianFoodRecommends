import { connection } from "next/server";
import { ogCard, ogContentType, ogSize } from "../../../../lib/seo/og";
import { cachedCreator } from "../../data";

export const alt = "Food vlogger's Delhi picks";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const data = await cachedCreator(slug).catch(() => null);
  if (!data) return ogCard({ title: "Where Delhi food vloggers say to eat" });
  return ogCard({
    title: `${data.creator.name}'s Delhi picks`,
    subline: `${data.total} ${data.total === 1 ? "pick" : "picks"}, each linked to the video moment`,
  });
}
