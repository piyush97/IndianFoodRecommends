import { Suspense } from "react";
import { asc, count, eq } from "drizzle-orm";
import { db, schema } from "../../../db";
import { requireAdminPage } from "../../../lib/auth";
import { cityFromName } from "../../../lib/cities";
import type { Match } from "../../../lib/matcher";
import {
  approveFormAction,
  manualAddFormAction,
  rejectFormAction,
  suggestLocationFormAction,
} from "./actions";
import { Shortcuts } from "./Shortcuts";

type Extracted = {
  place_name?: string;
  locality?: string | null;
  city?: string | null;
  dishes?: string[];
  suggestions?: { places?: Match[]; dishes?: Match[] };
};

const field =
  "min-h-11 w-full rounded-[var(--radius-step)] border border-line bg-paper px-3 text-base focus-visible:outline-2 focus-visible:outline-accent";
const label = "flex flex-col gap-1 text-sm font-medium";
const button =
  "min-h-11 rounded-[var(--radius-step)] px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function ReviewPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="text-muted">Loading next pick…</p>}>
      <ReviewCard searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewCard({ searchParams }: { searchParams: Search }) {
  await requireAdminPage();
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");

  const [pending] = await db
    .select({ n: count() })
    .from(schema.recommendations)
    .where(eq(schema.recommendations.status, "pending"));

  const [rec] = await db
    .select({
      id: schema.recommendations.id,
      tsSeconds: schema.recommendations.tsSeconds,
      confidence: schema.recommendations.confidence,
      extracted: schema.recommendations.extracted,
      videoId: schema.sources.externalId,
      creator: schema.creators.name,
    })
    .from(schema.recommendations)
    .innerJoin(schema.sources, eq(schema.sources.id, schema.recommendations.sourceId))
    .innerJoin(schema.creators, eq(schema.creators.id, schema.sources.creatorId))
    .where(eq(schema.recommendations.status, "pending"))
    .orderBy(asc(schema.recommendations.createdAt), asc(schema.recommendations.id))
    .limit(1);

  const error = one("error");

  if (!rec) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Review queue</h1>
        {error && <ErrorBanner message={error} />}
        {one("added") && <p role="status">Pick added and published.</p>}
        <p className="text-muted">
          Queue clear. The daily run reviews picks automatically; only picks it could not check land
          here.
        </p>
        <ManualAdd />
      </section>
    );
  }

  const cities = await db.select().from(schema.cities).orderBy(asc(schema.cities.id));
  const x0 = (rec.extracted ?? {}) as Extracted;
  // Default to the city the LLM named when we cover it; the editor can change it.
  const guessed = cityFromName(x0.city);
  const city = cities.find((c) => c.slug === guessed?.slug) ?? cities[0];
  const places = await db
    .select({ id: schema.places.id, name: schema.places.name })
    .from(schema.places)
    .where(eq(schema.places.cityId, city.id))
    .orderBy(asc(schema.places.name));
  const dishes = await db
    .select({ id: schema.dishes.id, name: schema.dishes.name })
    .from(schema.dishes)
    .orderBy(asc(schema.dishes.name));

  const x = x0;
  const placeGuess = x.suggestions?.places?.[0]?.id;
  const dishGuess = x.suggestions?.dishes?.[0]?.id;
  const start = rec.tsSeconds ? `?start=${rec.tsSeconds}` : "";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Review queue</h1>
        <p className="text-sm text-muted">{pending.n} pending</p>
      </div>

      {error && <ErrorBanner message={error} />}
      <Shortcuts />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <iframe
            className="aspect-video w-full rounded-[var(--radius-card)] border border-line"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(rec.videoId)}${start}`}
            title={`Video by ${rec.creator}`}
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Creator</dt>
            <dd>{rec.creator}</dd>
            <dt className="text-muted">LLM place</dt>
            <dd>{x.place_name ?? "none"}</dd>
            <dt className="text-muted">LLM city</dt>
            <dd>
              {x.city ?? "unknown"}
              {x.city && !guessed && (
                <strong className="ml-2 text-accent">City not covered: reject unless wrong</strong>
              )}
            </dd>
            <dt className="text-muted">LLM dishes</dt>
            <dd>{x.dishes?.join(", ") || "none"}</dd>
            <dt className="text-muted">Confidence</dt>
            <dd>{rec.confidence?.toFixed(2) ?? "n/a"}</dd>
          </dl>
        </div>

        <div className="flex flex-col gap-4">
          <form action={approveFormAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={rec.id} />
            <label className={label}>
              City
              <select name="cityId" defaultValue={city.id} className={field}>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line p-4">
              <legend className="px-1 text-sm font-semibold">Place ({city.name})</legend>
              <label className={label}>
                Existing place or new
                <select name="placeId" defaultValue={placeGuess ?? "new"} className={field}>
                  <option value="new">New place (fill fields below)</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                New place name
                <input name="placeName" defaultValue={x.place_name ?? ""} className={field} />
              </label>
              <label className={label}>
                Locality
                <input name="locality" defaultValue={x.locality ?? ""} className={field} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Latitude
                  <input
                    name="lat"
                    inputMode="decimal"
                    defaultValue={one("lat")}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Longitude
                  <input
                    name="lng"
                    inputMode="decimal"
                    defaultValue={one("lng")}
                    className={field}
                  />
                </label>
              </div>
              {one("found") && <p className="text-sm text-muted">OpenStreetMap: {one("found")}</p>}
            </fieldset>

            <fieldset className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line p-4">
              <legend className="px-1 text-sm font-semibold">Dish</legend>
              <label className={label}>
                Existing dish or new
                <select name="dishId" defaultValue={dishGuess ?? "new"} className={field}>
                  <option value="new">New dish (type name below)</option>
                  {dishes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                New dish name
                <input name="dishName" defaultValue={x.dishes?.[0] ?? ""} className={field} />
              </label>
            </fieldset>

            <label className={label}>
              Timestamp (seconds)
              <input
                name="tsSeconds"
                inputMode="numeric"
                defaultValue={rec.tsSeconds ?? ""}
                className={field}
              />
            </label>
            <label className={label}>
              Note, your own words (max 140)
              <textarea name="note" maxLength={140} rows={2} className={`${field} py-2`} />
            </label>

            <button id="approve-button" type="submit" className={`${button} bg-accent text-paper`}>
              Approve
            </button>
          </form>

          <div className="flex flex-wrap gap-3">
            <form action={suggestLocationFormAction} className="flex flex-1 gap-2">
              <input
                type="hidden"
                name="query"
                value={[x.place_name, x.locality, city.name].filter(Boolean).join(", ")}
              />
              <button type="submit" className={`${button} flex-1 border border-line`}>
                Suggest location
              </button>
            </form>
            <form action={rejectFormAction}>
              <input type="hidden" name="id" value={rec.id} />
              <button id="reject-button" type="submit" className={`${button} border border-line`}>
                Reject
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-step)] border border-accent bg-accent-soft p-3 text-sm"
    >
      <strong>Error: </strong>
      {message}
    </p>
  );
}

async function ManualAdd() {
  await requireAdminPage();
  const cities = await db.select().from(schema.cities).orderBy(asc(schema.cities.id));
  const creators = await db
    .select({ id: schema.creators.id, name: schema.creators.name })
    .from(schema.creators)
    .orderBy(asc(schema.creators.name));
  const places = await db
    .select({ id: schema.places.id, name: schema.places.name, cityId: schema.places.cityId })
    .from(schema.places)
    .orderBy(asc(schema.places.name));
  const cityName = new Map(cities.map((c) => [c.id, c.name] as const));
  const dishes = await db
    .select({ id: schema.dishes.id, name: schema.dishes.name })
    .from(schema.dishes)
    .orderBy(asc(schema.dishes.name));

  return (
    <form
      action={manualAddFormAction}
      className="mt-6 flex flex-col gap-3 rounded-[var(--radius-card)] border border-line p-4"
    >
      <h2 className="text-lg font-semibold">Add a pick by hand</h2>
      <label className={label}>
        City (for a new place)
        <select name="cityId" defaultValue={cities[0]?.id} className={field}>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        YouTube or Instagram URL
        <input name="url" type="url" required className={field} />
      </label>
      <label className={label}>
        Creator
        <select name="creatorId" required className={field}>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Place
        <select name="placeId" defaultValue="new" className={field}>
          <option value="new">New place (fill fields below)</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({cityName.get(p.cityId)})
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        New place name
        <input name="placeName" className={field} />
      </label>
      <label className={label}>
        Locality
        <input name="locality" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Latitude
          <input name="lat" inputMode="decimal" className={field} />
        </label>
        <label className={label}>
          Longitude
          <input name="lng" inputMode="decimal" className={field} />
        </label>
      </div>
      <label className={label}>
        Dish
        <select name="dishId" defaultValue="new" className={field}>
          <option value="new">New dish (type name below)</option>
          {dishes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        New dish name
        <input name="dishName" className={field} />
      </label>
      <label className={label}>
        Timestamp (seconds)
        <input name="tsSeconds" inputMode="numeric" className={field} />
      </label>
      <label className={label}>
        Note, your own words (max 140)
        <textarea name="note" maxLength={140} rows={2} className={`${field} py-2`} />
      </label>
      <button type="submit" className={`${button} bg-accent text-paper`}>
        Add and publish
      </button>
    </form>
  );
}
