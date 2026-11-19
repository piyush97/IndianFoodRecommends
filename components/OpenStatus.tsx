"use client";
import { useEffect, useState } from "react";
import { openStatus, type OpenStatus as Status, type Week } from "../lib/open-status";

/**
 * Open or closed right now, from the stored OpenStreetMap week. The page is cached, so the
 * status is computed in the browser after mount; the status line is reserved up front so
 * nothing shifts when it fills in.
 */
export function OpenStatus({ week }: { week: Week }) {
  const [status, setStatus] = useState<Status | undefined>(undefined);

  useEffect(() => {
    const tick = () => setStatus(openStatus(week, new Date()));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [week]);

  if (status === null) return null;
  const text = !status
    ? ""
    : status.open
      ? status.until
        ? `Open now · until ${status.until}`
        : "Open now"
      : `Closed · opens ${status.opensAt}`;
  return (
    <p className="text-sm">
      <span className="block min-h-5 font-semibold">{text}</span>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted underline"
      >
        Hours: © OpenStreetMap contributors
        <span className="sr-only">, opens OpenStreetMap</span>
      </a>
    </p>
  );
}
