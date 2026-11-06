"use client";

// `retry()` re-fetches server data; `reset()` would only re-render the failed output.
export default function PublicError({ retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p>Could not load picks.</p>
      <button type="button" onClick={() => retry()} className="btn btn-line">
        Retry
      </button>
    </div>
  );
}
