import Link from "next/link";
import { directionsUrl, formatTs, sourceUrl } from "../lib/public/links";
import type { PickCard } from "../lib/public/queries";

const action =
  "inline-flex min-h-11 items-center rounded-[var(--radius-step)] border border-line px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
  if (cards.length === 0) return <p className="text-muted">{emptyText}</p>;

  return (
    <ol className="flex flex-col divide-y divide-line border-y border-line">
      {cards.map((card, i) => {
        const directions = directionsUrl(card.lat, card.lng);
        const ts = formatTs(card.proof.tsSeconds);
        const n = card.creators.length;
        return (
          <li key={card.placeSlug} className="flex flex-col gap-2 py-4">
            <Heading className="text-lg font-semibold">
              {numbered && <span className="text-muted">{i + 1}. </span>}
              <Link
                href={`/${card.citySlug}/place/${card.placeSlug}`}
                className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {card.placeName}
              </Link>
              {card.locality && <span className="font-normal text-muted"> · {card.locality}</span>}
            </Heading>
            <p className="text-sm">
              Picked by {n} {n === 1 ? "creator" : "creators"}:{" "}
              {card.creators.map((c, j) => (
                <span key={c.slug}>
                  {j > 0 && ", "}
                  <Link
                    href={`/creator/${c.slug}`}
                    className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {c.name}
                  </Link>
                </span>
              ))}
            </p>
            <p className="text-sm text-muted">{card.dishes.join(", ")}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={sourceUrl(card.proof.platform, card.proof.externalId, card.proof.tsSeconds)}
                target="_blank"
                rel="noopener noreferrer"
                className={action}
                data-umami-event="watch"
                data-umami-event-place={card.placeSlug}
              >
                {ts ? `Watch moment (${ts})` : "Watch video"}
                <span className="sr-only">
                  {" "}
                  by {card.proof.creator}, opens{" "}
                  {card.proof.platform === "youtube" ? "YouTube" : "Instagram"}
                </span>
              </a>
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={action}
                  data-umami-event="directions"
                  data-umami-event-place={card.placeSlug}
                >
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
