import { create } from 'zustand';
import {
  AIConfig, ChatMessage, DataMeta, IndicatorRecord, PredictionCard, Quadrant, Region,
  IndicatorType, Signal, BUILTIN_INDICATORS,
} from '../lib/types';
import { buildDemoIndicators, metaToRecord } from '../lib/seed';

const LS_KEY = 'macro-radar-state-v2';
const LEGACY_KEY = 'macro-radar-state-v1';

const BUILTIN_IDS = new Set(BUILTIN_INDICATORS.map((m) => m.id));

interface Persisted {
  customIndicators: IndicatorRecord[];
  disabledIds: string[];
  signalOverrides: Record<string, Signal>;
  predictions: PredictionCard[];
  quadrant: Quadrant;
  cnQuadrant: Quadrant;
  tier: 'watch' | 'warn' | 'confirm';
  tierNote: string;
  aiConfig: AIConfig;
  chat: ChatMessage[];
}

interface AppState extends Persisted {
  // 自动采集数据（运行时从 data/indicators.json 加载，不持久化）
  autoIndicators: IndicatorRecord[];
  dataMeta: DataMeta | null;
  aiReport: { text: string; updatedAt: string } | null;
  demoMode: boolean;
  // 合并后的完整指标列表（自动 + 自定义 + 用户设置）
  indicators: IndicatorRecord[];

  setAutoIndicators: (list: IndicatorRecord[], meta: DataMeta | null) => void;
  setAiReport: (r: { text: string; updatedAt: string } | null) => void;

  upsertCustom: (rec: IndicatorRecord) => void;
  removeCustom: (id: string) => void;
  addBuiltinManual: (id: string) => void;  // 把内置手动指标加入工作台
  removeIndicator: (id: string) => void;   // 自动指标=禁用；自定义=删除
  toggleEnabled: (id: string) => void;
  setSignalOverride: (id: string, sig: Signal) => void;
  clearOverrides: () => void;

  resetDemo: () => void;
  clearAll: () => void;

  addPrediction: (p: PredictionCard) => void;
  updatePrediction: (p: PredictionCard) => void;
  removePrediction: (id: string) => void;

  setQuadrant: (q: Quadrant) => void;
  setCnQuadrant: (q: Quadrant) => void;
  setTier: (t: 'watch' | 'warn' | 'confirm', note?: string) => void;

  setAiConfig: (c: AIConfig) => void;
  setChat: (m: ChatMessage[]) => void;
  appendChat: (m: ChatMessage) => void;
  clearChat: () => void;

  exportState: () => string;
  importState: (json: string) => boolean;
}

function defaultAiConfig(): AIConfig {
  return { provider: 'modelscope', baseUrl: 'https://api-inference.modelscope.cn/v1', apiKey: '', model: 'Qwen/Qwen3-235B-A22B-Instruct-2507', temperature: 0.7 };
}

function emptyPersisted(): Persisted {
  return {
    customIndicators: [], disabledIds: [], signalOverrides: {},
    predictions: [], quadrant: 'recovery', cnQuadrant: 'recovery',
    tier: 'watch', tierNote: '', aiConfig: defaultAiConfig(), chat: [],
  };
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      return {
        customIndicators: p.customIndicators ?? [],
        disabledIds: p.disabledIds ?? [],
        signalOverrides: p.signalOverrides ?? {},
        predictions: p.predictions ?? [],
        quadrant: p.quadrant ?? 'recovery',
        cnQuadrant: p.cnQuadrant ?? 'recovery',
        tier: p.tier ?? 'watch',
        tierNote: p.tierNote ?? '',
        aiConfig: { ...defaultAiConfig(), ...(p.aiConfig ?? {}) },
        chat: p.chat ?? [],
      };
    }
    // 迁移旧版本（v1 把所有指标存 localStorage，新版本只保留自定义）
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = JSON.parse(legacy) as Partial<Persisted & { indicators?: IndicatorRecord[] }>;
      const migrated: Persisted = {
        customIndicators: (p.indicators ?? []).filter((i) => !BUILTIN_IDS.has(i.id)),
        disabledIds: [],
        signalOverrides: {},
        predictions: p.predictions ?? [],
        quadrant: p.quadrant ?? 'recovery',
        cnQuadrant: p.cnQuadrant ?? 'recovery',
        tier: p.tier ?? 'watch',
        tierNote: p.tierNote ?? '',
        aiConfig: { ...defaultAiConfig(), ...(p.aiConfig ?? {}) },
        chat: p.chat ?? [],
      };
      localStorage.setItem(LS_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
  } catch (e) {
    console.warn('读取本地数据失败', e);
  }
  return emptyPersisted();
}

function mergeIndicators(
  auto: IndicatorRecord[],
  custom: IndicatorRecord[],
  disabledIds: string[],
  overrides: Record<string, Signal>,
): IndicatorRecord[] {
  const mergedAuto = auto.map((a) => ({
    ...a,
    enabled: !disabledIds.includes(a.id),
    signal: overrides[a.id] ?? a.signal,
  }));
  return [...mergedAuto, ...custom];
}

