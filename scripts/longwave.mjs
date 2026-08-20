#!/usr/bin/env node
/**
 * 长波档案数据（P2-4，借鉴 kairos-atlas Long Wave Atlas）
 * 拉取 FRED 60 年+ 长历史序列，供前端「长波档案」页可视化（阶段标注为学术共识示意）。
 * 输出：public/data/longwave.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const OUT = join(DATA_DIR, 'longwave.json');
const UA = 'Mozilla/5.0';

const SERIES = [
  { id: 'gdpc1', name: '美国实际 GDP（季调年率，十亿美元）', series: 'GDPC1', unit: '十亿美元', freq: 'q' },
  { id: 'indpro', name: '美国工业生产指数', series: 'INDPRO', unit: '指数(2017=100)', freq: 'm' },
  { id: 'dgs10', name: '美国 10 年期国债收益率', series: 'DGS10', unit: '%', freq: 'm' },
  { id: 'unrate', name: '美国失业率', series: 'UNRATE', unit: '%', freq: 'm' },
  { id: 'payems', name: '美国非农就业（千人）', series: 'PAYEMS', unit: '千人', freq: 'm' },
  { id: 'm2sl', name: '美国 M2 货币存量', series: 'M2SL', unit: '十亿美元', freq: 'm' },
  { id: 'tcu', name: '美国产能利用率', series: 'TCU', unit: '%', freq: 'm' },
  { id: 'debtgdp', name: '美国政府债务/GDP', series: 'GFDEGDQ188S', unit: '%', freq: 'q' },
];

const ANNOTATIONS = [
  { year: 1944, label: '布雷顿森林体系建立', type: 'regime' },
  { year: 1971, label: '尼克松冲击 · 金本位终结', type: 'regime' },
  { year: 1973, label: '第一次石油危机', type: 'shock' },
  { year: 1980, label: '沃尔克极限加息（滞胀顶点）', type: 'policy' },
  { year: 1990, label: '冷战结束 · 全球化加速', type: 'regime' },
  { year: 2000, label: '互联网泡沫见顶', type: 'cycle' },
  { year: 2008, label: '全球金融危机（长债务周期去杠杆）', type: 'cycle' },
  { year: 2020, label: '新冠疫情冲击 + 史无前例财政货币双扩', type: 'shock' },
  { year: 2022, label: '通胀冲击 · 激进加息', type: 'shock' },
];

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

function downsample(points, freq) {
  // 转年度（取年均值），60 年图更清爽
  const byYear = new Map();
  for (const p of points) {
    const y = p.date.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(p.value);
  }
  const arr = [...byYear.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([y, vals]) => ({ year: y, value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 }));
  return arr.slice(-66);
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  const seriesData = {};
  for (const s of SERIES) {
    try {
      const pts = await fred(s.series);
      seriesData[s.id] = { ...s, yearly: downsample(pts, s.freq) };
      console.log(`✅ ${s.id}（${s.series}）：${seriesData[s.id].yearly.length} 年数据`);
    } catch (e) {
      console.log(`❌ ${s.id}: ${String(e.message || e).slice(0, 80)}`);
    }
  }
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), series: seriesData, annotations: ANNOTATIONS }, null, 2));
  console.log('✅ 长波数据已生成');
}

main().catch((e) => { console.error('长波数据失败：', e); process.exit(1); });
