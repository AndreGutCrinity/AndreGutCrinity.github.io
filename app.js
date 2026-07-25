'use strict';
// ZEC/USDT spot geometric grid backtester — client side only. See SPEC.md §4.
// No network calls except fetching the locally-committed data files.

const $ = id => document.getElementById(id);
const fmtDate = ms => new Date(ms).toISOString().slice(0, 16);        // UTC -> datetime-local
const parseDate = v => Date.parse(v.length === 16 ? v + ':00Z' : v + 'Z');

let DATA = null; // { t, h, l : Float64Array, n }

// ---------- load committed data ----------
async function loadData() {
  const idx = await (await fetch('data/index.json', { cache: 'no-cache' })).json();
  const months = idx.months || [];
  const parts = [];
  let n = 0;
  for (const ym of months) {
    const j = await (await fetch(`data/${idx.symbol}-${idx.interval}-${ym}.json`)).json();
    parts.push(j);
    n += j.c.length;
  }
  const t = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n);
  let k = 0;
  for (const j of parts) {
    for (let i = 0; i < j.c.length; i++) {
      t[k] = j.t0 + i * j.step;
      h[k] = j.h[i];
      l[k] = j.l[i];
      k++;
    }
  }
  DATA = { t, h, l, n, first: idx.firstTime, last: idx.lastTime };
  return idx;
}

// ---------- binary heap over Int32 (sign +1 = max-heap, -1 = min-heap on value) ----------
function makeHeap(sign, cap) {
  const a = new Int32Array(cap);
  let n = 0;
  const better = sign > 0 ? (x, y) => x > y : (x, y) => x < y;
  return {
    get size() { return n; },
    peek() { return a[0]; },
    push(v) {
      let i = n++; a[i] = v;
      while (i > 0) { const p = (i - 1) >> 1; if (better(a[i], a[p])) { const t = a[p]; a[p] = a[i]; a[i] = t; i = p; } else break; }
    },
    pop() {
      const top = a[0]; a[0] = a[--n]; let i = 0;
      for (;;) { let L = 2 * i + 1, R = L + 1, b = i;
        if (L < n && better(a[L], a[b])) b = L;
        if (R < n && better(a[R], a[b])) b = R;
        if (b === i) break; const t = a[b]; a[b] = a[i]; a[i] = t; i = b; }
      return top;
    },
    reset() { n = 0; },
  };
}

// ---------- backtest one grid count N over candle window [k0,k1] ----------
// Returns { N, trips, net, profit }. Matches SPEC §4 exactly (verified vs naive loop).
function backtest(k0, k1, Pmin, Pmax, N, I, f) {
  const r = Math.pow(Pmax / Pmin, 1 / N);
  const Lv = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) Lv[i] = Pmin * Math.pow(r, i);
  const buy = makeHeap(+1, N);   // armed=0 intervals; want largest i with Lv[i]  >= low
  const sell = makeHeap(-1, N);  // armed=1 intervals; want smallest i with Lv[i+1] <= high
  for (let i = 0; i < N; i++) buy.push(i);
  const H = DATA.h, L = DATA.l;
  let trips = 0;
  for (let k = k0; k <= k1; k++) {
    const cl = L[k], ch = H[k];
    while (buy.size && Lv[buy.peek()] >= cl) sell.push(buy.pop());          // buys
    while (sell.size && Lv[sell.peek() + 1] <= ch) { buy.push(sell.pop()); trips++; } // sells
  }
  const q = I / N;
  const net = q * ((r - 1) - f * (1 + r));
  return { N, trips, net, profit: net * trips };
}

// first index with t >= target
function lowerBound(t, target) {
  let lo = 0, hi = t.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < target) lo = m + 1; else hi = m; }
  return lo;
}

