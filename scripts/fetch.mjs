// ZEC/USDT 1m candle fetcher for the grid backtester.
// Downloads Binance public data-dump ZIPs (no auth, no rate limit) and stores
// compact columnar monthly JSON. See SPEC.md §3.
//
// Usage:
//   node scripts/fetch.mjs            # auto: backfill if empty, else incremental
//   node scripts/fetch.mjs --backfill 6
//
// No external dependencies. Node 18+ (global fetch). Minimal built-in unzip.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SYMBOL = 'ZECUSDT';
const INTERVAL = '1m';
const STEP = 60_000;              // ms per 1m candle
const KEEP_MONTHS = 6;            // rolling retention
const BASE = 'https://data.binance.vision/data/spot';
const DATA_DIR = path.resolve('data');

// ---------- minimal single-file ZIP extractor ----------
function unzipSingle(buf) {
  // locate End Of Central Directory (0x06054b50), scanning from the end
  let eocd = buf.length - 22;
  for (; eocd >= 0; eocd--) if (buf.readUInt32LE(eocd) === 0x06054b50) break;
  if (eocd < 0) throw new Error('ZIP: EOCD not found');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('ZIP: bad central dir');
  const method = buf.readUInt16LE(cd + 10);
  const compSize = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('ZIP: bad local header');
  const fnLen = buf.readUInt16LE(local + 26);
  const exLen = buf.readUInt16LE(local + 28);
  const start = local + 30 + fnLen + exLen;
  const comp = buf.subarray(start, start + compSize);
  return method === 0 ? comp : zlib.inflateRawSync(comp);
}

// ---------- download ----------
async function download(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;               // not published yet / no data
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function dailyUrl(dateStr) {
  return `${BASE}/daily/klines/${SYMBOL}/${INTERVAL}/${SYMBOL}-${INTERVAL}-${dateStr}.zip`;
}
function monthlyUrl(ym) {
  return `${BASE}/monthly/klines/${SYMBOL}/${INTERVAL}/${SYMBOL}-${INTERVAL}-${ym}.zip`;
}

// ---------- CSV parse ----------
// Returns array of {t, o, h, l, c} with t normalized to ms.
function parseCsv(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const f = line.split(',');
    let ts = Number(f[0]);
    if (!Number.isFinite(ts)) continue;              // header row
    if (ts > 1e14) ts = Math.floor(ts / 1000);       // µs -> ms (Binance switched in 2025)
    out.push({ t: ts, o: +f[1], h: +f[2], l: +f[3], c: +f[4] });
  }
  return out;
}

// ---------- month file I/O (contiguous, gap-filled) ----------
function monthPath(ym) {
  return path.join(DATA_DIR, `${SYMBOL}-${INTERVAL}-${ym}.json`);
}
function ymOf(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function loadMonth(ym) {
  const p = monthPath(ym);
  if (!fs.existsSync(p)) return new Map();
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const m = new Map();
  for (let i = 0; i < j.c.length; i++) {
    const t = j.t0 + i * j.step;
    m.set(t, { t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i] });
  }
  return m;
}
function writeMonth(ym, map) {
  if (map.size === 0) return;
  const times = [...map.keys()].sort((a, b) => a - b);
  const t0 = times[0];
  const tEnd = times[times.length - 1];
  const o = [], h = [], l = [], c = [];
  let prevClose = map.get(t0).c;
  let gaps = 0;
  for (let t = t0; t <= tEnd; t += STEP) {
    const cd = map.get(t);
    if (cd) {
      o.push(cd.o); h.push(cd.h); l.push(cd.l); c.push(cd.c);
      prevClose = cd.c;
    } else {
      // gap-fill with a flat candle (triggers no grid crossings; keeps index contiguous)
      o.push(prevClose); h.push(prevClose); l.push(prevClose); c.push(prevClose);
      gaps++;
    }
  }
  fs.writeFileSync(monthPath(ym), JSON.stringify({
    symbol: SYMBOL, interval: INTERVAL, t0, step: STEP, o, h, l, c,
  }));
  if (gaps) console.log(`  ${ym}: filled ${gaps} gap candle(s)`);
}

// Merge freshly parsed candles (any months) into their month files.
function mergeCandles(candles) {
  const byMonth = new Map();
  for (const cd of candles) {
    const ym = ymOf(cd.t);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(cd);
  }
  for (const [ym, list] of byMonth) {
    const map = loadMonth(ym);
    for (const cd of list) map.set(cd.t, cd);         // dedupe by openTime
    writeMonth(ym, map);
    console.log(`  wrote ${ym} (${map.size} candles)`);
  }
}

