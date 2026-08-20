#!/usr/bin/env node
/**
 * 宏观周期雷达 —— 数据采集脚本 v2
 * 数据源：
 *  FRED（fredgraph.csv）｜东方财富 datacenter-web ｜东方财富行情 push2his
 *  ｜国家统计局 esData｜商务部 mofcom｜新浪外盘
 * 输出：public/data/indicators.json / meta.json / history.json（累计快照，供复盘对比）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const OUT_IND = join(DATA_DIR, 'indicators.json');
const OUT_META = join(DATA_DIR, 'meta.json');
const OUT_HISTORY = join(DATA_DIR, 'history.json');

const UA = 'Mozilla/5.0';
const MONTHS = 24;
const HISTORY_KEEP = 40;

const builtin = JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'builtin.json'), 'utf8'));
const autoList = builtin.filter((b) => b.auto);

// ---------- 工具 ----------
function monthOf(dateStr) { return dateStr.slice(0, 7); }
function round(v, n = 3) {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return Math.round(v * 10 ** n) / 10 ** n;
}
function toMonthly(points, mode = 'last') {
  const byMonth = new Map();
  for (const p of points) {
    const m = monthOf(p.date);
    if (p.value === null || p.value === undefined) continue;
    byMonth.set(m, { month: m, value: p.value });
  }
  return [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1)).slice(-MONTHS);
}
function yoyOf(monthly) {
  return monthly
    .map((p, i) => {
      const base = monthly[i - 12];
      if (!base || base.value === 0 || p.value === null) return { month: p.month, value: null };
      return { month: p.month, value: round(((p.value / base.value) - 1) * 100) };
    })
    .filter((p) => p.value !== null);
}
function spreadOf(a, b) {
  const mapB = new Map(b.map((p) => [p.month, p.value]));
  return a.map((p) => (mapB.has(p.month) ? { month: p.month, value: round(p.value - mapB.get(p.month)) } : null))
    .filter((p) => p !== null);
}
function signalOf(monthly, better) {
  const pts = monthly.filter((p) => p.value !== null);
  if (pts.length < 2) return 'flat';
  const d = pts[pts.length - 1].value - pts[pts.length - 2].value;
  if (Math.abs(d) < 1e-9) return 'flat';
  const good = better === 'high' ? d > 0 : d < 0;
  return good ? 'up' : 'down';
}
function freqOf(meta) {
  if (meta.freq) return meta.freq;
  return 'm';
}

// ---------- 采集器 ----------
const FETCH_TIMEOUT = 25000;
async function httpGet(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}
async function httpPost(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': UA, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function fetchFred(series) {
  const res = await httpGet(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, val] = lines[i].split(',');
    if (!date || val === undefined || val === '' || val === '.') continue;
    const v = parseFloat(val);
    if (Number.isNaN(v)) continue;
    points.push({ date, value: v });
  }
  if (!points.length) throw new Error(`FRED ${series} 无数据`);
  return points;
}

async function fetchEm(reportName, extra = {}, pageSize = 80) {
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=${reportName}&columns=ALL&pageNumber=1&pageSize=${pageSize}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;
  const res = await httpGet(url, { Referer: 'https://data.eastmoney.com/' });
  const data = await res.json();
  if (!data?.success || !data?.result?.data) throw new Error(`东财 ${reportName} 返回异常`);
  return data.result.data;
}

async function fetchEmRate(meta) {
  const { field } = meta.auto;
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_RATE&columns=ALL&sortColumns=TRADE_DATE&sortTypes=-1&token=894050c76af8597a853f5b408b759f5d&pageNumber=1&pageSize=80`;
  const res = await httpGet(url, { Referer: 'https://data.eastmoney.com/' });
  const data = await res.json();
  if (!data?.success || !data?.result?.data) throw new Error('LPR 接口异常');
  return data.result.data
    .map((r) => ({ month: monthOf(r.TRADE_DATE), value: parseFloat(r[field]) }))
    .filter((p) => !Number.isNaN(p.value) && p.value > 0)
    .reverse()
    .slice(-MONTHS);
}

async function fetchEmInd(meta) {
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=REPORT_DATE&sortTypes=-1&pageSize=80&pageNumber=1&reportName=RPT_INDUSTRY_INDEX&columns=REPORT_DATE,INDICATOR_VALUE&filter=(INDICATOR_ID%3D%22EMM00121987%22)&source=WEB&client=WEB`;
  const res = await httpGet(url, { Referer: 'https://data.eastmoney.com/' });
  const data = await res.json();
  if (!data?.success || !data?.result?.data) throw new Error('国房景气接口异常');
  return data.result.data
    .map((r) => ({ month: monthOf(r.REPORT_DATE), value: parseFloat(r.INDICATOR_VALUE) }))
    .filter((p) => !Number.isNaN(p.value))
    .reverse()
    .slice(-MONTHS);
}

async function fetchEmCity(meta) {
  const { reportName, field, city } = meta.auto;
  const filter = encodeURIComponent(`(CITY in ("${city}"))`);
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?columns=REPORT_DATE,${field}&pageNumber=1&pageSize=80&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB&reportName=${reportName}&filter=${filter}`;
  const res = await httpGet(url, { Referer: 'https://data.eastmoney.com/' });
  const data = await res.json();
  if (!data?.success || !data?.result?.data) throw new Error(`东财 ${reportName} 返回异常`);
  return data.result.data
    .map((r) => ({ month: monthOf(r.REPORT_DATE), value: parseFloat(r[field]) }))
    .filter((p) => !Number.isNaN(p.value))
    .reverse()
    .slice(-MONTHS);
}

async function fetchStats(meta) {
  const url = 'https://data.stats.gov.cn/dg/website/publicrelease/web/external/stream/esData';
  const res = await httpPost(url, {
    cid: 'ee3b7046b390415b9b7745e3d16f6052',
    indicatorIds: ['3888eac6062945a79c8a27e5f13d4953'],
    daCatalogId: '',
    das: [{ text: '全国', value: '000000000000' }],
    dts: ['202401MM-203601MM'],
    showType: '1',
    rootId: 'fc982599aa684be7969d7b90b1bd0e84',
  }, {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    Origin: 'https://data.stats.gov.cn',
    Referer: 'https://data.stats.gov.cn/dg/website/page.html',
  });
  const data = await res.json();
  const rows = [];
  for (const m of data?.data || []) {
    const y = m.name.split('年')[0];
    const mo = String(parseInt(m.name.split('年')[1]?.replace('月', '') || '0')).padStart(2, '0');
    for (const v of m.values || []) {
      if (v._name === '城镇调查失业率' && v.value !== '' && v.value != null) {
        rows.push({ month: `${y}-${mo}`, value: parseFloat(v.value) });
      }
    }
  }
  if (!rows.length) throw new Error('统计局失业率无数据');
  rows.sort((a, b) => (a.month < b.month ? -1 : 1));
  return rows.slice(-MONTHS);
}

async function fetchMofcom(meta) {
  const res = await httpPost('https://data.mofcom.gov.cn/datamofcom/front/gnmy/shrzgmQuery', '{}', {
    'Content-Type': 'application/json',
  });
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new Error('商务部社融无数据');
  return data
    .map((r) => ({ month: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}`, value: parseFloat(r.tiosfs) }))
    .filter((p) => !Number.isNaN(p.value))
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .slice(-MONTHS);
}

async function fetchSinaKline(meta) {
  const { symbol } = meta.auto;
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=240&ma=no&datalen=1023`;
  const res = await httpGet(url, { Referer: 'https://finance.sina.com.cn' });
  const text = await res.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data) || !data.length) throw new Error(`新浪行情 ${symbol} 无数据`);
  const points = data.map((k) => ({ date: k.day, value: parseFloat(k.close) })).filter((p) => !Number.isNaN(p.value));
  return toMonthly(points).slice(-MONTHS);
}

// ---------- 指标处理 ----------
async function processIndicator(meta) {
  const a = meta.auto;
  let monthly;
  if (a.kind === 'fred') {
    if (a.transform === 'spread') {
      const [pa, pb] = await Promise.all([fetchFred(a.seriesA), fetchFred(a.seriesB)]);
      monthly = spreadOf(toMonthly(pa), toMonthly(pb));
    } else {
      const pts = await fetchFred(a.series);
      monthly = toMonthly(pts);
      if (a.transform === 'yoy') monthly = yoyOf(monthly);
    }
  } else if (a.kind === 'em') {
    const rows = await fetchEm(a.reportName);
    monthly = rows.map((r) => ({ month: monthOf(r.REPORT_DATE), value: parseFloat(r[a.field]) }))
      .filter((p) => !Number.isNaN(p.value)).reverse().slice(-MONTHS);
  } else if (a.kind === 'emDerive') {
    const rows = await fetchEm(a.reportName);
    monthly = rows.map((r) => ({ month: monthOf(r.REPORT_DATE), value: round(parseFloat(r[a.fieldA]) - parseFloat(r[a.fieldB])) }))
      .filter((p) => !Number.isNaN(p.value)).reverse().slice(-MONTHS);
  } else if (a.kind === 'emRate') monthly = await fetchEmRate(meta);
  else if (a.kind === 'emInd') monthly = await fetchEmInd(meta);
  else if (a.kind === 'emCity') monthly = await fetchEmCity(meta);
  else if (a.kind === 'stats') monthly = await fetchStats(meta);
  else if (a.kind === 'mofcom') monthly = await fetchMofcom(meta);
  else if (a.kind === 'kline') monthly = await fetchKline(meta);
  else if (a.kind === 'sinaKline') monthly = await fetchSinaKline(meta);
  else throw new Error(`未知采集类型 ${a.kind}`);

  monthly = monthly.filter((p) => p.value !== null && p.value !== undefined);
  if (monthly.length < 2) throw new Error('月度序列过短');
  const srcName = a.kind === 'fred' ? 'FRED' : a.kind === 'kline' || a.kind === 'sinaKline' ? '新浪财经行情' : a.kind === 'stats' ? '国家统计局' : a.kind === 'mofcom' ? '商务部' : '东方财富';
  return {
    id: meta.id, name: meta.name, region: meta.region, layer: meta.layer, type: meta.type,
    unit: meta.unit, better: meta.better, watch: meta.watch, meaning: meta.meaning, limit: meta.limit,
    freq: freqOf(meta), lag: meta.lag ?? null,
    auto: true, source: srcName,
    monthly, signal: signalOf(monthly, meta.better), updatedAt: monthly[monthly.length - 1].month,
  };
}

// ---------- 主流程 ----------
async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const sources = {};
  const failed = [];

  let oldMap = new Map();
  try {
    const old = JSON.parse(readFileSync(OUT_IND, 'utf8'));
    for (const rec of old.indicators || []) oldMap.set(rec.id, rec);
  } catch { /* 首次运行 */ }

  const results = [];
  let idx = 0;
  for (const meta of autoList) {
    idx++;
    const srcKey = meta.auto.kind === 'fred' ? 'FRED（圣路易斯联储）' : meta.auto.kind === 'sinaKline' ? '新浪财经行情' : meta.auto.kind === 'stats' ? '国家统计局' : meta.auto.kind === 'mofcom' ? '商务部' : '东方财富数据中心';
    try {
      const rec = await processIndicator(meta);
      results.push(rec);
      sources[srcKey] = (sources[srcKey] || 0) + 1;
      console.log(`   [${idx}/${autoList.length}] ✅ ${meta.id}`);
    } catch (e) {
      const old = oldMap.get(meta.id);
      if (old) {
        results.push({ ...old, stale: true });
        failed.push({ id: meta.id, name: meta.name, error: String(e.message || e).slice(0, 120), reused: true });
      } else {
        failed.push({ id: meta.id, name: meta.name, error: String(e.message || e).slice(0, 120), reused: false });
      }
      console.log(`   [${idx}/${autoList.length}] ❌ ${meta.id}: ${String(e.message || e).slice(0, 100)}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!results.length) { console.error('全部数据源失败，保留旧数据，退出。'); process.exit(1); }

  const payload = { updatedAt: startedAt, indicators: results };
  writeFileSync(OUT_IND, JSON.stringify(payload, null, 2));

  // 累计历史快照（供复盘对比 / 数据源登记页成功率）
  let history = [];
  try { history = JSON.parse(readFileSync(OUT_HISTORY, 'utf8')); } catch { /* 首次 */ }
  const summary = {
    date: startedAt.slice(0, 10),
    fetchedAt: startedAt,
    autoCount: results.filter((r) => !r.stale).length,
    staleCount: results.filter((r) => r.stale).length,
    failedIds: failed.map((f) => f.id),
    diffusion: { leading: 0, coincident: 0, lagging: 0, total: 0 },
    signals: {},
  };
  for (const r of results) {
    summary.signals[r.id] = r.signal;
    if (r.type === 'leading') summary.diffusion.leading += r.signal === 'up' ? 1 : r.signal === 'down' ? -1 : 0;
    if (r.type === 'coincident') summary.diffusion.coincident += r.signal === 'up' ? 1 : r.signal === 'down' ? -1 : 0;
    if (r.type === 'lagging') summary.diffusion.lagging += r.signal === 'up' ? 1 : r.signal === 'down' ? -1 : 0;
  }
  summary.diffusion.total = summary.diffusion.leading + summary.diffusion.coincident + summary.diffusion.lagging;
  history = [summary, ...history.filter((h) => h.date !== summary.date)].slice(0, HISTORY_KEEP);
  writeFileSync(OUT_HISTORY, JSON.stringify(history, null, 2));

  const meta = {
    fetchedAt: startedAt,
    sources: Object.entries(sources).map(([name, count]) => ({ name, status: 'ok', count })),
    autoCount: summary.autoCount,
    staleCount: summary.staleCount,
    failed,
    note: failed.length ? '部分指标采集失败，已沿用最近一次成功数据。' : '全部指标采集成功。',
  };
  writeFileSync(OUT_META, JSON.stringify(meta, null, 2));

  console.log(`✅ 采集完成：成功 ${meta.autoCount}，沿用旧值 ${meta.staleCount}，失败 ${failed.length}`);
  for (const f of failed) console.log(`   ⚠️ ${f.name}: ${f.error}${f.reused ? '（沿用旧值）' : '（无旧值）'}`);
}

main().catch((e) => { console.error('采集脚本异常：', e); process.exit(1); });
