import { IndicatorRecord, PredictionCard, Quadrant, Region, Signal } from './types';

export const REGION_LABEL: Record<Region, string> = { US: '美国', CN: '中国', GL: '全球' };

export const QUADRANTS: Record<Quadrant, { name: string; cn: string; desc: string; assetOrder: string; tip: string; color: string }> = {
  recession: {
    name: '衰退', cn: '增长↓ 通胀↓',
    desc: '经济下行、通胀回落，央行通常转松',
    assetOrder: '债 > 现金 > 股 > 商品',
    tip: '防守为主：高等级债、现金；等待信用脉冲转正与被动去库结束的扩张信号',
    color: '#0ea5e9',
  },
  recovery: {
    name: '复苏', cn: '增长↑ 通胀↓',
    desc: '增长回升、通胀低位，风险资产最友好的阶段',
    assetOrder: '股 > 债 > 现金 > 商品',
    tip: '可逐步进攻：股票占优；关注新订单回升 + 广度改善的确认',
    color: '#059669',
  },
  overheat: {
    name: '过热', cn: '增长↑ 通胀↑',
    desc: '增长强劲、通胀抬头，商品与周期资产强势',
    assetOrder: '商品 > 股 > 现金 > 债',
    tip: '提高质量、留现金：警惕“这次不一样”的叙事与不审慎的资本供给',
    color: '#d97706',
  },
  stagflation: {
    name: '滞胀', cn: '增长↓ 通胀↑',
    desc: '增长放缓、通胀粘滞，股债双杀风险高',
    assetOrder: '现金 > 商品/债 > 股',
    tip: '现金为王、降杠杆：最难受的阶段，等待政策转向信号',
    color: '#dc2626',
  },
};

export const CN_QUADRANTS: Record<Quadrant, { name: string; cn: string; desc: string; asset: string; acc: string; tip: string; color: string }> = {
  recession: {
    name: '类衰退', cn: '宽货币 + 紧信用',
    desc: '政策已松、信用未起',
    asset: '债券', acc: '约 83%',
    tip: '债券占优；盯信用脉冲是否转正——转正即向复苏切换',
    color: '#0ea5e9',
  },
  recovery: {
    name: '类复苏', cn: '宽货币 + 宽信用',
    desc: '货币信用双宽',
    asset: '股票', acc: '约 100%',
    tip: '股票最强阶段；历史样本正确率约 100%',
    color: '#059669',
  },
  overheat: {
    name: '类过热', cn: '紧货币 + 宽信用',
    desc: '货币收紧、信用仍宽',
    asset: '商品', acc: '约 57%',
    tip: '商品占优但正确率仅约 57%，需结合库存与情绪验证',
    color: '#d97706',
  },
  stagflation: {
    name: '类滞胀', cn: '紧货币 + 紧信用',
    desc: '货币信用双紧',
    asset: '现金 / 无明确优势', acc: '约 43%',
    tip: '最差组合：现金为主，避免抄底冲动；等货币先转松',
    color: '#dc2626',
  },
};

export const TIER_META: Record<'watch' | 'warn' | 'confirm', { name: string; color: string; bg: string; desc: string; action: string }> = {
  watch: {
    name: '观察', color: '#0369a1', bg: '#f0f9ff',
    desc: '仅 1 个领先指标异常，或出现背离',
    action: '什么都别急着做，加密监测频率，不改主仓位',
  },
  warn: {
    name: '预警', color: '#b45309', bg: '#fffbeb',
    desc: '≥3 个相互独立的领先指标同向恶化，持续 2–3 个月',
    action: '仓位向新方向倾斜 1/3～1/2；提高质量、降杠杆、留现金',
  },
  confirm: {
    name: '确认', color: '#b91c1c', bg: '#fef2f2',
    desc: '同步指标跟上，或曲线再陡峭化 + 利差走阔 + 就业裂口',
    action: '按新的周期状态做明显的配置调整，并用滞后指标做最终打卡',
  },
};

