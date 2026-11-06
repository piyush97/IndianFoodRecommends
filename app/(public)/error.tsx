"use client";

// `retry()` re-fetches server data; `reset()` would only re-render the failed output.
export default function PublicError({ retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p>Could not load picks.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-11 rounded-[var(--radius-step)] border border-line px-4 focus-visible:outline-2 focus-visible:outline-accent"
      >
        Retry
      </button>
    </div>
  );
}
