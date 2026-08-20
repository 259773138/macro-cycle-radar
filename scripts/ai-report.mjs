#!/usr/bin/env node
/**
 * AI 每日简报 —— 数据更新后调用 OpenAI 兼容 API（魔搭/OpenAI 均可）生成中文宏观简报。
 * 依赖仓库 Secrets：AI_API_KEY / AI_BASE_URL / AI_MODEL（缺失则跳过，前端自动隐藏该卡片）。
 * 输出：public/data/ai-report.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const OUT = join(DATA_DIR, 'ai-report.md');

const BASE_URL = process.env.AI_BASE_URL || '';
const API_KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.AI_MODEL || '';

const SIG = { up: '改善', flat: '中性', down: '恶化' };
const LAYER = {
  credit: '① 信用与流动性', leading: '② 实体领先指标', coincident: '③ 同步指标',
  lagging: '④ 滞后指标', sentiment: '⑤ 市场与情绪', fragility: '⑥ 结构脆弱性',
};
const REGION = { US: '美国', CN: '中国', GL: '全球' };

function buildSummary() {
  try {
    const data = JSON.parse(readFileSync(join(DATA_DIR, 'indicators.json'), 'utf8'));
    const lines = [];
    for (const r of data.indicators) {
      const last = r.monthly[r.monthly.length - 1];
      const prev = r.monthly[r.monthly.length - 2] || last;
      lines.push(`- [${LAYER[r.layer] || r.layer}][${REGION[r.region] || r.region}] ${r.name}: 最新 ${last.value}${r.unit}（上期 ${prev.value}），信号${SIG[r.signal] || r.signal}${r.stale ? '（沿用旧数据）' : ''}`);
    }
    return lines.join('\n');
  } catch {
    return '（无数据）';
  }
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!BASE_URL || !API_KEY || !MODEL) {
    console.log('未配置 AI Secrets，跳过 AI 简报（前端将只显示规则引擎摘要）。');
    return;
  }
  const summary = buildSummary();
  const dataDate = (() => {
    try {
      const d = JSON.parse(readFileSync(join(DATA_DIR, 'indicators.json'), 'utf8'));
      return d.indicators?.[0]?.monthly?.slice(-1)[0]?.month || '近期';
    } catch { return '近期'; }
  })();
  const nowStr = new Date().toISOString().slice(0, 10);
  const prompt = `你是资深宏观策略分析师，方法论遵循：不预测拐点只提前感知；六层仪表盘（信用流动性→领先→同步→滞后→情绪→脆弱性）；三档协议（观察/预警/确认）；情景树必须可证伪；仓位倾斜而非一把梭。

【重要】今天是 ${nowStr}，数据截止至 ${dataDate}，简报标题与内容请严格使用这两个日期，不要虚构其他日期。

以下是当前宏观仪表盘数据：
${summary}

请输出一份《每日宏观简报》（中文 Markdown），要求：
# 每日宏观简报（${nowStr}，数据截至 ${dataDate}）
## 一句话总览（30字内）
## 六层仪表盘要点（每层一句话，标注信号）
## 关键变化与扩散（哪些指标同向变差/变好、有无背离、二阶导变化）
## 三档协议建议（观察/预警/确认 + 理由，仓位倾斜建议）
## 情景树（基准/上行/下行 + 概率 + 4-8周证伪条件）
## 风险提示与红队视角（最强反方论点）
总长 500-800 字，语言精炼专业，禁止给出"必然涨跌"式承诺，注明"分析正确≠投资正确"。`;

  const url = BASE_URL.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.4 }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`AI 接口 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 返回为空');
  const header = `> 🤖 本简报由 AI 自动生成于 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 模型 ${MODEL} · 仅供研究参考，不构成投资建议\n\n---\n\n`;
  writeFileSync(OUT, header + content);
  console.log('✅ AI 简报已生成');
}

main().catch((e) => {
  console.error('AI 简报失败（不影响部署）：', String(e.message || e).slice(0, 300));
  process.exit(0); // 简报失败不阻塞主流程
});
