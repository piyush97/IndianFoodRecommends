import type { Metadata } from "next";
import { Analytics } from "../components/Analytics";
import { SITE_URL } from "../lib/seo/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Indian Food Recommends", template: "%s · Indian Food Recommends" },
  alternates: { canonical: "/" },
  openGraph: { siteName: "Indian Food Recommends", locale: "en_IN", type: "website" },
  description:
    "Where Delhi food vloggers say to eat: places ranked by how many creators picked them, with the video moment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
