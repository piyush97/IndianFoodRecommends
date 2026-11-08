import Link from "next/link";

const segment =
  "inline-flex min-h-11 items-center gap-1.5 px-2.5 text-sm font-bold whitespace-nowrap uppercase tracking-wide no-underline focus-visible:outline-offset-[-3px]";

export function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted" aria-hidden="true">
        {label}
      </span>
      <nav
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="-mx-4 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0"
      >
        <ul className="inline-flex rounded-[var(--radius-step)] shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
          {children}
        </ul>
      </nav>
    </div>
  );
}

export function Segment({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex">
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        scroll={false}
        className={`${segment} ${active ? "bg-ink text-paper" : "text-ink hover:bg-cloth"}`}
      >
        {children}
      </Link>
    </li>
  );
}
