// ---------- 全局类型定义 ----------

export type Signal = 'up' | 'flat' | 'down';

export type LayerId = 'credit' | 'leading' | 'coincident' | 'lagging' | 'sentiment' | 'fragility';
export type Region = 'US' | 'CN' | 'GL';
export type IndicatorType = 'leading' | 'coincident' | 'lagging';

export interface IndicatorMeta {
  id: string;
  name: string;
  region: Region;
  layer: LayerId;
  type: IndicatorType;
  watch: string;      // 看什么
  meaning: string;    // 经验含义
  limit: string;      // 局限
  unit: string;
  better: 'high' | 'low'; // 该指标数值越高越好 or 越低越好
}

export interface Reading {
  value: number;      // 最新值
  prev: number;       // 上期值
  updatedAt: string;  // ISO 日期
}

// 月度快照（用于趋势图）
export interface MonthlyPoint {
  month: string; // YYYY-MM
  value: number;
}

export interface SignalHistory {
  month: string;
  signals: Record<string, Signal>;
  diffusion: Record<IndicatorType, number>; // 改善数-恶化数
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
  signal: Signal;            // 当前信号（由 monthly 推导或手动）
  updatedAt: string;
  tags: string[];
}

export type Quadrant = 'recovery' | 'overheat' | 'stagflation' | 'recession';

export interface PredictionCard {
  id: string;
  date: string;                 // 记录日期
  createdBy: 'user' | 'ai';
  cyclePosition: { short: string; mid: string; long: string };
  mainScenario: { label: string; prob: number; window: string; assets: string };
  keyEvidence: string[];        // ≤5 条，来自不同层
  notDoing: string;             // 明确不做的事
  falsify: string[];            // 证伪条件（4-8 周）
  positionMeaning: { stance: 'attack' | 'neutral' | 'defense'; note: string };
  redTeam: string;              // 最强反方论点
  status: 'open' | 'resolved';
  review?: {
    date: string;
    occurred: boolean;          // 主情景是否发生
    direction: number;          // 1-5
    timing: number;             // 1-5
    calibration: number;        // 1-5
    value: number;              // 1-5
    brier: number;              // 自动 (p-y)^2
    note: string;
  };
}

