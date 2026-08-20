import { useMemo } from 'react';
import { marked } from 'marked';
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { useStore, aggregateSignals, suggestTier, diffusion } from '../lib/store';
import { CN_QUADRANTS, QUADRANTS, TIER_META, LIGHT_LEVEL_META, recessionLights } from '../lib/utils';
import { fmtMonth, lastNMonths } from '../lib/types';
import { LAYERS, IndicatorRecord, IndicatorType, Quadrant, Signal } from '../lib/types';
import { SignalBadge } from '../components/Badges';

const TYPE_LABEL: Record<IndicatorType, string> = { leading: '领先', coincident: '同步', lagging: '滞后' };

function layerColor(sig: Signal): string {
  return sig === 'up' ? '#059669' : sig === 'down' ? '#dc2626' : '#f59e0b';
}

// 原始方向（不看 better 偏好，用于时钟推导）
function rawDir(rec: IndicatorRecord | undefined): 'up' | 'down' | 'flat' {
  if (!rec) return 'flat';
  const pts = rec.monthly.filter((p) => p.value !== null && p.value !== undefined);
  if (pts.length < 2) return 'flat';
  const d = pts[pts.length - 1].value - pts[pts.length - 2].value;
  if (d > 1e-9) return 'up';
  if (d < -1e-9) return 'down';
  return 'flat';
}

function byId(indicators: IndicatorRecord[], id: string): IndicatorRecord | undefined {
  return indicators.find((i) => i.enabled && i.id === id);
}

function dirText(d: 'up' | 'down' | 'flat', upLabel: string, downLabel: string): string {
  return d === 'up' ? upLabel : d === 'down' ? downLabel : '持平';
}

function dirColor(d: 'up' | 'down' | 'flat'): string {
  return d === 'up' ? 'var(--green)' : d === 'down' ? 'var(--red)' : 'var(--muted)';
}

function sahmCheck(indicators: IndicatorRecord[]): { triggered: boolean; diff: number } | null {
  const ue = byId(indicators, 'us-ue');
  if (!ue) return null;
  const pts = ue.monthly.filter((p) => p.value !== null).map((p) => p.value);
  if (pts.length < 16) return null;
  const avg3 = (pts.slice(-3).reduce((a, b) => a + b, 0)) / 3;
  const min12 = Math.min(...pts.slice(-15, -3));
  const diff = Math.round((avg3 - min12) * 100) / 100;
  return { triggered: diff >= 0.5, diff };
}

