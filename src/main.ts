import { loadEnv, saveSettings } from './config';
import { joinP2PRoom } from './p2p';
import { getMessages, addMessage, addMessages } from './storage';
import { renderMarkdown } from './markdown';

const els = {
  settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
  settingsDialog: document.getElementById('settingsDialog') as HTMLDialogElement,
  saveSettings: document.getElementById('saveSettings') as HTMLButtonElement,
  resetSettings: document.getElementById('resetSettings') as HTMLButtonElement,
  displayName: document.getElementById('displayName') as HTMLInputElement,
  color: document.getElementById('color') as HTMLInputElement,
  aiApiKey: document.getElementById('aiApiKey') as HTMLInputElement,
  aiProxyUrl: document.getElementById('aiProxyUrl') as HTMLInputElement,
  aiModel: document.getElementById('aiModel') as HTMLInputElement,
  roomId: document.getElementById('roomId') as HTMLInputElement,
  roomPassword: document.getElementById('roomPassword') as HTMLInputElement,
  joinRoom: document.getElementById('joinRoom') as HTMLButtonElement,
  roomStatus: document.getElementById('roomStatus') as HTMLSpanElement,
  chat: document.getElementById('chat') as HTMLDivElement,
  composer: document.getElementById('composer') as HTMLFormElement,
  sendBtn: document.getElementById('sendBtn') as HTMLButtonElement,
  messageInput: document.getElementById('messageInput') as HTMLInputElement,
  askAiBtn: document.getElementById('askAiBtn') as HTMLButtonElement,
  presence: document.getElementById('presence') as HTMLDivElement,
  cursorCanvas: document.getElementById('cursorCanvas') as HTMLCanvasElement,
};

const env = loadEnv();
els.displayName.value = env.profile?.name || 'guest';
els.color.value = env.profile?.color || '#22c55e';
els.aiApiKey.value = env.AI_API_KEY || '';
els.aiProxyUrl.value = env.AI_PROXY_URL || '';
els.aiModel.value = env.AI_MODEL || 'gpt-4o-mini';

