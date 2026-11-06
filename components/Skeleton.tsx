export function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading picks" className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-[var(--radius-card)] bg-line" />
      ))}
    </div>
  );
}
