#!/usr/bin/env node
/**
 * AI 每日简报 v2 —— 多 Agent 辩论式（借鉴 TradingAgents / PanWatch）
 * 角色：多头分析师 → 空头分析师 → 风控官 → 裁判（综合输出最终简报）
 * 依赖 Secrets：AI_API_KEY / AI_BASE_URL / AI_MODEL
 * 输出：public/data/ai-report.md
 * 容错：任一角色失败时降级为单次调用。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const OUT = join(DATA_DIR, 'ai-report.md');

const BASE_URL = (process.env.AI_BASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.AI_MODEL || '';

const SIG = { up: '改善', flat: '中性', down: '恶化' };
const LAYER = { credit: '① 信用与流动性', leading: '② 实体领先指标', coincident: '③ 同步指标', lagging: '④ 滞后指标', sentiment: '⑤ 市场与情绪', fragility: '⑥ 结构脆弱性' };
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
  } catch { return '（无数据）'; }
}

async function call(messages) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, max_tokens: 1200 }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`AI 接口 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 返回为空');
  return content;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!BASE_URL || !API_KEY || !MODEL) {
    console.log('未配置 AI Secrets，跳过 AI 简报。');
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

  const common = `【重要】今天是 ${nowStr}，数据截止至 ${dataDate}，请严格使用这两个日期，不要虚构其他日期。
方法论：不预测拐点只提前感知；六层仪表盘（信用流动性→领先→同步→滞后→情绪→脆弱性）；三档协议（观察/预警/确认，仓位倾斜1/3~1/2而非一把梭）；情景树必须可证伪（4-8周证伪条件）；禁止"必然涨跌"承诺；分析正确≠投资正确。

以下是当前宏观仪表盘数据：
${summary}`;

  const roles = [
    {
      name: '多头分析师', icon: '🐂',
      prompt: `${common}\n\n你是【多头分析师】。请基于数据中支撑经济增长与风险资产的观点，给出 3-4 条最强看多论据（每条必须引用具体指标数值与逻辑，180 字内）。`,
    },
    {
      name: '空头分析师', icon: '🐻',
      prompt: `${common}\n\n你是【空头分析师】。请基于数据中预示走弱、背离与脆弱性的部分，给出 3-4 条最强看空论据（每条必须引用具体指标数值与逻辑，180 字内）。`,
    },
    {
      name: '风控官', icon: '🛡️',
      prompt: `${common}\n\n你是【风控官】。不站队多空，只评估：①当前最值得警惕的 2-3 个尾部风险/背离信号 ②三档协议应处于哪一档（观察/预警/确认）及理由 ③建议的仓位倾斜方向与幅度（180 字内）。`,
    },
  ];

  const header = `> 🤖 本简报由多 Agent 辩论生成（多头 🐂 × 空头 🐻 × 风控 🛡️ → 裁判 ⚖️）于 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 模型 ${MODEL} · 仅供研究参考，不构成投资建议\n\n---\n\n`;

  try {
    const rounds = [];
    for (const r of roles) {
      const out = await call([{ role: 'user', content: r.prompt }]);
      rounds.push(`## ${r.icon} ${r.name}\n\n${out.trim()}`);
      console.log(`✅ ${r.name} 完成`);
    }
    const judgePrompt = `${common}\n\n你是【裁判】。以下是多空辩论与风控意见，请主持裁决并输出最终《每日宏观简报》（中文 Markdown）：\n\n${rounds.join('\n\n')}\n\n输出格式要求：\n# 每日宏观简报（${nowStr}，数据截至 ${dataDate}）\n## 一句话总览（30字内）\n## 多空裁决（谁更有说服力，为什么，2-3句）\n## 六层仪表盘要点（每层一句话）\n## 关键变化与扩散（同向恶化/改善项、背离、二阶导）\n## 三档协议建议（档位+仓位倾斜建议）\n## 情景树（基准/上行/下行+概率+4-8周证伪条件）\n## 风险提示与红队视角\n总长 600-900 字，精炼专业。`;
    const verdict = await call([{ role: 'user', content: judgePrompt }]);
    console.log('✅ 裁判完成');
    writeFileSync(OUT, header + verdict);
    console.log('✅ AI 多 Agent 简报已生成');
  } catch (e) {
    console.error('多 Agent 流程失败，降级为单次调用：', String(e.message || e).slice(0, 200));
    try {
      const out = await call([{
        role: 'user',
        content: `${common}\n\n请直接输出一份《每日宏观简报》（中文 Markdown）：一句话总览、六层要点、关键变化与扩散、三档协议建议、情景树（含证伪条件）、风险提示。500-800 字。`,
      }]);
      writeFileSync(OUT, header + out);
      console.log('✅ 降级简报已生成');
    } catch (e2) {
      console.error('降级也失败（不影响部署）：', String(e2.message || e2).slice(0, 200));
      process.exit(0);
    }
  }
}

main().catch((e) => { console.error('AI 简报失败（不影响部署）：', String(e.message || e).slice(0, 300)); process.exit(0); });
