import { loadEnv, saveSettings } from './config';
import { joinP2PRoom } from './p2p';
import { getMessages, addMessage, addMessages } from './storage';
import { renderMarkdown } from './markdown';
import { getDefaultPrompt } from './prompts';

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
  overlayCanvas: document.getElementById('overlayCanvas') as HTMLCanvasElement,
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
    const overlayCtx = els.overlayCanvas.getContext('2d')!;
    function resizeOverlay() { els.overlayCanvas.width = Math.max(1, Math.floor(window.innerWidth * dpr)); els.overlayCanvas.height = Math.max(1, Math.floor(window.innerHeight * dpr)); }
    resizeOverlay();
    window.addEventListener('resize', resizeOverlay);
    function draw() {
      overlayCtx.clearRect(0, 0, els.overlayCanvas.width, els.overlayCanvas.height);
      for (const id in presenceState) {
        const p = presenceState[id]; if (!p) continue;
        // Map normalized viewport coords to overlay canvas
        const x = p.x * els.overlayCanvas.width;
        const y = p.y * els.overlayCanvas.height;
        overlayCtx.fillStyle = p.color || '#22c55e'; overlayCtx.beginPath(); overlayCtx.arc(x, y, 6 * dpr, 0, Math.PI * 2); overlayCtx.fill();
        overlayCtx.fillStyle = '#fff'; overlayCtx.font = `${12 * dpr}px system-ui`; overlayCtx.fillText(p.name || id, x + 8 * dpr, y - 8 * dpr);
        if (p.typing) { overlayCtx.fillStyle = '#94a3b8'; overlayCtx.fillText(String(p.typing).slice(0, 24), x + 8 * dpr, y + 10 * dpr); }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    document.addEventListener('pointermove', (e) => {
      const x = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
      const y = Math.max(0, Math.min(1, e.clientY / window.innerHeight));
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
          full = await askAIStream(history, { onDelta(delta) { full += delta; (span as HTMLElement).innerText = full; els.chat.scrollTop = els.chat.scrollHeight; }, system: getDefaultPrompt()?.body });
        } catch {
          const { askAI } = await import('./ai');
          full = await askAI(history, { system: getDefaultPrompt()?.body }); (span as HTMLElement).innerText = full; els.chat.scrollTop = els.chat.scrollHeight;
        }
        (span as HTMLElement).innerHTML = renderMarkdown(full);
        markSeen({ role: 'assistant', author: 'AI', ts: aiTs, content: full });
        p2p.sendMessage({ role: 'assistant', content: full, author: 'AI', ts: aiTs });
      } finally {
        els.askAiBtn.disabled = false; if (els.sendBtn) els.sendBtn.disabled = false;
      }
    }
    // 初回キックオフ: 履歴が空なら自動でプランニング開始
    const initial = await getMessages(roomId);
    if (!initial || initial.length === 0) {
      // 起動時はプロンプトは読まず、サンプルの質問リストを提示
      const sample = [
        'プランニングを始めましょう。以下の質問に答えてください。',
        '- 1) プロジェクトの目的（達成したい価値）は？',
        '- 2) 主要なユーザー/ステークホルダーは誰？',
        '- 3) 想定ユースケース（3〜5件）を挙げてください。',
        '- 4) 優先すべきユースケースはどれ？理由は？',
        '- 5) 成功指標（KPI/KSF）は？',
        '- 6) 既存の制約（技術/運用/法務/スケジュール）は？',
        '- 7) 対象プラットフォーム/環境（Web/モバイル/CLI 等）は？',
        '- 8) 依存サービスや外部APIは？',
        '- 9) データ保存/同期の方針は？',
        '- 10) セキュリティ/認可要件は？',
        '- 11) 非機能要件（性能/可用性/監視）は？',
        '- 12) 既知のリスク/ブロッカーは？',
        '- 13) 今週のスコープ（何を終える？）は？',
        '- 14) タスク分解（30–120分粒度）を列挙してください。',
        '- 15) 依存関係/順序関係は？',
        '- 16) 見積（S/M/L など）と優先度は？',
        '- 17) 今日取り掛かる最小ステップは？',
        '- 18) 不明点/要確認事項は？',
        '- 19) コミュニケーション/レビューの頻度は？',
        '- 20) 想定される完成イメージ（簡潔に）を言語化してください。'
      ].join('\n');
      p2p.sendMessage({ role: 'assistant', author: 'AI', ts: Date.now(), content: sample });
    }
    // Join 完了後はボタン無効化（重複Joinでの重複表示防止）
    els.joinRoom.disabled = true;
    els.joinRoom.textContent = 'Joined';
  } catch (err: any) { els.roomStatus.textContent = `Error: ${err.message}`; }
});

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]); }
function hash32(str: string) { let h = 0; for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; } return (h >>> 0).toString(36); }
