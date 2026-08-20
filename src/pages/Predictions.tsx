import { useMemo, useState } from 'react';
import { useStore, brier, brierInterpret } from '../lib/store';
import { PredictionCard, todayISO, uid } from '../lib/types';
import { TIER_META } from '../lib/utils';

const STANCE = {
  attack: { label: '进攻', color: '#059669' },
  neutral: { label: '中性', color: '#b45309' },
  defense: { label: '防御', color: '#dc2626' },
} as const;

function lines(s: string): string[] {
  return s.split('\n').map((x) => x.trim()).filter(Boolean);
}

export default function Predictions() {
  const { predictions, addPrediction, updatePrediction, removePrediction } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [reviewing, setReviewing] = useState<PredictionCard | null>(null);

  const resolved = useMemo(() => predictions.filter((p) => p.status === 'resolved' && p.review), [predictions]);
  const open = useMemo(() => predictions.filter((p) => p.status === 'open'), [predictions]);
  const avgBrier = resolved.length ? resolved.reduce((s, p) => s + (p.review?.brier ?? 0), 0) / resolved.length : null;
  const avgDir = resolved.length ? resolved.reduce((s, p) => s + (p.review?.direction ?? 0), 0) / resolved.length : null;
  const calibCount = (lo: number, hi: number) => resolved.filter((p) => p.review && p.review.brier >= lo && p.review.brier < hi).length;

  return (
    <div>
      <h2 className="page-title">🧭 预测日志</h2>
      <p className="page-sub">
        分析必须可证伪：每次判断都写清楚 <b>主情景 + 概率 + 时间窗 + 证伪条件 + 最强反方论点</b>。
        到期复盘，用 Brier 分数检验概率校准——记忆会把含糊的话改写成神预测，只有日志不会。
      </p>

      <div className="spread mb16">
        <div className="row">
          <div className="kpi" style={{ minWidth: 130 }}>
            <div className="k">未到期判断</div>
            <div className="v">{open.length}</div>
          </div>
          <div className="kpi" style={{ minWidth: 130 }}>
            <div className="k">已复盘</div>
            <div className="v">{resolved.length}</div>
          </div>
          <div className="kpi" style={{ minWidth: 160 }}>
            <div className="k">平均 Brier（越低越好）</div>
            <div className="v" style={{ fontSize: 20 }}>{avgBrier === null ? '—' : avgBrier.toFixed(2)}</div>
            <div className="s">{avgBrier === null ? '' : brierInterpret(avgBrier)}</div>
          </div>
          <div className="kpi" style={{ minWidth: 130 }}>
            <div className="k">方向平均分 /5</div>
            <div className="v" style={{ fontSize: 20 }}>{avgDir === null ? '—' : avgDir.toFixed(1)}</div>
          </div>
        </div>
        <button className="btn primary" onClick={() => setShowForm(true)}>＋ 记录新判断</button>
      </div>

      {!predictions.length && (
        <div className="alert-box info">
          <b>还没有预测记录。</b>报告要求：正式判断至少按月留下一张卡片，包含情景树、概率、证伪条件与仓位含义。点击右上角「记录新判断」开始。
        </div>
      )}

      {predictions.map((p) => (
        <div className="card" key={p.id} style={{ marginTop: 12 }}>
          <div className="spread">
            <div className="row">
              <span className="badge blue">{p.date}</span>
              <span className="badge gray">{p.createdBy === 'ai' ? 'AI 生成' : '人工记录'}</span>
              <span className="badge" style={{ background: STANCE[p.positionMeaning.stance].color + '15', color: STANCE[p.positionMeaning.stance].color }}>
                {STANCE[p.positionMeaning.stance].label} · {p.positionMeaning.note || '未注明'}
              </span>
              {p.status === 'open'
                ? <span className="badge flat">进行中</span>
                : <span className="badge up">已复盘 {p.review?.date}</span>}
            </div>
            <div className="row">
              {p.status === 'open' && <button className="btn sm primary" onClick={() => setReviewing(p)}>✍️ 到期复盘</button>}
              <button className="btn sm ghost danger" onClick={() => { if (confirm('删除这条预测记录？')) removePrediction(p.id); }}>删除</button>
            </div>
          </div>

          <div className="mt8">
            <div className="bold" style={{ fontSize: 15 }}>
              主情景：{p.mainScenario.label}
              <span style={{ color: 'var(--primary)', marginLeft: 8 }}>{p.mainScenario.prob}%</span>
              <span className="muted small" style={{ marginLeft: 8 }}>时间窗 {p.mainScenario.window || '未注明'}</span>
            </div>
            <div className="small muted mt8">周期定位：短 {p.cyclePosition.short || '—'} ｜ 中 {p.cyclePosition.mid || '—'} ｜ 长 {p.cyclePosition.long || '—'}</div>
            {p.mainScenario.assets && <div className="small mt8">占优资产/结构：{p.mainScenario.assets}</div>}
          </div>

          <div className="grid grid-2 mt16 small">
            <div>
              <b>关键依据（≤5 条，来自不同层）：</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {p.keyEvidence.map((e, i) => <li key={i}>{e}</li>)}
                {!p.keyEvidence.length && <li className="faint">未填写</li>}
              </ul>
            </div>
            <div>
              <b>明确不做的事：</b>
              <div className="mt8">{p.notDoing || <span className="faint">未填写</span>}</div>
            </div>
            <div>
              <b>证伪条件（4–8 周内出现则下调权重）：</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {p.falsify.map((e, i) => <li key={i}>{e}</li>)}
                {!p.falsify.length && <li className="faint">未填写 —— 没有证伪条件的分析只能事后编故事</li>}
              </ul>
            </div>
            <div>
              <b>🥊 红队（最强反方论点）：</b>
              <div className="mt8">{p.redTeam || <span className="faint">未填写</span>}</div>
            </div>
          </div>

          {p.review && (
            <div className="mt16" style={{ borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
              <div className="row small">
                <span className={`badge ${p.review.occurred ? 'up' : 'down'}`}>{p.review.occurred ? '主情景发生' : '主情景未发生'}</span>
                <span className="badge gray">方向 {p.review.direction}/5</span>
                <span className="badge gray">时机 {p.review.timing}/5</span>
                <span className="badge gray">校准 {p.review.calibration}/5</span>
                <span className="badge gray">决策价值 {p.review.value}/5</span>
                <span className="badge blue">Brier {(p.review.brier).toFixed(2)} {brierInterpret(p.review.brier)}</span>
              </div>
              {p.review.note && <div className="small muted mt8">{p.review.note}</div>}
            </div>
          )}
        </div>
      ))}

      {/* Brier 校准看板 */}
      {resolved.length > 0 && (
        <div className="card mt16">
          <h3>📐 概率校准看板（Brier 分数）</h3>
          <p className="hint">Brier = (p − y)²，p 是你给的概率，y 是事后发生(1)/未发生(0)。长期平均越低越好；若长期 BSS≤0，说明你的宏观故事还不如一句“扩张通常会延续”。</p>
          <div className="grid grid-3">
            <div className="kpi"><div className="k">平均 Brier</div><div className="v">{avgBrier?.toFixed(2)}</div><div className="s">{brierInterpret(avgBrier!)}</div></div>
            <div className="kpi"><div className="k">≤0.10（校准优秀）</div><div className="v">{calibCount(0, 0.1)}</div><div className="s">共 {resolved.length} 次复盘</div></div>
            <div className="kpi"><div className="k">&gt;0.40（校准差）</div><div className="v">{calibCount(0.4, 99)}</div><div className="s">概率偏乐观</div></div>
          </div>
          <table className="tbl mt16">
            <thead><tr><th>日期</th><th>主情景</th><th>概率 p</th><th>发生 y</th><th>Brier</th><th>方向</th></tr></thead>
            <tbody>
              {resolved.map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.date}</td>
                  <td>{p.mainScenario.label}</td>
                  <td className="num">{p.mainScenario.prob}%</td>
                  <td className="num">{p.review!.occurred ? '1' : '0'}</td>
                  <td className="num">{p.review!.brier.toFixed(2)}</td>
                  <td className="num">{p.review!.direction}/5</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="alert-box gray mt16 small">
            💡 及格线不是“月月说对”，而是：定位很少大幅打脸、概率大致校准、错的时候亏得少、对的时候仓位配得上。
          </div>
        </div>
      )}

      {showForm && <FormModal onClose={() => setShowForm(false)} onSave={(p) => { addPrediction(p); setShowForm(false); }} />}
      {reviewing && (
        <ReviewModal
          p={reviewing}
          onClose={() => setReviewing(null)}
          onSave={(p) => { updatePrediction(p); setReviewing(null); }}
        />
      )}
    </div>
  );
}

function FormModal({ onClose, onSave }: { onClose: () => void; onSave: (p: PredictionCard) => void }) {
  const [date, setDate] = useState(todayISO());
  const [posS, setPosS] = useState(''); const [posM, setPosM] = useState(''); const [posL, setPosL] = useState('');
  const [label, setLabel] = useState(''); const [prob, setProb] = useState(60); const [windowT, setWindowT] = useState('6–12 个月');
  const [assets, setAssets] = useState('');
  const [evidence, setEvidence] = useState('');
  const [notDoing, setNotDoing] = useState('');
  const [falsify, setFalsify] = useState('');
  const [stance, setStance] = useState<'attack' | 'neutral' | 'defense'>('neutral');
  const [stanceNote, setStanceNote] = useState('');
  const [redTeam, setRedTeam] = useState('');

  const valid = label.trim() && prob >= 0 && prob <= 100 && lines(evidence).length <= 5;

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <h3>记录新判断（预测卡片）</h3>
        <div className="grid grid-2">
          <label className="field"><span>日期</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>时间窗</span><input type="text" value={windowT} onChange={(e) => setWindowT(e.target.value)} /></label>
          <label className="field"><span>周期定位 · 短周期（库存/流动）</span><input type="text" value={posS} onChange={(e) => setPosS(e.target.value)} placeholder="如：被动去库存末期" /></label>
          <label className="field"><span>周期定位 · 中周期（信用/资本开支）</span><input type="text" value={posM} onChange={(e) => setPosM(e.target.value)} placeholder="如：宽货币紧信用" /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>周期定位 · 长周期（债务/人口/技术）</span><input type="text" value={posL} onChange={(e) => setPosL(e.target.value)} placeholder="如：温和去杠杆、生产率平稳" /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>主情景描述 *</span>
            <textarea rows={2} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如：未来 6–12 个月增长下台阶、通胀回落，宽货币紧信用，债券占优、股票结构分化" />
          </label>
          <label className="field"><span>主情景概率（%）*</span>
            <input type="number" min={0} max={100} value={prob} onChange={(e) => setProb(parseFloat(e.target.value) || 0)} />
            <div className="small faint mt8">提示：诚实给概率。总在 70%–90% 之间 = 校准很差的迹象。</div>
          </label>
          <label className="field"><span>占优资产 / 结构</span><input type="text" value={assets} onChange={(e) => setAssets(e.target.value)} placeholder="如：利率债 > 股票" /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>关键依据（每行一条，≤5 条，来自不同层）*</span>
            <textarea rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={'如：\n1. 信用脉冲转负\n2. PMI 新订单连续 3 个月 <48\n3. 地产许可同比下行'} />
            {lines(evidence).length > 5 && <div className="small" style={{ color: 'var(--red)' }}>超过 5 条，请精简（来自不同层的关键依据）</div>}
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>明确不做的事（防止事后把一切说成“在预料中”）</span>
            <textarea rows={2} value={notDoing} onChange={(e) => setNotDoing(e.target.value)} placeholder="如：不因为 PMI 单月回升就转多；不追高杠杆资产" />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>证伪条件（每行一条，4–8 周内若看到则下调主情景权重）*</span>
            <textarea rows={2} value={falsify} onChange={(e) => setFalsify(e.target.value)} placeholder={'如：\n· 3 个月内社融脉冲回升\n· HY 利差未走阔\n· PMI 新订单连续回升'} />
          </label>
          <label className="field"><span>仓位含义</span>
            <select value={stance} onChange={(e) => setStance(e.target.value as typeof stance)}>
              <option value="attack">进攻</option><option value="neutral">中性</option><option value="defense">防御</option>
            </select>
          </label>
          <label className="field"><span>相对基准的偏离说明</span><input type="text" value={stanceNote} onChange={(e) => setStanceNote(e.target.value)} placeholder="如：权益仓位降至基准 −20%" /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>🥊 最强反方论点（红队）</span>
            <textarea rows={2} value={redTeam} onChange={(e) => setRedTeam(e.target.value)} placeholder="每次主情景旁边强制写一个最强反方论点" />
          </label>
        </div>
        <div className="row mt8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button
            className="btn primary"
            disabled={!valid}
            onClick={() => onSave({
              id: uid(), date, createdBy: 'user',
              cyclePosition: { short: posS, mid: posM, long: posL },
              mainScenario: { label: label.trim(), prob, window: windowT, assets },
              keyEvidence: lines(evidence), notDoing, falsify: lines(falsify),
              positionMeaning: { stance, note: stanceNote }, redTeam, status: 'open',
            })}
          >保存判断</button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ p, onClose, onSave }: { p: PredictionCard; onClose: () => void; onSave: (p: PredictionCard) => void }) {
  const [occurred, setOccurred] = useState<boolean | null>(null);
  const [direction, setDirection] = useState(3);
  const [timing, setTiming] = useState(3);
  const [calibration, setCalibration] = useState(3);
  const [value, setValue] = useState(3);
  const [note, setNote] = useState('');

  const b = occurred === null ? null : brier(p.mainScenario.prob / 100, occurred ? 1 : 0);

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>复盘打分：{p.mainScenario.label}</h3>
        <p className="muted small">按报告第 5 节四维评分：方向 / 时机 / 校准 / 决策价值。分析正确 ≠ 投资正确。</p>
        <div className="mb16">
          <span className="small bold">主情景（{p.mainScenario.prob}%）是否发生？</span>
          <div className="row mt8">
            <button className={`btn sm ${occurred === true ? 'primary' : ''}`} onClick={() => setOccurred(true)}>发生</button>
            <button className={`btn sm ${occurred === false ? 'primary' : ''}`} onClick={() => setOccurred(false)}>未发生</button>
          </div>
          {b !== null && (
            <div className="alert-box info mt8">
              Brier 分数 = ({p.mainScenario.prob / 100} − {occurred ? 1 : 0})² = <b>{b.toFixed(2)}</b>（{brierInterpret(b)}）
            </div>
          )}
        </div>
        {[
          { k: 'direction', label: '方向：增长/通胀/流动性方向对不对', v: direction, set: setDirection },
          { k: 'timing', label: '时机：提前量是否合适（方向对但早两年，决策上仍可能亏钱）', v: timing, set: setTiming },
          { k: 'calibration', label: '校准：概率是否诚实（60% 的事应约 60% 发生）', v: calibration, set: setCalibration },
          { k: 'value', label: '决策价值：按此调整仓位，是否优于“什么都不做”', v: value, set: setValue },
        ].map((s) => (
          <label className="field" key={s.k}>
            <span>{s.label}</span>
            <input type="range" min={1} max={5} step={1} value={s.v} onChange={(e) => s.set(parseInt(e.target.value))} />
            <div className="small num muted">当前：{s.v} / 5</div>
          </label>
        ))}
        <label className="field">
          <span>复盘笔记（对了也要问为什么）</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="方向对是因为核心逻辑对，还是因为一个没想到的冲击碰巧同向？改口用了多久？最大的错误是仓位还是事实判断？" />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button
            className="btn primary"
            disabled={occurred === null}
            onClick={() => onSave({
              ...p, status: 'resolved',
              review: { date: todayISO(), occurred: occurred as boolean, direction, timing, calibration, value, brier: b ?? 0, note },
            })}
          >完成复盘</button>
        </div>
      </div>
    </div>
  );
}