export default function Dashboard() {
  const {
    indicators, tier, tierNote, setTier, quadrant, setQuadrant, cnQuadrant, setCnQuadrant,
    aiReport, dataMeta, demoMode, predictions,
  } = useStore();

  const enabled = useMemo(() => indicators.filter((i) => i.enabled), [indicators]);
  const total = enabled.length;
  const up = enabled.filter((i) => i.signal === 'up').length;
  const down = enabled.filter((i) => i.signal === 'down').length;
  const flat = total - up - down;

  const leadDiff = diffusion(indicators, 'leading');
  const coinDiff = diffusion(indicators, 'coincident');
  const lagDiff = diffusion(indicators, 'lagging');
  const totalDiff = leadDiff + coinDiff + lagDiff;

  const suggestion = useMemo(() => suggestTier(indicators), [indicators]);

  // 关键指标
  const usWei = byId(enabled, 'us-wei');
  const usCoreCpi = byId(enabled, 'us-core-cpi');
  const cnPmi = byId(enabled, 'cn-pmi');
  const cnCpi = byId(enabled, 'cn-cpi');
  const cnM1 = byId(enabled, 'cn-m1');
  const cnM2 = byId(enabled, 'cn-m2');
  const cnM1m2 = byId(enabled, 'cn-m1m2');
  const usVix = byId(enabled, 'us-vix');
  const usSp500 = byId(enabled, 'us-sp500');
  const us2s10s = byId(enabled, 'us-2s10s');
  const usHy = byId(enabled, 'us-hy-oas');
  const sahm = sahmCheck(enabled);

  // 时钟自动推导（启发式）
  const usGrowth = rawDir(usWei);
  const usInfl = rawDir(usCoreCpi);
  const cnGrowth = rawDir(cnPmi);
  const cnInfl = rawDir(cnCpi);
  const cnCredit = rawDir(cnM1) === 'flat' ? rawDir(cnM1m2) : rawDir(cnM1);
  const cnMoney = rawDir(cnM2);

  const usQuadrantSug: Quadrant = usGrowth === 'up' ? (usInfl === 'up' ? 'overheat' : 'recovery') : usGrowth === 'down' ? (usInfl === 'up' ? 'stagflation' : 'recession') : quadrant;
  const cnQuadrantSug: Quadrant = cnMoney === 'up' ? (cnCredit === 'up' ? 'recovery' : 'recession') : cnMoney === 'down' ? (cnCredit === 'up' ? 'overheat' : 'stagflation') : cnQuadrant;

  // 扩散趋势
  const months = lastNMonths(12);
  const diffTrend = useMemo(() => {
    return months.map((m) => {
      let upN = 0, downN = 0;
      for (const ind of enabled) {
        const pts = ind.monthly;
        const idx = pts.findIndex((p) => p.month === m);
        if (idx < 0) continue;
        const cur = pts[idx];
        const prev = pts[idx - 1] ?? pts[idx];
        const d = cur.value - prev.value;
        if (Math.abs(d) < 1e-9) continue;
        const good = ind.better === 'high' ? d > 0 : d < 0;
        if (good) upN++; else downN++;
      }
      return { month: fmtMonth(m), 扩散: upN - downN };
    });
  }, [enabled, months]);

  const t = TIER_META[tier];
  const q = QUADRANTS[quadrant];
  const cq = CN_QUADRANTS[cnQuadrant];
  const creditAgg = aggregateSignals(enabled.filter((i) => i.layer === 'credit').map((i) => i.signal));
  const sentiAgg = aggregateSignals(enabled.filter((i) => i.layer === 'sentiment').map((i) => i.signal));
  const fragAgg = aggregateSignals(enabled.filter((i) => i.layer === 'fragility').map((i) => i.signal));

  // P1-1 衰退红绿灯
  const lights = useMemo(() => recessionLights(enabled), [enabled]);
  const lightMeta = LIGHT_LEVEL_META[lights.level];

  // P1-5 到期预测提醒
  const today = new Date().toISOString().slice(0, 10);
  const duePredictions = predictions.filter((p) => p.status === 'open' && p.reviewDue && p.reviewDue <= today);
  const soonPredictions = predictions.filter((p) => {
    if (p.status !== 'open' || !p.reviewDue) return false;
    const days = (new Date(p.reviewDue).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  });

  const vixVal = usVix?.monthly?.slice(-1)[0]?.value;
  const vixText = vixVal === undefined ? '未知' : vixVal < 15 ? `低位（${vixVal}，市场平静/自满）` : vixVal < 25 ? `中性（${vixVal}）` : `高位（${vixVal}，恐慌）`;
  const inversion = us2s10s?.monthly?.slice(-1)[0]?.value ?? 0;
  const hyVal = usHy?.monthly?.slice(-1)[0]?.value;

  return (
    <div>
      <div className="hero">
        <h1>宏观周期雷达 · 全自动版</h1>
        <p>
          数据每日自动采集（FRED + 东方财富），信号、扩散、档位、时钟与简报自动生成——
          你只需要看结论。不预测拐点，只提前感知风向。
        </p>
        {demoMode && <div className="quote">⚠️ 当前为演示数据模式（未加载到自动数据文件，本地开发时正常；线上由每日流水线提供真实数据）。</div>}
      </div>

      {/* KPI */}
      <div className="grid grid-4 mb16">
        <div className="kpi">
          <div className="k">启用指标（自动+手动）</div>
          <div className="v">{total}</div>
          <div className="s">改善 {up} · 中性 {flat} · 恶化 {down}</div>
        </div>
        <div className="kpi">
          <div className="k">扩散指数（改善−恶化）</div>
          <div className="v" style={{ color: totalDiff > 0 ? 'var(--green)' : totalDiff < 0 ? 'var(--red)' : 'var(--muted)' }}>
            {totalDiff > 0 ? '+' : ''}{totalDiff}
          </div>
          <div className="s">领先 {leadDiff > 0 ? '+' : ''}{leadDiff} · 同步 {coinDiff > 0 ? '+' : ''}{coinDiff} · 滞后 {lagDiff > 0 ? '+' : ''}{lagDiff}</div>
        </div>
        <div className="kpi">
          <div className="k">当前协议档位</div>
          <div className="v" style={{ color: t.color }}>{t.name}</div>
          <div className="s">系统建议：{TIER_META[suggestion.tier].name}档</div>
        </div>
        <div className="kpi">
          <div className="k">周期定位</div>
          <div className="v" style={{ color: q.color, fontSize: 20 }}>{q.name} / {cq.name}</div>
          <div className="s">美林 {q.cn} · 货币信用 {cq.cn}</div>
        </div>
      </div>

      {/* P1-1 衰退红绿灯总分条 */}
      <div className="card" style={{ borderColor: lightMeta.color }}>
        <div className="spread">
          <div>
            <h3>🚦 美国衰退风险灯（5 信号合成）</h3>
            <p className="hint" style={{ marginBottom: 0 }}>0-1 绿灯扩张 · 2-3 黄灯警惕 · 4-5 红灯衰退风险高（借鉴 recession-indicator-dashboard）。</p>
          </div>
          <div className="badge" style={{ background: lightMeta.bg, color: lightMeta.color, fontSize: 14, padding: '8px 14px' }}>
            {lights.count} 盏亮 · {lightMeta.label}
          </div>
        </div>
        <div className="grid grid-4 mt16" style={{ gap: 10 }}>
          {lights.lights.map((l) => (
            <div key={l.id} style={{
              border: `1px solid ${l.on ? lightMeta.color : 'var(--border)'}`,
              background: l.on ? lightMeta.bg : '#fff',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="bold small">{l.label}</span>
                <span className="pill-dot" style={{ background: l.on ? lightMeta.color : '#cbd5e1' }} />
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>{l.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* P1-5 预测到期提醒 */}
      {(duePredictions.length > 0 || soonPredictions.length > 0) && (
        <div className={`alert-box ${duePredictions.length ? 'warn' : 'info'} mt16`}>
          <b>🧭 预测复盘提醒：</b>
          {duePredictions.map((p) => <div key={p.id}>· 「{p.mainScenario.label.slice(0, 30)}…」已到复盘日（{p.reviewDue}）——去「预测日志」打分，别让记忆改写历史。</div>)}
          {soonPredictions.map((p) => <div key={p.id}>· 「{p.mainScenario.label.slice(0, 30)}…」将在 {p.reviewDue}（{Math.ceil((new Date(p.reviewDue!).getTime() - Date.now()) / 86400000)} 天后）到期复盘。</div>)}
        </div>
      )}

      {/* 自动分析摘要 */}
      <div className="card">
        <h3>🤖 自动分析摘要（规则引擎 · 每日随数据更新）</h3>
        <p className="hint">按报告「月度四问」自动生成；时钟定位为启发式推导，仅供定位参考。</p>

        <div className="grid grid-2">
          <div>
            <div className="bold">① 流动性 / 信用：{dirText(creditAgg, '偏松（改善）', '偏紧（恶化）')}</div>
            <ul className="small muted" style={{ paddingLeft: 18, margin: '6px 0 12px' }}>
              <li>美债曲线 2s10s：{inversion < 0 ? `倒挂 ${inversion}bp（未来 6–18 个月衰退概率上升的信号）` : `未倒挂 ${inversion}bp`}；HY 利差 {hyVal !== undefined ? `${hyVal}bp${hyVal > 600 ? '（危机级！）' : ''}` : '—'}</li>
              <li>中国 M1 同比 {dirText(rawDir(cnM1), '↑ 回升（资金活化）', '↓ 回落')}；M1–M2 剪刀差 {dirText(rawDir(cnM1m2), '走扩', '收窄')}；M2 {dirText(cnMoney, '↑ 货币偏宽', '↓ 货币偏紧')}</li>
            </ul>
          </div>
          <div>
            <div className="bold">② 增长与通胀方向</div>
            <ul className="small muted" style={{ paddingLeft: 18, margin: '6px 0 12px' }}>
              <li>美国：WEI 增长动能 <b style={{ color: dirColor(usGrowth) }}>{dirText(usGrowth, '回升', '回落')}</b>；核心 CPI <b style={{ color: dirColor(usInfl) }}>{dirText(usInfl, '抬升', '回落')}</b></li>
              <li>中国：PMI <b style={{ color: dirColor(cnGrowth) }}>{dirText(cnGrowth, '回升', '回落')}</b>；CPI <b style={{ color: dirColor(cnInfl) }}>{dirText(cnInfl, '抬升', '回落')}</b></li>
              <li>Sahm 规则（美国失业率）：{sahm === null ? '数据不足' : sahm.triggered ? <b style={{ color: 'var(--red)' }}>已触发（+{sahm.diff}pp，衰退确认信号）</b> : <span style={{ color: 'var(--green)' }}>未触发（+{sahm.diff}pp）</span>}</li>
            </ul>
          </div>
          <div>
            <div className="bold">③ 市场定价的情景：{dirText(sentiAgg, '偏乐观', '偏谨慎')}</div>
            <ul className="small muted" style={{ paddingLeft: 18, margin: '6px 0 12px' }}>
              <li>VIX {vixText}；标普500 {dirText(rawDir(usSp500), '上行中', '回调中')}</li>
              <li>提示：贵不贵、疯不疯还要看估值与广度——估值/广度/融资余额等情绪指标为手动维护项，建议每月人工复核。</li>
            </ul>
          </div>
          <div>
            <div className="bold">④ 长周期脆弱性：{dirText(fragAgg, '在释放（改善）', '在累积（恶化）')}</div>
            <ul className="small muted" style={{ paddingLeft: 18, margin: '6px 0 12px' }}>
              <li>该层决定「普通衰退还是资产负债表衰退」；多数脆弱性指标（杠杆率、信贷/GDP 缺口、房价缺口）无免费自动源，建议每月人工核对一次。</li>
            </ul>
          </div>
        </div>

        <div className="spread mt8" style={{ borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
          <div className="small">
            <b>时钟启发式定位：</b>
            美林建议 <b style={{ color: QUADRANTS[usQuadrantSug].color }}>{QUADRANTS[usQuadrantSug].name}</b>（增长{dirText(usGrowth, '↑', '↓')} 通胀{dirText(usInfl, '↑', '↓')}）
            ｜ 货币×信用建议 <b style={{ color: CN_QUADRANTS[cnQuadrantSug].color }}>{CN_QUADRANTS[cnQuadrantSug].name}</b>（货币{dirText(cnMoney, '宽', '紧')} 信用{dirText(cnCredit, '宽', '紧')}）
          </div>
          <div className="row">
            <button className="btn sm" onClick={() => { setQuadrant(usQuadrantSug); setCnQuadrant(cnQuadrantSug); }}>采纳建议定位</button>
          </div>
        </div>
      </div>

      {/* AI 每日简报 */}
      {aiReport && (
        <div className="card mt16">
          <h3>🧠 AI 每日简报（魔搭 Qwen 自动生成）</h3>
          <div className="md small" style={{ maxHeight: 560, overflowY: 'auto' }}
            dangerouslySetInnerHTML={{ __html: marked.parse(aiReport.text) as string }} />
        </div>
      )}

      {/* 三档协议 */}
      <div className="card mt16">
        <h3>🎚️ 拐点识别协议（观察 → 预警 → 确认）</h3>
        <p className="hint">禁止从“一个数据”直接跳到“改世界观”。当前档位由你决定，系统只给建议。</p>
        <div className="tier-cards">
          {(['watch', 'warn', 'confirm'] as const).map((k) => {
            const m = TIER_META[k];
            return (
              <div key={k} className={`tier-card ${tier === k ? 'sel' : ''}`} onClick={() => setTier(k)}>
                <div className="tn" style={{ color: m.color }}>{m.name}档</div>
                <div className="td">{m.desc}</div>
                <div className="ta">▸ {m.action}</div>
              </div>
            );
          })}
        </div>
        {tierNote && <div className="mt8 small muted">备注：{tierNote}</div>}
        <div className={`alert-box mt16 ${suggestion.tier === 'confirm' ? 'danger' : suggestion.tier === 'warn' ? 'warn' : 'info'}`}>
          <b>系统建议：{TIER_META[suggestion.tier].name}档。</b>{' '}
          {suggestion.reasons.map((r, i) => <div key={i}>· {r}</div>)}
        </div>
      </div>

      {/* 六层仪表盘 */}
      <div className="card mt16">
        <h3>🧭 六层仪表盘</h3>
        <p className="hint">长期看地基 → 中期看信用 → 短期看需求 → 再看库存与盈利 → 再看贵不贵 → 最后看大家疯不疯。</p>
        <div>
          {LAYERS.map((l) => {
            const list = enabled.filter((i) => i.layer === l.id);
            const agg = aggregateSignals(list.map((i) => i.signal));
            return (
              <div className="layer-row" key={l.id}>
                <div className="layer-no" style={{ background: `${layerColor(agg)}15`, color: layerColor(agg) }}>{l.no}</div>
                <div className="layer-body">
                  <div className="spread">
                    <div className="layer-name">
                      {l.name}
                      <span className="badge gray" style={{ marginLeft: 8 }}>{list.length} 项</span>
                    </div>
                    <SignalBadge signal={agg} />
                  </div>
                  <div className="layer-desc">{l.desc}</div>
                  <div className="layer-dots mt8">
                    {list.map((i) => <span key={i.id} className={`dot ${i.signal}`} title={`${i.name}：${i.signal === 'up' ? '改善' : i.signal === 'down' ? '恶化' : '中性'}`} />)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 两套时钟 */}
      <div className="grid grid-2 mt16">
        <div className="card">
          <h3>🕐 美林时钟 · 增长 × 通胀（点击选择当前阶段）</h3>
          <p className="hint">美国 1970–2020 大类资产正确率约 88%；用于全球/美国视角。</p>
          <div className="clock">
            {(Object.keys(QUADRANTS) as Quadrant[]).map((k) => {
              const m = QUADRANTS[k];
              return (
                <div key={k} className={`q ${quadrant === k ? 'sel' : ''}`} onClick={() => setQuadrant(k)}>
                  <div className="qn"><span className="qdot" style={{ background: m.color }} />{m.name}<span className="faint small">{m.cn}</span></div>
                  <div className="qc">{m.desc}</div>
                  <div className="qa">占优资产：<b>{m.assetOrder}</b></div>
                </div>
              );
            })}
          </div>
          <div className={`alert-box ${quadrant === 'recovery' ? 'ok' : quadrant === 'recession' ? 'info' : quadrant === 'overheat' ? 'warn' : 'danger'} mt16`}>
            <b>{q.name}阶段提示：</b>{q.tip}
          </div>
        </div>

        <div className="card">
          <h3>🕐 货币 × 信用时钟（中国改良版，点击选择）</h3>
          <p className="hint">传统美林时钟在中国正确率约 40%；改为货币×信用后 2002–2020 样本约 73%。</p>
          <div className="clock">
            {(Object.keys(CN_QUADRANTS) as Quadrant[]).map((k) => {
              const m = CN_QUADRANTS[k];
              return (
                <div key={k} className={`q ${cnQuadrant === k ? 'sel' : ''}`} onClick={() => setCnQuadrant(k)}>
                  <div className="qn"><span className="qdot" style={{ background: m.color }} />{m.name}<span className="faint small">{m.cn}</span></div>
                  <div className="qc">{m.desc}</div>
                  <div className="qa">占优资产：<b>{m.asset}</b>（历史正确率 {m.acc}）</div>
                </div>
              );
            })}
          </div>
          <div className={`alert-box ${cnQuadrant === 'recovery' ? 'ok' : cnQuadrant === 'recession' ? 'info' : cnQuadrant === 'overheat' ? 'warn' : 'danger'} mt16`}>
            <b>{cq.name}阶段提示：</b>{cq.tip}
          </div>
          <div className="alert-box gray mt16 small">
            两套时钟打架时：<b>信用与流动性优先于滞后的增长/通胀读数</b>。政策与信用是因，GDP 与 CPI 是果。
          </div>
        </div>
      </div>

      {/* 扩散趋势 */}
      <div className="card mt16">
        <h3>📈 扩散指数趋势（近 12 个月）</h3>
        <p className="hint">扩散指数 = 改善指标数 − 恶化指标数。不要问“一个指标有没有报警”，要问“多少指标同时报警”。</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={diffTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={32} />
            <Tooltip />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Bar dataKey="扩散" radius={[4, 4, 0, 0]}>
              {diffTrend.map((d, i) => (
                <Cell key={i} fill={d.扩散 >= 0 ? '#059669' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
