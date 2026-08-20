import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { DataMeta, HistoryEntry } from '../lib/types';
import { FREQ_LABEL, lagMonths } from '../lib/utils';
import { LayerBadge, RegionBadge, TypeBadge } from '../components/Badges';

export default function Sources() {
  const { indicators, dataMeta, demoMode } = useStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    fetch('./data/history.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]));
  }, []);

  const autoList = useMemo(() => indicators.filter((i) => i.auto), [indicators]);
  const manualList = useMemo(() => indicators.filter((i) => !i.auto), [indicators]);

  // 最近 N 次采集成功率（按历史快照）
  const recent = history.slice(0, 30);
  const successRate = recent.length
    ? Math.round((recent.reduce((s, h) => s + (h.autoCount), 0) / Math.max(recent.reduce((s, h) => s + h.autoCount + h.failedIds.length, 0), 1)) * 1000) / 10
    : null;

  const diffTrend = useMemo(
    () => recent.slice().reverse().map((h) => ({ date: h.date.slice(5), 扩散: h.diffusion.total, 领先: h.diffusion.leading })),
    [recent],
  );

  return (
    <div>
      <h2 className="page-title">🗂 数据源登记</h2>
      <p className="page-sub">
        每一份数据的来源、频率、滞后与健康状态公开可查（借鉴 kairos-atlas 的 Source Registry）。
        数据出问题时，先来这里自查。
      </p>

      <div className="grid grid-3 mb16">
        <div className="kpi"><div className="k">自动采集指标</div><div className="v">{autoList.length}</div><div className="s">手动指标 {manualList.length}</div></div>
        <div className="kpi"><div className="k">最近 30 次采集成功率</div><div className="v">{successRate === null ? '—' : `${successRate}%`}</div><div className="s">{recent.length ? `样本 ${recent.length} 次（${recent[0].date} 最近）` : '历史快照未积累'}</div></div>
        <div className="kpi"><div className="k">数据源</div><div className="v" style={{ fontSize: 20 }}>{dataMeta ? dataMeta.sources.length : '—'} 个</div><div className="s">FRED · 东方财富 · 统计局 · 商务部 · 新浪</div></div>
      </div>

      {demoMode && (
        <div className="alert-box warn mb16">演示数据模式：线上部署后此处显示真实采集状态与历史成功率。</div>
      )}

      {dataMeta && (
        <div className="card mb16">
          <h3>最近一次采集（{dataMeta.fetchedAt.slice(0, 16).replace('T', ' ')} UTC）</h3>
          <div className="row mt8">
            <span className="badge up">成功 {dataMeta.autoCount}</span>
            {dataMeta.staleCount > 0 && <span className="badge flat">沿用旧值 {dataMeta.staleCount}</span>}
            <span className="badge gray">{dataMeta.note}</span>
          </div>
          {dataMeta.failed.length > 0 && (
            <table className="tbl mt16">
              <thead><tr><th>失败指标</th><th>原因</th><th>处理</th></tr></thead>
              <tbody>
                {dataMeta.failed.map((f) => (
                  <tr key={f.id}><td>{f.name}</td><td className="small muted">{f.error}</td><td>{f.reused ? <span className="badge flat">沿用最近成功数据</span> : <span className="badge down">无旧值（缺数）</span>}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card">
        <h3>🛰️ 自动指标登记表（{autoList.length} 项）</h3>
        <p className="hint">滞后月数 = 当前月 − 数据截止月；≥2 显示警示色（部分指标如国房景气/社融官方发布本身滞后，属正常）。</p>
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>指标</th><th>数据源</th><th>频率</th><th>截止</th><th>滞后</th><th>分类</th><th>状态</th></tr></thead>
            <tbody>
              {autoList.map((i) => {
                const lag = lagMonths(i.updatedAt);
                return (
                  <tr key={i.id}>
                    <td className="bold small">{i.name}</td>
                    <td className="small">{i.source}</td>
                    <td><span className="badge gray">{FREQ_LABEL[i.freq ?? 'm'] ?? '月更'}</span></td>
                    <td className="num small">{i.updatedAt}</td>
                    <td>
                      <span className={`badge ${lag >= 3 ? 'down' : lag === 2 ? 'flat' : 'up'}`}>
                        {lag} 个月
                      </span>
                    </td>
                    <td className="small"><RegionBadge region={i.region} /> <LayerBadge layer={i.layer} /> <TypeBadge type={i.type} /></td>
                    <td>{i.stale ? <span className="badge flat">沿用旧值</span> : <span className="badge up">正常</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt16">
        <h3>📈 扩散指数每日快照（近 {diffTrend.length} 次采集）</h3>
        <p className="hint">每次采集自动存档（最多 40 条），既用于复盘对比，也可审计数据源健康。</p>
        {diffTrend.length ? (
          <div className="row" style={{ alignItems: 'flex-end', gap: 2, height: 120 }}>
            {diffTrend.map((d, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: Math.abs(d.扩散) * 6 + 2,
                  background: d.扩散 >= 0 ? 'var(--green)' : 'var(--red)',
                  borderRadius: 3,
                  margin: '0 2px',
                  opacity: 0.85,
                }} title={`${d.date}：扩散指数 ${d.扩散}`} />
              </div>
            ))}
          </div>
        ) : <div className="muted small">快照将在流水线运行后积累。</div>}
      </div>

      <div className="card mt16">
        <h3>✍️ 手动指标登记（{manualList.length} 项）</h3>
        <p className="hint">暂无稳定免费自动源，保留手动维护（恒指历史、CAPE、ERP、市场广度、融资余额、IPO 环境、BIS 信贷缺口、宏观杠杆率、生产率等）。</p>
        <table className="tbl">
          <thead><tr><th>指标</th><th>建议维护频率</th><th>建议来源</th></tr></thead>
          <tbody>
            {manualList.map((i) => (
              <tr key={i.id}>
                <td className="bold small">{i.name}</td>
                <td className="small">每月第一个周末</td>
                <td className="small muted">{i.region === 'CN' ? '国家统计局 / 央行 / 交易所官网' : i.region === 'US' ? 'multpl.com / FRED / 交易所' : 'BIS / IMF'}</td>
              </tr>
            ))}
            {!manualList.length && <tr><td colSpan={3} className="muted small" style={{ textAlign: 'center', padding: 16 }}>全部指标已自动化。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
