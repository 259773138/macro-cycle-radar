import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { useStore } from '../lib/store';
import { buildRadarSummary } from '../lib/utils';
import { PROVIDERS, uid } from '../lib/types';
import { ROLE_LABEL, chatStream, fetchModels, AIMessage } from '../lib/ai';
import { QUICK_ACTIONS, SYSTEM_PROMPT, quickPrompt } from '../lib/prompts';

marked.setOptions({ breaks: true });

const DEFAULT_MODEL: Record<string, string> = {
  openai: 'gpt-4o-mini',
  modelscope: 'Qwen/Qwen2.5-72B-Instruct',
  custom: '',
};

export default function Assistant() {
  const { aiConfig, setAiConfig, chat, appendChat, setChat, clearChat, indicators, predictions } = useStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelMsg, setModelMsg] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat, busy]);

  const configured = useMemo(() => aiConfig.apiKey.trim() !== '' && aiConfig.model.trim() !== '', [aiConfig]);

  const updateMsg = (id: string, content: string) => {
    const st = useStore.getState();
    st.setChat(st.chat.map((m) => (m.id === id ? { ...m, content } : m)));
  };

  const send = async (text: string, withData: boolean) => {
    if (!configured || busy) return;
    const content = withData
      ? `${text}\n\n【当前仪表盘数据】\n${buildRadarSummary(indicators, predictions)}`
      : text;
    const userMsg = { id: uid(), role: 'user' as const, content, time: Date.now() };
    const assistantId = uid();
    const assistantMsg = { id: assistantId, role: 'assistant' as const, content: '', time: Date.now() };
    const history: AIMessage[] = chat.slice(-12).map((m) => ({ role: m.role, content: m.content }));
    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content },
    ];
    setChat([...chat, userMsg, assistantMsg]);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let acc = '';
    try {
      await chatStream(aiConfig, messages, (delta) => {
        acc += delta;
        updateMsg(assistantId, acc);
      }, controller.signal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateMsg(assistantId, acc + `\n\n⚠️ ${msg}`);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const quickSend = (id: string) => {
    const a = QUICK_ACTIONS.find((x) => x.id === id);
    if (!a) return;
    send(a.prompt, a.needsData);
  };

  const loadModels = async () => {
    if (!aiConfig.baseUrl) { setModelMsg('请先填写 Base URL'); return; }
    setFetchingModels(true);
    setModelMsg('');
    try {
      const list = await fetchModels(aiConfig);
      setModels(list);
      setModelMsg(`拉到 ${list.length} 个模型，请从下拉框选择`);
    } catch (e) {
      setModels([]);
      setModelMsg(`${e instanceof Error ? e.message : '拉取失败'}——若服务器不支持 /models 接口（常见跨域），可直接手动填写模型名`);
    } finally {
      setFetchingModels(false);
    }
  };

  const pickProvider = (id: string) => {
    const p = PROVIDERS.find((x) => x.id === id);
    setAiConfig({
      ...aiConfig,
      provider: id,
      baseUrl: p?.baseUrl ?? '',
      model: DEFAULT_MODEL[id] ?? aiConfig.model,
    });
    setModels([]);
    setModelMsg('');
  };

  return (
    <div>
      <h2 className="page-title">🤖 AI 分析师</h2>
      <p className="page-sub">
        内置报告方法论（六层仪表盘 / 三档协议 / 可证伪预测）作为系统提示词；一键动作会把你当前的仪表盘数据注入上下文。
        API 兼容 OpenAI 格式与魔搭，模型列表可从服务器拉取。
      </p>

      {/* 配置卡片 */}
      <div className="card mb16">
        <div className="spread">
          <div>
            <h3 style={{ margin: 0 }}>模型配置</h3>
            <div className="small muted mt8">
              {configured ? (
                <span>✅ 已配置：{ROLE_LABEL[aiConfig.provider] ?? aiConfig.provider} · <span className="num">{aiConfig.model}</span></span>
              ) : (
                <span>⚠️ 尚未配置 API Key 与模型 —— 填写后才可对话（不影响其他页面使用）</span>
              )}
            </div>
          </div>
          <div className="row">
            {configured && <button className="btn sm ghost" onClick={() => { clearChat(); }}>清空对话</button>}
            <button className="btn sm" onClick={() => setShowSetup(!showSetup)}>{showSetup ? '收起配置' : '⚙️ 配置'}</button>
          </div>
        </div>

        {showSetup && (
          <div className="mt16" style={{ borderTop: '1px dashed var(--border)', paddingTop: 16 }}>
            <div className="grid grid-2">
              <label className="field">
                <span>服务商</span>
                <select value={aiConfig.provider} onChange={(e) => pickProvider(e.target.value)}>
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="small faint mt8">{PROVIDERS.find((p) => p.id === aiConfig.provider)?.hint}</div>
              </label>
              <label className="field">
                <span>Base URL</span>
                <input type="text" value={aiConfig.baseUrl} onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
              </label>
              <label className="field">
                <span>API Key（仅保存在浏览器本地，不发送给任何第三方）</span>
                <input type="password" value={aiConfig.apiKey} onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })} placeholder="sk-…" />
              </label>
              <label className="field">
                <span>模型名（从服务器拉取，或手动填写）</span>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input type="text" list="model-list" value={aiConfig.model} onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })} placeholder="Qwen/Qwen2.5-72B-Instruct" />
                  <datalist id="model-list">
                    {models.map((m) => <option key={m.id} value={m.id} />)}
                  </datalist>
                  <button className="btn" style={{ whiteSpace: 'nowrap' }} disabled={fetchingModels} onClick={loadModels}>
                    {fetchingModels ? '拉取中…' : '从服务器拉取'}
                  </button>
                </div>
                {modelMsg && <div className="small faint mt8">{modelMsg}</div>}
              </label>
              <label className="field">
                <span>温度（创造性）</span>
                <input type="range" min={0} max={1.5} step={0.1} value={aiConfig.temperature}
                  onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })} />
                <div className="small num muted">{aiConfig.temperature}</div>
              </label>
              <div className="field" style={{ alignSelf: 'end' }}>
                <button className="btn primary" onClick={loadModels} disabled={fetchingModels}>测试连接（拉取模型列表）</button>
              </div>
            </div>
            <div className="alert-box warn mt8 small">
              🔒 纯前端架构：请求由你的浏览器直接发往 API 服务器，Key 只存 localStorage。请使用有额度限制的 Key；魔搭需先在平台开通模型推理服务。
            </div>
          </div>
        )}
      </div>

      {/* 一键动作 */}
      <div className="row mb16">
        {QUICK_ACTIONS.map((a) => (
          <button key={a.id} className="chip on" style={{ padding: '6px 12px' }} disabled={busy || !configured} onClick={() => quickSend(a.id)} title={a.needsData ? '附带当前仪表盘数据' : ''}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* 聊天区 */}
      <div className="card" style={{ padding: '18px 18px 14px' }}>
        <div className="chat-wrap" style={{ height: chat.length ? 'calc(100vh - 340px)' : 'auto', minHeight: 240 }}>
          <div className="chat-list" ref={listRef}>
            {!chat.length && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                <div style={{ fontSize: 34 }}>📡</div>
                <div className="mt8">向 AI 分析师提问，或点击上方一键动作：</div>
                <div className="small faint mt8">“现在的周期处于哪个阶段？怎么看美债曲线倒挂？”</div>
                <div className="small faint">“我的仪表盘扩散指数转负，下一步该怎么调仓位？”</div>
              </div>
            )}
            {chat.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>
                {m.role === 'assistant'
                  ? (m.content
                    ? <div className="md" dangerouslySetInnerHTML={{ __html: marked.parse(m.content) as string }} />
                    : <span className="typing" />)
                  : m.content}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <textarea
              rows={1}
              placeholder={configured ? '输入问题…（Enter 发送，Shift+Enter 换行）' : '请先在上方完成模型配置'}
              value={input}
              disabled={!configured || busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) send(input.trim(), false);
                }
              }}
            />
            {busy
              ? <button className="btn danger" onClick={stop}>停止</button>
              : <button className="btn primary" disabled={!configured || !input.trim()} onClick={() => send(input.trim(), false)}>发送</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
