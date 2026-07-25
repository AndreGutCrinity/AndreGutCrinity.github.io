# ZEC/USDT Spot Grid-Bot Backtester — SPEC

A static GitHub Pages site that backtests a **spot geometric grid bot** on ZEC/USDT
and finds the optimal number of grids for a chosen price range and time window.

The website performs **no API calls**. A daily GitHub Actions cron downloads fresh
candles from Binance's public data dump and commits them to the repo. The site reads
those committed files.

---

## 1. Goals

- Input: start time, end time, range min price, range max price.
- Output: **profit ($) vs. number of grids** line plot. This answers "what grid
  count is optimal for this range/window". With `I = $100`, dollars ≈ % gain.
- The app is **calculation + presentation of results only** — no candle chart in v1.
  Cross-check the price action on Binance directly. (Candle chart may be added later;
  the data pipeline already stores OHLC for it.)
- Aesthetic: minimalist "terminal". Geist Mono, pure black & white, no border-radius,
  no shadows, no gradients. Elements separated by 1px straight lines (Obsidian-like).

---

## 2. Architecture

```
/.github/workflows/fetch-data.yml   # daily cron: download + append + commit
/scripts/fetch.mjs                  # the fetcher (Node, no deps ideally)
/data/index.json                    # manifest: available months, first/last candle time
/data/ZECUSDT-1m-YYYY-MM.json       # one compact file per month (source of truth)
/index.html                         # UI shell
/style.css                          # terminal styling
/app.js                             # load data, draw charts, run backtest
/SPEC.md                            # this file
```

- The **cron** is the only thing that touches Binance.
- The **site** is fully static: `fetch()` of local JSON only.

---

## 3. Data pipeline

### 3.1 Source
Binance public data dump (no auth, no rate limit):

```
https://data.binance.vision/data/spot/daily/klines/ZECUSDT/1m/ZECUSDT-1m-YYYY-MM-DD.zip
```

Each ZIP contains one CSV. Kline CSV columns (we only keep 1–5):

```
openTime(ms), open, high, low, close, volume, closeTime, quoteVol, trades, ...
```

Monthly ZIPs also exist (`.../monthly/klines/...`) — use these for the initial
backfill, daily ZIPs for the incremental update.

### 3.2 Retention
Keep **6 months** rolling (delete month files older than that). A couple of months is
acceptable; 6 gives headroom. At 1m resolution this is roughly 4–6 MB total — fine for
Pages. Grids are not tight and missing a few trades is acceptable, so we may later
downsample to a coarser interval (e.g. 5m/15m) without changing any backtest logic —
**the interval is a data concern, the algorithm is interval-agnostic.** Ship 1m first.

### 3.3 Stored format (compact, columnar to save bytes)
`data/ZECUSDT-1m-2026-07.json`:
```json
{ "interval":"1m", "t0":1719792000000, "step":60000,
  "o":[...], "h":[...], "l":[...], "c":[...] }
```
- `t0` = openTime of first candle, `step` = ms between candles. Timestamps are implicit
  (`t0 + i*step`), which removes the largest column. Gaps (Binance downtime) are rare;
  if a gap occurs, start a new segment object in an array. Keep it simple: one segment
  per file, and if a gap is detected the fetcher logs it.
- Numbers stored as JSON numbers. (Optional later optimization: fixed-point strings.)

`data/index.json`:
```json
{ "symbol":"ZECUSDT", "interval":"1m",
  "months":["2026-02","2026-03","2026-04","2026-05","2026-06","2026-07"],
  "firstTime":..., "lastTime":... }
```

### 3.4 Cron behavior (`fetch-data.yml`)
- Schedule: daily (e.g. `0 2 * * *` UTC).
- Steps: determine yesterday's date → download daily ZIP → unzip → parse CSV → append
  candles to the current month file (create if new month) → prune files older than 6
  months → rewrite `index.json` → `git commit` + `git push` only if data changed.
- Idempotent: re-running the same day must not duplicate candles (dedupe by openTime).
- On first run (empty `/data`): backfill last 6 monthly ZIPs.
- Use `GITHUB_TOKEN` with `contents: write` permission; commit as a bot author.

---

## 4. Backtest math (the critical, frozen part)

**Model: spot geometric grid, grid-profit only, no floating PnL, no compounding.**

### 4.1 Grid construction (geometric — equal % spacing)
Given range `[Pmin, Pmax]` and grid count `N`:
- Ratio between adjacent lines: `r = (Pmax / Pmin) ^ (1/N)`  (same % step everywhere).
- Grid lines: `L_i = Pmin * r^i` for `i = 0..N`. So `L_0 = Pmin`, `L_N = Pmax`,
  and `L_{i+1} / L_i = r` for all `i`.
- There are `N+1` lines and `N` intervals. "Number of grids" = `N` (number of intervals),
  matching Binance's convention.

### 4.2 Capital allocation
- Fixed total investment `I` (default **$100**, so profit in $ ≈ % gain: $1 = 1%).
  Constant for the whole sweep so grid counts are comparable.
- Equal **quote value per interval**: `q = I / N`.
- An interval `i` buys at line `L_i` and sells at line `L_{i+1}`.
- Order quantity when buying interval `i`: `qty_i = q / L_i` (ZEC).

### 4.3 Fees
- Fee rate `f = 0.001` (0.1% per fill).
- A completed round trip = 1 buy fill + 1 sell fill.

