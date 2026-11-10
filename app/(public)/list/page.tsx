import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHead } from "../../../components/PageHead";
import { PickList } from "../../../components/PickList";
import { Skeleton } from "../../../components/Skeleton";
import { listParam } from "../../../lib/list-core";
import { listShareText, parseListParam } from "../../../lib/list-params";
import { absoluteUrl } from "../../../lib/seo/site";
import { cachedList } from "../data";
import { ListActions } from "./ListActions";

type Props = PageProps<"/list">;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const key = listParam(parseListParam((await searchParams).p));
  const base: Metadata = { title: "My eat list", robots: { index: false } };
  if (!key) return base;
  try {
    const cards = await cachedList(key);
    if (cards.length === 0) return base;
    const text = listShareText(cards);
    const image = `/api/og/list?p=${encodeURIComponent(key)}`;
    return {
      ...base,
      title: text,
      openGraph: { title: text, images: [image] },
      twitter: { card: "summary_large_image", title: text, images: [image] },
    };
  } catch {
    return base;
  }
}

export default function ListPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ListContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ListContent({ searchParams }: Pick<Props, "searchParams">) {
  const { p } = await searchParams;
  const key = listParam(parseListParam(p));
  if (!key) {
    return (
      <div className="flex flex-col gap-4">
        <PageHead title="My eat list" />
        <ListActions mode="redirect" />
      </div>
    );
  }
  const cards = await cachedList(key);
  if (cards.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHead title="My eat list" />
        <p className="border-y border-line py-6 text-muted" role="status">
          None of the places in this link are available any more.
        </p>
        <Link className="btn btn-line self-start" href="/">
          Find places to eat
        </Link>
      </div>
    );
  }
  const text = listShareText(cards);
  const slugs = cards.map((c) => c.placeSlug);
  return (
    <div className="flex flex-col gap-4">
      <PageHead title="Eat list" sub={text} />
      <ListActions
        mode="view"
        slugs={slugs}
        text={text}
        url={absoluteUrl(`/list?p=${encodeURIComponent(listParam(slugs))}`)}
      />
      <PickList cards={cards} numbered={false} headingLevel={2} emptyText="" />
    </div>
  );
}