export interface AIConfig {
  provider: string;   // 'openai' | 'modelscope' | 'custom'
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

// 六层定义（顺序与文案来自报告）
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

export const DEFAULTS: Record<Signal, string> = {
  up: '改善', flat: '中性', down: '恶化',
};

// ---------- 内置指标元数据（内容来自研究报告 3.1–3.6） ----------
export const BUILTIN_INDICATORS: IndicatorMeta[] = [
  // —— 第一层：信用与流动性 ——
  { id: 'us-2s10s', name: '美债收益率曲线 2s10s', region: 'US', layer: 'credit', type: 'leading', unit: 'bp', better: 'high',
    watch: '是否倒挂、倒挂深度与持续时间、何时重新陡峭化',
    meaning: '1955 年以来美国衰退前几乎都出现倒挂；领先约 6–18 个月，中位数约 12 个月',
    limit: '2022–2024 出现超长倒挂而未立刻衰退；浅而短的倒挂假信号更多' },
  { id: 'us-3m10s', name: '美债收益率曲线 3m10s', region: 'US', layer: 'credit', type: 'leading', unit: 'bp', better: 'high',
    watch: '是否倒挂、深度与持续时间',
    meaning: '更贴政策、假信号相对少；2s10s 更早更吵，两者一起看',
    limit: '同样存在“超长倒挂未衰退”的失效期' },
  { id: 'us-hy-oas', name: '高收益债利差 HY OAS', region: 'US', layer: 'credit', type: 'leading', unit: 'bp', better: 'low',
    watch: '水平 + 走阔速度（100bp 快速走阔尤其重要）',
    meaning: '利差快速走阔往往早于股价见顶；危机级常见 >600bp',
    limit: '利差可以在过热期长期过窄，容易让人麻木' },
  { id: 'us-ig-baa', name: '投资级利差 BAA–AAA', region: 'US', layer: 'credit', type: 'leading', unit: 'bp', better: 'low',
    watch: '质量下沉是否被惩罚',
    meaning: '金融条件收紧的确认信号',
    limit: '相对 HY 更钝、更晚' },
  { id: 'us-real-rate', name: '实际利率 / 联邦基金期货', region: 'US', layer: 'credit', type: 'leading', unit: '%', better: 'low',
    watch: '政策是限制性还是转向',
    meaning: '短债周期的舵；货币政策立场的最直接度量',
    limit: '拐点期期货隐含误差会显著变大' },
  { id: 'gl-m2', name: '全球 M2 / 流动性脉冲', region: 'GL', layer: 'credit', type: 'leading', unit: '%', better: 'high',
    watch: '水平不如加速度（二阶导）',
    meaning: '流动性加速常领先风险资产表现',
    limit: '口径、时滞、财政干扰较大' },
  { id: 'us-sloos', name: '银行贷款标准 SLOOS', region: 'US', layer: 'credit', type: 'leading', unit: '%', better: 'low',
    watch: '银行愿不愿意放贷',
    meaning: '信用周期的供给端；银行“拒绝放贷”往往比股市阴线更早更诚实',
    limit: '季度数据、偏滞后于价格' },
  { id: 'cn-shf', name: '社融存量增速', region: 'CN', layer: 'credit', type: 'leading', unit: '%', better: 'high',
    watch: '增速、结构（政府债 vs 企业债 vs 贷款）',
    meaning: '货币×信用时钟的信用端核心；宽信用领先风险资产',
    limit: '存量变大后增速对边际变化变钝，需配合脉冲' },
  { id: 'cn-credit-impulse', name: '信用脉冲（社融增量/GDP）', region: 'CN', layer: 'credit', type: 'leading', unit: '指数', better: 'high',
    watch: '边际变化、是否转正',
    meaning: '扩张初期镜像：政策转松→信用脉冲转正→利差收窄→被动去库结束',
    limit: '口径波动大，需看连续变化' },
  { id: 'cn-m1', name: 'M1 同比', region: 'CN', layer: 'credit', type: 'leading', unit: '%', better: 'high',
    watch: '同比方向与拐点',
    meaning: '企业活钱、周期敏感；历史上领先股价约 1–2 个月量级（经验规律）',
    limit: '非定律；受节日、口径调整干扰' },
  { id: 'cn-m1m2', name: 'M1–M2 剪刀差', region: 'CN', layer: 'credit', type: 'leading', unit: 'pp', better: 'high',
    watch: 'M1 快于 M2 → 资金活化；反之预防性储蓄',
    meaning: '反映资金活化程度，是信用环境敏感的温度计',
    limit: 'M2/社融存量变大后增速钝化，需结合结构' },
  { id: 'cn-mlt-loan', name: '企业中长期贷款 vs 居民贷款', region: 'CN', layer: 'credit', type: 'leading', unit: '亿元', better: 'high',
    watch: '企业敢不敢借钱投资、居民敢不敢加杠杆',
    meaning: '信用扩张的质量：企业端优于居民端的结构更健康',
    limit: '单月波动大，需看趋势' },

  // —— 第二层：实体领先指标 ——
  { id: 'us-lei', name: 'Conference Board LEI', region: 'US', layer: 'leading', type: 'leading', unit: '指数', better: 'high',
    watch: '连续 3 个月同向、或同比跌超约 2%',
    meaning: '综合领先指数，历史上常先于美国衰退',
    limit: '近年出现“长期低于零但未衰退”的失效期' },
  { id: 'gl-oecd-cli', name: 'OECD CLI', region: 'GL', layer: 'leading', type: 'leading', unit: '指数', better: 'high',
    watch: '以 100 为趋势：方向 + 位置四象限',
    meaning: '国际可比领先指数，可对应美林四阶段',
    limit: '更新慢、平滑重，抓不到短期拐点' },
  { id: 'us-ism-orders', name: 'PMI / ISM 新订单', region: 'US', layer: 'leading', type: 'leading', unit: '指数', better: 'high',
    watch: '荣枯线 50；新订单连续低于 48 更有意义；看新订单–库存差',
    meaning: '需求的月度体温，比 PMI 水平更领先',
    limit: '单月噪声大；低于 50 不必然衰退' },
  { id: 'cn-pmi-orders', name: '中国 PMI 新订单', region: 'CN', layer: 'leading', type: 'leading', unit: '指数', better: 'high',
    watch: '荣枯线 50 上下、连续方向',
    meaning: '中国需求的最快月度读数；扩张初期新订单回升是关键',
    limit: '季节性明显（春节），需看同比或扩散' },
  { id: 'us-claims', name: '初请失业金人数', region: 'US', layer: 'leading', type: 'leading', unit: '万人', better: 'low',
    watch: '趋势而非单周数字',
    meaning: '劳动市场最早的裂口；拐点信息量大于水平',
    limit: '节假日、飓风等会扭曲单周读数' },
  { id: 'us-housing', name: '地产开工 / 营建许可', region: 'US', layer: 'leading', type: 'leading', unit: '万套', better: 'high',
    watch: '许可趋势',
    meaning: '长周期里的短领先；地产是利率最敏感的实体部门',
    limit: '地区差异大，且受利率以外的供给约束影响' },
  { id: 'us-capex', name: '资本品订单（非国防不含飞机）', region: 'US', layer: 'leading', type: 'leading', unit: '亿美元', better: 'high',
    watch: '企业投资意图',
    meaning: '朱格拉周期的月度代理',
    limit: '波动大、修订多' },
  { id: 'gl-copper-gold', name: '铜金比', region: 'GL', layer: 'leading', type: 'leading', unit: '比值', better: 'high',
    watch: '比值方向',
    meaning: '铜偏周期、金偏避险；比值下行常与增长放缓同向',
    limit: '受供给、央行购金等非周期因素干扰' },
  { id: 'us-earnings-rev', name: '盈利预测下修', region: 'US', layer: 'leading', type: 'leading', unit: '%', better: 'low',
    watch: '下修比例与速度',
    meaning: '市场对基本面的实时投票，比财报本身更领先',
    limit: '分析师群体有跟风与滞后性' },

  // —— 第三层：同步指标 ——
  { id: 'us-ip', name: '工业生产', region: 'US', layer: 'coincident', type: 'coincident', unit: '%', better: 'high',
    watch: '同比方向',
    meaning: '回答“现在在哪”的核心同步指标',
    limit: '制造业占比下降，代表性减弱' },
  { id: 'cn-ip', name: '中国工业增加值', region: 'CN', layer: 'coincident', type: 'coincident', unit: '%', better: 'high',
    watch: '同比方向',
    meaning: '中国实体经济的最核心同步读数',
    limit: '受基数效应干扰大' },
  { id: 'us-retail', name: '美国零售销售', region: 'US', layer: 'coincident', type: 'coincident', unit: '%', better: 'high',
    watch: '同比 / 环比方向',
    meaning: '消费是 GDP 的大头，同步确认增长动能',
    limit: '不覆盖服务消费' },
  { id: 'us-payrolls', name: '非农就业', region: 'US', layer: 'coincident', type: 'coincident', unit: '万人', better: 'high',
    watch: '趋势与下修',
    meaning: '就业是最重要的同步指标之一；Sahm 规则的原料',
    limit: '初始值修订大' },
  { id: 'cn-urban-ue', name: '城镇调查失业率', region: 'CN', layer: 'coincident', type: 'coincident', unit: '%', better: 'low',
    watch: '趋势',
    meaning: '中国就业的同步读数',
    limit: '对隐性失业覆盖不足' },

  // —— 第四层：滞后指标 ——
  { id: 'us-ue', name: '失业率（Sahm 规则）', region: 'US', layer: 'lagging', type: 'lagging', unit: '%', better: 'low',
    watch: '3 个月均值较过去 12 个月低点回升 0.5pp',
    meaning: '美国战后衰退识别相当稳，但偏确认而非领先（平均滞后约 2–3 个月）',
    limit: 'OECD 国家需重标定阈值；结构变化会干扰' },
  { id: 'us-core-cpi', name: '核心 CPI 同比', region: 'US', layer: 'lagging', type: 'lagging', unit: '%', better: 'low',
    watch: '趋势；但拐点预警请看 PPI/CRB/运价/工资',
    meaning: '通胀是典型滞后变量：适合定阶段，不适合做拐点预警',
    limit: '用 CPI 做拐点预警通常太晚' },
  { id: 'us-ppis', name: 'PPI / CRB / 运价', region: 'US', layer: 'lagging', type: 'lagging', unit: '%', better: 'low',
    watch: '拐点苗头',
    meaning: '比 CPI 更早看到通胀拐点',
    limit: '商品属性强，受供给冲击影响大' },
  { id: 'us-inv-sales', name: '库存 / 销售比', region: 'US', layer: 'lagging', type: 'lagging', unit: '比值', better: 'low',
    watch: '被动补库还是主动去库',
    meaning: '库存是滞后变量：被动去库结束+新订单回升是扩张信号',
    limit: '行业差异巨大' },
  { id: 'cn-inv', name: '中国产成品存货同比', region: 'CN', layer: 'lagging', type: 'lagging', unit: '%', better: 'low',
    watch: '与营业收入同比对照划分库存四阶段',
    meaning: '基钦库存周期（约 3.3 年）的核心变量',
    limit: '价格往往是库存拐点的先兆，库存本身滞后' },

  // —— 第五层：市场与情绪 ——
  { id: 'us-cape', name: 'CAPE 席勒市盈率', region: 'US', layer: 'sentiment', type: 'leading', unit: '倍', better: 'low',
    watch: '水平与分位数',
    meaning: '东西贵不贵；估值高=赔率差',
    limit: '长期均值回归可能迟到很久' },
  { id: 'us-erp', name: '股权风险溢价 ERP', region: 'US', layer: 'sentiment', type: 'leading', unit: '%', better: 'high',
    watch: '分位数',
    meaning: '股债性价比；ERP 极低时常对应过热尾部',
    limit: '无风险利率口径影响大' },
  { id: 'us-breadth', name: '市场广度（新高家数/涨跌比）', region: 'US', layer: 'sentiment', type: 'leading', unit: '家', better: 'high',
    watch: '等权 vs 市值加权背离',
    meaning: '指数新高而广度变差 = 背离，提高监测频率',
    limit: '背离不是立刻反向开仓的理由' },
  { id: 'us-vix', name: 'VIX 方向与期限结构', region: 'US', layer: 'sentiment', type: 'leading', unit: '点', better: 'low',
    watch: '方向与远期升水/贴水',
    meaning: 'VIX 的水平不如方向和期限结构有信息',
    limit: '容易被事件脉冲扭曲' },
  { id: 'cn-margin', name: '融资余额 / 杠杆资金', region: 'CN', layer: 'sentiment', type: 'leading', unit: '亿元', better: 'low',
    watch: '增速与占比',
    meaning: '杠杆是情绪的放大器',
    limit: '规模随市值自然增长' },
  { id: 'us-ipo', name: 'IPO / 垃圾债发行环境', region: 'US', layer: 'sentiment', type: 'leading', unit: '家', better: 'low',
    watch: '是否“什么都能发出去”',
    meaning: '一级市场融资狂热是过热尾部的经典特征；融资突然关闭常早于崩盘',
    limit: '监管周期会干扰' },

  // —— 第六层：结构脆弱性 ——
  { id: 'gl-bis-gap', name: 'BIS 信贷/GDP 缺口', region: 'GL', layer: 'fragility', type: 'lagging', unit: 'pp', better: 'low',
    watch: '缺口是否长期处于高位',
    meaning: '金融周期的中期脆弱性度量',
    limit: '不是最及时的危机指标（IMF：股价、房价、产出缺口更及时）' },
  { id: 'cn-debt-ratio', name: '中国宏观杠杆率（分部门）', region: 'CN', layer: 'fragility', type: 'lagging', unit: '%', better: 'low',
    watch: '政府/居民/企业谁在加杠杆',
    meaning: '判断“普通衰退还是资产负债表衰退”',
    limit: '口径变化多' },
  { id: 'gl-productivity', name: '生产率增长', region: 'GL', layer: 'fragility', type: 'lagging', unit: '%', better: 'high',
    watch: '真实增长 vs 加杠杆增长',
    meaning: '达利欧长周期锚：生产率决定长期收入',
    limit: '难以高频观测' },
  { id: 'cn-house-price', name: '房价相对趋势缺口', region: 'CN', layer: 'fragility', type: 'lagging', unit: '%', better: 'low',
    watch: '相对长期趋势的偏离',
    meaning: 'IMF：新兴市场“股价+房价+信贷缺口”组合预警能力最好',
    limit: '数据口径多、区域分化大' },
];

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