// ---------- run the sweep ----------
function run() {
  $('err').textContent = '';
  const start = parseDate($('start').value);
  const end = parseDate($('end').value);
  const Pmin = parseFloat($('min').value);
  const Pmax = parseFloat($('max').value);
  const I = parseFloat($('invest').value);
  const f = parseFloat($('fee').value) / 100;
  const maxN = Math.max(2, Math.floor(parseFloat($('maxgrids').value)));

  const fail = m => { $('err').textContent = m; };
  if (!(start < end)) return fail('start must be before end');
  if (!(Pmin > 0 && Pmax > Pmin)) return fail('need 0 < min < max');
  if (!(I > 0)) return fail('invest must be > 0');
  if (!(f >= 0)) return fail('fee must be >= 0');

  const k0 = lowerBound(DATA.t, start);
  let k1 = lowerBound(DATA.t, end) - 1;
  if (k1 >= DATA.n) k1 = DATA.n - 1;
  if (k0 > k1) return fail('no candles in that time window');

  // Warn (non-fatal) if the requested window extends beyond available data —
  // otherwise the backtest silently runs on a shorter span than asked for.
  const warns = [];
  if (start < DATA.first - 60000) warns.push(`start ${fmtDate(start)} precedes data (begins ${fmtDate(DATA.first)})`);
  if (end > DATA.last + 60000) warns.push(`end ${fmtDate(end)} exceeds data (ends ${fmtDate(DATA.last)})`);
  $('err').textContent = warns.join(' · ');

  const t0 = performance.now();
  const results = [];
  let best = null;
  for (let N = 2; N <= maxN; N++) {
    const res = backtest(k0, k1, Pmin, Pmax, N, I, f);
    results.push(res);
    if (!best || res.profit > best.profit) best = res;
  }
  const ms = Math.round(performance.now() - t0);

  drawPlot(results, best, I);
  const pct = (best.profit / I * 100);
  $('result').classList.remove('muted');
  $('result').innerHTML =
    `optimal grids: <b>${best.N}</b> &nbsp; profit: <b>$${best.profit.toFixed(2)}</b> ` +
    `(${pct.toFixed(2)}%) &nbsp; · ${best.trips} matched trades<br>` +
    `<span class="muted">analyzed ${fmtDate(DATA.t[k0])} … ${fmtDate(DATA.t[k1])} UTC ` +
    `· ${(k1 - k0 + 1).toLocaleString()} candles · sweep 2…${maxN} · ${ms} ms</span>`;
}

// ---------- plot: profit ($) vs grid count ----------
let PLOT = null; // stored state so the hover handler can remap + redraw

function drawPlot(results, best, I) {
  const cv = $('plot');
  const W = Math.round(cv.clientWidth || 900), Hh = 420;
  const padL = 62, padR = 16, padT = 16, padB = 34;
  const plotW = W - padL - padR, plotH = Hh - padT - padB;
  const xMin = results[0].N, xMax = results[results.length - 1].N;
  let yMax = Math.max(...results.map(r => r.profit));
  if (!(yMax > 0)) yMax = 1;            // all non-positive -> show empty 0..1
  yMax *= 1.08;                          // headroom; y always starts at 0
  PLOT = { results, best, I, W, Hh, padL, padR, padT, padB, plotW, plotH, xMin, xMax, yMax };
  drawBase();
}

function mapX(n) { return PLOT.padL + (n - PLOT.xMin) / (PLOT.xMax - PLOT.xMin || 1) * PLOT.plotW; }
function mapY(v) { return PLOT.padT + (1 - v / PLOT.yMax) * PLOT.plotH; }   // 0 at axis, never negative

