// ---------- 全局类型定义 ----------
import builtinJson from './builtin.json';

export type Signal = 'up' | 'flat' | 'down';

export type LayerId = 'credit' | 'leading' | 'coincident' | 'lagging' | 'sentiment' | 'fragility';
export type Region = 'US' | 'CN' | 'GL';
export type IndicatorType = 'leading' | 'coincident' | 'lagging';

export interface AutoConfig {
  kind: 'fred' | 'em' | 'emDerive';
  series?: string;
  seriesA?: string;
  seriesB?: string;
  reportName?: string;
  field?: string;
  fieldA?: string;
  fieldB?: string;
  op?: string;
  transform?: 'none' | 'yoy' | 'spread';
}

export interface IndicatorMeta {
  id: string;
  name: string;
  region: Region;
  layer: LayerId;
  type: IndicatorType;
  watch: string;
  meaning: string;
  limit: string;
  unit: string;
  better: 'high' | 'low';
  auto?: AutoConfig | null;
}

// 月度快照（用于趋势图）
export interface MonthlyPoint {
  month: string; // YYYY-MM
  value: number;
}

export interface IndicatorRecord {
  id: string;
  name: string;
  region: Region;
  layer: LayerId;
  type: IndicatorType;
  unit: string;
  better: 'high' | 'low';
  watch: string;
  meaning: string;
  limit: string;
  enabled: boolean;          // 是否参与扩散统计
  monthly: MonthlyPoint[];   // 最近若干月数值
  signal: Signal;            // 当前信号
  updatedAt: string;         // 数据截止月份或日期
  tags: string[];
  auto?: boolean;            // 是否自动采集
  source?: string;           // 数据源名称（FRED / 东方财富）
  stale?: boolean;           // 本次采集失败沿用旧值
}

export type Quadrant = 'recovery' | 'overheat' | 'stagflation' | 'recession';

export interface PredictionCard {
  id: string;
  date: string;
  createdBy: 'user' | 'ai';
  cyclePosition: { short: string; mid: string; long: string };
  mainScenario: { label: string; prob: number; window: string; assets: string };
  keyEvidence: string[];
  notDoing: string;
  falsify: string[];
  positionMeaning: { stance: 'attack' | 'neutral' | 'defense'; note: string };
  redTeam: string;
  status: 'open' | 'resolved';
  review?: {
    date: string;
    occurred: boolean;
    direction: number;
    timing: number;
    calibration: number;
    value: number;
    brier: number;
    note: string;
  };
}

export interface AIConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: number;
}

export interface DataSourceStatus {
  name: string;
  status: 'ok' | 'partial' | 'error';
  count: number;
  message?: string;
}

export interface DataMeta {
  fetchedAt: string;
  sources: DataSourceStatus[];
  autoCount: number;
  staleCount: number;
  failed: { id: string; name: string; error: string; reused: boolean }[];
  note: string;
}

// ---------- 内置指标元数据（共享 JSON，脚本 scripts/fetch-data.mjs 也读它） ----------
export const BUILTIN_INDICATORS: IndicatorMeta[] = builtinJson as IndicatorMeta[];

export const LAYERS: { id: LayerId; no: number; name: string; short: string; desc: string }[] = [
  { id: 'credit', no: 1, name: '信用与流动性', short: '信用', desc: '风的方向：利率、曲线、利差、社融、M1。最早也最重要的一层。' },
  { id: 'leading', no: 2, name: '实体领先指标', short: '领先', desc: '新订单、初请、地产许可、资本品订单、盈利下修等。' },
  { id: 'coincident', no: 3, name: '同步指标', short: '同步', desc: '工业产出、零售、就业、GDP。回答“现在在哪”。' },
  { id: 'lagging', no: 4, name: '滞后指标', short: '滞后', desc: '失业率、核心通胀、库存销售比。回答“拐点是否已被确认”。' },
  { id: 'sentiment', no: 5, name: '市场与情绪', short: '情绪', desc: '估值、广度、波动、杠杆、一级市场。马克斯的“量体温”。' },
  { id: 'fragility', no: 6, name: '结构脆弱性', short: '脆弱', desc: '债务缺口、杠杆、地产、生产率。长周期的雷。' },
];

export const REGIONS: { id: Region; name: string }[] = [
  { id: 'US', name: '美国' },
  { id: 'CN', name: '中国' },
  { id: 'GL', name: '全球' },
];

export const TYPE_NAMES: Record<IndicatorType, string> = {
  leading: '领先',
  coincident: '同步',
  lagging: '滞后',
};

export const SIGNAL_META: Record<Signal, { label: string; color: string; bg: string; icon: string }> = {
  up: { label: '改善', color: '#059669', bg: '#ecfdf5', icon: '↑' },
  flat: { label: '中性', color: '#b45309', bg: '#fffbeb', icon: '→' },
  down: { label: '恶化', color: '#dc2626', bg: '#fef2f2', icon: '↓' },
};

export const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', hint: '默认兼容 OpenAI 官方接口' },
  { id: 'modelscope', name: '魔搭 ModelScope', baseUrl: 'https://api-inference.modelscope.cn/v1', hint: '兼容 OpenAI 格式，需在魔搭开通模型推理服务' },
  { id: 'custom', name: '自定义（OpenAI 兼容）', baseUrl: '', hint: '任意兼容 /v1/chat/completions 的服务，如 DeepSeek、Moonshot、Ollama 等' },
] as const;

// ---------- 工具函数 ----------
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function fmtMonth(m: string): string {
  return m.replace('-', '年') + '月';
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function lastNMonths(n: number): string[] {
  const arr: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
}

export function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}
