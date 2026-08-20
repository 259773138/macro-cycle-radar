import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Indicators from './pages/Indicators';
import Predictions from './pages/Predictions';
import Assistant from './pages/Assistant';
import Knowledge from './pages/Knowledge';
import Settings from './pages/Settings';
import { useStore } from './lib/store';
import { DataMeta, IndicatorRecord } from './lib/types';

const NAV = [
  { id: 'dashboard', label: '总览仪表盘', icon: '📡' },
  { id: 'indicators', label: '指标库', icon: '📊' },
  { id: 'predictions', label: '预测日志', icon: '🧭' },
  { id: 'assistant', label: 'AI 分析师', icon: '🤖' },
  { id: 'knowledge', label: '知识库', icon: '📚' },
  { id: 'settings', label: '设置', icon: '⚙️' },
] as const;

type PageId = (typeof NAV)[number]['id'];

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard');
  const setAutoIndicators = useStore((s) => s.setAutoIndicators);
  const setAiReport = useStore((s) => s.setAiReport);
  const dataMeta = useStore((s) => s.dataMeta);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('./data/indicators.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('no data file');
        const data = await res.json();
        if (!alive) return;
        let meta: DataMeta | null = null;
        try {
          const mres = await fetch('./data/meta.json', { cache: 'no-store' });
          if (mres.ok) meta = await mres.json();
        } catch { /* 忽略 */ }
        setAutoIndicators(data.indicators as IndicatorRecord[], meta);
      } catch {
        // 本地开发或文件缺失：保持内置演示数据（demoMode）
      }
      try {
        const rres = await fetch('./data/ai-report.md', { cache: 'no-store' });
        if (rres.ok) {
          const text = await rres.text();
          if (alive && text.trim()) setAiReport({ text, updatedAt: new Date().toISOString().slice(0, 10) });
        }
      } catch { /* 忽略 */ }
    })();
    return () => { alive = false; };
  }, [setAutoIndicators, setAiReport]);

  const updateLabel = dataMeta?.fetchedAt
    ? `数据更新于 ${dataMeta.fetchedAt.slice(0, 16).replace('T', ' ')} UTC`
    : '当前为演示数据（未加载到自动数据文件）';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="#2563eb" />
            <circle cx="32" cy="32" r="21" fill="none" stroke="#bfdbfe" strokeWidth="2" opacity=".85" />
            <circle cx="32" cy="32" r="12" fill="none" stroke="#bfdbfe" strokeWidth="2" opacity=".85" />
            <circle cx="32" cy="32" r="3.5" fill="#fff" />
            <path d="M32 32 L49 15 A24 24 0 0 1 56 32 Z" fill="#93c5fd" opacity=".95" />
            <circle cx="45" cy="21" r="3" fill="#fbbf24" />
          </svg>
          <div>
            <div className="t1">宏观周期雷达</div>
            <div className="t2">Macro Cycle Radar</div>
          </div>
        </div>
        {NAV.map((n) => (
          <div key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
            <span className="ico">{n.icon}</span>
            {n.label}
          </div>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div className="alert-box gray small" style={{ padding: '10px 12px', fontSize: 11.5 }}>
            不预测拐点，<br />只提前感知风向。
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="row">
            <span className="badge blue">🛰️ {updateLabel}</span>
          </div>
          <span className="badge gray">数据来源：FRED · 东方财富</span>
        </div>
        {page === 'dashboard' && <Dashboard />}
        {page === 'indicators' && <Indicators />}
        {page === 'predictions' && <Predictions />}
        {page === 'assistant' && <Assistant />}
        {page === 'knowledge' && <Knowledge />}
        {page === 'settings' && <Settings />}
        <div className="footer-note">
          本工具基于《宏观周期感知-研究报告》构建；宏观数据由 GitHub Actions 每日自动采集（FRED / 东方财富），
          分析结论为规则引擎与 AI 生成，仅供研究参考，不构成任何投资建议。市场有风险，决策需独立判断。
        </div>
      </main>
    </div>
  );
}
