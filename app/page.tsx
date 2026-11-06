export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Indian Food Recommends
      </h1>
      <p className="text-muted max-w-prose">
        Recommendations from Indian food vloggers, one city and one dish at a
        time. The public site is not built yet: only the database schema and the
        ingest pipeline are in place.
      </p>
    </main>
  );
}
