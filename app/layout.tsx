import type { Metadata, Viewport } from "next";
import { Analytics } from "../components/Analytics";
import { SITE_URL } from "../lib/seo/site";
import { Archivo } from "next/font/google";
import "./globals.css";

// Variable width axis carries both voices: condensed lid codes and normal body.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

// Paper colour: the phone status bar blends into the page, and the site is light only.
export const viewport: Viewport = { themeColor: "#f2eee5", colorScheme: "light" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Indian Food Recommends", template: "%s · Indian Food Recommends" },
  alternates: { canonical: "/" },
  openGraph: { siteName: "Indian Food Recommends", locale: "en_IN", type: "website" },
  description:
    "Where Indian food vloggers say to eat: places ranked by how many creators picked them, with the video moment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={archivo.variable}>
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
