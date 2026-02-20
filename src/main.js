import { loadEnv, saveSettings } from "./config.js";
import { joinP2PRoom } from "./p2p.js";
import { getMessages, addMessage, addMessages } from "./storage.js";

const els = {
  settingsBtn: document.getElementById("settingsBtn"),
  settingsDialog: document.getElementById("settingsDialog"),
  saveSettings: document.getElementById("saveSettings"),
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
  messageInput: document.getElementById("messageInput"),
  askAiBtn: document.getElementById("askAiBtn"),
  presence: document.getElementById("presence"),
  cursorCanvas: document.getElementById("cursorCanvas"),
};

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
  saveSettings({ aiApiKey: els.aiApiKey.value.trim(), aiProxyUrl: els.aiProxyUrl.value.trim(), aiModel: els.aiModel.value.trim(), profile });
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

    function appendChat(items) {
      if (!Array.isArray(items)) items = [items];
      const html = items.map(m => `<div class=\"msg ${m.role === 'assistant' ? 'ai' : m.role === 'user' ? 'me' : ''}\"><strong>${escapeHtml(m.author || m.role)}</strong>: ${escapeHtml(m.content||'')}</div>`).join('');
      els.chat.insertAdjacentHTML('beforeend', html);
      els.chat.scrollTop = els.chat.scrollHeight;
    }
    // Load local persisted history first
    const localMsgs = await getMessages(roomId);
    if (localMsgs.length) appendChat(localMsgs);

    els.composer.addEventListener('submit', () => {
      const text = els.messageInput.value.trim(); if (!text) return;
      const msg = { role: 'user', content: text, author: cfg.profile.name, ts: Date.now() };
      p2p.sendMessage(msg);
    });
    els.askAiBtn.addEventListener('click', async () => {
      try {
        els.askAiBtn.disabled = true;
        const history = (await getMessages(roomId)).map(m => ({ role: m.role || 'user', content: m.content || '' }));
        if (history.length === 0 || history[history.length-1].role !== 'user') {
          const text = els.messageInput.value.trim(); if (text) history.push({ role: 'user', content: text });
        }
        const { askAI } = await import('./ai.js');
        const reply = await askAI(history);
        p2p.sendMessage({ role: 'assistant', content: reply, author: 'AI', ts: Date.now() });
      } catch (err) { alert(`AI error: ${err.message}`); }
      finally { els.askAiBtn.disabled = false; }
    });
  } catch (err) {
    els.roomStatus.textContent = `Error: ${err.message}`;
  }
});

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
