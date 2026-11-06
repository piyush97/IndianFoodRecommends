"use client";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p>Could not load picks.</p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-[var(--radius-step)] border border-line px-4 focus-visible:outline-2 focus-visible:outline-accent"
      >
        Retry
      </button>
    </div>
  );
}
