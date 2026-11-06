import Script from "next/script";

/**
 * Umami Cloud: no cookies, no personal data. Off unless a website id is set,
 * so the site works the same without an analytics account.
 */
export function Analytics({
  websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "",
}: {
  websiteId?: string;
}) {
  if (!websiteId) return null;
  return (
    <Script
      src="https://cloud.umami.is/script.js"
      data-website-id={websiteId}
      data-do-not-track="true"
      strategy="afterInteractive"
    />
  );
}
