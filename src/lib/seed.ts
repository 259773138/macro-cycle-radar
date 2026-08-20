// 演示数据（离线兜底 / 本地开发用）：真实数据由 data/indicators.json 提供并覆盖
import { BUILTIN_INDICATORS, IndicatorRecord, lastNMonths, todayISO } from './types';

// 为每个内置指标生成近 12 个月的确定性演示序列
function genMonthly(id: string): { month: string; value: number }[] {
  const months = lastNMonths(12);
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 997;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const base = 40 + rnd() * 60;
  const drift = (rnd() - 0.5) * 8;
  const vol = 3 + rnd() * 6;
  return months.map((m, i) => ({ month: m, value: Math.round((base + drift * i + (rnd() - 0.5) * vol) * 10) / 10 }));
}

export function metaToRecord(meta: (typeof BUILTIN_INDICATORS)[number], demo = false): IndicatorRecord {
  const monthly = genMonthly(meta.id);
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2] || last;
  let signal: 'up' | 'flat' | 'down' = 'flat';
  const delta = last.value - prev.value;
  if (delta > 0.05) signal = meta.better === 'high' ? 'up' : 'down';
  else if (delta < -0.05) signal = meta.better === 'high' ? 'down' : 'up';
  return {
    id: meta.id, name: meta.name, region: meta.region, layer: meta.layer, type: meta.type,
    unit: meta.unit, better: meta.better, watch: meta.watch, meaning: meta.meaning, limit: meta.limit,
    enabled: true, monthly, signal, updatedAt: todayISO(),
    tags: [meta.region === 'CN' ? '中国' : meta.region === 'US' ? '美国' : '全球'],
    auto: !!meta.auto, source: demo ? '演示数据' : undefined,
  };
}

export function buildDemoIndicators(): IndicatorRecord[] {
  return BUILTIN_INDICATORS.map((meta) => metaToRecord(meta, true));
}
