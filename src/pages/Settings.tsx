import { useRef } from 'react';
import { useStore } from '../lib/store';
import { exportJSON, loadJSONFile } from '../lib/utils';

export default function Settings() {
  const { indicators, predictions, resetDemo, clearAll, exportState, importState } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <h2 className="page-title">⚙️ 设置</h2>
      <p className="page-sub">数据管理、备份与 AI 配置入口（AI 详细配置在「AI 分析师」页）。</p>

      <div className="card">
        <h3>💾 数据管理</h3>
        <p className="hint">所有数据保存在你的浏览器 localStorage 中。建议定期导出备份；清除浏览器数据会导致记录丢失。</p>
        <div className="row">
          <button className="btn" onClick={() => exportJSON(JSON.parse(exportState()), `宏观周期雷达-备份-${new Date().toISOString().slice(0, 10)}.json`)}>
            ⬇️ 导出全部数据（JSON）
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆️ 导入备份</button>
          <input
            ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await loadJSONFile(f);
              const ok = importState(text);
              alert(ok ? '✅ 导入成功，已刷新数据。' : '❌ 导入失败：文件格式不正确。');
              e.target.value = '';
            }}
          />
          <button className="btn" onClick={() => { if (confirm('重置为演示数据？当前数据将被覆盖。')) resetDemo(); }}>
            🔄 重置为演示数据
          </button>
          <button className="btn danger" onClick={() => { if (confirm('清空全部数据（指标、预测、对话）？此操作不可撤销，建议先导出备份。')) clearAll(); }}>
            🗑️ 清空全部数据
          </button>
        </div>
        <div className="small muted mt16">
          当前：{indicators.length} 个指标 · {predictions.length} 条预测记录。
        </div>
      </div>

      <div className="card">
        <h3>🔌 AI API 配置</h3>
        <p className="hint">
          兼容 OpenAI 格式（Chat Completions）与魔搭 ModelScope，支持自定义任意 OpenAI 兼容服务。
          模型列表从服务器 <span className="num">GET /models</span> 拉取；不支持时可手动填写模型名。
        </p>
        <ul className="small muted" style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>API Key 仅保存在浏览器本地（localStorage），不写入代码仓库，也不经过任何第三方服务器。</li>
          <li>请求由你的浏览器直接发往所配置的 API 服务器，请使用有额度限制的 Key。</li>
          <li>魔搭（ModelScope）需先在平台开通模型推理 API 服务（兼容 OpenAI 格式）。</li>
          <li>无 Key 时，除 AI 对话外全部功能正常可用。</li>
        </ul>
      </div>

      <div className="card">
        <h3>ℹ️ 关于本站</h3>
        <p className="hint">「宏观周期雷达」把《宏观周期感知-研究报告》的方法论做成可操作的工作台。</p>
        <div className="small muted" style={{ lineHeight: 2 }}>
          <div>· 六层仪表盘：信用流动性 → 实体领先 → 同步 → 滞后 → 情绪 → 脆弱性</div>
          <div>· 三档协议：观察 → 预警 → 确认（仓位倾斜 1/3~1/2，反对一把梭）</div>
          <div>· 两套时钟：美林（增长×通胀）+ 中国货币×信用版</div>
          <div>· 预测日志：情景树 + 证伪条件 + Brier 概率校准 + 红队挑战</div>
          <div>· 内置数据为演示用途，不构成投资建议；市场有风险，决策需独立判断。</div>
        </div>
      </div>
    </div>
  );
}
