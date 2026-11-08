import { formatTs } from "../lib/public/links";

/** Route colour per city, the same one the city tab and map pin use. */
export const ROUTE: Record<string, { bg: string; fg: string; code: string }> = {
  delhi: { bg: "var(--color-route-delhi)", fg: "var(--color-paper)", code: "DL" },
  mumbai: { bg: "var(--color-route-mumbai)", fg: "var(--color-paper)", code: "MB" },
  kolkata: { bg: "var(--color-route-kolkata)", fg: "var(--color-ink)", code: "KL" },
};

/**
 * The signature: a painted route code like a dabbawala tiffin lid. City code,
 * creators who agree, and the video moment, readable at arm's length. The same
 * facts are spelled out in words beside it; the tile never stands alone.
 */
export function LidCode({
  citySlug,
  creators,
  tsSeconds,
  size = "md",
}: {
  citySlug: string;
  creators: number;
  tsSeconds?: number | null;
  size?: "md" | "lg";
}) {
  const label = creators === 1 ? "creator" : "creators";
  const route = ROUTE[citySlug] ?? ROUTE.delhi;
  const ts = formatTs(tsSeconds ?? null);
  return (
    <span
      aria-hidden="true"
      className={`enamel type-lid inline-grid shrink-0 place-items-center text-center ${
        size === "lg" ? "min-w-22 px-3 py-2.5" : "min-w-16 px-2 py-1.5"
      }`}
      style={{ background: route.bg, color: route.fg }}
    >
      <span className={size === "lg" ? "text-sm" : "text-xs"}>{route.code}</span>
      <span className={size === "lg" ? "text-4xl" : "text-2xl"}>{creators}</span>
      <span className="text-xs font-semibold tracking-normal normal-case">{label}</span>
      {ts && <span className="text-xs font-semibold tracking-normal normal-case">{ts}</span>}
    </span>
  );
}
