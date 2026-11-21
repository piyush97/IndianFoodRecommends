import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyField } from "../../../../../components/CopyField";
import { Skeleton } from "../../../../../components/Skeleton";
import { badgeTheme, escapeXml, kitShareText } from "../../../../../lib/badge";
import { absoluteUrl } from "../../../../../lib/seo/site";
import { cachedCreator } from "../../../data";

export const metadata: Metadata = {
  title: "Creator share kit",
  robots: { index: false, follow: false },
};

export default function KitPage({ params, searchParams }: PageProps<"/creator/[slug]/kit">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Kit params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Kit({ params, searchParams }: PageProps<"/creator/[slug]/kit">) {
  const { slug } = await params;
  const theme = badgeTheme(String((await searchParams).theme ?? ""));
  const data = await cachedCreator(slug);
  if (!data) notFound();
  const page = absoluteUrl(`/creator/${slug}`);
  const utm = (medium?: string) =>
    `${page}?utm_source=creator${medium ? `&utm_medium=${medium}` : ""}&utm_campaign=${slug}`;
  const tracked = utm();
  const badgePath = `/creator/${slug}/badge${theme === "light" ? "?theme=light" : ""}`;
  const badge = absoluteUrl(badgePath);
  const alt = `${data.creator.name}: ${data.total} ${data.total === 1 ? "pick" : "picks"} on Indian Food Recommends`;
  const html = `<a href="${utm("badge")}"><img src="${badge}" alt="${escapeXml(alt)}" height="28"></a>`;
  const markdown = `[![${alt.replace(/[[\]]/g, "")}](${badge})](${utm("badge")})`;
  const shareText = kitShareText({ total: data.total, picks: data.picks, url: utm("post") });
  const event = (kind: string) => ({ kind, creator: slug });

  return (
    <section className="flex max-w-prose flex-col gap-6">
      <h1 className="type-lid text-[2.6rem] sm:text-[3.2rem]">Share kit for {data.creator.name}</h1>
      <p>
        Your {data.total} {data.total === 1 ? "pick is" : "picks are"} listed with a link back to
        each video. Use these to point your audience to the list.
      </p>

      <div className="flex flex-col gap-2">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Link to your page</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Page URL
          <input readOnly value={page} className="field font-normal" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Link for your bio</h2>
        <p className="text-sm text-muted">
          Visits through this link show up as coming from creators, so you can see what it brings.
        </p>
        <CopyField label="Tracked link" value={tracked} event={event("link")} />
      </div>

      {data.picks.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">
            Text for a video description
          </h2>
          <p className="text-sm text-muted">
            Paste it under a video or in a community post. The places are the three with the most of
            your dishes listed.
          </p>
          <CopyField
            label="Share text"
            value={shareText}
            rows={8}
            button="Copy text"
            event={event("text")}
          />
        </div>
      )}

      {data.picks.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Story image</h2>
          <p className="text-sm text-muted">Your top picks as a 1080x1920 image for a story.</p>
          <a
            href={`/creator/${slug}/story`}
            download={`${slug}-story.png`}
            className="btn btn-ink self-start"
          >
            Download story
          </a>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">
          Badge for your website
        </h2>
        <nav aria-label="Badge colour" className="flex flex-wrap gap-2">
          {(["dark", "light"] as const).map((t) => (
            <Link
              key={t}
              href={`/creator/${slug}/kit${t === "light" ? "?theme=light" : ""}`}
              replace
              scroll={false}
              aria-current={t === theme ? "true" : undefined}
              className={`btn ${t === theme ? "btn-ink" : "btn-line"}`}
            >
              {t === "light" ? "Light badge" : "Dark badge"}
            </Link>
          ))}
        </nav>
        {/* eslint-disable-next-line @next/next/no-img-element -- the badge is the SVG creators embed */}
        <img src={badgePath} alt={alt} className="max-w-full self-start" />
        <CopyField
          label="HTML to paste"
          value={html}
          rows={4}
          button="Copy HTML"
          event={event("html")}
        />
        <CopyField
          label="Markdown to paste"
          value={markdown}
          rows={3}
          button="Copy Markdown"
          event={event("markdown")}
        />
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
