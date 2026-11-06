"use client";

import { useEffect } from "react";

/** A approves, R rejects, E focuses the first field. Ignored while typing. */
export function Shortcuts() {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const key = event.key.toLowerCase();
      const click = (id: string) => document.getElementById(id)?.click();
      if (key === "a") click("approve-button");
      else if (key === "r") click("reject-button");
      else if (key === "e")
        (document.querySelector("[name=placeId]") as HTMLElement | null)?.focus();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <p className="text-sm text-muted">
      Keys: <kbd>A</kbd> approve, <kbd>R</kbd> reject, <kbd>E</kbd> edit place.
    </p>
  );
}
