import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Indicators from './pages/Indicators';
import Predictions from './pages/Predictions';
import Assistant from './pages/Assistant';
import Knowledge from './pages/Knowledge';
import Settings from './pages/Settings';

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
        {page === 'dashboard' && <Dashboard />}
        {page === 'indicators' && <Indicators />}
        {page === 'predictions' && <Predictions />}
        {page === 'assistant' && <Assistant />}
        {page === 'knowledge' && <Knowledge />}
        {page === 'settings' && <Settings />}
        <div className="footer-note">
          本工具基于《宏观周期感知-研究报告》构建，内置数据为教学演示用途，不构成任何投资建议。
          市场有风险，决策需独立判断。· 数据仅保存在你的浏览器本地（localStorage）。
        </div>
      </main>
    </div>
  );
}