const persisted = loadPersisted();

export const useStore = create<AppState>((set, get) => {
  const recompute = (partial: Partial<AppState>): Partial<AppState> => {
    const s = { ...get(), ...partial } as AppState;
    return { ...partial, indicators: mergeIndicators(s.autoIndicators, s.customIndicators, s.disabledIds, s.signalOverrides) };
  };

  return {
    ...persisted,
    autoIndicators: buildDemoIndicators(),
    dataMeta: null,
    aiReport: null,
    demoMode: true,
    indicators: mergeIndicators(buildDemoIndicators(), persisted.customIndicators, persisted.disabledIds, persisted.signalOverrides),

    setAutoIndicators: (list, meta) => set((s) => recompute({ autoIndicators: list, dataMeta: meta, demoMode: false })),

    setAiReport: (r) => set({ aiReport: r }),

    upsertCustom: (rec) => set((s) => recompute({
      customIndicators: s.customIndicators.some((i) => i.id === rec.id)
        ? s.customIndicators.map((i) => (i.id === rec.id ? rec : i))
        : [...s.customIndicators, rec],
    })),

    removeCustom: (id) => set((s) => recompute({ customIndicators: s.customIndicators.filter((i) => i.id !== id) })),

    addBuiltinManual: (id) => set((s) => {
      const meta = BUILTIN_INDICATORS.find((m) => m.id === id);
      if (!meta) return {};
      return recompute({ customIndicators: [...s.customIndicators, metaToRecord(meta)] });
    }),

    removeIndicator: (id) => set((s) => {
      if (BUILTIN_IDS.has(id)) {
        return recompute({ disabledIds: [...new Set([...s.disabledIds, id])] });
      }
      return recompute({ customIndicators: s.customIndicators.filter((i) => i.id !== id) });
    }),

    toggleEnabled: (id) => set((s) => {
      const disabled = new Set(s.disabledIds);
      if (disabled.has(id)) disabled.delete(id); else disabled.add(id);
      return recompute({ disabledIds: [...disabled] });
    }),

    setSignalOverride: (id, sig) => set((s) => {
      const overrides = { ...s.signalOverrides, [id]: sig };
      return recompute({ signalOverrides: overrides });
    }),

    clearOverrides: () => set((s) => recompute({ signalOverrides: {} })),

    resetDemo: () => set((s) => recompute({ customIndicators: [], disabledIds: [], signalOverrides: {}, predictions: [], chat: [] })),

    clearAll: () => set((s) => recompute({ customIndicators: [], disabledIds: [], signalOverrides: {}, predictions: [], chat: [], tier: 'watch', tierNote: '' })),

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
      customIndicators: get().customIndicators,
      disabledIds: get().disabledIds,
      signalOverrides: get().signalOverrides,
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
        set(recompute({
          customIndicators: Array.isArray(p.customIndicators) ? p.customIndicators : get().customIndicators,
          disabledIds: Array.isArray(p.disabledIds) ? p.disabledIds : get().disabledIds,
          signalOverrides: p.signalOverrides ?? get().signalOverrides,
          predictions: Array.isArray(p.predictions) ? p.predictions : get().predictions,
          quadrant: p.quadrant ?? get().quadrant,
          cnQuadrant: p.cnQuadrant ?? get().cnQuadrant,
          tier: p.tier ?? get().tier,
          tierNote: p.tierNote ?? get().tierNote,
        }));
        return true;
      } catch {
        return false;
      }
    },
  };
});

// 持久化订阅
useStore.subscribe((s) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      customIndicators: s.customIndicators, disabledIds: s.disabledIds, signalOverrides: s.signalOverrides,
      predictions: s.predictions, quadrant: s.quadrant, cnQuadrant: s.cnQuadrant,
      tier: s.tier, tierNote: s.tierNote, aiConfig: s.aiConfig, chat: s.chat,
    }));
  } catch (e) { /* 存储满时忽略 */ }
});

// ---------- 派生工具（供各页面使用） ----------

export function layerSignals(indicators: IndicatorRecord[], layer: string): Signal[] {
  return indicators.filter((i) => i.enabled && i.layer === layer).map((i) => i.signal);
}

export function aggregateSignals(signals: Signal[]): Signal {
  if (!signals.length) return 'flat';
  const up = signals.filter((s) => s === 'up').length;
  const down = signals.filter((s) => s === 'down').length;
  if (up > down && up >= signals.length * 0.5) return 'up';
  if (down > up && down >= signals.length * 0.5) return 'down';
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
    return { tier: 'warn', reasons };
  }
  if (badLeads.length >= 1) {
    reasons.push(`${badLeads.length} 个领先指标出现恶化迹象——加密监测，不必急着改仓位`);
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
