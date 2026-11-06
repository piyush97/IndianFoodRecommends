import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "../../../../../components/Skeleton";
import { escapeXml } from "../../../../../lib/badge";
import { absoluteUrl } from "../../../../../lib/seo/site";
import { cachedCreator } from "../../../data";

export const metadata: Metadata = {
  title: "Creator share kit",
  robots: { index: false, follow: false },
};

export default function KitPage({ params }: PageProps<"/creator/[slug]/kit">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Kit params={params} />
    </Suspense>
  );
}

async function Kit({ params }: Pick<PageProps<"/creator/[slug]/kit">, "params">) {
  const { slug } = await params;
  const data = await cachedCreator(slug);
  if (!data) notFound();
  const page = absoluteUrl(`/creator/${slug}`);
  const badge = absoluteUrl(`/creator/${slug}/badge`);
  const snippet = `<a href="${page}"><img src="${badge}" alt="${escapeXml(data.creator.name)} on Indian Food Recommends" height="28"></a>`;

  return (
    <section className="flex max-w-prose flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Share kit for {data.creator.name}</h1>
      <p>
        Your {data.total} {data.total === 1 ? "pick is" : "picks are"} listed with a link back to
        each video. Use these to point your audience to the list.
      </p>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Link to your page</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Page URL
          <input
            readOnly
            value={page}
            className="min-h-11 rounded-[var(--radius-step)] border border-line bg-paper px-3 font-normal"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Badge for your website</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- the badge is the SVG creators embed */}
        <img
          src={`/creator/${slug}/badge`}
          alt={`${data.creator.name} on Indian Food Recommends`}
          height={28}
        />
        <label className="flex flex-col gap-1 text-sm font-medium">
          HTML to paste
          <textarea
            readOnly
            rows={4}
            value={snippet}
            className="rounded-[var(--radius-step)] border border-line bg-paper px-3 py-2 font-mono text-sm font-normal"
          />
        </label>
      </div>

      <p className="text-sm text-muted">
        Want your picks removed instead? See the opt-out section on the{" "}
        <Link href="/about" className="underline">
          about page
        </Link>
        .
      </p>
    </section>
  );
}
