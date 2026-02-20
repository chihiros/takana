# AI-DLC Planning Chat (Realtime)

A static web app for collaborative AI-assisted planning. Users join rooms (optional password), chat with an AI, and see everyone’s cursors and typing in real time. Runs entirely on GitHub Pages using P2P (WebRTC) — no server required.

## Quick Start
- Serve locally with any static server (examples):
  - Python: `python3 -m http.server -d . 5173`
  - Node: `npx serve .`
- Open `http://localhost:5173` and configure Settings → Firebase + AI.

## Configuration
- Open Settings and set Profile + AI options.
- For AI replies, provide an OpenAI-compatible API key or Proxy URL.
- Optionally copy `public/env.example.js` to `public/env.js` to prefill defaults.

## Deploy
- GitHub Pages: serve the repo root as static site (P2P mode works as-is).

## Security Notes
- E2E encryption: when a room has a password, messages/presence are encrypted client‑to‑client (AES‑GCM via PBKDF2‑derived key). Without a password, frames are plaintext.
- P2P is decentralized; metadata like connection presence can still leak via trackers.
- AI calls from the browser expose user-supplied keys in the client. Prefer a proxy in production.

## Persistence
- Local: IndexedDB stores the last ~200 messages per room on each device; remains after reload until cleared by the browser/storage quota.
- Network: P2P peers share recent messages upon connect; no central storage.

## Docs
- Architecture: `docs/ARCHITECTURE.md`
- App Spec: `docs/APP_SPEC.md`
