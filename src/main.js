import { loadEnv, saveSettings } from "./config.js";
import { joinP2PRoom } from "./p2p.js";
import { getMessages, addMessage, addMessages } from "./storage.js";

const els = {
  settingsBtn: document.getElementById("settingsBtn"),
  settingsDialog: document.getElementById("settingsDialog"),
  saveSettings: document.getElementById("saveSettings"),
  resetSettings: document.getElementById("resetSettings"),
  displayName: document.getElementById("displayName"),
  color: document.getElementById("color"),
  aiApiKey: document.getElementById("aiApiKey"),
  aiProxyUrl: document.getElementById("aiProxyUrl"),
  aiModel: document.getElementById("aiModel"),
  roomId: document.getElementById("roomId"),
  roomPassword: document.getElementById("roomPassword"),
  joinRoom: document.getElementById("joinRoom"),
  roomStatus: document.getElementById("roomStatus"),
  chat: document.getElementById("chat"),
  composer: document.getElementById("composer"),
  sendBtn: document.getElementById("sendBtn"),
  messageInput: document.getElementById("messageInput"),
  askAiBtn: document.getElementById("askAiBtn"),
  presence: document.getElementById("presence"),
  cursorCanvas: document.getElementById("cursorCanvas"),
};

function hash32(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return (h >>> 0).toString(36);
}

// Load settings
const env = loadEnv();
els.displayName.value = env.profile?.name || "guest";
els.color.value = env.profile?.color || "#22c55e";
els.aiApiKey.value = env.AI_API_KEY || "";
els.aiProxyUrl.value = env.AI_PROXY_URL || "";
els.aiModel.value = env.AI_MODEL || "gpt-4o-mini";