export const SIGNAL_BADGE: Record<Signal, string> = {
  up: '绿', flat: '黄', down: '红',
};

// 将用户数据压缩成注入 AI 的仪表盘摘要
export function buildRadarSummary(indicators: IndicatorRecord[], predictions: PredictionCard[]): string {
  const total = indicators.filter((i) => i.enabled).length;
  const up = indicators.filter((i) => i.enabled && i.signal === 'up').length;
  const down = indicators.filter((i) => i.enabled && i.signal === 'down').length;
  const flat = total - up - down;
  const lead = indicators.filter((i) => i.enabled && i.type === 'leading');
  const badLead = lead.filter((i) => i.signal === 'down').map((i) => `${i.name}(${i.unit}${i.monthly.length ? `最新${i.monthly[i.monthly.length - 1].value}` : ''})`);
  const lines: string[] = [
    `当前仪表盘共 ${total} 个启用指标：改善 ${up}、中性 ${flat}、恶化 ${down}。`,
    `领先指标恶化名单：${badLead.length ? badLead.join('；') : '无'}`,
  ];
  indicators.filter((i) => i.enabled).forEach((i) => {
    const last = i.monthly[i.monthly.length - 1];
    const prev = i.monthly[i.monthly.length - 2] || last;
    lines.push(`- [${i.type === 'leading' ? '领先' : i.type === 'coincident' ? '同步' : '滞后'}][${i.region === 'CN' ? '中国' : i.region === 'US' ? '美国' : '全球'}] ${i.name}: ${last.value}${i.unit}（上期 ${prev.value}），信号${i.signal === 'up' ? '改善' : i.signal === 'down' ? '恶化' : '中性'}`);
  });
  if (predictions.length) {
    const open = predictions.filter((p) => p.status === 'open').slice(0, 3);
    if (open.length) {
      lines.push(`近期未到期预测：`);
      open.forEach((p) => {
        lines.push(`- [${p.date}] ${p.mainScenario.label}（概率 ${p.mainScenario.prob}%，${p.mainScenario.window}），证伪条件：${p.falsify.join('；') || '未写'}`);
      });
    }
  }
  return lines.join('\n');
}

export function exportJSON(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadJSONFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsText(file);
  });
}

// ---------- P0-2 数据新鲜度 ----------
export const FREQ_LABEL: Record<string, string> = { d: '日更', w: '周更', m: '月更', q: '季更' };

export function lagMonths(updatedAt: string): number {
  // updatedAt 形如 'YYYY-MM'；返回与当前月份的差距
  const m = /^(\d{4})-(\d{2})/.exec(updatedAt);
  if (!m) return 0;
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth() - (parseInt(m[1]) * 12 + (parseInt(m[2]) - 1));
}

// ---------- P1-1 衰退红绿灯（借鉴 recession-indicator-dashboard） ----------
export interface LightSignal { id: string; label: string; on: boolean; note: string }

