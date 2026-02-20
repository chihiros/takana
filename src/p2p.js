// P2P realtime using WebRTC with public WebTorrent trackers for signaling.
// No server required; works on GitHub Pages.

const TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.fastcast.nz',
];

function loadP2PT() {
  if (window.P2PT) return Promise.resolve(window.P2PT);
  const umdSources = [
    // UMD/IIFE グローバル（CORS不要のクラシックスクリプト）
    'https://cdn.jsdelivr.net/npm/p2pt@1/dist/p2pt.min.js',
    'https://cdn.jsdelivr.net/npm/p2pt/dist/p2pt.min.js',
    'https://unpkg.com/p2pt@1/dist/p2pt.min.js',
    'https://unpkg.com/p2pt/dist/p2pt.min.js',
    // 同梱フォールバック
    '/public/p2pt.min.js',
  ];
  const esmSources = [
    // ESM（モジュールインポート）
    'https://cdn.jsdelivr.net/npm/p2pt@1/dist/p2pt.min.js',
  ];
  return new Promise(async (resolve, reject) => {
    // 1) UMD をクラシックスクリプトとして試す（CORS の影響を受けにくい）
    for (const src of umdSources) {
      try {
        await loadScript(src, 8000);
        if (window.P2PT) return resolve(window.P2PT);
      } catch {}
    }
    // 2) だめなら ESM を動的 import（CORS 必須だが jsDelivr は許可されていることが多い）
    for (const src of esmSources) {
      try {
        const mod = await import(/* @vite-ignore */ src);
        const P2PT = mod?.default || mod?.P2PT || window.P2PT;
        if (P2PT) return resolve(P2PT);
      } catch {}
    }
    reject(new Error('Failed to load P2PT (CDN/CORS). ネットワークを変えるか public/p2pt.min.js を同梱してください。'));
  });
}

function loadScript(src, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    let timedOut = false;
    const to = setTimeout(() => { timedOut = true; cleanup(); reject(new Error('timeout')); }, timeoutMs);
    function cleanup() { clearTimeout(to); s.onload = null; s.onerror = null; }
    // CORS ブロックを避けるため crossOrigin/referrerPolicy は付与しない（クラシックJS）
    s.src = src;
    s.onload = () => { if (!timedOut) { cleanup(); resolve(); } };
    s.onerror = () => { if (!timedOut) { cleanup(); reject(new Error('load-error')); } };
    document.head.appendChild(s);
  });
}

async function sha256Hex(text) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i*2, 2), 16);
  return arr;
}

export async function joinP2PRoom(roomId, password, profile, handlers) {
  const P2PT = await loadP2PT();
  const topicHex = await sha256Hex(`aidlc:${roomId}:${password||''}`);
  const p2pt = new P2PT(TRACKERS, hexToBytes(topicHex));
  const peers = new Set();
  let messages = [];
  let presence = {}; // clientId -> presence
  const meId = Math.random().toString(36).slice(2,10);
  const e2e = await buildCrypto(roomId, password);

  async function sendAll(obj) {
    const data = await e2e.wrap(obj);
    peers.forEach(peer => p2pt.send(peer, data));
  }

  p2pt.on('peerconnect', (peer) => {
    peers.add(peer);
    // Send a sync frame with recent messages and presence
    p2pt.send(peer, JSON.stringify({ t: 'sync', messages: messages.slice(-50), presence }));
    handlers?.onPeers?.(peers.size);
  });

  p2pt.on('peerclose', (peer) => {
    peers.delete(peer);
    handlers?.onPeers?.(peers.size);
  });

  p2pt.on('msg', async (_peer, msg) => {
    try {
      const obj = await e2e.unwrap(msg);
      switch (obj.t) {
        case 'presence':
          presence[obj.id] = obj.data;
          handlers?.onPresence?.(presence);
          break;
        case 'chat':
          messages.push(obj.message);
          handlers?.onMessage?.(obj.message);
          break;
        case 'sync':
          // Merge: prefer latest presence keys, concat messages
          presence = { ...presence, ...obj.presence };
          messages = [...messages, ...(obj.messages || [])].slice(-200);
          handlers?.onPresence?.(presence);
          handlers?.onSync?.(obj.messages || []);
          break;
      }
    } catch {}
  });

  p2pt.start();

  return {
    meId,
    async broadcastPresence(data) {
      presence[meId] = data;
      await sendAll({ t: 'presence', id: meId, data });
      handlers?.onPresence?.(presence);
    },
    async sendMessage(message) {
      messages.push(message);
      await sendAll({ t: 'chat', message });
      handlers?.onMessage?.(message);
    },
  };
}

async function buildCrypto(roomId, password) {
  // If no password, pass-through
  if (!password) {
    return {
      async wrap(obj) { return JSON.stringify(obj); },
      async unwrap(buf) {
        const text = typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
        try { return JSON.parse(text); } catch { return {}; }
      }
    };
  }
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = enc.encode(`aidlc:e2e:${roomId}`);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);

  return {
    async wrap(obj) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const pt = enc.encode(JSON.stringify(obj));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
      const payload = { t: 'enc', v: 1, iv: b64(iv), ct: b64(ct) };
      return JSON.stringify(payload);
    },
    async unwrap(buf) {
      const text = typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
      const outer = JSON.parse(text);
      if (outer && outer.t === 'enc' && outer.iv && outer.ct) {
        const iv = b64d(outer.iv);
        const ct = b64d(outer.ct);
        const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
        return JSON.parse(new TextDecoder().decode(pt));
      }
      // Fallback to plaintext for compatibility
      return outer;
    }
  };
}

function b64(uint8) {
  let str = '';
  for (let i = 0; i < uint8.length; i++) str += String.fromCharCode(uint8[i]);
  return btoa(str);
}
function b64d(b64s) {
  const bin = atob(b64s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
