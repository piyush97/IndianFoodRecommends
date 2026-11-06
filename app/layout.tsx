import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indian Food Recommends",
  description:
    "Where Delhi food vloggers say to eat: places ranked by how many creators picked them, with the video moment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4">{children}</div>
      </body>
    </html>
  );
}
