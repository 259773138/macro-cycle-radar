// 演示数据：内置指标 + 一组示例读数（数据为教学演示用途，非实时行情）
import { BUILTIN_INDICATORS, IndicatorRecord, lastNMonths, todayISO } from './types';

// 为每个内置指标生成近 12 个月的演示月度序列
function genMonthly(id: string): { month: string; value: number }[] {
  const months = lastNMonths(12);
  // 用 id 做确定性伪随机种子
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

export function buildDemoIndicators(): IndicatorRecord[] {
  return BUILTIN_INDICATORS.map((meta, idx) => {
    const monthly = genMonthly(meta.id);
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2] || last;
    let signal: 'up' | 'flat' | 'down' = 'flat';
    const delta = last.value - prev.value;
    if (delta > 0.05) signal = meta.better === 'high' ? 'up' : 'down';
    else if (delta < -0.05) signal = meta.better === 'high' ? 'down' : 'up';
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
      enabled: true,
      monthly,
      signal,
      updatedAt: todayISO(),
      tags: [meta.region === 'CN' ? '中国' : meta.region === 'US' ? '美国' : '全球'],
    };
  });
}

// 用于“加入全部内置指标”时新增的条目
export function metaToRecord(meta: (typeof BUILTIN_INDICATORS)[number]): IndicatorRecord {
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
    enabled: true, monthly, signal, updatedAt: todayISO(), tags: [],
  };
}
