import Link from "next/link";
import { directionsUrl, formatTs, sourceUrl } from "../lib/public/links";
import type { PickCard } from "../lib/public/queries";
import { LidCode } from "./LidCode";

export function PickList({
  cards,
  emptyText,
  numbered = true,
  headingLevel = 3,
}: {
  cards: PickCard[];
  emptyText: string;
  numbered?: boolean;
  /** 2 when the list sits directly under the page h1, 3 under a section h2. */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  if (cards.length === 0) {
    return (
      <p className="border-y border-line py-6 text-muted" role="status">
        {emptyText}
      </p>
    );
  }

  return (
    <ol className="border-t-2 border-ink">
      {cards.map((card, i) => {
        const directions = directionsUrl(card.lat, card.lng);
        const ts = formatTs(card.proof.tsSeconds);
        const n = card.creators.length;
        const platform = card.proof.platform === "youtube" ? "YouTube" : "Instagram";
        return (
          <li key={`${card.citySlug}-${card.placeSlug}`} className="border-b border-line py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Heading className="type-lid text-[1.65rem]">
                  {numbered && (
                    <span className="mr-2 align-[0.18em] text-sm text-muted tabular-nums">
                      No.{i + 1}
                    </span>
                  )}
                  <Link
                    href={`/${card.citySlug}/place/${card.placeSlug}`}
                    className="decoration-2 underline-offset-4 hover:underline"
                  >
                    {card.placeName}
                  </Link>
                </Heading>
                {(card.locality || card.approx) && (
                  <p className="mt-1 text-sm text-muted">
                    {card.locality}
                    {card.approx && <span>{card.locality ? " · " : ""}approximate pin</span>}
                  </p>
                )}
                <p className="mt-1.5 text-sm">
                  Picked by {n} {n === 1 ? "creator" : "creators"}:{" "}
                  {card.creators.map((c, j) => (
                    <span key={c.slug}>
                      {j > 0 && ", "}
                      <Link href={`/creator/${c.slug}`} className="font-semibold underline">
                        {c.name}
                      </Link>
                    </span>
                  ))}
                </p>
                {card.dishes.length > 0 && (
                  <p className="mt-0.5 text-sm text-muted">{card.dishes.join(" · ")}</p>
                )}
                {card.distanceM !== undefined && (
                  <p className="mt-1 text-sm text-muted">
                    {(card.distanceM / 1000).toFixed(1)} km from area centre
                    {card.approx ? " (approximate pin)" : ""}
                  </p>
                )}
              </div>
              <LidCode citySlug={card.citySlug} creators={n} tsSeconds={card.proof.tsSeconds} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={sourceUrl(card.proof.platform, card.proof.externalId, card.proof.tsSeconds)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ink"
                data-umami-event="watch"
                data-umami-event-place={card.placeSlug}
              >
                <PlayIcon />
                {ts ? `Watch moment (${ts})` : "Watch video"}
                <span className="sr-only">
                  {" "}
                  by {card.proof.creator}, opens {platform}
                </span>
              </a>
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-line"
                  data-umami-event="directions"
                  data-umami-event-place={card.placeSlug}
                >
                  <ArrowIcon />
                  Directions
                  <span className="sr-only"> to {card.placeName}, opens Google Maps</span>
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PlayIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 1.8v10.4a.6.6 0 0 0 .9.5l8.4-5.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 11.5 11.5 2.5M5 2.5h6.5V9" />
    </svg>
  );
}
