# Architecture

- Hosting: static site (GitHub Pages) — no server.
- Realtime: P2P via WebRTC with public WebTorrent trackers (no backend).
- AI: Browser calls OpenAI-compatible Chat Completions API using user-provided key or a proxy URL.
- Crypto: Optional E2E when a room password is set (AES‑GCM, PBKDF2-derived key from password + roomId).

## Modules
- `index.html`: UI shell, settings dialog.
- `src/config.js`: load/save settings from `localStorage` and `window.__ENV`.
- `src/p2p.js`: WebRTC P2P room, presence and chat sync via trackers; optional E2E.
- `src/storage.js`: IndexedDB storage for messages (per room, last ~200 entries).
- `src/ai.js`: OpenAI-compatible request wrapper.

## Data Model
- P2P: in-memory only; peers share last N messages/presence on connect. Client stores last ~200 messages per room in IndexedDB.

## Security Considerations
- With a password: payloads (presence/messages/sync) are E2E-encrypted; signaling metadata is still visible to trackers.
- Without a password: payloads are plaintext; do not share secrets.
- Prefer an AI proxy with a server-side key; do not embed secrets in the client.