function drawBase() {
  const p = PLOT, cv = $('plot');
  const dpr = window.devicePixelRatio || 1;
  cv.width = p.W * dpr; cv.height = p.Hh * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, p.W, p.Hh);
  ctx.strokeStyle = '#000'; ctx.fillStyle = '#000'; ctx.lineWidth = 1;
  ctx.font = "11px 'Geist Mono', monospace";

  // axes
  ctx.beginPath();
  ctx.moveTo(p.padL, p.padT); ctx.lineTo(p.padL, p.padT + p.plotH); ctx.lineTo(p.padL + p.plotW, p.padT + p.plotH);
  ctx.stroke();

  // y gridlines + ticks (0 .. yMax)
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const dec = p.yMax < 5 ? 2 : 1;
  for (let i = 0; i <= 5; i++) {
    const v = p.yMax * i / 5, y = mapY(v);
    ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.moveTo(p.padL, y); ctx.lineTo(p.padL + p.plotW, y); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillText('$' + v.toFixed(dec), p.padL - 6, y);
  }
  // x ticks
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const xstep = Math.max(1, Math.round((p.xMax - p.xMin) / 10));
  for (let n = p.xMin; n <= p.xMax; n += xstep) ctx.fillText(String(n), mapX(n), p.padT + p.plotH + 6);
  ctx.textAlign = 'left';
  ctx.fillText('GRIDS (N) →', p.padL, p.padT + p.plotH + 18);

  // profit line, clipped to the plot area (negative tails fall outside, never below 0)
  ctx.save();
  ctx.beginPath(); ctx.rect(p.padL, p.padT, p.plotW, p.plotH); ctx.clip();
  ctx.beginPath();
  p.results.forEach((r, i) => { const x = mapX(r.N), y = mapY(r.profit); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  // mark best
  const bx = mapX(p.best.N), by = mapY(p.best.profit);
  ctx.setLineDash([2, 3]); ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.moveTo(bx, p.padT); ctx.lineTo(bx, p.padT + p.plotH); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.fillRect(bx - 3, by - 3, 6, 6);
  ctx.restore();
}

function drawHover(mx) {
  if (!PLOT) return;
  const p = PLOT;
  drawBase();
  // nearest N to cursor
  const nRaw = p.xMin + (mx - p.padL) / (p.plotW || 1) * (p.xMax - p.xMin);
  const N = Math.max(p.xMin, Math.min(p.xMax, Math.round(nRaw)));
  const r = p.results[N - p.xMin];
  if (!r) return;
  const x = mapX(r.N), y = mapY(Math.max(0, r.profit));
  const ctx = $('plot').getContext('2d');
  ctx.strokeStyle = '#000'; ctx.fillStyle = '#000'; ctx.lineWidth = 1;

  // crosshair + point
  ctx.setLineDash([1, 2]);
  ctx.beginPath(); ctx.moveTo(x, p.padT); ctx.lineTo(x, p.padT + p.plotH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();

  // tooltip box
  const pct = (r.profit / p.I * 100);
  const lines = [`N = ${r.N}`, `$${r.profit.toFixed(2)}  (${pct.toFixed(2)}%)`, `${r.trips} matched`];
  ctx.font = "11px 'Geist Mono', monospace";
  const tw = Math.max(...lines.map(s => ctx.measureText(s).width)) + 14;
  const th = lines.length * 15 + 8;
  let tx = x + 10, ty = p.padT + 8;
  if (tx + tw > p.padL + p.plotW) tx = x - 10 - tw;
  ctx.fillStyle = '#fff'; ctx.fillRect(tx, ty, tw, th);
  ctx.strokeStyle = '#000'; ctx.strokeRect(tx, ty, tw, th);
  ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((s, i) => ctx.fillText(s, tx + 7, ty + 6 + i * 15));
}

// ---------- init ----------
(async function () {
  try {
    const idx = await loadData();
    // prefill
    $('start').value = fmtDate(idx.firstTime); $('start').min = fmtDate(idx.firstTime); $('start').max = fmtDate(idx.lastTime);
    $('end').value = fmtDate(idx.lastTime); $('end').min = fmtDate(idx.firstTime); $('end').max = fmtDate(idx.lastTime);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < DATA.n; i++) { if (DATA.l[i] < lo) lo = DATA.l[i]; if (DATA.h[i] > hi) hi = DATA.h[i]; }
    $('min').value = lo.toFixed(2);
    $('max').value = hi.toFixed(2);
    $('run').addEventListener('click', run);
    const cv = $('plot');
    cv.addEventListener('mousemove', e => drawHover(e.offsetX));
    cv.addEventListener('mouseleave', () => { if (PLOT) drawBase(); });
  } catch (e) {
    $('err').textContent = 'failed to load data: ' + e.message;
    console.error(e);
  }
})();
