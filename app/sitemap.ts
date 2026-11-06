import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { db } from "../db";
import { absoluteUrl } from "../lib/seo/site";
import { sitemapPaths } from "../lib/seo/sitemap";

async function cachedPaths() {
  "use cache";
  cacheLife("hours");
  cacheTag("public");
  return sitemapPaths(db);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Request time only: the build has no database.
  await connection();
  const entries = await cachedPaths();
  return entries.map((e) => ({ url: absoluteUrl(e.path), lastModified: e.lastModified }));
}
