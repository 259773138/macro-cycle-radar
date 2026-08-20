import { create } from 'zustand';
import {
  AIConfig, ChatMessage, IndicatorRecord, LayerId, PredictionCard, Quadrant, Region,
  IndicatorType, Signal,
} from '../lib/types';
import { buildDemoIndicators } from '../lib/seed';

const LS_KEY = 'macro-radar-state-v1';

interface Persisted {
  indicators: IndicatorRecord[];
  predictions: PredictionCard[];
  quadrant: Quadrant;
  cnQuadrant: Quadrant;
  tier: 'watch' | 'warn' | 'confirm';
  tierNote: string;
  aiConfig: AIConfig;
  chat: ChatMessage[];
}

interface AppState extends Persisted {
  // 指标
  upsertIndicator: (rec: IndicatorRecord) => void;
  removeIndicator: (id: string) => void;
  resetDemo: () => void;
  clearAll: () => void;
  // 预测日志
  addPrediction: (p: PredictionCard) => void;
  updatePrediction: (p: PredictionCard) => void;
  removePrediction: (id: string) => void;
  // 周期与档位
  setQuadrant: (q: Quadrant) => void;
  setCnQuadrant: (q: Quadrant) => void;
  setTier: (t: 'watch' | 'warn' | 'confirm', note?: string) => void;
  // AI
  setAiConfig: (c: AIConfig) => void;
  setChat: (m: ChatMessage[]) => void;
  appendChat: (m: ChatMessage) => void;
  clearChat: () => void;
  // 导入导出
  exportState: () => string;
  importState: (json: string) => boolean;
}

function defaultAiConfig(): AIConfig {
  return { provider: 'modelscope', baseUrl: 'https://api-inference.modelscope.cn/v1', apiKey: '', model: '', temperature: 0.7 };
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      return {
        indicators: p.indicators?.length ? p.indicators : buildDemoIndicators(),
        predictions: p.predictions ?? [],
        quadrant: p.quadrant ?? 'recovery',
        cnQuadrant: p.cnQuadrant ?? 'recovery',
        tier: p.tier ?? 'watch',
        tierNote: p.tierNote ?? '',
        aiConfig: { ...defaultAiConfig(), ...(p.aiConfig ?? {}) },
        chat: p.chat ?? [],
      };
    }
  } catch (e) {
    console.warn('读取本地数据失败，使用演示数据', e);
  }
  return {
    indicators: buildDemoIndicators(),
    predictions: [],
    quadrant: 'recovery',
    cnQuadrant: 'recovery',
    tier: 'watch',
    tierNote: '',
    aiConfig: defaultAiConfig(),
    chat: [],
  };
}

const initial = load();

export const useStore = create<AppState>((set, get) => {
  const save = () => {
    const { indicators, predictions, quadrant, cnQuadrant, tier, tierNote, aiConfig, chat } = get();
    localStorage.setItem(LS_KEY, JSON.stringify({
      indicators, predictions, quadrant, cnQuadrant, tier, tierNote, aiConfig, chat,
    }));
  };

  return {
    ...initial,

    upsertIndicator: (rec) => set((s) => {
      const exists = s.indicators.some((i) => i.id === rec.id);
      return { indicators: exists ? s.indicators.map((i) => (i.id === rec.id ? rec : i)) : [...s.indicators, rec] };
    }),
    removeIndicator: (id) => set((s) => ({ indicators: s.indicators.filter((i) => i.id !== id) })),
    resetDemo: () => set({ indicators: buildDemoIndicators() }),
    clearAll: () => set({ indicators: [], predictions: [], chat: [], tier: 'watch', tierNote: '' }),

    addPrediction: (p) => set((s) => ({ predictions: [p, ...s.predictions] })),
    updatePrediction: (p) => set((s) => ({ predictions: s.predictions.map((x) => (x.id === p.id ? p : x)) })),
    removePrediction: (id) => set((s) => ({ predictions: s.predictions.filter((x) => x.id !== id) })),

    setQuadrant: (q) => set({ quadrant: q }),
    setCnQuadrant: (q) => set({ cnQuadrant: q }),
    setTier: (t, note) => set({ tier: t, tierNote: note ?? get().tierNote }),

    setAiConfig: (c) => set({ aiConfig: c }),
    setChat: (m) => set({ chat: m }),
    appendChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
    clearChat: () => set({ chat: [] }),

    exportState: () => JSON.stringify({
      exportedAt: new Date().toISOString(),
      indicators: get().indicators,
      predictions: get().predictions,
      quadrant: get().quadrant,
      cnQuadrant: get().cnQuadrant,
      tier: get().tier,
      tierNote: get().tierNote,
      aiConfig: { ...get().aiConfig, apiKey: '' },
    }, null, 2),

    importState: (json) => {
      try {
        const p = JSON.parse(json);
        set({
          indicators: Array.isArray(p.indicators) ? p.indicators : get().indicators,
          predictions: Array.isArray(p.predictions) ? p.predictions : get().predictions,
          quadrant: p.quadrant ?? get().quadrant,
          cnQuadrant: p.cnQuadrant ?? get().cnQuadrant,
          tier: p.tier ?? get().tier,
          tierNote: p.tierNote ?? get().tierNote,
        });
        return true;
      } catch {
        return false;
      }
    },
  };
});

