import { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../lib/store';
import {
  BUILTIN_INDICATORS, IndicatorRecord, LAYERS, REGIONS, Signal, todayISO, uid,
} from '../lib/types';
import { fmtMonth } from '../lib/types';
import { metaToRecord } from '../lib/seed';
import { LayerBadge, RegionBadge, SignalBadge, TypeBadge } from '../components/Badges';
import { consecutiveBad, consecutiveGood } from '../lib/store';
import { FREQ_LABEL, lagMonths } from '../lib/utils';

const EMPTY: IndicatorRecord = {
  id: '', name: '', region: 'US', layer: 'credit', type: 'leading', unit: '',
  better: 'high', watch: '', meaning: '', limit: '', enabled: true, monthly: [], signal: 'flat',
  updatedAt: todayISO(), tags: [],
};

function miniSeries(rec: IndicatorRecord) {
  return rec.monthly.map((m) => ({ ...m, label: fmtMonth(m.month) }));
}

export default function Indicators() {
  const {
    indicators, dataMeta, demoMode, upsertCustom, removeCustom, removeIndicator,
    toggleEnabled, setSignalOverride, addBuiltinManual,
  } = useStore();
  const [region, setRegion] = useState<string>('all');
  const [layer, setLayer] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [sig, setSig] = useState<string>('all');
  const [autoFilter, setAutoFilter] = useState<string>('all');
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
      if (autoFilter === 'auto' && !i.auto) return false;
      if (autoFilter === 'manual' && i.auto) return false;
      if (q && !i.name.includes(q) && !i.watch.includes(q)) return false;
      return true;
    });
  }, [indicators, region, layer, type, sig, autoFilter, q]);

  const autoIds = useMemo(() => new Set(indicators.filter((i) => i.auto).map((i) => i.id)), [indicators]);
  const manualPool = BUILTIN_INDICATORS.filter((m) => !m.auto && !indicators.some((i) => i.id === m.id));

  const cycleSignal = (rec: IndicatorRecord) => {
    const order: Signal[] = ['up', 'flat', 'down'];
    const next = order[(order.indexOf(rec.signal) + 1) % 3];
    if (rec.auto) setSignalOverride(rec.id, next);
    else upsertCustom({ ...rec, signal: next });
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
    upsertCustom({ ...rec, monthly: months, updatedAt: todayISO() });
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
        {dataMeta && !demoMode
          ? <>真实数据由流水线自动采集（{dataMeta.fetchedAt.slice(0, 16).replace('T', ' ')} UTC 更新）。<b>自动指标不可篡改数值</b>，信号可手动覆盖；手动指标自由维护。</>
          : <>演示数据模式：线上部署后由 GitHub Actions 每日自动采集真实数据。<b>自动指标不可篡改数值</b>，手动指标自由维护。</>}
      </p>

      <div className="card">
        <div className="spread mb8">
          <div className="row">
            <select style={{ width: 110 }} value={autoFilter} onChange={(e) => setAutoFilter(e.target.value)}>
              <option value="all">全部来源</option>
              <option value="auto">🛰️ 自动采集</option>
              <option value="manual">✍️ 手动维护</option>
            </select>
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
            <button className="btn" onClick={() => setLibOpen(true)}>＋ 添加内置手动指标{manualPool.length ? `（${manualPool.length}）` : ''}</button>
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
              <th style={{ width: 120 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rec) => {
              const last = rec.monthly[rec.monthly.length - 1];
              const prev = rec.monthly[rec.monthly.length - 2] || last;
              const delta = last ? last.value - prev.value : 0;
              const streak = rec.signal === 'down' ? consecutiveBad(rec) : rec.signal === 'up' ? consecutiveGood(rec) : 0;
              const isAuto = !!rec.auto;
              return (
                <tr key={rec.id} style={{ opacity: rec.enabled ? 1 : .5 }}>
                  <td>
                    <span
                      className={`pill-dot ${rec.enabled ? 'up' : ''}`}
                      style={{ background: rec.enabled ? 'var(--green)' : '#cbd5e1', cursor: 'pointer' }}
                      title={rec.enabled ? '参与统计，点击停用' : '已停用，点击启用'}
                      onClick={() => toggleEnabled(rec.id)}
                    />
                  </td>
                  <td style={{ cursor: 'pointer' }} onClick={() => setDetail(rec)}>
                    <div className="bold">
                      {rec.name}
                      {isAuto
                        ? <span className="badge blue" style={{ marginLeft: 6 }}>🛰️ 自动 · {rec.source}</span>
                        : <span className="badge gray" style={{ marginLeft: 6 }}>✍️ 手动</span>}
                      {rec.stale && <span className="badge flat" style={{ marginLeft: 4 }}>沿用旧值</span>}
                      {rec.freq && <span className="badge gray" style={{ marginLeft: 4 }}>{FREQ_LABEL[rec.freq] ?? rec.freq}</span>}
                      {isAuto && lagMonths(rec.updatedAt) >= 3 && (
                        <span className="badge down" style={{ marginLeft: 4 }}>滞后 {lagMonths(rec.updatedAt)} 月</span>
                      )}
                    </div>
                    <div className="row small faint" style={{ marginTop: 2 }}>
                      <RegionBadge region={rec.region} />
                      <LayerBadge layer={rec.layer} />
                      <TypeBadge type={rec.type} />
                      <span className="num">截止 {rec.updatedAt}</span>
                    </div>
                  </td>
                  <td className="num">
                    {last ? (
                      isAuto ? (
                        <b>{last.value}</b>
                      ) : (
                        <input
                          type="number" step="any" style={{ width: 92, padding: '3px 6px' }}
                          value={last.value}
                          onChange={(e) => changeVal(rec, 'latest', e.target.value)}
                          title="编辑最新值（自动推入月度序列）"
                        />
                      )
                    ) : <span className="faint">—</span>}
                    {last && <span className="faint small"> {rec.unit}</span>}
                  </td>
                  <td className="num faint">{prev ? `${prev.value}${rec.unit}` : '—'}</td>
                  <td className="num" style={{ color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--faint)' }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                  </td>
                  <td>
                    <span className="sig-btn" onClick={() => cycleSignal(rec)} title={isAuto ? '点击覆盖自动信号（数据本身不变）' : '点击切换信号'}>
                      <SignalBadge signal={rec.signal} />
                    </span>
                  </td>
                  <td className="num small muted">{rec.signal === 'flat' ? '—' : `${streak} 个月`}</td>
                  <td>
                    <div className="row">
                      {!isAuto && (
                        <button className="btn sm ghost" onClick={() => { setCreating(false); setEditing(rec); }}>编辑</button>
                      )}
                      <button
                        className="btn sm ghost danger"
                        onClick={() => {
                          if (isAuto) { if (confirm(`停用自动指标「${rec.name}」？（数据仍在更新，仅从仪表盘隐藏）`)) removeIndicator(rec.id); }
                          else { if (confirm(`删除指标「${rec.name}」？`)) removeIndicator(rec.id); }
                        }}
                      >{isAuto ? '停用' : '删除'}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 26 }}>
                没有符合条件的指标。
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 内置手动指标库弹窗 */}
      {libOpen && (
        <div className="modal-mask" onClick={() => setLibOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>添加内置手动指标</h3>
            <p className="muted small mb16">这些指标暂无免费自动数据源（如 CAPE、融资余额、社融、LPR），加入后由你每月手动维护读数。</p>
            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {manualPool.map((m) => (
                <div key={m.id} className="spread" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="bold small">{m.name}</div>
                    <div className="small muted" style={{ marginTop: 2 }}>{m.meaning}</div>
                    <div className="row small faint" style={{ marginTop: 4 }}>
                      <RegionBadge region={m.region} /><LayerBadge layer={m.layer} /><TypeBadge type={m.type} />
                    </div>
                  </div>
                  <button className="btn sm primary" onClick={() => addBuiltinManual(m.id)}>添加</button>
                </div>
              ))}
              {!manualPool.length && <div className="muted" style={{ padding: 16, textAlign: 'center' }}>全部手动指标已添加。</div>}
            </div>
            <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setLibOpen(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗（仅手动指标） */}
      {(editing && (creating || (!editing.auto && editing.id !== EMPTY.id))) && (
        <EditModal
          rec={editing}
          isNew={creating}
          onSave={(r) => { upsertCustom(r); setEditing(null); setCreating(false); }}
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
              {detail.auto && <span className="badge blue">🛰️ 自动采集 · {detail.source} · 截止 {detail.updatedAt}</span>}
            </div>
            <div className="mt16 small">
              <div><b>看什么：</b>{detail.watch || '—'}</div>
              <div className="mt8"><b>经验含义：</b>{detail.meaning || '—'}</div>
              <div className="mt8"><b>局限：</b>{detail.limit || '—'}</div>
            </div>
            <div className="mt16">
              <b className="small">近 {Math.min(detail.monthly.length, 24)} 个月走势</b>
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
