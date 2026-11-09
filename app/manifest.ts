import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Indian Food Recommends",
    short_name: "Food Recommends",
    description:
      "Where Indian food vloggers say to eat: places ranked by how many creators picked them, with the video moment.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2eee5",
    theme_color: "#f2eee5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