// 每次变更后持久化（轻量订阅）
useStore.subscribe((s) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      indicators: s.indicators, predictions: s.predictions, quadrant: s.quadrant,
      cnQuadrant: s.cnQuadrant, tier: s.tier, tierNote: s.tierNote, aiConfig: s.aiConfig, chat: s.chat,
    }));
  } catch (e) { /* 存储满时忽略 */ }
});

// ---------- 派生工具（纯函数，供各页面使用） ----------

export function signalOf(rec: IndicatorRecord): Signal {
  return rec.signal;
}

export function layerSignals(indicators: IndicatorRecord[], layer: LayerId): Signal[] {
  return indicators.filter((i) => i.enabled && i.layer === layer).map((i) => i.signal);
}

export function aggregateSignals(signals: Signal[]): Signal {
  if (!signals.length) return 'flat';
  const up = signals.filter((s) => s === 'up').length;
  const down = signals.filter((s) => s === 'down').length;
  if (up > down && up >= signals.length * 0.5) return 'up';
  if (down > up && down >= signals.length * 0.5) return 'down';
  if (up === down && up === 0) return 'flat';
  if (up > down) return 'up';
  if (down > up) return 'down';
  return 'flat';
}

export function diffusion(indicators: IndicatorRecord[], type?: IndicatorType, region?: Region): number {
  const list = indicators.filter((i) => i.enabled && (!type || i.type === type) && (!region || i.region === region));
  return list.filter((i) => i.signal === 'up').length - list.filter((i) => i.signal === 'down').length;
}

export function consecutiveBad(rec: IndicatorRecord): number {
  let n = 0;
  for (let i = rec.monthly.length - 1; i >= 1; i--) {
    const d = rec.monthly[i].value - rec.monthly[i - 1].value;
    const bad = rec.better === 'high' ? d < 0 : d > 0;
    if (bad) n++;
    else break;
  }
  return n;
}

export function consecutiveGood(rec: IndicatorRecord): number {
  let n = 0;
  for (let i = rec.monthly.length - 1; i >= 1; i--) {
    const d = rec.monthly[i].value - rec.monthly[i - 1].value;
    const good = rec.better === 'high' ? d > 0 : d < 0;
    if (good) n++;
    else break;
  }
  return n;
}

// 自动档位建议（报告 4.4 拐点识别协议）
export function suggestTier(indicators: IndicatorRecord[]): { tier: 'watch' | 'warn' | 'confirm'; reasons: string[] } {
  const reasons: string[] = [];
  const lead = indicators.filter((i) => i.enabled && i.type === 'leading');
  const badLeads = lead.filter((i) => i.signal === 'down' && consecutiveBad(i) >= 2);
  const coincident = indicators.filter((i) => i.enabled && i.type === 'coincident');
  const badCoincident = coincident.filter((i) => i.signal === 'down');

  if (badLeads.length >= 3) {
    reasons.push(`${badLeads.length} 个独立领先指标同向恶化且持续 ≥2 个月（${badLeads.map((i) => i.name).slice(0, 4).join('、')}…）`);
    if (badCoincident.length >= 2) {
      reasons.push(`同步指标也开始恶化（${badCoincident.map((i) => i.name).join('、')}）——拐点大概率正在发生`);
      return { tier: 'confirm', reasons };
    }
    if (reasons.length) return { tier: 'warn', reasons };
  }
  if (badLeads.length >= 1 || lead.some((i) => i.signal === 'down')) {
    reasons.push(`${badLeads.length || 1} 个领先指标出现恶化迹象——加密监测，不必急着改仓位`);
    return { tier: 'watch', reasons };
  }
  reasons.push('领先指标未见明显恶化，维持观察即可');
  return { tier: 'watch', reasons };
}

// Brier 分数
export function brier(p: number, y: 1 | 0): number {
  return Math.round((p - y) * (p - y) * 100) / 100;
}

export function brierInterpret(b: number): string {
  if (b <= 0.1) return '校准优秀（≤0.10）';
  if (b <= 0.25) return '校准良好（0.10–0.25）';
  if (b <= 0.4) return '校准一般（0.25–0.40）';
  return '校准差（>0.40）——概率偏乐观';
}
