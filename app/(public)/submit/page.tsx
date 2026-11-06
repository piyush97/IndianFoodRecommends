import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SubmitForm } from "../../../components/SubmitForm";
import { Skeleton } from "../../../components/Skeleton";
import { db, schema } from "../../../db";
import { CITIES } from "../../../lib/cities";

export const metadata: Metadata = {
  title: "Suggest a pick",
  description: "Saw a food vlogger recommend a place? Send us the video and we will check it.",
  alternates: { canonical: "/submit" },
};

export default function SubmitPage() {
  return (
    <section className="flex max-w-prose flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Saw a vlogger recommend a place?</h1>
      <p className="text-muted">
        Send a YouTube video from one of the creators we follow. It shows on the site only if the
        video is on that creator&apos;s channel and its description names the place, the dish and
        the city.
      </p>
      <Suspense fallback={<Skeleton />}>
        <Form />
      </Suspense>
    </section>
  );
}

async function Form() {
  await connection();
  const creators = await db
    .select({ slug: schema.creators.slug, name: schema.creators.name })
    .from(schema.creators)
    .where(eq(schema.creators.optedOut, false))
    .orderBy(asc(schema.creators.name));
  return (
    <SubmitForm creators={creators} cities={CITIES.map(({ slug, name }) => ({ slug, name }))} />
  );
}
