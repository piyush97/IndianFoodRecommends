"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { listParam, MAX_LIST, readList, useEatList, writeList } from "../../../lib/eat-list";
import { track, withUtm } from "../../../lib/track";

const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

type Props =
  | { mode: "redirect" }
  | { mode: "clear" }
  | { mode: "view"; slugs: string[]; requested: string[]; text: string; url: string };

export function ListActions(props: Props) {
  if (props.mode === "redirect") return <Redirect />;
  return props.mode === "clear" ? <ClearStale /> : <View {...props} />;
}

function confirmClear(): boolean {
  if (!confirm("Remove every place from your list on this device?")) return false;
  writeList([]);
  return true;
}

/** Every place in a link is gone: the owner can still empty the stale slugs saved on this device. */
function ClearStale() {
  const router = useRouter();
  const hydrated = useHydrated();
  const device = useEatList();
  if (!hydrated || device.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => confirmClear() && router.replace("/list")}
      className="btn btn-line self-start"
    >
      Clear my list
    </button>
  );
}

/** `/list` with no `?p=`: send the visitor to their own device list. Nothing is read on the server. */
function Redirect() {
  const router = useRouter();
  const hydrated = useHydrated();
  const list = useEatList();
  useEffect(() => {
    if (hydrated && list.length > 0)
      router.replace(`/list?p=${encodeURIComponent(listParam(list))}`);
  }, [hydrated, list, router]);
  if (!hydrated || list.length > 0) {
    return (
      <p role="status" className="text-muted">
        Opening your list…
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="border-y border-line py-6 text-muted" role="status">
        Your list is empty. Tap Save on any place to add it.
      </p>
      <Link className="btn btn-line" href="/">
        Find places to eat
      </Link>
    </div>
  );
}

function View({
  slugs,
  requested,
  text,
  url,
}: {
  slugs: string[];
  requested: string[];
  text: string;
  url: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const device = useEatList();
  // `requested` includes slugs hidden since saving, so a stale device entry never demotes the owner.
  const own = listParam(device) === listParam(requested);
  const [note, setNote] = useState("");
  const opened = useRef(false);

  useEffect(() => {
    if (!hydrated || opened.current) return;
    opened.current = true;
    track("list-open", { size: String(slugs.length), own: own ? "yes" : "no" });
  }, [hydrated, own, slugs.length]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(withUtm(url, "copy"));
      setNote("Link copied");
    } catch {
      setNote("Could not copy. Copy the address from the browser bar.");
    }
  }

  async function share() {
    track("list-share", { size: String(slugs.length) });
    if (!navigator.share) return copy();
    try {
      await navigator.share({ url: withUtm(url, "native"), title: text, text });
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if ((error as Error).name !== "AbortError") await copy();
    }
  }

  function saveAll() {
    const mine = readList();
    writeList([...slugs, ...mine.filter((s) => !slugs.includes(s))].slice(0, MAX_LIST));
    track("list-save-all");
    const kept = readList().filter((s) => slugs.includes(s)).length;
    setNote(
      kept < slugs.length
        ? `Saved ${kept} of ${slugs.length}. Your list holds at most ${MAX_LIST} places.`
        : "Saved to your list",
    );
  }

  function clear() {
    if (confirmClear()) router.replace("/list");
  }

  if (!hydrated) return <div className="min-h-11" aria-hidden="true" />;

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${withUtm(url, "whatsapp")}`)}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {own ? (
        <>
          <button type="button" onClick={share} className="btn btn-ink">
            Share
          </button>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-line"
            onClick={() => track("list-share", { size: String(slugs.length) })}
          >
            Send on WhatsApp
            <span className="sr-only"> (opens WhatsApp)</span>
          </a>
          <button type="button" onClick={clear} className="btn btn-line">
            Clear
          </button>
        </>
      ) : (
        <button type="button" onClick={saveAll} className="btn btn-ink">
          Save all to my list
        </button>
      )}
      <span role="status" className="text-sm text-muted">
        {note}
      </span>
    </div>
  );
}