// ---------- index + prune ----------
function existingMonths() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .map(f => f.match(new RegExp(`^${SYMBOL}-${INTERVAL}-(\\d{4}-\\d{2})\\.json$`)))
    .filter(Boolean).map(m => m[1]).sort();
}
function pruneOld() {
  const months = existingMonths();
  const drop = months.slice(0, Math.max(0, months.length - KEEP_MONTHS));
  for (const ym of drop) {
    fs.unlinkSync(monthPath(ym));
    console.log(`  pruned ${ym}`);
  }
}
function rebuildIndex() {
  const months = existingMonths();
  let firstTime = null, lastTime = null;
  for (const ym of months) {
    const j = JSON.parse(fs.readFileSync(monthPath(ym), 'utf8'));
    const start = j.t0;
    const end = j.t0 + (j.c.length - 1) * j.step;
    if (firstTime === null || start < firstTime) firstTime = start;
    if (lastTime === null || end > lastTime) lastTime = end;
  }
  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify({
    symbol: SYMBOL, interval: INTERVAL, months, firstTime, lastTime,
  }, null, 0));
  console.log(`  index: ${months.length} months, ${firstTime} .. ${lastTime}`);
}

// ---------- date helpers (UTC) ----------
function ymd(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function lastNMonths(n) {
  const out = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out.reverse();
}

// Download + merge one ZIP. Returns true if ingested, false on 404.
async function tryIngest(url, label) {
  const buf = await download(url);
  if (!buf) return false;
  const candles = parseCsv(unzipSingle(buf).toString('utf8'));
  mergeCandles(candles);
  console.log(`  ingested ${label}: ${candles.length} candles`);
  return true;
}

// Every day (UTC midnight) of month `ym`, from the 1st up to and including `maxDay`.
function daysOfMonthUpTo(ym, maxDay) {
  const [y, m] = ym.split('-').map(Number);
  const out = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCMonth() === m - 1 && d <= maxDay) {
    out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Ingest one month: prefer the single monthly ZIP; if it isn't published yet
// (current month) fall back to fetching EVERY daily file up to `yest`.
async function ingestMonth(ym, yest) {
  try {
    if (await tryIngest(monthlyUrl(ym), `monthly ${ym}`)) return;
  } catch (e) { console.log(`  monthly ${ym} failed: ${e.message}`); }
  console.log(`  no monthly ${ym} yet -> daily-filling`);
  for (const d of daysOfMonthUpTo(ym, yest)) {
    try { await tryIngest(dailyUrl(ymd(d)), `daily ${ymd(d)}`); }
    catch (e) { console.log(`  daily ${ymd(d)} failed: ${e.message}`); }
  }
}

// Fetch daily files for every day in [from, to] inclusive (UTC).
async function ingestDailyRange(from, to, label) {
  console.log(`${label}: ${ymd(from)} .. ${ymd(to)}`);
  const d = new Date(from);
  while (d <= to) {
    try { await tryIngest(dailyUrl(ymd(d)), `daily ${ymd(d)}`); }
    catch (e) { console.log(`  daily ${ymd(d)} failed: ${e.message}`); }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const backfillIdx = args.indexOf('--backfill');
  const indexPath = path.join(DATA_DIR, 'index.json');
  const indexExists = fs.existsSync(indexPath);

  // "yesterday" (UTC midnight) — the newest daily file Binance is guaranteed to have.
  const yest = new Date(); yest.setUTCHours(0, 0, 0, 0); yest.setUTCDate(yest.getUTCDate() - 1);

  if (backfillIdx !== -1 || !indexExists) {
    const n = backfillIdx !== -1 ? Number(args[backfillIdx + 1] || KEEP_MONTHS) : KEEP_MONTHS;
    console.log(`Backfill: last ${n} month(s) (monthly ZIP, or full daily fill if unpublished)`);
    for (const ym of lastNMonths(n)) await ingestMonth(ym, yest);
  } else {
    // Regular cron: self-heal any gap since the last committed candle up to yesterday.
    const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    let from;
    if (idx.lastTime) {
      from = new Date(idx.lastTime); from.setUTCHours(0, 0, 0, 0);
      from.setUTCDate(from.getUTCDate() + 1);          // day after last coverage
    } else {
      from = new Date(yest); from.setUTCDate(from.getUTCDate() - 3);
    }
    if (from <= yest) await ingestDailyRange(from, yest, 'Incremental');
    else console.log('Already up to date.');
  }

  pruneOld();
  rebuildIndex();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
