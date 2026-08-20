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

### 数据覆盖（40 项自动 + 手动扩展）

| 来源 | 指标 |
|---|---|
| FRED（免 Key） | 美债曲线 2s10s/3m10s、HY OAS、BAA-AAA、TIPS 实际利率、M2 同比、NFCI 金融条件、WEI 周度经济指数、初请失业金、新屋开工/营建许可、核心资本品订单、铜价同比、工业产出、零售、非农、失业率、核心 CPI、PPI、库存销售比、VIX、标普500、联邦基金利率 |
| 东方财富 | 中国制造业 PMI、PMI 新订单、M1/M2 同比、M1-M2 剪刀差（推导）、CPI、PPI、工业增加值、GDP、**LPR、新增人民币贷款、国房景气指数、北京房价** |
| 国家统计局 | 城镇调查失业率 |
| 商务部 | 社融规模增量（官方源，更新滞后约 4 月，失败自动沿用旧值） |
| 新浪财经 | 上证指数、沪深 300（日频行情） |
| 手动扩展 | 恒生指数、CAPE、ERP、市场广度、融资余额、IPO 环境、信贷/GDP 缺口、宏观杠杆率、生产率 |

## ✨ 功能总览
| 模块 | 说明 |
|---|---|
| 📡 总览仪表盘 | **衰退红绿灯总分条**（5 信号合成）、自动分析摘要（四问四答 + Sahm + 时钟启发式定位）、AI 每日简报（多 Agent 辩论）、六层仪表盘、扩散趋势、两套时钟、三档协议 |
| 📊 指标库 | 40 项自动指标（🛰️ 徽标 + **更新频率/滞后警示**）+ 手动指标；信号可覆盖 |
| 📈 策略回测 | **三档协议 34 年历史回测** vs 买入持有：年化、最大回撤、下跌月保护率、档位分布图 |
| 📅 宏观日历 | 未来 30 天中美数据发布日程（自维护发布规则引擎）+ 已发布值回填 |
| 🧭 预测日志 | 情景树 + 证伪条件 + **到期复盘提醒 + 数据快照对比** + Brier 校准 |
| 🤖 AI 分析师 | 流式对话 + 一键动作，注入最新真实数据 |
| 🗂 数据源 | 每项数据的源/频率/滞后/状态登记 + 最近 40 次采集快照与成功率 |
| 🌊 长波档案 | 美国 60 年长历史（GDP/利率/债务/产能）+ 长波转折点标注 |
| 📚 知识库 | 方法论 / 大白话版 / 月度流程 |
| ⚙️ 设置 | 数据源状态、手动触发、备份、AI 配置 |
| 📱 PWA | 手机浏览器「添加到主屏幕」即可像 App 使用，离线可看上次数据 |

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
