import { loadEnv } from './config';

export async function askAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const { AI_API_KEY, AI_PROXY_URL, AI_MODEL } = loadEnv();
  const isMock = (AI_MODEL || '').toLowerCase() === 'mock' || (AI_PROXY_URL || '').toLowerCase().startsWith('mock');
  if (isMock) {
    const lastUser = [...(messages || [])].reverse().find(m => (m.role || '') === 'user');
    const prompt = lastUser?.content?.trim() || '';
    await new Promise(r => setTimeout(r, 150));
    return `【mock】${prompt ? `You said: "${prompt}"` : 'Ready. Ask me something.'}`;
  }
  const body = { model: AI_MODEL || 'gpt-4o-mini', messages };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url = (AI_PROXY_URL || '').trim();
  if (url) {
    const lower = url.toLowerCase();
    if (url.includes('sk-')) throw new Error('Proxy URL に API Key を入れないでください');
    const isAbs = lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mock:');
    if (!isAbs) throw new Error('Proxy URL は https:// または mock: で始まる絶対URLを指定してください。');
  }
  if (!url) {
    if (!AI_API_KEY) throw new Error('Provide AI API key or proxy URL in Settings');
    url = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${AI_API_KEY}`;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) { const text = await res.text(); throw new Error(`AI error: ${res.status} ${text}`); }
  const json: any = await res.json();
  return json.choices?.[0]?.message?.content || json.reply || '';
}

export async function askAIStream(
  messages: Array<{ role: string; content: string }>,
  { onDelta }: { onDelta?: (delta: string) => void } = {}
): Promise<string> {
  const { AI_API_KEY, AI_PROXY_URL, AI_MODEL } = loadEnv();
  const isMock = (AI_MODEL || '').toLowerCase() === 'mock' || (AI_PROXY_URL || '').toLowerCase().startsWith('mock');
  if (isMock) {
    const lastUser = [...(messages || [])].reverse().find(m => (m.role || '') === 'user');
    const prompt = lastUser?.content?.trim() || '';
    const mock = `【mock】${prompt ? `You said: "${prompt}"` : 'Ready. Ask me something.'}`;
    let acc = '';
    for (const ch of mock) { acc += ch; onDelta?.(ch); /* eslint-disable-next-line no-await-in-loop */ await new Promise(r => setTimeout(r, 5)); }
    return acc;
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url = (AI_PROXY_URL || '').trim();
  const body = { model: AI_MODEL || 'gpt-4o-mini', messages, stream: true };
  if (!url) { if (!AI_API_KEY) throw new Error('Provide AI API key or proxy URL in Settings'); url = 'https://api.openai.com/v1/chat/completions'; headers['Authorization'] = `Bearer ${AI_API_KEY}`; }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok || !res.body) return askAI(messages);
  const reader = res.body.getReader(); const decoder = new TextDecoder();
  let acc = ''; let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break; buf += decoder.decode(value, { stream: true });
    let idx; while ((idx = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
      if (!line) continue; if (!line.startsWith('data:')) continue; const payload = line.slice(5).trim(); if (payload === '[DONE]') { buf = ''; break; }
      try { const j = JSON.parse(payload); const delta = j.choices?.[0]?.delta?.content || j.delta?.content || j.content || ''; if (delta) { acc += delta; onDelta?.(delta); } }
      catch { acc += payload; onDelta?.(payload); }
    }
  }
  return acc;
}
