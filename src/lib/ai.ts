// AI API 封装：OpenAI 兼容 Chat Completions（含 SSE 流式）
import { AIConfig } from '../lib/types';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function normalizeBase(baseUrl: string): string {
  let b = baseUrl.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(b)) b = b.replace(/\/chat\/completions$/, '');
  return b;
}

export function completionsUrl(baseUrl: string): string {
  return `${normalizeBase(baseUrl)}/chat/completions`;
}

export function modelsUrl(baseUrl: string): string {
  return `${normalizeBase(baseUrl)}/models`;
}

// 拉取模型列表（GET /models，OpenAI 兼容）
export async function fetchModels(cfg: AIConfig): Promise<{ id: string; owned_by?: string }[]> {
  const res = await fetch(modelsUrl(cfg.baseUrl), {
    headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
  });
  if (!res.ok) throw new Error(`拉取模型失败：HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();
  const list: { id: string; owned_by?: string }[] = Array.isArray(data?.data) ? data.data : [];
  if (!list.length) throw new Error('服务器返回了空模型列表');
  return list;
}

// 非流式补全
export async function chatOnce(cfg: AIConfig, messages: AIMessage[]): Promise<string> {
  const res = await fetch(completionsUrl(cfg.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      stream: false,
    }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()).slice(0, 400); } catch { /* ignore */ }
    throw new Error(`请求失败：HTTP ${res.status} ${res.statusText}${detail ? ' | ' + detail : ''}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '(空回复)';
}

// 流式补全（SSE）
export async function chatStream(
  cfg: AIConfig,
  messages: AIMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(completionsUrl(cfg.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      stream: true,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()).slice(0, 400); } catch { /* ignore */ }
    throw new Error(`请求失败：HTTP ${res.status} ${res.statusText}${detail ? ' | ' + detail : ''}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta: string = json?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch { /* 忽略不完整行 */ }
    }
  }
  return full;
}

export const ROLE_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  modelscope: '魔搭 ModelScope',
  custom: '自定义',
};
