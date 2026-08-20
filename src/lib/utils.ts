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
