# 宏观周期雷达 · Macro Cycle Radar

> 基于《宏观周期感知-研究报告》构建的 **AI 自动化宏观周期感知工作台**（纯前端 + GitHub Actions 数据流水线）。
> **不预测拐点，只提前感知风向。** —— 霍华德·马克斯："我们永远不知道下一步会去哪，但必须知道自己现在在哪。"
> **数据全自动：每天定时采集 → 清洗处理 → 自动分析 → 自动部署，无需任何手动操作。**

在线地址：**https://259773138.github.io/macro-cycle-radar/**

---

## 🛰️ 自动化数据流水线（核心）

```
每天 UTC 23:00（北京时间 07:00）GitHub Actions 自动执行：
① 采集：FRED（美国/全球 23 项，日度）+ 东方财富（中国 9 项：PMI/M1/M2/CPI/PPI/工业增加值/GDP）
② 处理：月度化 → 同比/剪刀差推导 → 改善/中性/恶化信号 → 扩散指数 → 三档协议建议
③ AI 简报：调用魔搭 Qwen（仓库 Secret）生成《每日宏观简报》
④ 提交数据到仓库（git 历史 = 数据历史）→ 构建 → 自动部署 GitHub Pages
```

- 失败容错：某指标采集失败自动沿用最近一次成功数据，并在「设置 → 数据源状态」标注。
- 手动触发：[Actions → 每日数据更新与部署 → Run workflow](https://github.com/259773138/macro-cycle-radar/actions/workflows/update-data.yml)
- 调整频率：修改 `.github/workflows/update-data.yml` 的 cron。

### 数据覆盖（32 项自动 + 手动扩展）

| 来源 | 指标 |
|---|---|
| FRED（免 Key） | 美债曲线 2s10s/3m10s、HY OAS、BAA-AAA、TIPS 实际利率、M2 同比、NFCI 金融条件、WEI 周度经济指数、初请失业金、新屋开工/营建许可、核心资本品订单、铜价同比、工业产出、零售、非农、失业率、核心 CPI、PPI、库存销售比、VIX、标普500、联邦基金利率 |
| 东方财富 | 中国制造业 PMI、PMI 新订单、M1/M2 同比、M1-M2 剪刀差（推导）、CPI、PPI、工业增加值、GDP |
| 手动扩展 | CAPE、ERP、市场广度、融资余额、IPO 环境、社融、LPR、城镇失业率、信贷/GDP 缺口、宏观杠杆率、生产率、房价缺口 |

## ✨ 功能总览

| 模块 | 说明 |
|---|---|
| 📡 总览仪表盘 | **自动分析摘要**（四问四答 + Sahm 规则 + 曲线倒挂/利差检查 + 时钟启发式定位）、AI 每日简报、六层仪表盘、扩散指数趋势、两套时钟、三档协议（自动建议档位） |
| 📊 指标库 | 自动指标（🛰️ 徽标，只读真实数据）+ 手动指标（自由维护）；信号可手动覆盖；按层/类型/地区/来源过滤 |
| 🧭 预测日志 | 情景树 + 概率 + 证伪条件 + 红队；到期四维打分 + Brier 概率校准看板 |
| 🤖 AI 分析师 | 流式对话 + 一键动作（情景树/月度复盘/证伪检查/大白话解释/红队），自动注入最新真实数据 |
| 📚 知识库 | 两份源文件的结构化精华：方法论、大白话版、月度操作流程 |
| ⚙️ 设置 | 数据源状态面板、手动触发更新、本地数据备份、AI 配置 |

## 🔌 AI 配置（OpenAI 兼容格式 + 魔搭）

**对话（本机）**：「AI 分析师」→「⚙️ 配置」→ 选服务商（OpenAI / 魔搭 / 自定义兼容服务）→ 填 Key → 「从服务器拉取」获取模型列表。

**每日简报（服务器）**：使用仓库 Secrets（`AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`），流水线自动调用，无需你操作。更换 Key：仓库 Settings → Secrets and variables → Actions。

## 🛠 本地开发

```bash
npm install
npm run dev            # 开发模式（加载 public/data 下的数据文件；无则用演示数据）
node scripts/fetch-data.mjs   # 手动采集一次真实数据
AI_API_KEY=xxx AI_BASE_URL=... AI_MODEL=... node scripts/ai-report.mjs  # 本地生成 AI 简报
npm run build
```

技术栈：Vite + React 18 + TypeScript + Zustand + Recharts。数据 JSON 位于 `public/data/`。

## 📂 目录结构

```
scripts/fetch-data.mjs   # 数据采集（FRED + 东财）与处理
scripts/ai-report.mjs    # AI 每日简报生成
.github/workflows/update-data.yml  # 每日定时流水线
.github/workflows/deploy.yml       # 代码推送自动部署
src/lib/builtin.json     # 指标元数据（前端与脚本共用）
src/lib/store.ts         # 状态管理（自动数据 + 本地自定义合并）
public/data/             # 采集产物（indicators.json / meta.json / ai-report.md）
```

## ⚠️ 免责声明

自动分析为规则引擎与 AI 生成，宏观数据来自公开免费源（可能存在延迟与修订），仅供研究参考，**不构成任何投资建议**。市场有风险，决策需独立判断。宏观分析的目标是"提前感知环境变化并据此调整风险敞口"，而非预测涨跌。
