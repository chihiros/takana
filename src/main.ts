import { loadEnv, saveSettings } from './config';
import { joinP2PRoom } from './p2p';
import { getMessages, addMessage, addMessages } from './storage';
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
  presence: document.getElementById('presence') as HTMLDivElement,
  overlayCanvas: document.getElementById('overlayCanvas') as HTMLCanvasElement,
};

const env = loadEnv();
// Query params: allow specifying roomId via ?room= or ?roomId=
try {
  const url = new URL(window.location.href);
  const qRoom = (url.searchParams.get('room') || url.searchParams.get('roomId') || '').trim();
  if (qRoom) {
    const input = document.getElementById('roomId') as HTMLInputElement | null;
    if (input) input.value = qRoom;
  }
} catch {}
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
      onSync(msgs) { appendChat(msgs); addMessages(roomId, msgs); },
      onReview(_r) { /* reviews disabled */ },
      onApply(_p) { /* apply disabled */ },
    });

    // rebuildAssistant removed (comments/line numbers disabled)

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
    // removed: messageState, reviews, rangeReviews
    function appendChat(items: any[] | any) {
      if (!Array.isArray(items)) items = [items];
      const filtered = (items as any[]).filter(m => { const k = msgKey(m); if (seen.has(k)) return false; seen.add(k); return true; });
      if (!filtered.length) return;
      for (const m of filtered) {
        const wrap = document.createElement('div');
        const isAssistant = (m.role || '') === 'assistant';
        const isUser = (m.role || '') === 'user';
        const isMe = isUser && String(m.author || '') === String(cfg.profile?.name || '');
        wrap.className = 'msg';
        if (isAssistant) wrap.classList.add('ai');
        if (isMe) wrap.classList.add('me');
        const head = document.createElement('div'); head.className = 'msg-head';
        const who = document.createElement('strong'); who.textContent = String(m.author || m.role || '');
        head.appendChild(who);
        const content = String(m.content || '');
        const mid = (m as any).mid || `${m.author||''}:${m.ts||Date.now()}:${hash32(content)}`;
        (wrap as HTMLElement).setAttribute('data-mid', mid);
        const body = document.createElement('div'); body.className = 'msg-content'; body.textContent = content;
        wrap.appendChild(head); wrap.appendChild(body);
        els.chat.appendChild(wrap);
      }
      els.chat.scrollTop = els.chat.scrollHeight;
    }

    function updateGutterMarks(mid: string) {
      const wrap = els.chat.querySelector(`[data-mid="${CSS.escape(mid)}"]`) as HTMLElement | null;
      if (!wrap) return;
      const map = reviews.get(mid);
      const rlist = (rangeReviews.get(mid) || []) as any[];
      const gutter = wrap.querySelector('.msg-gutter'); if (!gutter) return;
      gutter.querySelectorAll('.line').forEach(el => {
        const idx = Number((el as HTMLElement).getAttribute('data-line') || '0');
        const hasSingle = map && map.has(idx);
        const hasRange = rlist.some(r => idx >= (r.start ?? r.line) && idx <= (r.end ?? r.line));
        if (hasSingle || hasRange) el.classList.add('has-review'); else el.classList.remove('has-review');
      });
    }

    function renderThread(mid: string, line: number, panel: HTMLElement) {
      panel.innerHTML = '';
      const title = document.createElement('h4'); title.textContent = `Line ${line + 1} — Reviews`;
      const list = document.createElement('div'); list.className = 'review-comments';
      const arr = (reviews.get(mid)?.get(line)) || [];
      for (const r of arr) {
        const item = document.createElement('div'); item.className = 'review-comment';
        const head = document.createElement('div'); head.innerHTML = `<strong>${escapeHtml(r.author || 'user')}</strong> · ${new Date(r.ts||Date.now()).toLocaleString()}`;
        const body = document.createElement('div'); body.textContent = String(r.comment || '');
        item.appendChild(head); item.appendChild(body);
        if (r.replacement) {
          const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = String(r.replacement); pre.appendChild(code); item.appendChild(pre);
          const applyBtn = document.createElement('button'); applyBtn.className = 'btn'; applyBtn.textContent = 'Apply this change';
          applyBtn.addEventListener('click', () => {
            const patch = { target: mid, line, replacement: String(r.replacement || ''), author: env.profile?.name || 'guest', ts: Date.now() };
            p2p.applyPatch(patch);
          });
          item.appendChild(applyBtn);
        }
        list.appendChild(item);
      }
      const form = document.createElement('div'); form.className = 'review-form';
      const ta = document.createElement('textarea'); ta.rows = 3; ta.placeholder = 'コメントを追加…';
      const repl = document.createElement('input'); repl.placeholder = '置換案（任意）';
      const actions = document.createElement('div'); actions.className = 'actions';
      const addBtn = document.createElement('button'); addBtn.className = 'btn'; addBtn.textContent = 'Comment';
      const applyBtn = document.createElement('button'); applyBtn.className = 'btn'; applyBtn.textContent = 'Apply replacement';
      addBtn.addEventListener('click', () => { const comment = ta.value.trim(); if (!comment) return; const review = { id: crypto.randomUUID(), target: mid, line, comment, replacement: '', author: env.profile?.name || 'guest', ts: Date.now() }; p2p.sendReview(review); ta.value=''; });
      applyBtn.addEventListener('click', () => { const replacement = repl.value; const review = { id: crypto.randomUUID(), target: mid, line, comment: ta.value.trim(), replacement, author: env.profile?.name || 'guest', ts: Date.now() }; p2p.sendReview(review); const patch = { target: mid, line, replacement, author: env.profile?.name || 'guest', ts: Date.now() }; p2p.applyPatch(patch); ta.value=''; repl.value=''; });
      actions.appendChild(addBtn); actions.appendChild(applyBtn);
      form.appendChild(ta); form.appendChild(repl); form.appendChild(actions);
      panel.appendChild(title); panel.appendChild(list); panel.appendChild(form);
    }

    // Range selection & inline editor helpers
    function attachRangeHandlers(msgWrap: HTMLElement, gutter: HTMLElement, mid: string, lineEl: HTMLElement) {
      let dragging = false; let start = 0; let last = 0;
      const onMouseUp = () => {
        if (!dragging) return; dragging = false;
        const sel = getSelectedRange(gutter); clearSelected(gutter);
        if (!sel) return; const [s,e] = sel; openInlineEditor(msgWrap, mid, s, e);
        document.removeEventListener('mouseup', onMouseUp);
      };
      lineEl.addEventListener('mousedown', (e) => {
        e.preventDefault(); dragging = true; start = Number(lineEl.getAttribute('data-line')) || 0; last = start;
        updateSelectedRange(gutter, start, start);
        document.addEventListener('mouseup', onMouseUp);
      });
      lineEl.addEventListener('mouseenter', () => {
        if (!dragging) return; const cur = Number(lineEl.getAttribute('data-line')) || 0; if (cur !== last) { last = cur; updateSelectedRange(gutter, start, cur); }
      });
      lineEl.addEventListener('click', () => { if (!dragging) openInlineEditor(msgWrap, mid, Number(lineEl.getAttribute('data-line'))||0, Number(lineEl.getAttribute('data-line'))||0); });
    }
    function updateSelectedRange(gutter: HTMLElement, a: number, b: number) { clearSelected(gutter); const s = Math.min(a,b), e = Math.max(a,b); for (let i=s;i<=e;i++){ const el = gutter.querySelector(`.line[data-line="${i}"]`) as HTMLElement | null; if (el) el.classList.add('selected'); } }
    function clearSelected(gutter: HTMLElement) { gutter.querySelectorAll('.line.selected').forEach(n => n.classList.remove('selected')); }
    function getSelectedRange(gutter: HTMLElement): [number,number] | null { const nodes = Array.from(gutter.querySelectorAll('.line.selected')) as HTMLElement[]; if (!nodes.length) return null; const idxs = nodes.map(n => Number(n.getAttribute('data-line'))||0); return [Math.min(...idxs), Math.max(...idxs)]; }
    function openInlineEditor(msgWrap: HTMLElement, mid: string, start: number, end: number) {
      const bodyWrap = msgWrap.querySelector('.msg-body') as HTMLElement | null; const gutter = msgWrap.querySelector('.msg-gutter') as HTMLElement | null; if (!bodyWrap || !gutter) return;
      const endLine = gutter.querySelector(`.line[data-line="${end}"]`) as HTMLElement | null; if (!endLine) return;
      const bodyRect = bodyWrap.getBoundingClientRect(); const gutterRect = gutter.getBoundingClientRect(); const lineRect = endLine.getBoundingClientRect();
      let inline = bodyWrap.querySelector(`.inline-review[data-range="${start}-${end}"]`) as HTMLElement | null;
      if (!inline) { inline = document.createElement('div'); inline.className = 'inline-review'; inline.setAttribute('data-range', `${start}-${end}`); bodyWrap.appendChild(inline); }
      const left = gutterRect.right - bodyRect.left + 8; const top = lineRect.bottom - bodyRect.top + 4;
      inline.style.left = `${Math.max(0, left)}px`; inline.style.top = `${Math.max(0, top)}px`;
      inline.style.width = `${Math.max(200, bodyRect.width - left - 12)}px`;
      renderThreadRange(mid, start, end, inline);
    }
    function renderThreadRange(mid: string, start: number, end: number, container: HTMLElement) {
      container.innerHTML = '';
      const title = document.createElement('div'); title.className = 'hdr'; title.textContent = `Review · L${start + 1}${end !== start ? `–L${end + 1}` : ''}`;
      const list = document.createElement('div'); list.className = 'review-comments';
      const all = (rangeReviews.get(mid) || []) as any[];
      const arr = all.filter(r => (r.start ?? r.line) === start && (r.end ?? r.line) === end);
      for (const r of arr) {
        const item = document.createElement('div'); item.className = 'review-comment';
        const head = document.createElement('div'); head.innerHTML = `<strong>${escapeHtml(r.author || 'user')}</strong> · ${new Date(r.ts||Date.now()).toLocaleString()}`;
        const body = document.createElement('div'); body.textContent = String(r.comment || '');
        item.appendChild(head); item.appendChild(body);
        if (r.replacement) {
          const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = String(r.replacement); pre.appendChild(code); item.appendChild(pre);
          const applyBtn = document.createElement('button'); applyBtn.className = 'btn'; applyBtn.textContent = 'Apply this change';
          applyBtn.addEventListener('click', () => { const patch = { target: mid, start, end, replacement: String(r.replacement||''), author: env.profile?.name || 'guest', ts: Date.now() }; p2p.applyPatch(patch); });
          item.appendChild(applyBtn);
        }
        list.appendChild(item);
      }
      const form = document.createElement('div'); form.className = 'review-form';
      const ta = document.createElement('textarea'); ta.rows = 3; ta.placeholder = 'コメントを追加…';
      const repl = document.createElement('input'); repl.placeholder = '置換案（任意、複数行可）';
      const actions = document.createElement('div'); actions.className = 'actions';
      const addBtn = document.createElement('button'); addBtn.className = 'btn'; addBtn.textContent = 'Comment';
      const applyBtn = document.createElement('button'); applyBtn.className = 'btn'; applyBtn.textContent = 'Apply replacement';
      addBtn.addEventListener('click', () => { const comment = ta.value.trim(); if (!comment) return; const review = { id: crypto.randomUUID(), target: mid, start, end, comment, replacement: '', author: env.profile?.name || 'guest', ts: Date.now() }; p2p.sendReview(review); ta.value=''; });
      applyBtn.addEventListener('click', () => { const replacement = repl.value; const review = { id: crypto.randomUUID(), target: mid, start, end, comment: ta.value.trim(), replacement, author: env.profile?.name || 'guest', ts: Date.now() }; p2p.sendReview(review); const patch = { target: mid, start, end, replacement, author: env.profile?.name || 'guest', ts: Date.now() }; p2p.applyPatch(patch); ta.value=''; repl.value=''; });
      actions.appendChild(addBtn); actions.appendChild(applyBtn);
      form.appendChild(ta); form.appendChild(repl); form.appendChild(actions);
      container.appendChild(title); container.appendChild(list); container.appendChild(form);
    }

    els.composer.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = els.messageInput.value.trim(); if (!text) return;
      els.messageInput.value = '';
      const id = p2p.meId; presenceState[id] = presenceState[id] || { name: cfg.profile.name, color: cfg.profile.color, typing: '' };
      presenceState[id] = { ...presenceState[id], typing: '' }; p2p.broadcastPresence({ ...presenceState[id] });
      // 自分のユーザーメッセージを即時表示・保存・配信
      const userTs = Date.now();
      const userMid = crypto.randomUUID();
      const userMsg = { role: 'user', author: cfg.profile?.name || 'guest', ts: userTs, content: text, mid: userMid };
      appendChat([userMsg]);
      markSeen(userMsg);
      addMessage(roomId, userMsg);
      p2p.sendMessage(userMsg);
      await runAskAI();
    });

    async function runAskAI(optionalTyped?: string) {
      if (els.sendBtn) els.sendBtn.disabled = true;
      try {
        const history = (await getMessages(roomId)).map((m: any) => ({ role: m.role || 'user', content: m.content || '' }));
        // 送信済みのユーザーメッセージは履歴に保存済みのため、ここでは追加しない
        const msgEl = document.createElement('div'); msgEl.className = 'msg ai';
        const aiMid = crypto.randomUUID();
        (msgEl as HTMLElement).setAttribute('data-mid', aiMid);
        const head = document.createElement('div'); head.className = 'msg-head';
        const strong = document.createElement('strong'); strong.textContent = 'AI'; head.appendChild(strong);
        const body = document.createElement('div'); body.className = 'msg-content';
        msgEl.appendChild(head); msgEl.appendChild(body);
        els.chat.appendChild(msgEl); els.chat.scrollTop = els.chat.scrollHeight;

        const aiTs = Date.now(); let full = '';
        try {
          const { askAIStream } = await import('./ai');
          full = await askAIStream(history, { onDelta(delta) { full += delta; (body as HTMLElement).innerText = full; els.chat.scrollTop = els.chat.scrollHeight; }, system: getDefaultPrompt()?.body });
        } catch {
          const { askAI } = await import('./ai');
          full = await askAI(history, { system: getDefaultPrompt()?.body }); (body as HTMLElement).innerText = full; els.chat.scrollTop = els.chat.scrollHeight;
        }
        // keep plain text as-is (no line numbers or comments)
        markSeen({ role: 'assistant', author: 'AI', ts: aiTs, content: full });
        p2p.sendMessage({ role: 'assistant', content: full, author: 'AI', ts: aiTs, mid: aiMid });
      } finally { if (els.sendBtn) els.sendBtn.disabled = false; }
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