els.settingsBtn.addEventListener("click", () => els.settingsDialog.showModal());
els.saveSettings.addEventListener("click", () => {
  const profile = { name: els.displayName.value || "guest", color: els.color.value || "#22c55e" };
  const proxy = (els.aiProxyUrl.value || '').trim();
  if (proxy) {
    if (proxy.includes('sk-') || proxy.startsWith('sk-')) {
      alert('Proxy URL に API Key を入力しないでください。API Key は「OpenAI API Key」に入力してください。');
      return;
    }
    const lower = proxy.toLowerCase();
    if (!(lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mock:'))) {
      alert('Proxy URL は https:// または mock: で始まる絶対URLを指定してください。');
      return;
    }
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

// Local history via IndexedDB

els.joinRoom.addEventListener("click", async () => {
  try {
    const cfg = loadEnv();
    const roomId = els.roomId.value.trim() || "planning";
    const roomPassword = els.roomPassword.value;
    els.roomStatus.textContent = `Joined (P2P): ${roomId}`;

    const p2p = await joinP2PRoom(roomId, roomPassword, cfg.profile, {
      onPresence(snapshot) {
        const list = Object.values(snapshot || {}).map(p => `${p.name}`).join(", ");
        els.presence.textContent = list ? `Online: ${list}` : "Online: —";
        Object.assign(presenceState, snapshot || {});
      },
      onMessage(m) { appendChat([m]); addMessage(roomId, m); },
      onSync(msgs) { appendChat(msgs); addMessages(roomId, msgs); }
    });

    // Draw cursors using local presence broadcast
    const presenceState = {};
    const dpr = window.devicePixelRatio || 1;
    const ctx = els.cursorCanvas.getContext('2d');
    function resize() { const rect = els.cursorCanvas.getBoundingClientRect(); els.cursorCanvas.width = rect.width * dpr; els.cursorCanvas.height = rect.height * dpr; }
    resize(); new ResizeObserver(resize).observe(els.cursorCanvas);
    function draw() {
      ctx.clearRect(0,0,els.cursorCanvas.width, els.cursorCanvas.height);
      for (const id in presenceState) {
        const p = presenceState[id]; if (!p) continue;
        const x = p.x * els.cursorCanvas.width; const y = p.y * els.cursorCanvas.height;
        ctx.fillStyle = p.color || '#22c55e'; ctx.beginPath(); ctx.arc(x, y, 6*dpr, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `${12*dpr}px system-ui`; ctx.fillText(p.name||id, x+8*dpr, y-8*dpr);
        if (p.typing) { ctx.fillStyle = '#94a3b8'; ctx.fillText(String(p.typing).slice(0,24), x+8*dpr, y+10*dpr); }
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
      presenceState[id] = { ...presenceState[id], typing: els.messageInput.value.slice(0,24) }; p2p.broadcastPresence({ ...presenceState[id] });
    });

    // 重複描画防止用
    const seen = new Set();
    function msgKey(m) {
      const role = m.role || '';
      const author = m.author || '';
      const ts = m.ts || 0;
      const c = String(m.content || '');
      return `${role}|${author}|${ts}|${c.length}|${hash32(c)}`;
    }
    function markSeen(m) { seen.add(msgKey(m)); }
    function appendChat(items) {
      if (!Array.isArray(items)) items = [items];
      const filtered = items.filter(m => { const k = msgKey(m); if (seen.has(k)) return false; seen.add(k); return true; });
      if (!filtered.length) return;
      const html = filtered.map(m => `<div class=\"msg ${m.role === 'assistant' ? 'ai' : m.role === 'user' ? 'me' : ''}\"><strong>${escapeHtml(m.author || m.role)}</strong>: ${escapeHtml(m.content||'')}</div>`).join('');
      els.chat.insertAdjacentHTML('beforeend', html);
      els.chat.scrollTop = els.chat.scrollHeight;
    }
    // Load local persisted history first
    const localMsgs = await getMessages(roomId);
    if (localMsgs.length) appendChat(localMsgs);

    els.composer.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = els.messageInput.value.trim(); if (!text) return;
      const userTs = Date.now();
      const msg = { role: 'user', content: text, author: cfg.profile.name, ts: userTs };
      p2p.sendMessage(msg);
      // 送信後に入力欄とtyping表示をクリア
      els.messageInput.value = '';
      const id = p2p.meId;
      presenceState[id] = presenceState[id] || { name: cfg.profile.name, color: cfg.profile.color, typing: '' };
      presenceState[id] = { ...presenceState[id], typing: '' };
      p2p.broadcastPresence({ ...presenceState[id] });
      // AI へ質問（今の発話を履歴に含める）
      await runAskAI(text);
    });
    els.askAiBtn.addEventListener('click', async () => {
      try { await runAskAI(els.messageInput.value.trim()); }
      catch (err) { alert(`AI error: ${err.message}`); }
    });

    async function runAskAI(optionalTyped) {
      els.askAiBtn.disabled = true; if (els.sendBtn) els.sendBtn.disabled = true;
      try {
        const history = (await getMessages(roomId)).map(m => ({ role: m.role || 'user', content: m.content || '' }));
        if (optionalTyped && (history.length === 0 || history[history.length-1].role !== 'user')) {
          history.push({ role: 'user', content: optionalTyped });
        }
        // ストリーミング表示要素
        const msgEl = document.createElement('div');
        msgEl.className = 'msg ai';
        const strong = document.createElement('strong'); strong.textContent = 'AI';
        const sep = document.createTextNode(': ');
        const span = document.createElement('span');
        msgEl.appendChild(strong); msgEl.appendChild(sep); msgEl.appendChild(span);
        els.chat.appendChild(msgEl);
        els.chat.scrollTop = els.chat.scrollHeight;

        const aiTs = Date.now();
        let full = '';
        try {
          const { askAIStream } = await import('./ai.js');
          full = await askAIStream(history, { onDelta(delta) { full += delta; span.textContent = full; els.chat.scrollTop = els.chat.scrollHeight; } });
        } catch (streamErr) {
          const { askAI } = await import('./ai.js');
          full = await askAI(history);
          span.textContent = full; els.chat.scrollTop = els.chat.scrollHeight;
        }
        // 先にseen登録し、P2Pから届く同内容のAIメッセージを抑止
        markSeen({ role: 'assistant', author: 'AI', ts: aiTs, content: full });
        p2p.sendMessage({ role: 'assistant', content: full, author: 'AI', ts: aiTs });
      } finally {
        els.askAiBtn.disabled = false; if (els.sendBtn) els.sendBtn.disabled = false;
      }
    }
  } catch (err) {
    els.roomStatus.textContent = `Error: ${err.message}`;
  }
});

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
