"use client";

import { useEffect, useRef, useState } from "react";

/** Read-only field with a copy button; same "Link copied" status pattern as ShareButton. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    let message = "Link copied";
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      message = "Could not copy. Select the link and copy it by hand.";
    }
    setNote(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 4000);
  }

  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <label className="flex flex-col gap-1">
        {label}
        <input readOnly value={value} className="field font-normal" />
      </label>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="btn btn-line">
          Copy link
        </button>
        <span role="status" aria-live="polite" className="text-sm font-normal text-muted">
          {note}
        </span>
      </span>
    </div>
  );
}
