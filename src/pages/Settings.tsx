import { useRef } from 'react';
import { useStore } from '../lib/store';
import { exportJSON, loadJSONFile } from '../lib/utils';

const WORKFLOW_URL = 'https://github.com/259773138/macro-cycle-radar/actions/workflows/update-data.yml';

export default function Settings() {
  const { indicators, predictions, dataMeta, demoMode, resetDemo, clearAll, exportState, importState } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const autoCount = indicators.filter((i) => i.auto).length;
  const manualCount = indicators.length - autoCount;

  return (
    <div>
      <h2 className="page-title">⚙️ 设置</h2>
      <p className="page-sub">数据源状态、数据管理、备份与 AI 配置入口（AI 详细配置在「AI 分析师」页）。</p>

      <div className="card">
        <h3>🛰️ 数据源状态</h3>
        {demoMode ? (
          <div className="alert-box warn">
            <b>演示数据模式：</b>当前未加载到自动数据文件（本地开发时正常）。线上部署后，GitHub Actions 流水线每天北京时间约 07:00 自动采集数据并发布。
          </div>
        ) : dataMeta ? (
          <>
            <div className="row mb16">
              <span className="badge blue">🛰️ 最近采集：{dataMeta.fetchedAt.slice(0, 16).replace('T', ' ')} UTC</span>
              <span className="badge up">成功 {dataMeta.autoCount} 项</span>
              {dataMeta.staleCount > 0 && <span className="badge flat">沿用旧值 {dataMeta.staleCount} 项</span>}
              <span className="badge gray">自动指标 {autoCount} · 手动指标 {manualCount}</span>
            </div>
            <table className="tbl">
              <thead><tr><th>数据源</th><th>状态</th><th>本次成功</th></tr></thead>
              <tbody>
                {dataMeta.sources.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>
                      <span className={`badge ${s.status === 'ok' ? 'up' : s.status === 'partial' ? 'flat' : 'down'}`}>
                        {s.status === 'ok' ? '正常' : s.status === 'partial' ? '部分失败（已沿用旧值）' : '失败'}
                      </span>
                    </td>
                    <td className="num">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dataMeta.failed.length > 0 && (
              <div className="alert-box warn mt16 small">
                <b>失败明细：</b>
                {dataMeta.failed.map((f) => <div key={f.id}>· {f.name}：{f.error}{f.reused ? '（已沿用最近一次成功数据）' : '（无旧值）'}</div>)}
              </div>
            )}
            <div className="alert-box gray mt16 small">{dataMeta.note}</div>
          </>
        ) : null}
        <div className="row mt16">
          <a className="btn" href={WORKFLOW_URL} target="_blank" rel="noreferrer">🔁 手动触发数据更新（打开 Actions 页点 Run workflow）</a>
          <span className="small faint">更新频率：每天 UTC 23:00（北京时间 07:00）自动执行；修改 .github/workflows/update-data.yml 的 cron 可调整。</span>
        </div>
      </div>

      <div className="card">
        <h3>💾 本地数据管理</h3>
        <p className="hint">
          自动采集的宏观数据由流水线维护（无需备份）；此处备份/管理的是你的<b>本地数据</b>：自定义指标、预测日志、AI 配置等（存于浏览器 localStorage）。
        </p>
        <div className="row">
          <button className="btn" onClick={() => exportJSON(JSON.parse(exportState()), `宏观周期雷达-备份-${new Date().toISOString().slice(0, 10)}.json`)}>
            ⬇️ 导出本地数据（JSON）
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆️ 导入备份</button>
          <input
            ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await loadJSONFile(f);
              const ok = importState(text);
              alert(ok ? '✅ 导入成功，已刷新。' : '❌ 导入失败：文件格式不正确。');
              e.target.value = '';
            }}
          />
          <button className="btn" onClick={() => { if (confirm('重置本地数据（自定义指标、停用列表、信号覆盖、预测日志、对话）？')) resetDemo(); }}>
            🔄 重置本地数据
          </button>
          <button className="btn danger" onClick={() => { if (confirm('清空本地数据？此操作不可撤销，建议先导出备份。')) clearAll(); }}>
            🗑️ 清空本地数据
          </button>
        </div>
        <div className="small muted mt16">
          当前：自动指标 {autoCount} 项 · 手动指标 {manualCount} 项 · 预测记录 {predictions.length} 条。
        </div>
      </div>

      <div className="card">
        <h3>🔌 AI API 配置</h3>
        <p className="hint">
          兼容 OpenAI 格式（Chat Completions）与魔搭 ModelScope，支持自定义任意 OpenAI 兼容服务。
          模型列表从服务器 <span className="num">GET /models</span> 拉取；不支持时可手动填写模型名。
        </p>
        <ul className="small muted" style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>「AI 分析师」页的对话使用你在本机配置的 Key（仅存 localStorage，不经过任何第三方）。</li>
          <li>「AI 每日简报」由流水线使用仓库 Secret 自动生成（无需你在本机配置）。</li>
          <li>魔搭（ModelScope）需先在平台开通模型推理服务（兼容 OpenAI 格式）。</li>
        </ul>
      </div>

      <div className="card">
        <h3>ℹ️ 关于本站</h3>
        <div className="small muted" style={{ lineHeight: 2 }}>
          <div>· 数据自动采集：FRED（圣路易斯联储，美国/全球 23 项）+ 东方财富（中国 9 项），每日 UTC 23:00 更新</div>
          <div>· 六层仪表盘：信用流动性 → 实体领先 → 同步 → 滞后 → 情绪 → 脆弱性</div>
          <div>· 三档协议：观察 → 预警 → 确认（仓位倾斜 1/3~1/2，反对一把梭）</div>
          <div>· 两套时钟：美林（增长×通胀）+ 中国货币×信用版</div>
          <div>· 预测日志：情景树 + 证伪条件 + Brier 概率校准 + 红队挑战</div>
          <div>· 自动分析为规则引擎 + AI 生成，仅供研究参考，不构成投资建议；市场有风险，决策需独立判断。</div>
        </div>
      </div>
    </div>
  );
}
