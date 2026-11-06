import { ogCard, ogContentType, ogSize } from "../lib/seo/og";

export const alt = "Indian Food Recommends: where Indian food vloggers say to eat";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    title: "Where Indian food vloggers say to eat",
    subline: "Places ranked by how many creators picked them, with the video moment",
  });
}