els.settingsBtn.addEventListener('click', () => els.settingsDialog.showModal());
els.saveSettings.addEventListener('click', () => {
  const profile = { name: els.displayName.value || 'guest', color: els.color.value || '#22c55e' };
  const proxy = (els.aiProxyUrl.value || '').trim();
  if (proxy) {
    if (proxy.includes('sk-') || proxy.startsWith('sk-')) { alert('Proxy URL に API Key を入力しないでください。'); return; }
    const lower = proxy.toLowerCase();
    if (!(lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mock:'))) { alert('Proxy URL は https:// または mock: で始まる絶対URLを指定してください。'); return; }
  }
  saveSettings({ aiApiKey: (els.aiApiKey.value || '').trim(), aiProxyUrl: proxy, aiModel: (els.aiModel.value || '').trim(), profile });
});

els.resetSettings.addEventListener('click', () => {
  try { localStorage.removeItem('settings'); } catch {}
  const env = loadEnv();
  els.displayName.value = env.profile?.name || 'guest';
  els.color.value = env.profile?.color || '#22c55e';
  els.aiApiKey.value = env.AI_API_KEY || '';
  els.aiProxyUrl.value = env.AI_PROXY_URL || '';
  els.aiModel.value = env.AI_MODEL || 'gpt-4o-mini';
  alert('Settings reset.');
});

els.joinRoom.addEventListener('click', async () => {
  if (els.joinRoom.disabled) return; // 二重Join防止
  try {
    const cfg = loadEnv();
    const roomId = els.roomId.value.trim() || 'planning';
    const roomPassword = els.roomPassword.value;
    els.roomStatus.textContent = `Joined (P2P): ${roomId}`;

    const p2p = await joinP2PRoom(roomId, roomPassword, cfg.profile, {
      onPresence(snapshot) { const list = Object.values(snapshot || {}).map((p: any) => `${(p as any).name}`).join(', '); els.presence.textContent = list ? `Online: ${list}` : 'Online: —'; Object.assign(presenceState, snapshot || {}); },
      onMessage(m) { appendChat([m]); addMessage(roomId, m); },
      onSync(msgs) { appendChat(msgs); addMessages(roomId, msgs); }
    });

    const presenceState: Record<string, any> = {};
    const dpr = window.devicePixelRatio || 1;
    const ctx = els.cursorCanvas.getContext('2d')!;
    function resize() { const rect = els.cursorCanvas.getBoundingClientRect(); els.cursorCanvas.width = rect.width * dpr; els.cursorCanvas.height = rect.height * dpr; }
    resize(); new (window as any).ResizeObserver(resize).observe(els.cursorCanvas);
    function draw() {
      ctx.clearRect(0, 0, els.cursorCanvas.width, els.cursorCanvas.height);
      for (const id in presenceState) {
        const p = presenceState[id]; if (!p) continue;
        const x = p.x * els.cursorCanvas.width; const y = p.y * els.cursorCanvas.height;
        ctx.fillStyle = p.color || '#22c55e'; ctx.beginPath(); ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `${12 * dpr}px system-ui`; ctx.fillText(p.name || id, x + 8 * dpr, y - 8 * dpr);
        if (p.typing) { ctx.fillStyle = '#94a3b8'; ctx.fillText(String(p.typing).slice(0, 24), x + 8 * dpr, y + 10 * dpr); }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    document.addEventListener('pointermove', (e) => {
      const rect = els.cursorCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const id = p2p.meId; presenceState[id] = presenceState[id] || { name: cfg.profile.name, color: cfg.profile.color, typing: '' };
      presenceState[id] = { ...presenceState[id], x, y }; p2p.broadcastPresence({ ...presenceState[id] });
    });
    els.messageInput.addEventListener('input', () => {
      const id = p2p.meId; presenceState[id] = presenceState[id] || { name: cfg.profile.name, color: cfg.profile.color, typing: '' };
      presenceState[id] = { ...presenceState[id], typing: els.messageInput.value.slice(0, 24) }; p2p.broadcastPresence({ ...presenceState[id] });
    });

    const seen = new Set<string>();
    function msgKey(m: any) { const role = m.role || ''; const author = m.author || ''; const ts = m.ts || 0; const c = String(m.content || ''); return `${role}|${author}|${ts}|${c.length}|${hash32(c)}`; }
    function markSeen(m: any) { seen.add(msgKey(m)); }
    function appendChat(items: any[] | any) {
      if (!Array.isArray(items)) items = [items];
      const filtered = (items as any[]).filter(m => { const k = msgKey(m); if (seen.has(k)) return false; seen.add(k); return true; });
      if (!filtered.length) return;
      for (const m of filtered) {
        const wrap = document.createElement('div');
        wrap.className = `msg ${m.role === 'assistant' ? 'ai' : m.role === 'user' ? 'me' : ''}`;
        const head = document.createElement('div'); head.className = 'msg-head';
        const who = document.createElement('strong'); who.textContent = String(m.author || m.role || '');
        head.appendChild(who);
        const body = document.createElement('div');
        body.className = `msg-content${m.role === 'assistant' ? ' prose' : ''}`;
        const content = String(m.content || '');
        if (m.role === 'assistant') {
          body.innerHTML = renderMarkdown(content);
        } else {
          body.textContent = content;
        }
        wrap.appendChild(head); wrap.appendChild(body);
        els.chat.appendChild(wrap);
      }
      els.chat.scrollTop = els.chat.scrollHeight;
    }

    els.composer.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = els.messageInput.value.trim(); if (!text) return;
      const userTs = Date.now();
      const msg = { role: 'user', content: text, author: cfg.profile.name, ts: userTs };
      p2p.sendMessage(msg);
      els.messageInput.value = '';
      const id = p2p.meId; presenceState[id] = presenceState[id] || { name: cfg.profile.name, color: cfg.profile.color, typing: '' };
      presenceState[id] = { ...presenceState[id], typing: '' }; p2p.broadcastPresence({ ...presenceState[id] });
      await runAskAI(text);
    });

    els.askAiBtn.addEventListener('click', async () => {
      try { await runAskAI(els.messageInput.value.trim()); } catch (err: any) { alert(`AI error: ${err.message}`); }
    });

    async function runAskAI(optionalTyped?: string) {
      els.askAiBtn.disabled = true; if (els.sendBtn) els.sendBtn.disabled = true;
      try {
        const history = (await getMessages(roomId)).map((m: any) => ({ role: m.role || 'user', content: m.content || '' }));
        if (optionalTyped && (history.length === 0 || history[history.length - 1].role !== 'user')) history.push({ role: 'user', content: optionalTyped });
        const msgEl = document.createElement('div'); msgEl.className = 'msg ai';
        const head = document.createElement('div'); head.className = 'msg-head';
        const strong = document.createElement('strong'); strong.textContent = 'AI'; head.appendChild(strong);
        const span = document.createElement('div'); span.className = 'msg-content prose';
        msgEl.appendChild(head); msgEl.appendChild(span);
        els.chat.appendChild(msgEl); els.chat.scrollTop = els.chat.scrollHeight;

        const aiTs = Date.now(); let full = '';
        try {
          const { askAIStream } = await import('./ai');
          full = await askAIStream(history, { onDelta(delta) { full += delta; (span as HTMLElement).innerText = full; els.chat.scrollTop = els.chat.scrollHeight; } });
        } catch {
          const { askAI } = await import('./ai');
          full = await askAI(history); (span as HTMLElement).innerText = full; els.chat.scrollTop = els.chat.scrollHeight;
        }
        (span as HTMLElement).innerHTML = renderMarkdown(full);
        markSeen({ role: 'assistant', author: 'AI', ts: aiTs, content: full });
        p2p.sendMessage({ role: 'assistant', content: full, author: 'AI', ts: aiTs });
      } finally {
        els.askAiBtn.disabled = false; if (els.sendBtn) els.sendBtn.disabled = false;
      }
    }
    // Join 完了後はボタン無効化（重複Joinでの重複表示防止）
    els.joinRoom.disabled = true;
    els.joinRoom.textContent = 'Joined';
  } catch (err: any) { els.roomStatus.textContent = `Error: ${err.message}`; }
});

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]); }
function hash32(str: string) { let h = 0; for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; } return (h >>> 0).toString(36); }
