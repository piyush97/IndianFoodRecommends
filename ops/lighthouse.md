# Lighthouse record

Run: Lighthouse 12.8.2, mobile preset, headless Chromium, against production
`https://indian-food-recommends.vercel.app`, 2026-11-06, after the S3-4 fixes.

| Page                      | Performance | Accessibility | Best practices | SEO | LCP   | CLS | TBT    |
| ------------------------- | ----------- | ------------- | -------------- | --- | ----- | --- | ------ |
| `/`                       | 99          | 100           | 100            | 100 | 1.8 s | 0   | 100 ms |
| `/delhi/butter-chicken`   | 95          | 100           | 100            | 91  | 1.9 s | 0   | 240 ms |
| `/delhi/place/rpjs-shack` | 98          | 100           | 100            | 91  | 1.8 s | 0   | 150 ms |

Before the fixes the place page scored 68 (MapLibre loaded on page load: 3.5 s TBT) and the home
page had CLS 0.127 (footer moved when streamed lists arrived).

SEO 91 on dynamic pages is the `meta-description` audit: Next streams `generateMetadata` after
the shell, and Lighthouse reads the head before it arrives. The description is in the served
HTML and is sent up-front to crawlers (Googlebot user agent checked with curl).

Re-run:

```bash
CHROME_PATH=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | tail -1) \
  npx -y lighthouse@12 https://indian-food-recommends.vercel.app/ --form-factor=mobile \
  --chrome-flags="--headless=new --no-sandbox" --view
```
