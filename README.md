# AI-DLC Planning Chat (Realtime)

A static web app for collaborative AI-assisted planning. Users join rooms (optional password), chat with an AI, and see everyone’s cursors and typing in real time. Runs entirely on GitHub Pages using P2P (WebRTC) — no server required.

## Quick Start (TypeScript + Vite)
- Install deps: `make setup` (or `npm ci`)
- Dev server: `make run` (Vite at http://localhost:5173)
- Build: `make build` → output in `dist/`
- Open `http://localhost:5173` and configure Settings → AI.

## Configuration
- Open Settings and set Profile + AI options.
- For AI replies, provide an OpenAI-compatible API key or Proxy URL.
- Local env: create `.env` or `.env.local` with the following keys (Vite reads them automatically):
  - `VITE_AI_MODEL=gpt-4o-mini` (or `mock`)
  - `VITE_AI_PROXY_URL=` (e.g., `https://your-proxy.example.com/api/chat` or `mock:`)
  - `VITE_AI_API_KEY=` (for local testing; avoid committing real keys)
  See `.env.example` for a template.

### AI Setup (Mock / Real)
- Mock (no network): set Model to `mock` (or Proxy URL to `mock:`). Use Ask AI to verify wiring; you’ll see `【mock】...` replies.
- Real with OpenAI directly: enter your OpenAI API Key, set Model (e.g., `gpt-4o-mini`). Calls are made from the browser.
- Real via Proxy (recommended): set an OpenAI-compatible proxy URL that supports browser CORS; leave API Key blank if the proxy secures the key server-side.
 - .env defaults: Add a `.env.local` with `VITE_AI_MODEL`, `VITE_AI_PROXY_URL`, `VITE_AI_API_KEY`. See `.env.example`. Do not commit real keys.

### AI Streaming
- Ask AI renders streaming responses when the endpoint supports OpenAI-style `stream: true` SSE.
- If streaming isn’t supported, it falls back to non-streaming.

### Dependencies
- All libraries are installed via npm (no runtime CDN). P2PT is bundled by Vite.

## Deploy
- GitHub Pages: serve the repo root as static site (P2P mode works as-is).

## Security Notes
- E2E encryption: when a room has a password, messages/presence are encrypted client‑to‑client (AES‑GCM via PBKDF2‑derived key). Without a password, frames are plaintext.
- P2P is decentralized; metadata like connection presence can still leak via trackers.
- AI calls from the browser expose user-supplied keys in the client. Prefer a proxy in production.
- Do not commit real secrets. `.env.local` is for local/testing only and should be gitignored by default.

## Persistence
- Local: IndexedDB stores the last ~200 messages per room on each device; remains after reload until cleared by the browser/storage quota.
- Network: P2P peers share recent messages upon connect; no central storage.

## Docs
- Architecture: `docs/ARCHITECTURE.md`
- App Spec: `docs/APP_SPEC.md`

## Troubleshooting
- Dev server won’t start: run `make setup` first. If corporate proxy, configure npm proxy.
- CORS errors for AI: prefer a proxy with proper CORS; or use the Mock model to verify UI.
- No streaming output: your proxy may not support SSE; the app falls back to non-streaming.
- 501 Unsupported method and key shown in logs: You likely put your API key into the Proxy URL. Rotate your key immediately, then set the key in "OpenAI API Key" and leave Proxy URL empty (or set a full `https://...` URL if using a proxy). The Proxy URL must be absolute or `mock:`.
