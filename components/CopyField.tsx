"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "../lib/track";

/** Read-only field with a copy button; same status pattern as ShareButton. `rows` makes it a textarea. */
export function CopyField({
  label,
  value,
  button = "Copy link",
  rows,
  event,
}: {
  label: string;
  value: string;
  button?: string;
  rows?: number;
  /** `kit-copy` data, see docs/metrics.md. */
  event?: { kind: string; creator: string };
}) {
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    let message = "Copied";
    try {
      await navigator.clipboard.writeText(value);
      if (event) track("kit-copy", event);
    } catch {
      message = "Could not copy. Select the text and copy it by hand.";
    }
    setNote(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 4000);
  }

  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <label className="flex flex-col gap-1">
        {label}
        {rows ? (
          <textarea
            readOnly
            rows={rows}
            value={value}
            className="field py-2 font-mono text-sm font-normal"
          />
        ) : (
          <input readOnly value={value} className="field font-normal" />
        )}
      </label>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="btn btn-line">
          {button}
        </button>
        <span role="status" aria-live="polite" className="text-sm font-normal text-muted">
          {note}
        </span>
      </span>
    </div>
  );
}
