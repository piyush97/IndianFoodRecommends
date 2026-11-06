export function Skeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Loading picks</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-20 animate-pulse rounded-[var(--radius-step)] bg-line"
        />
      ))}
    </div>
  );
}
