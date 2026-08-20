import { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../lib/store';
import {
  BUILTIN_INDICATORS, IndicatorRecord, LAYERS, REGIONS, Signal, TYPE_NAMES, todayISO, uid,
} from '../lib/types';
import { fmtMonth } from '../lib/types';
import { metaToRecord } from '../lib/seed';
import { LayerBadge, RegionBadge, SignalBadge, TypeBadge } from '../components/Badges';
import { consecutiveBad, consecutiveGood } from '../lib/store';

const EMPTY: IndicatorRecord = {
  id: '', name: '', region: 'US', layer: 'credit', type: 'leading', unit: '',
  better: 'high', watch: '', meaning: '', limit: '', enabled: true, monthly: [], signal: 'flat',
  updatedAt: todayISO(), tags: [],
};

function miniSeries(rec: IndicatorRecord) {
  return rec.monthly.map((m) => ({ ...m, label: fmtMonth(m.month) }));
}

export default function Indicators() {
  const { indicators, upsertIndicator, removeIndicator } = useStore();
  const [region, setRegion] = useState<string>('all');
  const [layer, setLayer] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [sig, setSig] = useState<string>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<IndicatorRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<IndicatorRecord | null>(null);
  const [libOpen, setLibOpen] = useState(false);

  const filtered = useMemo(() => {
    return indicators.filter((i) => {
      if (region !== 'all' && i.region !== region) return false;
      if (layer !== 'all' && i.layer !== layer) return false;
      if (type !== 'all' && i.type !== type) return false;
      if (sig !== 'all' && i.signal !== sig) return false;
      if (q && !i.name.includes(q) && !i.watch.includes(q)) return false;
      return true;
    });
  }, [indicators, region, layer, type, sig, q]);

  const addedIds = useMemo(() => new Set(indicators.map((i) => i.id)), [indicators]);
  const libPool = BUILTIN_INDICATORS.filter((m) => !addedIds.has(m.id));

  const cycleSignal = (rec: IndicatorRecord) => {
    const order: Signal[] = ['up', 'flat', 'down'];
    const next = order[(order.indexOf(rec.signal) + 1) % 3];
    upsertIndicator({ ...rec, signal: next });
  };

  const toggleEnabled = (rec: IndicatorRecord) => {
    upsertIndicator({ ...rec, enabled: !rec.enabled });
  };

  const changeVal = (rec: IndicatorRecord, field: 'latest' | 'prev', v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return;
    const months = [...rec.monthly];
    const lastMonth = months.length ? months[months.length - 1].month : lastMonthStr();
    if (field === 'latest') {
      if (months.length && months[months.length - 1].month === lastMonth) {
        months[months.length - 1] = { month: lastMonth, value: n };
      } else {
        months.push({ month: lastMonth, value: n });
      }
    } else {
      if (months.length >= 2) months[months.length - 2] = { ...months[months.length - 2], value: n };
      else months.unshift({ month: prevMonthStr(), value: n });
    }
    upsertIndicator({ ...rec, monthly: months, updatedAt: todayISO() });
  };

  function lastMonthStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function prevMonthStr(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  return (
    <div>
      <h2 className="page-title">📊 指标库</h2>
      <p className="page-sub">
        六层仪表盘的信号来源。维护你关心的指标读数，系统自动推导信号、扩散指数与档位建议。
        <b> 点信号列可循环切换 改善/中性/恶化。</b>
      </p>

      <div className="card">
        <div className="spread mb8">
          <div className="row">
            <select style={{ width: 110 }} value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="all">全部地区</option>
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select style={{ width: 150 }} value={layer} onChange={(e) => setLayer(e.target.value)}>
              <option value="all">全部层级</option>
              {LAYERS.map((l) => <option key={l.id} value={l.id}>第{l.no}层 · {l.name}</option>)}
            </select>
            <select style={{ width: 110 }} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">全部类型</option>
              <option value="leading">领先</option>
              <option value="coincident">同步</option>
              <option value="lagging">滞后</option>
            </select>
            <select style={{ width: 110 }} value={sig} onChange={(e) => setSig(e.target.value)}>
              <option value="all">全部信号</option>
              <option value="up">改善</option>
              <option value="flat">中性</option>
              <option value="down">恶化</option>
            </select>
            <input style={{ width: 170 }} type="text" placeholder="搜索名称 / 关键词…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn" onClick={() => setLibOpen(true)}>＋ 从内置指标库添加{libPool.length ? `（${libPool.length}）` : ''}</button>
            <button className="btn primary" onClick={() => { setCreating(true); setEditing({ ...EMPTY, id: uid(), monthly: [] }); }}>＋ 自定义指标</button>
          </div>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 26 }}></th>
              <th>指标</th>
              <th>最新值</th>
              <th>上期</th>
              <th>变化</th>
              <th>信号</th>
              <th>连续同向</th>
              <th style={{ width: 110 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rec) => {
              const last = rec.monthly[rec.monthly.length - 1];
              const prev = rec.monthly[rec.monthly.length - 2] || last;
              const delta = last ? last.value - prev.value : 0;
              const streak = rec.signal === 'down' ? consecutiveBad(rec) : rec.signal === 'up' ? consecutiveGood(rec) : 0;
              return (
                <tr key={rec.id} style={{ opacity: rec.enabled ? 1 : .5 }}>
                  <td>
                    <span
                      className={`pill-dot ${rec.enabled ? 'up' : ''}`}
                      style={{ background: rec.enabled ? 'var(--green)' : '#cbd5e1', cursor: 'pointer' }}
                      title={rec.enabled ? '参与统计，点击停用' : '已停用，点击启用'}
                      onClick={() => toggleEnabled(rec)}
                    />
                  </td>
                  <td style={{ cursor: 'pointer' }} onClick={() => setDetail(rec)}>
                    <div className="bold">{rec.name}</div>
                    <div className="row small faint" style={{ marginTop: 2 }}>
                      <RegionBadge region={rec.region} />
                      <LayerBadge layer={rec.layer} />
                      <TypeBadge type={rec.type} />
                    </div>
                  </td>
                  <td className="num">
                    {last ? (
                      <input
                        type="number" step="any" style={{ width: 92, padding: '3px 6px' }}
                        value={last.value}
                        onChange={(e) => changeVal(rec, 'latest', e.target.value)}
                        title="编辑最新值（自动推入月度序列）"
                      />
                    ) : <span className="faint">—</span>}
                    {last && <span className="faint small"> {rec.unit}</span>}
                  </td>
                  <td className="num faint">{prev ? `${prev.value}${rec.unit}` : '—'}</td>
                  <td className={`num ${delta > 0 ? '' : delta < 0 ? '' : 'faint'}`} style={{ color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--faint)' }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                  </td>
                  <td>
                    <span className="sig-btn" onClick={() => cycleSignal(rec)} title="点击切换信号">
                      <SignalBadge signal={rec.signal} />
                    </span>
                  </td>
                  <td className="num small muted">
                    {rec.signal === 'flat' ? '—' : `${streak} 个月`}
                  </td>
                  <td>
                    <div className="row">
                      <button className="btn sm ghost" onClick={() => { setCreating(false); setEditing(rec); }}>编辑</button>
                      <button className="btn sm ghost danger" onClick={() => { if (confirm(`删除指标「${rec.name}」？`)) removeIndicator(rec.id); }}>删除</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 26 }}>
                没有符合条件的指标。可从内置指标库添加，或创建自定义指标。
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 内置指标库弹窗 */}
      {libOpen && (
        <div className="modal-mask" onClick={() => setLibOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>从内置指标库添加</h3>
            <p className="muted small mb16">指标含义与用法均来自研究报告（第 3.1–3.6 节），添加后可在表格中维护读数。</p>
            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {libPool.map((m) => (
                <div key={m.id} className="spread" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="bold small">{m.name}</div>
                    <div className="small muted" style={{ marginTop: 2 }}>{m.meaning}</div>
                    <div className="row small faint" style={{ marginTop: 4 }}>
                      <RegionBadge region={m.region} /><LayerBadge layer={m.layer} /><TypeBadge type={m.type} />
                    </div>
                  </div>
                  <button className="btn sm primary" onClick={() => { upsertIndicator(metaToRecord(m)); }}>添加</button>
                </div>
              ))}
              {!libPool.length && <div className="muted" style={{ padding: 16, textAlign: 'center' }}>全部内置指标已添加。</div>}
            </div>
            <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setLibOpen(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {(editing && (creating || editing.id !== EMPTY.id)) && (
        <EditModal
          rec={editing}
          isNew={creating}
          onSave={(r) => { upsertIndicator(r); setEditing(null); setCreating(false); }}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}

      {/* 详情弹窗 */}
      {detail && (
        <div className="modal-mask" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="spread">
              <h3 style={{ margin: 0 }}>{detail.name}</h3>
              <button className="btn sm ghost" onClick={() => setDetail(null)}>关闭</button>
            </div>
            <div className="row mt8">
              <RegionBadge region={detail.region} /><LayerBadge layer={detail.layer} /><TypeBadge type={detail.type} /><SignalBadge signal={detail.signal} />
            </div>
            <div className="mt16 small">
              <div><b>看什么：</b>{detail.watch || '—'}</div>
              <div className="mt8"><b>经验含义：</b>{detail.meaning || '—'}</div>
              <div className="mt8"><b>局限：</b>{detail.limit || '—'}</div>
            </div>
            <div className="mt16">
              <b className="small">近 12 个月走势（演示/维护数据）</b>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={miniSeries(detail)}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={44} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ rec, isNew, onSave, onClose }: {
  rec: IndicatorRecord; isNew: boolean; onSave: (r: IndicatorRecord) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<IndicatorRecord>(rec);
  const set = <K extends keyof IndicatorRecord>(k: K, v: IndicatorRecord[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? '新建自定义指标' : '编辑指标'}</h3>
        <div className="grid grid-2">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>指标名称 *</span>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="如：社融存量增速" />
          </label>
          <label className="field">
            <span>地区</span>
            <select value={form.region} onChange={(e) => set('region', e.target.value as IndicatorRecord['region'])}>
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>所属层级</span>
            <select value={form.layer} onChange={(e) => set('layer', e.target.value as IndicatorRecord['layer'])}>
              {LAYERS.map((l) => <option key={l.id} value={l.id}>第{l.no}层 · {l.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>指标类型</span>
            <select value={form.type} onChange={(e) => set('type', e.target.value as IndicatorRecord['type'])}>
              <option value="leading">领先（提高警觉）</option>
              <option value="coincident">同步（定位现在）</option>
              <option value="lagging">滞后（确认拐点）</option>
            </select>
          </label>
          <label className="field">
            <span>数值方向偏好</span>
            <select value={form.better} onChange={(e) => set('better', e.target.value as 'high' | 'low')}>
              <option value="high">数值越高越好（如社融、PMI）</option>
              <option value="low">数值越低越好（如利差、失业率）</option>
            </select>
          </label>
          <label className="field">
            <span>单位</span>
            <input type="text" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="%、bp、亿元…" />
          </label>
          <label className="field">
            <span>当前信号</span>
            <select value={form.signal} onChange={(e) => set('signal', e.target.value as Signal)}>
              <option value="up">改善</option>
              <option value="flat">中性</option>
              <option value="down">恶化</option>
            </select>
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>看什么</span>
            <input type="text" value={form.watch} onChange={(e) => set('watch', e.target.value)} placeholder="如：是否倒挂、走阔速度" />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>经验含义</span>
            <textarea rows={2} value={form.meaning} onChange={(e) => set('meaning', e.target.value)} placeholder="该指标变化通常意味着什么" />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>局限</span>
            <textarea rows={2} value={form.limit} onChange={(e) => set('limit', e.target.value)} placeholder="什么情况下会失灵" />
          </label>
        </div>
        <div className="row mt8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" disabled={!form.name.trim()} onClick={() => onSave({ ...form, id: form.id || uid() })}>保存</button>
        </div>
      </div>
    </div>
  );
}
