# Daily ingest timer

The pipeline runs from this machine because cliproxyapi listens on `localhost:8317`.

## Install

```bash
sudo systemctl link /root/Projects/IndianFoodRecommends/ops/ifr-ingest.service
sudo systemctl link /root/Projects/IndianFoodRecommends/ops/ifr-ingest.timer
sudo systemctl enable --now ifr-ingest.timer
```

## Check

```bash
systemctl list-timers ifr-ingest.timer
sudo systemctl start ifr-ingest.service   # run once now
journalctl -u ifr-ingest -n 100 --no-pager
```

## Notes

- `.env` must hold `DATABASE_URL` (Neon, the live DB), `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `TYPESAFE_API_KEY`.
- No YouTube API key: ingest reads the public channel feed.
- Enabled 2026-11-06. Each run: ingest new videos, then auto-review every pending pick with Jev
  (`lib/auto-review.ts`). No human queue; `/admin/review` only shows picks left pending when Jev was down.
- Every decision is stored in `recommendations.extracted.autoReview` (reason + Jev scores).
  Audit rejects: `select extracted->>'place_name', extracted->'autoReview'->>'reason' from recommendations where status='rejected';`
- Manual run: `pnpm worker ingest`.
