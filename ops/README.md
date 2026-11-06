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

- `.env` must hold `DATABASE_URL`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
- No YouTube API key: ingest reads the public channel feed.
- Do not enable the timer until the eval gate in Task 8 passes (precision >= 0.85).
- Manual run: `pnpm worker ingest`.
