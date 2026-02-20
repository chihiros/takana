// Copy to public/env.js to prefill defaults (optional)
window.__ENV = {
  // 注意: このファイルはクライアントへ配布されます（秘密は入れない）。
  AI_MODEL: "gpt-4o-mini",
  AI_PROXY_URL: "", // 例: https://your-domain.com/api/chat（任意）
  AI_API_KEY: "", // 例: sk-...（任意・開発用途のみ推奨）
};
