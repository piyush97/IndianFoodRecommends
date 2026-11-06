export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" className="flex gap-2" role="search">
      <label htmlFor="q" className="sr-only">
        Search dish, place or creator
      </label>
      <div className="relative flex-1">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="7" cy="7" r="5" />
          <path d="m11 11 3.5 3.5" />
        </svg>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="Dish, place or creator"
          maxLength={100}
          className="field pl-9"
        />
      </div>
      <button type="submit" className="btn btn-ink">
        Search
      </button>
    </form>
  );
}
