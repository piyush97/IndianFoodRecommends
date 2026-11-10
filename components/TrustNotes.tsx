import { monthYear } from "../lib/public/links";
import type { PickCard } from "../lib/public/queries";

type Trust = Pick<PickCard, "pickedOn" | "status" | "statusChangedAt" | "flagged" | "flagKind">;

/** Freshness and status as words, never colour alone. Order: closed, flagged, moved, last video. */
export function trustNotes(t: Trust): string[] {
  return [
    t.status === "closed"
      ? `Closed${t.statusChangedAt ? ` (confirmed ${monthYear(t.statusChangedAt)})` : ""}`
      : null,
    t.status !== "closed" && t.flagged
      ? `Visitors reported this ${t.flagKind === "moved" ? "moved" : "closed"}. We are checking.`
      : null,
    t.status === "moved" ? "Reported moved: check the location before you go." : null,
    `Last in a video: ${monthYear(t.pickedOn)}`,
  ].filter((n): n is string => n !== null);
}

export function TrustNotes({ trust }: { trust: Trust }) {
  const [first, ...rest] = trustNotes(trust);
  const alert = trust.status !== "open" || trust.flagged;
  return (
    <p className="mt-1 text-sm text-muted">
      {alert && first !== undefined ? (
        <>
          <strong className="font-semibold text-ink">{first}</strong>
          {rest.map((n) => ` · ${n}`).join("")}
        </>
      ) : (
        [first, ...rest].join(" · ")
      )}
    </p>
  );
}
