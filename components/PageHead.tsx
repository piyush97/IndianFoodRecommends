import Link from "next/link";

/** Page title in the lid voice, with an optional way back and one line of facts. */
export function PageHead({
  title,
  back,
  sub,
  children,
}: {
  title: React.ReactNode;
  back?: { href: string; label: string };
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {back && (
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold no-underline hover:underline"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8.5 2.5 4 7l4.5 4.5" />
          </svg>
          {back.label}
        </Link>
      )}
      <h1 className="type-lid text-[2.6rem] sm:text-[3.2rem]">{title}</h1>
      {sub && <p className="text-base text-muted">{sub}</p>}
      {children}
    </div>
  );
}
