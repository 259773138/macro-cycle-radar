#!/usr/bin/env node
/**
 * 宏观周期雷达 —— 数据采集脚本
 * 运行于 GitHub Actions（每日定时 / 手动触发），无浏览器 CORS 限制。
 *
 * 数据源：
 *  1) FRED（圣路易斯联储，免 Key）：fredgraph.csv —— 美债曲线/利差/失业率/CPI 等
 *  2) 东方财富数据中心（免密 JSON）：中国 PMI/M1/M2/CPI/PPI/工业增加值/GDP
 *
 * 输出：
 *  public/data/indicators.json —— 各指标近 24 个月序列 + 当前信号 + 数据截止日
 *  public/data/meta.json       —— 采集时间、各源状态、汇总
 *  失败指标自动沿用上一次成功数据（读取旧 indicators.json），保证网站永不缺数。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const OUT_IND = join(DATA_DIR, 'indicators.json');
const OUT_META = join(DATA_DIR, 'meta.json');

const UA = 'Mozilla/5.0';
const MONTHS = 24;

// ---------- 内置指标定义（与前端 src/lib/builtin.json 同源） ----------
const builtin = JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'builtin.json'), 'utf8'));
const autoList = builtin.filter((b) => b.auto);

// ---------- 工具 ----------
function monthOf(dateStr) {
  return dateStr.slice(0, 7); // 'YYYY-MM-DD' -> 'YYYY-MM'
}
function round(v, n = 3) {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return Math.round(v * 10 ** n) / 10 ** n;
}

// 日频/周频序列 → 月度（取每月最后一个有效观测）
function toMonthly(points) {
  const byMonth = new Map();
  for (const p of points) {
    const m = monthOf(p.date);
    if (p.value === null) continue;
    byMonth.set(m, { month: m, value: p.value });
  }
  const arr = [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  return arr.slice(-MONTHS);
}

function yoyOf(monthly) {
  return monthly.map((p, i) => {
    const base = monthly[i - 12];
    if (!base || base.value === 0) return { ...p, value: null };
    return { month: p.month, value: round(((p.value / base.value) - 1) * 100) };
  }).map((p, i, arr) => (p.value === null ? { month: p.month, value: null } : p)).filter((_, i) => i >= 12);
}

function spreadOf(a, b) {
  const mapB = new Map(b.map((p) => [p.month, p.value]));
  return a.map((p) => (mapB.has(p.month) ? { month: p.month, value: round(p.value - mapB.get(p.month)) } : { month: p.month, value: null }))
    .filter((p) => p.value !== null);
}

function signalOf(rec, better) {
  const pts = rec.monthly.filter((p) => p.value !== null);
  if (pts.length < 2) return 'flat';
  const d = pts[pts.length - 1].value - pts[pts.length - 2].value;
  if (Math.abs(d) < 1e-9) return 'flat';
  const good = better === 'high' ? d > 0 : d < 0;
  return good ? 'up' : 'down';
}

// ---------- 采集器 ----------
const FETCH_TIMEOUT = 25000;
async function httpGet(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  return res;
}

async function fetchFred(series) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`;
  const res = await httpGet(url);
  if (!res.ok) throw new Error(`FRED ${series} HTTP ${res.status}`);
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

async function fetchEm(reportName, pageSize = 60) {
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=${reportName}&columns=ALL&pageNumber=1&pageSize=${pageSize}&sortColumns=REPORT_DATE&sortTypes=-1`;
  const res = await httpGet(url, { Referer: 'https://data.eastmoney.com/' });
  if (!res.ok) throw new Error(`东财 ${reportName} HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success || !data?.result?.data) throw new Error(`东财 ${reportName} 返回异常`);
  return data.result.data;
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
    monthly = rows
      .map((r) => ({ month: monthOf(r.REPORT_DATE), value: parseFloat(r[a.field]) }))
      .filter((p) => !Number.isNaN(p.value))
      .reverse()
      .slice(-MONTHS);
  } else if (a.kind === 'emDerive') {
    const rows = await fetchEm(a.reportName);
    monthly = rows
      .map((r) => ({ month: monthOf(r.REPORT_DATE), value: round(parseFloat(r[a.fieldA]) - parseFloat(r[a.fieldB])) }))
      .filter((p) => !Number.isNaN(p.value))
      .reverse()
      .slice(-MONTHS);
  } else {
    throw new Error(`未知采集类型 ${a.kind}`);
  }
  monthly = monthly.filter((p) => p.value !== null);
  if (monthly.length < 2) throw new Error('月度序列过短');
  return {
    id: meta.id,
    name: meta.name,
    region: meta.region,
    layer: meta.layer,
    type: meta.type,
    unit: meta.unit,
    better: meta.better,
    watch: meta.watch,
    meaning: meta.meaning,
    limit: meta.limit,
    auto: true,
    source: a.kind === 'fred' ? 'FRED' : '东方财富',
    monthly,
    signal: signalOf({ monthly }, meta.better),
    updatedAt: monthly[monthly.length - 1].month,
  };
}

// ---------- 主流程 ----------
async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const sources = { fred: { name: 'FRED（圣路易斯联储）', status: 'ok', count: 0, message: '' }, em: { name: '东方财富数据中心', status: 'ok', count: 0, message: '' } };
  const failed = [];

  // 旧数据（用于失败沿用）
  let oldMap = new Map();
  try {
    const old = JSON.parse(readFileSync(OUT_IND, 'utf8'));
    for (const rec of old.indicators || []) oldMap.set(rec.id, rec);
  } catch { /* 首次运行无旧数据 */ }

  const results = [];
  // 串行+限速，避免触发风控
  let idx = 0;
  for (const meta of autoList) {
    idx++;
    const srcKey = meta.auto.kind === 'em' || meta.auto.kind === 'emDerive' ? 'em' : 'fred';
    try {
      const rec = await processIndicator(meta);
      results.push(rec);
      sources[srcKey].count++;
      console.log(`   [${idx}/${autoList.length}] ✅ ${meta.id}`);
    } catch (e) {
      const old = oldMap.get(meta.id);
      if (old) {
        results.push({ ...old, stale: true });
        failed.push({ id: meta.id, name: meta.name, error: String(e.message || e).slice(0, 120), reused: true });
      } else {
        failed.push({ id: meta.id, name: meta.name, error: String(e.message || e).slice(0, 120), reused: false });
      }
      if (sources[srcKey].status === 'ok') sources[srcKey].status = 'partial';
      console.log(`   [${idx}/${autoList.length}] ❌ ${meta.id}: ${String(e.message || e).slice(0, 100)}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!results.length) {
    console.error('全部数据源失败，保留旧数据，退出。');
    process.exit(1);
  }

  const payload = {
    updatedAt: startedAt,
    indicators: results,
  };
  writeFileSync(OUT_IND, JSON.stringify(payload, null, 2));

  const meta = {
    fetchedAt: startedAt,
    sources: Object.values(sources),
    autoCount: results.filter((r) => !r.stale).length,
    staleCount: results.filter((r) => r.stale).length,
    failed,
    note: failed.length ? `部分指标采集失败，已沿用最近一次成功数据。` : '全部指标采集成功。',
  };
  writeFileSync(OUT_META, JSON.stringify(meta, null, 2));

  console.log(`✅ 采集完成：成功 ${meta.autoCount}，沿用旧值 ${meta.staleCount}，失败 ${failed.length}`);
  for (const f of failed) console.log(`   ⚠️ ${f.name}: ${f.error}${f.reused ? '（沿用旧值）' : '（无旧值）'}`);
  if (process.env.DEBUG_DATA) {
    const first = results.slice(0, 6).map((r) => `${r.id}=${r.monthly[r.monthly.length - 1].value}(${r.signal})`);
    console.log('   样例：' + first.join('  '));
  }
}

main().catch((e) => {
  console.error('采集脚本异常：', e);
  process.exit(1);
});