export function recessionLights(indicators: IndicatorRecord[]): { lights: LightSignal[]; count: number; level: 'green' | 'yellow' | 'red' } {
  const byId = (id: string) => indicators.find((i) => i.enabled && i.id === id);
  const trendBad = (rec: IndicatorRecord | undefined, months = 3): boolean => {
    if (!rec) return false;
    const pts = rec.monthly.filter((p) => p.value !== null);
    if (pts.length < months + 1) return false;
    const last = pts[pts.length - 1];
    const base = pts[pts.length - 1 - months];
    return rec.better === 'high' ? last.value < base.value : last.value > base.value;
  };
  const curve = byId('us-2s10s');
  const curveVal = curve?.monthly?.filter((p) => p.value !== null).slice(-1)[0]?.value ?? 0;
  const sahm = (() => {
    const ue = byId('us-ue');
    if (!ue) return null;
    const pts = ue.monthly.filter((p) => p.value !== null).map((p) => p.value);
    if (pts.length < 16) return null;
    const avg3 = pts.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const min12 = Math.min(...pts.slice(-15, -3));
    return { triggered: avg3 - min12 >= 0.5, diff: Math.round((avg3 - min12) * 100) / 100 };
  })();
  const lights: LightSignal[] = [
    { id: 'curve', label: '曲线倒挂', on: curveVal < 0, note: curveVal < 0 ? `2s10s 倒挂 ${curveVal}bp` : `2s10s ${curveVal}bp 未倒挂` },
    { id: 'sahm', label: 'Sahm 规则', on: sahm?.triggered ?? false, note: sahm === null ? '数据不足' : sahm.triggered ? `已触发 +${sahm.diff}pp` : `未触发 +${sahm.diff}pp` },
    { id: 'claims', label: '初请失业金', on: trendBad(byId('us-claims'), 3), note: '近 3 个月趋势' },
    { id: 'housing', label: '新屋开工', on: trendBad(byId('us-housing'), 3), note: '近 3 个月趋势' },
    { id: 'invsales', label: '库存/销售比', on: trendBad(byId('us-inv-sales'), 3), note: '近 3 个月趋势' },
  ];
  const count = lights.filter((l) => l.on).length;
  const level: 'green' | 'yellow' | 'red' = count <= 1 ? 'green' : count <= 3 ? 'yellow' : 'red';
  return { lights, count, level };
}

export const LIGHT_LEVEL_META: Record<'green' | 'yellow' | 'red', { label: string; color: string; bg: string }> = {
  green: { label: '扩张（绿灯）', color: '#059669', bg: '#ecfdf5' },
  yellow: { label: '警惕（黄灯）', color: '#b45309', bg: '#fffbeb' },
  red: { label: '衰退风险高（红灯）', color: '#dc2626', bg: '#fef2f2' },
};

// ---------- P2-1 宏观数据日历（发布规则，自维护） ----------
export interface CalendarRule {
  id: string; name: string; region: string; freq: 'monthly' | 'weekly' | 'quarterly';
  rule: string;                 // 规则描述
  compute: (now: Date) => Date; // 计算下一次发布日（估算）
  indicatorId?: string;         // 关联指标（用于回填已发布数据）
  unit?: string;
}

const dayOfMonth = (y: number, m: number, d: number) => new Date(y, m, d);

function nextMonthlyRule(now: Date, day: number, offsetDays: number): Date {
  // 该月的目标日；若已过则下月
  let target = dayOfMonth(now.getFullYear(), now.getMonth(), day + offsetDays);
  if (target <= now) target = dayOfMonth(now.getFullYear(), now.getMonth() + 1, day + offsetDays);
  return target;
}

