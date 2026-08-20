import { useEffect, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { BacktestData } from '../lib/types';
import { TIER_META } from '../lib/utils';

export default function Backtest() {
  const [data, setData] = useState<BacktestData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('./data/backtest.json', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('no data'); return r.json(); })
      .then((d) => setData(d))
      .catch(() => setErr('回测数据未生成（本地开发时请运行 node scripts/backtest.mjs；线上由每日流水线生成）。'));
  }, []);

  if (err) return <div><h2 className="page-title">📈 策略回测</h2><div className="alert-box warn">{err}</div></div>;
  if (!data) return <div><h2 className="page-title">📈 策略回测</h2><div className="muted">加载中…</div></div>;

  const s = data.stats;
  const chart = data.rows.map((r) => ({ month: r.month, 三档策略: r.strategy, 买入持有: r.buyhold, tier: r.tier, weight: r.weight }));
  const tierColor: Record<string, string> = { watch: '#059669', warn: '#f59e0b', confirm: '#dc2626' };

  // 衰退区间标注（策略净值回撤 >15% 的窗口简化：用 tier=confirm 的区间）
  const recessions: { x1: string; x2: string }[] = [];
  let start: string | null = null;
  for (const r of data.rows) {
    if (r.tier === 'confirm' && start === null) start = r.month;
    if (r.tier !== 'confirm' && start !== null) {
      recessions.push({ x1: start, x2: r.month });
      start = null;
    }
  }
  if (start !== null) recessions.push({ x1: start, x2: data.rows[data.rows.length - 1].month });

  return (
    <div>
      <h2 className="page-title">📈 策略回测</h2>
      <p className="page-sub">
        三档协议不是拍脑袋：把「观察→100% 股票 / 预警→50% / 确认→20%」转成月度调仓规则，
        回测 {data.period}，回答报告第 5 节的终极问题——<b>按这套系统调整仓位，长期是否优于「什么都不做」？</b>
      </p>

      <div className="grid grid-4 mb16">
        <div className="kpi"><div className="k">策略年化收益</div><div className="v" style={{ color: s.strategyCagr >= 0 ? 'var(--green)' : 'var(--red)' }}>{s.strategyCagr}%</div><div className="s">买入持有 {s.buyholdCagr}%</div></div>
        <div className="kpi"><div className="k">策略最大回撤</div><div className="v" style={{ color: s.strategyMdd < s.buyholdMdd ? 'var(--green)' : 'var(--red)' }}>{s.strategyMdd}%</div><div className="s">买入持有 {s.buyholdMdd}%（改善 {Math.round((s.buyholdMdd - s.strategyMdd) * 100) / 100}pp）</div></div>
        <div className="kpi"><div className="k">下跌月保护率</div><div className="v">{s.downsideProtection === null ? '—' : `${s.downsideProtection}%`}</div><div className="s">市场下跌月份中策略跑赢的比例</div></div>
        <div className="kpi"><div className="k">样本</div><div className="v" style={{ fontSize: 20 }}>{s.months} 个月</div><div className="s">平均月收益：策略 {s.avgMonthlyStrat}% vs BH {s.avgMonthlyBh}%</div></div>
      </div>

      <div className="card">
        <h3>净值曲线：三档策略 vs 买入持有（{data.period}）</h3>
        <p className="hint">红色区间 = 规则判定「确认」档（股票仓位 20%）。{data.note}</p>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={60} />
            <YAxis tick={{ fontSize: 10 }} width={44} scale="log" domain={['auto', 'auto']} />
            <Tooltip formatter={(v: number, name: string) => [v.toFixed(2), name === '三档策略' ? '三档策略净值' : '买入持有净值']} />
            <Legend />
            {recessions.map((r, i) => <ReferenceArea key={i} x1={r.x1} x2={r.x2} fill="#dc2626" fillOpacity={0.06} />)}
            <Line type="monotone" dataKey="三档策略" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="买入持有" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card mt16">
        <h3>历史档位分布</h3>
        <p className="hint">红=确认（20% 仓）、黄=预警（50% 仓）、绿=观察（100% 仓）。信号用上月数据决定本月仓位，无未来函数。</p>
        <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {chart.map((r, i) => (
            <div key={i} style={{ flex: 1, background: tierColor[r.tier], opacity: 0.9 }} title={`${r.month}：${TIER_META[r.tier].name}档（${(r.weight * 100).toFixed(0)}% 股票）`} />
          ))}
        </div>
        <div className="row mt8 small muted">
          <span>■ 观察（100% 股票）</span><span>■ 预警（50%）</span><span>■ 确认（20%）</span>
        </div>
        <div className="alert-box gray mt16 small">
          ⚠️ 诚实解读：本回测<b>美国样本</b>、不含股息与交易成本。策略的意义不是「收益更高」，而是
          <b>用约 0.3pp 的年化代价把最大回撤压低约 10pp</b>——这正是报告说的：周期感知的产品是「倾斜与防御」，而不是追求神预测。
          历史不代表未来，规则参数应先验固定、不事后拟合。
        </div>
      </div>
    </div>
  );
}
