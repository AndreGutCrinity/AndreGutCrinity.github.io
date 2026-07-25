# ZEC/USDT Grid-Bot Backtester

A static site that backtests a **spot geometric grid bot** on ZEC/USDT and finds the
optimal number of grids for a chosen price range and time window. The output is a
**profit ($) vs. number of grids** plot.

The website makes **no API calls**. A daily GitHub Actions cron downloads fresh 1-minute
candles from Binance's public data dump and commits them to `data/`. The page reads
those committed files. Full design in [`SPEC.md`](SPEC.md).

## Use

1. Enter start/end time (UTC), the grid range (min/max price), investment ($) and fee (%).
2. Click **RUN**. The sweep computes profit for every grid count and marks the optimum.
3. Cross-check the price action on Binance directly (no candle chart in v1).

With investment = **$100**, profit in dollars ≈ percent gain.

## Model (frozen — see SPEC §4)

- Spot **geometric** grid: lines `L_i = Pmin · r^i`, `r = (Pmax/Pmin)^(1/N)`.
- **Grid-profit only**: counts completed buy→sell round trips; ignores floating PnL and
  end-of-window inventory. No leverage, no compounding.
- Per-trip net profit is constant: `net = (I/N)·[(r−1) − f·(1+r)]`;
  `profit(N) = net · total_trips(N)`.
- Candle-resolution approximation: a single candle counts at most one buy + one sell per
  interval (acceptable for loose, long-running grids).

## Data pipeline

- `scripts/fetch.mjs` — downloads Binance `data.binance.vision` 1m kline ZIPs (no auth,
  no rate limit), stores compact columnar monthly JSON in `data/`, keeps 6 months.
  - `node scripts/fetch.mjs` — incremental (auto-backfills if `data/` is empty)
  - `node scripts/fetch.mjs --backfill 6` — force 6-month backfill
- `.github/workflows/fetch-data.yml` — runs it daily at 02:00 UTC and commits changes.
  Trigger a backfill manually via the workflow_dispatch "backfill" input.

## Deploy (GitHub Pages)

1. Push to `main`.
2. Repo → Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/`.
3. The daily cron keeps `data/` fresh; each push auto-redeploys Pages.

## Files

```
index.html   style.css   app.js        # the static site (terminal UI, B/W, Geist Mono)
fonts/                                  # self-hosted Geist Mono (OFL)
data/                                   # committed candles + index.json (built by cron)
scripts/fetch.mjs                       # data fetcher
.github/workflows/fetch-data.yml        # daily cron
SPEC.md                                 # full specification
```
