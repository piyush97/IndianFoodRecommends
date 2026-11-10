"use client";

import Link from "next/link";
import { useEatList } from "../lib/eat-list";

export function ListLink() {
  const n = useEatList().length;
  return (
    <Link
      href="/list"
      className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold whitespace-nowrap underline decoration-line underline-offset-4 hover:decoration-ink"
    >
      My list
      <span className="min-w-[2ch] tabular-nums">{n > 0 ? n : ""}</span>
    </Link>
  );
}