function nextNthWeekday(now: Date, weekday: number, nth: number): Date {
  // weekday: 0=周日…5=周五；nth: 第几个
  let d = dayOfMonth(now.getFullYear(), now.getMonth(), 1);
  let count = 0;
  while (true) {
    if (d.getDay() === weekday) count++;
    if (count === nth) break;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  if (d <= now) {
    d = dayOfMonth(now.getFullYear(), now.getMonth() + 1, 1);
    count = 0;
    while (true) {
      if (d.getDay() === weekday) count++;
      if (count === nth) break;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
  }
  return d;
}

function nextWeekly(now: Date, weekday: number): Date {
  const d = new Date(now);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  if (d <= now) d.setDate(d.getDate() + 7);
  return d;
}

export const CALENDAR_RULES: CalendarRule[] = [
  { id: 'us-nfp', name: '非农就业 + 失业率', region: '美国', freq: 'monthly', rule: '每月第 1 个周五 20:30（北京）', compute: (n) => nextNthWeekday(n, 5, 1), indicatorId: 'us-payrolls', unit: '万人' },
  { id: 'us-claims', name: '初请失业金', region: '美国', freq: 'weekly', rule: '每周四 20:30（北京）', compute: (n) => nextWeekly(n, 4), indicatorId: 'us-claims', unit: '万人' },
  { id: 'us-cpi', name: '美国 CPI', region: '美国', freq: 'monthly', rule: '次月 10–14 日 20:30（北京）', compute: (n) => nextMonthlyRule(n, 12, 0), indicatorId: 'us-core-cpi', unit: '%' },
  { id: 'us-ppi', name: '美国 PPI', region: '美国', freq: 'monthly', rule: '次月 11–15 日 20:30（北京）', compute: (n) => nextMonthlyRule(n, 13, 0), indicatorId: 'us-ppi', unit: '%' },
  { id: 'us-retail', name: '美国零售销售', region: '美国', freq: 'monthly', rule: '次月 14–17 日 20:30（北京）', compute: (n) => nextMonthlyRule(n, 15, 0), indicatorId: 'us-retail', unit: '亿美元' },
  { id: 'us-housing', name: '新屋开工 / 营建许可', region: '美国', freq: 'monthly', rule: '次月 16–19 日 20:30（北京）', compute: (n) => nextMonthlyRule(n, 17, 0), indicatorId: 'us-housing', unit: '千套' },
  { id: 'us-fomc', name: '美联储 FOMC 利率决议', region: '美国', freq: 'monthly', rule: '每年 8 次会议（1/3/4/6/7/9/10/12 月，以官方日程为准）', compute: (n) => { const d = new Date(n); while (![0, 2, 3, 5, 6, 8, 9, 11].includes(d.getMonth())) d.setMonth(d.getMonth() + 1); if (d <= n) { d.setMonth(d.getMonth() + 1); while (![0, 2, 3, 5, 6, 8, 9, 11].includes(d.getMonth())) d.setMonth(d.getMonth() + 1); } return d; }, indicatorId: 'us-fedfunds', unit: '%' },
  { id: 'cn-pmi', name: '中国官方制造业 PMI', region: '中国', freq: 'monthly', rule: '每月最后一天 09:30（北京）', compute: (n) => dayOfMonth(n.getFullYear(), n.getMonth() + 1, 0), indicatorId: 'cn-pmi', unit: '指数' },
  { id: 'cn-cpi', name: '中国 CPI / PPI', region: '中国', freq: 'monthly', rule: '次月 9 日左右 09:30（北京）', compute: (n) => nextMonthlyRule(n, 9, 0), indicatorId: 'cn-cpi', unit: '%' },
  { id: 'cn-credit', name: '社融 / 新增贷款 / M1 / M2', region: '中国', freq: 'monthly', rule: '次月 10–15 日 16:00（北京）', compute: (n) => nextMonthlyRule(n, 12, 0), indicatorId: 'cn-new-loan', unit: '亿元' },
  { id: 'cn-ip', name: '工业增加值 / 社零 / 失业率', region: '中国', freq: 'monthly', rule: '次月 15–18 日 10:00（北京）', compute: (n) => nextMonthlyRule(n, 16, 0), indicatorId: 'cn-ip', unit: '%' },
  { id: 'cn-lpr', name: 'LPR 报价', region: '中国', freq: 'monthly', rule: '每月 20 日 09:15（北京，遇节假日顺延）', compute: (n) => nextMonthlyRule(n, 20, 0), indicatorId: 'cn-lpr', unit: '%' },
  { id: 'cn-house', name: '70 城房价 / 国房景气', region: '中国', freq: 'monthly', rule: '次月 15–19 日 09:30（北京）', compute: (n) => nextMonthlyRule(n, 17, 0), indicatorId: 'cn-house-bj', unit: '指数' },
  { id: 'cn-gdp', name: '中国 GDP', region: '中国', freq: 'quarterly', rule: '1/4/7/10 月 15–19 日 10:00（北京）', compute: (n) => { let d = new Date(n); while (![0, 3, 6, 9].includes(d.getMonth())) d.setMonth(d.getMonth() + 1); if (d <= n) { d.setMonth(d.getMonth() + 1); while (![0, 3, 6, 9].includes(d.getMonth())) d.setMonth(d.getMonth() + 1); } return d; }, indicatorId: 'cn-gdp', unit: '%' },
];
