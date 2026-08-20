import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { useStore, aggregateSignals, suggestTier, diffusion } from '../lib/store';
import { CN_QUADRANTS, QUADRANTS, TIER_META } from '../lib/utils';
import { fmtMonth, lastNMonths } from '../lib/types';
import { LAYERS, IndicatorType, Quadrant } from '../lib/types';
import { SignalBadge } from '../components/Badges';

const TYPE_LABEL: Record<IndicatorType, string> = { leading: '领先', coincident: '同步', lagging: '滞后' };

function layerColor(sig: 'up' | 'flat' | 'down'): string {
  return sig === 'up' ? '#059669' : sig === 'down' ? '#dc2626' : '#f59e0b';
}

export default function Dashboard() {
  const { indicators, tier, tierNote, setTier, quadrant, setQuadrant, cnQuadrant, setCnQuadrant } = useStore();

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

  // 扩散趋势：重建近 12 个月信号
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

  return (
    <div>
      <div className="hero">
        <h1>宏观周期雷达</h1>
        <p>
          不预测拐点，只提前感知风向：用六层仪表盘定位周期、用三档协议分级反应、用预测日志检验自己。
          现在的位置比明天的涨跌更重要 —— 马克斯：<i>“我们永远不知道下一步会去哪，但必须知道自己现在在哪。”</i>
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-4 mb16">
        <div className="kpi">
          <div className="k">启用指标</div>
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
          <div className="s">建议档位：{TIER_META[suggestion.tier].name}</div>
        </div>
        <div className="kpi">
          <div className="k">周期定位（美林 × 货币信用）</div>
          <div className="v" style={{ color: q.color, fontSize: 20 }}>{q.name} / {cq.name}</div>
          <div className="s">{q.cn} · {cq.cn}</div>
        </div>
      </div>

      {/* 三档协议 */}
      <div className="card">
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
