import { useEffect, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { LongwaveData } from '../lib/types';

const ANNO_COLOR: Record<string, string> = {
  regime: '#2563eb', cycle: '#dc2626', shock: '#d97706', policy: '#7c3aed',
};

export default function Longwave() {
  const [data, setData] = useState<LongwaveData | null>(null);
  const [err, setErr] = useState('');
  const [focus, setFocus] = useState<string>('gdpc1');

  useEffect(() => {
    fetch('./data/longwave.json', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('no data'); return r.json(); })
      .then((d) => setData(d))
      .catch(() => setErr('长波数据未生成（本地开发时请运行 node scripts/longwave.mjs；线上由每日流水线生成）。'));
  }, []);

  if (err) return <div><h2 className="page-title">🌊 长波档案</h2><div className="alert-box warn">{err}</div></div>;
  if (!data) return <div><h2 className="page-title">🌊 长波档案</h2><div className="muted">加载中…</div></div>;

  const seriesList = Object.values(data.series);
  const focused = data.series[focus];
  const chartData = focused?.yearly.map((p) => ({
    year: p.year,
    [focused.name]: p.value,
    ...Object.fromEntries(Object.values(data.series).map((s) => [[s.id, undefined]])),
  }));

  // 当前值（取每个序列最近一年）
  const latest = Object.fromEntries(seriesList.map((s) => [s.id, s.yearly[s.yearly.length - 1]?.value]));

  return (
    <div>
      <h2 className="page-title">🌊 长波档案</h2>
      <p className="page-sub">
        「长周期判断这是什么游戏」：达利欧说长期看生产率与债务，康波看技术范式。本页把美国 60 年长历史拉出来，
        叠加学术共识的 regime 转折点（借鉴 kairos-atlas Long Wave Atlas），回答报告第一问——<b>我们现在站在哪一层周期的哪一段</b>。
      </p>

      <div className="grid grid-4 mb16">
        {seriesList.slice(0, 4).map((s) => (
          <div key={s.id} className={`kpi ${focus === s.id ? '' : ''}`} style={focus === s.id ? { borderColor: 'var(--primary)' } : { cursor: 'pointer' }} onClick={() => setFocus(s.id)}>
            <div className="k">{s.name}</div>
            <div className="v" style={{ fontSize: 18 }}>{latest[s.id] ?? '—'}</div>
            <div className="s">{s.unit} · 年均值</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>{focused?.name}（{focused?.yearly[0]?.year}–{focused?.yearly[focused?.yearly.length - 1]?.year} 年，年度均值）</h3>
        <p className="hint">点击上方卡片切换序列；彩色竖线为长波转折点标注。</p>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} minTickGap={50} />
            <YAxis tick={{ fontSize: 10 }} width={54} domain={['auto', 'auto']} />
            <Tooltip />
            {data.annotations.map((a) => (
              <ReferenceLine key={a.year} x={String(a.year)} stroke={ANNO_COLOR[a.type] ?? '#94a3b8'} strokeDasharray="4 3" strokeWidth={1.2}
                label={{ value: `${a.year} ${a.label}`, position: 'top', fontSize: 10, fill: ANNO_COLOR[a.type] ?? '#94a3b8' }} />
            ))}
            <Line type="monotone" dataKey={focused?.name ?? ''} stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card mt16">
        <h3>长波转折点标注（学术共识示意）</h3>
        <div className="row">
          {data.annotations.map((a) => (
            <span key={a.year} className="badge" style={{ background: (ANNO_COLOR[a.type] ?? '#94a3b8') + '15', color: ANNO_COLOR[a.type] ?? '#94a3b8' }}>
              {a.year} · {a.label}
            </span>
          ))}
        </div>
        <div className="alert-box gray mt16 small">
          <b>怎么读长波：</b>把当前读数放进 60 年坐标里看——GDP 增长中枢是否在下移（生产率 vs 加杠杆）、10 年美债收益率处于什么位置（利率长周期）、
          政府债务/GDP 在哪个区间（达利欧长债务周期位置）、产能利用率周期位置（朱格拉）。<br />
          <b>框架提示：</b>长周期（50–75 年长债周期）决定「这是什么游戏」；中周期（7–11 年朱格拉）决定盈利斜率；短周期（3–4 年基钦库存）决定年内节奏。
          标注为学术共识示意，不构成投资建议。
        </div>
      </div>

      <div className="card mt16">
        <h3>全部序列一览</h3>
        <table className="tbl">
          <thead><tr><th>序列</th><th>起点</th><th>最新（年均）</th><th>单位</th></tr></thead>
          <tbody>
            {seriesList.map((s) => (
              <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setFocus(s.id)}>
                <td className="bold small">{s.name}</td>
                <td className="num small">{s.yearly[0]?.year}</td>
                <td className="num small bold">{latest[s.id] ?? '—'}</td>
                <td className="small muted">{s.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
