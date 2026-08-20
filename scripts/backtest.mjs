#!/usr/bin/env node
/**
 * 三档协议历史回测（P1-2，借鉴 actuallyfin/recession-timing-dashboard）
 * 规则：把「观察/预警/确认」三档转成仓位，回测 vs 买入持有（SP500）。
 *  - 领先信号（月度，用 t-1 月信号决定 t 月仓位，避免未来函数）：
 *      ① 2s10s 倒挂  ② 初请失业金 3月均值同比上升  ③ 新屋开工 3月均值同比下滑  ④ 库存/销售比 3月均值同比上升
 *  - 同步信号：⑤ 工业产出 3月均值环比下滑  ⑥ 非农 3月均值环比下滑
 *  - 档位：badLead>=3 且任一同步恶化 → 确认(股票20%)；badLead>=3 → 预警(股票50%)；badLead>=2 且同步恶化 → 预警；否则 观察(100%)
 * 输出：public/data/backtest.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const OUT = join(DATA_DIR, 'backtest.json');
const UA = 'Mozilla/5.0';

async function fred(series) {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`FRED ${series} HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const pts = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, val] = lines[i].split(',');
    if (!date || val === '' || val === '.') continue;
    const v = parseFloat(val);
    if (!Number.isNaN(v)) pts.push({ date, value: v });
  }
  return pts;
}

function toMonthly(points) {
  const byMonth = new Map();
  for (const p of points) {
    const m = p.date.slice(0, 7);
    byMonth.set(m, p.value);
  }
  return [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function avg3(m, i, arr) {
  if (i < 2) return null;
  return (arr[i][1] + arr[i - 1][1] + arr[i - 2][1]) / 3;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  // 用 Wilshire 5000 全市场指数（FRED 免 Key 提供 1970 年起完整历史；SP500 免费 CSV 仅 10 年）
  const [sp500Pts, t10y2yPts, icsaPts, houstPts, isratioPts, indproPts, payemsPts] = await Promise.all([
    fred('NASDAQCOM'), fred('T10Y2Y'), fred('ICSA'), fred('HOUST'), fred('ISRATIO'), fred('INDPRO'), fred('PAYEMS'),
  ]);
  const sp500 = toMonthly(sp500Pts);
  const t10y2y = toMonthly(t10y2yPts);
  const icsa = toMonthly(icsaPts);
  const houst = toMonthly(houstPts);
  const isratio = toMonthly(isratioPts);
  const indpro = toMonthly(indproPts);
  const payems = toMonthly(payemsPts);

  // 对齐月份（1992 年起，ISRATIO 最早 1992）
  const start = '1992-01';
  const months = sp500.filter(([m]) => m >= start).map(([m]) => m);
  const mapOf = (arr) => new Map(arr);

  const sigSeries = new Map(); // month -> {badLead, confirm}
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const idxMap = {
      t10y2y: t10y2y.findIndex(([x]) => x === m),
      icsa: icsa.findIndex(([x]) => x === m),
      houst: houst.findIndex(([x]) => x === m),
      isratio: isratio.findIndex(([x]) => x === m),
      indpro: indpro.findIndex(([x]) => x === m),
      payems: payems.findIndex(([x]) => x === m),
    };
    if (Object.values(idxMap).some((x) => x < 0)) { sigSeries.set(m, null); continue; }

    const inverted = t10y2y[idxMap.t10y2y][1] < 0;
    const claimsUp = avg3(icsa, idxMap.icsa, icsa) !== null && icsa[idxMap.icsa][1] > icsa[Math.max(idxMap.icsa - 12, 0)][1] * 1.05;
    const housingDn = avg3(houst, idxMap.houst, houst) !== null && avg3(houst, idxMap.houst, houst) < avg3(houst, Math.max(idxMap.houst - 12, 2), houst) * 0.9;
    const invSalesUp = avg3(isratio, idxMap.isratio, isratio) !== null && isratio[idxMap.isratio][1] > isratio[Math.max(idxMap.isratio - 12, 0)][1];
    const indproDn = avg3(indpro, idxMap.indpro, indpro) !== null && avg3(indpro, idxMap.indpro, indpro) < avg3(indpro, Math.max(idxMap.indpro - 6, 2), indpro);
    const payemsDn = avg3(payems, idxMap.payems, payems) !== null && avg3(payems, idxMap.payems, payems) < avg3(payems, Math.max(idxMap.payems - 6, 2), payems);

    const badLead = (inverted ? 1 : 0) + (claimsUp ? 1 : 0) + (housingDn ? 1 : 0) + (invSalesUp ? 1 : 0);
    const syncBad = (indproDn ? 1 : 0) + (payemsDn ? 1 : 0);
    let tier = 'watch', weight = 1;
    if (badLead >= 3 && syncBad >= 1) { tier = 'confirm'; weight = 0.2; }
    else if (badLead >= 3 || (badLead >= 2 && syncBad >= 1)) { tier = 'warn'; weight = 0.5; }
    sigSeries.set(m, { badLead, syncBad, tier, weight, inverted, claimsUp, housingDn, invSalesUp, indproDn, payemsDn });
  }

  const sp500Map = new Map(sp500);
  let eq = 1, bh = 1;
  const rows = [];
  let prevWeight = 1, prevTier = 'watch';
  for (let i = 1; i < months.length; i++) {
    const m = months[i];
    const prevM = months[i - 1];
    const prevSig = sigSeries.get(prevM);
    if (prevSig) { prevWeight = prevSig.weight; prevTier = prevSig.tier; }
    const p0 = sp500Map.get(prevM), p1 = sp500Map.get(m);
    if (p0 === undefined || p1 === undefined) continue;
    const ret = p1 / p0 - 1;
    bh *= 1 + ret;
    eq *= 1 + ret * prevWeight;
    rows.push({
      month: m, weight: prevWeight, tier: prevTier,
      strategy: Math.round(eq * 100) / 100, buyhold: Math.round(bh * 100) / 100,
      ret: Math.round(ret * 10000) / 100,
    });
  }

  // 统计
  const n = rows.length;
  const years = n / 12;
  const eqFinal = rows[n - 1]?.strategy ?? 1;
  const bhFinal = rows[n - 1]?.buyhold ?? 1;
  const eqCagr = Math.round((Math.pow(eqFinal, 1 / years) - 1) * 10000) / 100;
  const bhCagr = Math.round((Math.pow(bhFinal, 1 / years) - 1) * 10000) / 100;
  const eqSeries = [1, ...rows.map((r) => r.strategy)];
  const bhSeries = [1, ...rows.map((r) => r.buyhold)];
  function maxDrawdown(series) {
    let peak = -Infinity, mdd = 0;
    for (const v of series) {
      if (v > peak) peak = v;
      const dd = (peak - v) / peak;
      if (dd > mdd) mdd = dd;
    }
    return Math.round(mdd * 10000) / 100;
  }
  const eqMdd = maxDrawdown(eqSeries);
  const bhMdd = maxDrawdown(bhSeries);
  // 按月比较：策略月收益 vs 买入持有月收益
  let beat = 0, downMonths = 0, downBeat = 0;
  let stratSum = 0, bhSum = 0;
  for (let i = 0; i < n; i++) {
    const w = sigSeries.get(months[i])?.weight ?? 1;
    const sRet = rows[i].ret * w;
    const bRet = rows[i].ret;
    if (sRet > bRet + 1e-9) beat++;
    if (bRet < 0) {
      downMonths++;
      if (sRet > bRet + 1e-9) downBeat++;
    }
    stratSum += sRet; bhSum += bRet;
  }

  const out = {
    generatedAt: new Date().toISOString(),
    period: `${months[0]} ~ ${months[months.length - 1]}（${years.toFixed(1)} 年，美国样本）`,
    note: '策略=三档协议月度调仓（观察100%/预警50%/确认20%股票仓位，其余现金0收益）；信号用上月数据决定本月仓位，无未来函数。基准=纳斯达克综合指数（FRED 免费完整历史 1971 年起）。未含股息与交易成本。',
    stats: {
      strategyCagr: eqCagr, buyholdCagr: bhCagr,
      strategyFinal: eqFinal, buyholdFinal: bhFinal,
      strategyMdd: eqMdd, buyholdMdd: bhMdd,
      months: n,
      beatRate: Math.round((beat / n) * 10000) / 100,
      downsideProtection: downMonths ? Math.round((downBeat / downMonths) * 10000) / 100 : null,
      avgMonthlyStrat: Math.round((stratSum / n) * 10000) / 100,
      avgMonthlyBh: Math.round((bhSum / n) * 10000) / 100,
    },
    rows,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`✅ 回测完成：${months[0]}~${months[months.length - 1]}，策略年化 ${eqCagr}% vs 买入持有 ${bhCagr}%，策略最大回撤 ${eqMdd}% vs BH ${bhMdd}%，月度跑赢率 ${out.stats.beatRate}%`);
}

main().catch((e) => { console.error('回测失败：', e); process.exit(1); });
