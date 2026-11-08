import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About, content policy and creator opt-out",
  description:
    "How Indian Food Recommends picks places from food vlogger videos, what we store, and how creators can remove their picks.",
  alternates: { canonical: "/about" },
};

const OPT_OUT_DAYS = 7;

export default function About() {
  const optOut = process.env.NEXT_PUBLIC_OPTOUT_EMAIL;
  return (
    <article className="flex max-w-prose flex-col gap-6">
      <h1 className="type-lid text-[2.6rem] sm:text-[3.2rem]">About Indian Food Recommends</h1>

      <section className="flex flex-col gap-2">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">What this site is</h2>
        <p>
          One place to see which food spots in Delhi, Mumbai, Kolkata, Hyderabad, Bengaluru,
          Chennai, Lucknow and Jaipur food vloggers recommend, which dish they ordered, and the
          exact moment in their video. Every pick links back to the creator&apos;s original video.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">How picks are chosen</h2>
        <ol className="list-decimal pl-6">
          <li>Each day we read the public upload feed of the creators we follow.</li>
          <li>
            A language model reads each video&apos;s title and description and lists the places and
            dishes it names.
          </li>
          <li>
            A second model checks every pick: is the place named in the video, is it a shop rather
            than a dish, does the video recommend it, and is it in a city we cover.
          </li>
          <li>
            Picks that pass are published. Picks that fail are kept out, with the reason recorded.
          </li>
        </ol>
        <p>
          Places are ranked by how many different creators picked them. Newer picks get a small
          boost. Nobody pays for placement.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">What we store</h2>
        <p>
          The video ID, the creator, the place, the dish and the timestamp. We do not copy video
          titles, descriptions or transcripts. Any note on a pick is written in our own words.
          Videos play from YouTube or Instagram only after you press play.
        </p>
        <p>
          We do not use cookies or accounts. If you report a problem with a place, we keep a one-way
          hash of your IP address for a short time to stop spam, not the address itself.
        </p>
        <p>
          If you type an area to sort places by distance, that text is sent to OpenStreetMap search.
          Your device location never leaves your browser. Star ratings come live from Google Maps
          and are not stored here;{" "}
          <a href="https://policies.google.com/terms" className="underline">
            Google&apos;s terms
          </a>{" "}
          and{" "}
          <a href="https://policies.google.com/privacy" className="underline">
            privacy policy
          </a>{" "}
          apply to them. The Zomato and Swiggy buttons are plain searches; we have no tie to either.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">
          Creators: removing your picks
        </h2>
        <p>
          If you are a creator and do not want your videos listed, we remove all your picks within{" "}
          {OPT_OUT_DAYS} days of your request.
        </p>
        {optOut ? (
          <p>
            Email{" "}
            <a href={`mailto:${optOut}`} className="underline">
              {optOut}
            </a>{" "}
            from an address linked to your channel.
          </p>
        ) : (
          <p>The opt-out email address is coming soon.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Something wrong?</h2>
        <p>
          Every place page has a <strong>Report a problem</strong> form for closed, moved or wrong
          places. Start from the{" "}
          <Link href="/delhi" className="underline">
            Delhi list
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