### 4.4 Net profit per completed round trip — CONSTANT across intervals
Because geometric spacing gives every interval the same ratio `r`:
```
gross_i = qty_i * (L_{i+1} - L_i) = (q / L_i) * (L_i * r - L_i) = q * (r - 1)
fees_i  = f * ( qty_i * L_i + qty_i * L_{i+1} ) = f * ( q + q*r ) = f * q * (1 + r)
net     = q * (r - 1) - f * q * (1 + r) = q * [ (r - 1) - f * (1 + r) ]
```
`net` is identical for every interval `i` (it does not depend on `i`). Therefore:
```
q   = I / N
net = (I / N) * [ (r - 1) - f * (1 + r) ]
```
(If `net <= 0` the grid is too tight to overcome fees for this `N` — the plot will show
profit flattening/dropping as `N` grows. That crossover is exactly what we're finding.)

### 4.5 Simulation (per candle, using low & high)
State: `armed[i]` for each interval `i = 0..N-1`.
- `armed[i] = false` → waiting to **buy** at `L_i`.
- `armed[i] = true`  → holding, waiting to **sell** at `L_{i+1}`.

Initialize all `armed[i] = false` (must buy before it can sell — conservative, needs no
inventory/floating-PnL modeling).

For each candle `k` in the selected time window, in order, for each interval `i`:
```
if armed[i] == false and candle.low  <= L_i      → buy fill,  armed[i] = true
if armed[i] == true  and candle.high >= L_{i+1}  → sell fill, armed[i] = false,
                                                    totalProfit += net_i,  trips[i]++
```
- Both can fire within one candle (a dip to `L_i` then rise to `L_{i+1}`): that's one
  completed round trip in that candle. Evaluate buy-condition then sell-condition.
- Candles whose price is entirely outside `[Pmin,Pmax]` simply trigger nothing at the
  far lines (clamped by the conditions).
- This is intentionally a candle-resolution approximation: intra-candle path is unknown,
  so a single candle spanning several lines counts at most one buy + one sell per
  interval. Acceptable given "missing a few trades is fine".

### 4.6 Outputs
- `total_trips(N) = Σ_i trips_i` (sum of completed round trips across all intervals).
- `profit(N) = net * total_trips(N)` (since `net` is constant across intervals).
- Sweep `N` over `[Nmin..Nmax]` (default **2..150**, step 1) → array of `(N, profit)`
  → the profit plot.
- Report the argmax: optimal `N` and its profit `$`.

### 4.7 Complexity
`O(Nmax * candles)`. Worst case ~150 * ~260k (6 months 1m) ≈ 40M ops — runs in well
under a second in JS. If it ever feels slow, precompute per-candle low/high is already
the hot path; can early-skip candles outside `[Pmin,Pmax]`.

---

## 5. UI / UX

### 5.1 Layout (single page, stacked, separated by 1px lines)
```
─────────────────────────────────────────────
 ZEC/USDT GRID BACKTESTER            [terminal header]
─────────────────────────────────────────────
 INPUTS
   start [____]  end [____]
   min   [____]  max [____]
   [ RUN ]
─────────────────────────────────────────────
 PROFIT vs GRIDS        (line plot, x=N, y=$)
─────────────────────────────────────────────
 RESULT: optimal N = 42  →  $37.20  (37.2%)
─────────────────────────────────────────────
 data: 2026-02-01 … 2026-07-24   (from index.json)
─────────────────────────────────────────────
```

### 5.2 Inputs
- start/end: datetime, constrained to `[index.firstTime, index.lastTime]`.
- min/max: numeric price (the grid range; also the Pmin/Pmax used to build the grid).
- Validation: `0 < min < max`, `start < end`, within available data. Plain-text errors.

### 5.3 Profit chart
- Plain line/step plot. X axis = grid count `N`, Y axis = profit `$`. Mark the max point.
- Drawn in black on white, 1px strokes. No candle chart in v1 (see §1).

### 5.4 Styling rules (`style.css`)
- Font: **Geist Mono** (self-host the woff2 in `/fonts`, since the site makes no external
  calls — do not hotlink Google Fonts).
- Colors: `#000` and `#fff` only. Background white or black (pick one; propose **white bg,
  black text**, invertible later).
- `border-radius: 0` everywhere. No box-shadow, no gradients, 1px solid borders only.
- Separators are `border-top: 1px solid #000`.
- Charts drawn in black on white with 1px strokes, no anti-alias flourishes.

---

## 6. Non-goals (v1)
- No candle chart (cross-check price on Binance; data pipeline still stores OHLC for a
  later addition).
- No futures, no leverage, no neutral grids. Geometric spacing only (no arithmetic).
- No floating PnL / unrealized inventory valuation.
- No compounding, no reinvestment.
- No live prices, no websockets, no backend.
- No multi-symbol (ZEC/USDT only; symbol is a constant, easy to generalize later).

---

## 7. Implementation handoff notes
The following are mechanical given this spec and can be built by a cheaper/faster model:
1. `scripts/fetch.mjs` + `fetch-data.yml` (Section 3). Test locally by pointing at a
   couple of daily ZIP URLs.
2. `index.html` + `style.css` shell (Section 5).
3. `app.js`: `loadData()` → `runBacktest(candles, Pmin, Pmax, N)` implementing Section 4
   exactly → sweep `N` → draw the single profit-vs-grids chart + report optimal `N`.
4. Self-host Geist Mono woff2 under `/fonts`.

**Freeze point:** Section 4 is the contract. Do not "improve" the grid math during
implementation without updating this spec first — subtle changes silently alter results.
