import { loadP2PT } from './p2pt-loader';

const TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.fastcast.nz',
];

function hexToBytes(hex: string) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

async function sha256Hex(text: string) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function joinP2PRoom(
  roomId: string,
  password: string | undefined,
  profile: { name: string; color: string },
  handlers?: {
    onPresence?: (snapshot: Record<string, any>) => void;
    onMessage?: (m: any) => void;
    onSync?: (msgs: any[]) => void;
    onPeers?: (n: number) => void;
    onReview?: (r: any) => void;
    onApply?: (p: any) => void;
  }
) {
  const P2PT = await loadP2PT();
  const topicHex = await sha256Hex(`aidlc:${roomId}:${password || ''}`);
  const p2pt = new P2PT(TRACKERS, hexToBytes(topicHex));
  const peers = new Set<any>();
  let messages: any[] = [];
  let presence: Record<string, any> = {};
  const meId = Math.random().toString(36).slice(2, 10);
  const e2e = await buildCrypto(roomId, password);

  async function sendAll(obj: any) {
    const data = await e2e.wrap(obj);
    peers.forEach(peer => p2pt.send(peer, data));
  }

  p2pt.on('peerconnect', (peer: any) => {
    peers.add(peer);
    p2pt.send(peer, JSON.stringify({ t: 'sync', messages: messages.slice(-50), presence }));
    handlers?.onPeers?.(peers.size);
  });
  p2pt.on('peerclose', (peer: any) => { peers.delete(peer); handlers?.onPeers?.(peers.size); });

  p2pt.on('msg', async (_peer: any, msg: any) => {
    try {
      const obj = await e2e.unwrap(msg);
      switch (obj.t) {
        case 'presence':
          presence[obj.id] = obj.data; handlers?.onPresence?.(presence); break;
        case 'chat':
          messages.push(obj.message); handlers?.onMessage?.(obj.message); break;
        case 'review':
          handlers?.onReview?.(obj.review);
          break;
        case 'apply':
          handlers?.onApply?.(obj.patch);
          break;
        case 'sync':
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
    async broadcastPresence(data: any) {
      presence[meId] = data; await sendAll({ t: 'presence', id: meId, data }); handlers?.onPresence?.(presence);
    },
    async sendMessage(message: any) {
      messages.push(message); await sendAll({ t: 'chat', message }); handlers?.onMessage?.(message);
    },
    async sendReview(review: any) {
      await sendAll({ t: 'review', review }); handlers?.onReview?.(review);
    },
    async applyPatch(patch: any) {
      await sendAll({ t: 'apply', patch }); handlers?.onApply?.(patch);
    },
  };
}

async function buildCrypto(roomId: string, password?: string) {
  if (!password) {
    return {
      async wrap(obj: any) { return JSON.stringify(obj); },
      async unwrap(buf: any) { const text = typeof buf === 'string' ? buf : new TextDecoder().decode(buf); try { return JSON.parse(text); } catch { return {}; } }
    };
  }
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = enc.encode(`aidlc:e2e:${roomId}`);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

  return {
    async wrap(obj: any) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const pt = enc.encode(JSON.stringify(obj));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
      return JSON.stringify({ t: 'enc', v: 1, iv: b64(iv), ct: b64(ct) });
    },
    async unwrap(buf: any) {
      const text = typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
      const outer = JSON.parse(text);
      if (outer && outer.t === 'enc' && outer.iv && outer.ct) {
        const iv = b64d(outer.iv);
        const ct = b64d(outer.ct);
        const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
        return JSON.parse(new TextDecoder().decode(pt));
      }
      return outer;
    }
  };
}

function b64(uint8: Uint8Array) { let str = ''; for (let i = 0; i < uint8.length; i++) str += String.fromCharCode(uint8[i]); return btoa(str); }
function b64d(b64s: string) { const bin = atob(b64s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
