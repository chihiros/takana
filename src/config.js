export const loadEnv = () => {
  const local = JSON.parse(localStorage.getItem("settings") || "{}");
  // 誤入力の自動修正: Proxy URL に sk-（API Key）が入っている場合は移動
  try {
    if (typeof window !== 'undefined' && local?.aiProxyUrl && String(local.aiProxyUrl).includes('sk-')) {
      const migrated = { ...local };
      // 既存の aiApiKey が空なら移行、あれば Proxy をクリアのみ
      if (!migrated.aiApiKey) migrated.aiApiKey = String(migrated.aiProxyUrl);
      migrated.aiProxyUrl = '';
      localStorage.setItem('settings', JSON.stringify(migrated));
      Object.assign(local, migrated);
    }
  } catch {}
  // 外部注入値（public/env.js）をサニタイズ
  const rawInjected = typeof window !== "undefined" ? (window.__ENV || {}) : {};
  const injected = { ...rawInjected };
  if (injected.AI_PROXY_URL && String(injected.AI_PROXY_URL).includes('sk-')) {
    // セキュリティ: 公開ファイルにキーが含まれている。無効化して使用しない。
    try { console.warn('[config] Ignoring AI_PROXY_URL from env.js because it looks like an API key'); } catch {}
    injected.AI_PROXY_URL = '';
  }
  const AI_MODEL = local.aiModel || injected.AI_MODEL || "gpt-4o-mini";
  // AI_API_KEY は localStorage を優先し、未設定の場合は env.js からも拾う
  const AI_API_KEY = local.aiApiKey || injected.AI_API_KEY || "";
  const AI_PROXY_URL = local.aiProxyUrl || injected.AI_PROXY_URL || "";
  const profile = local.profile || { name: "guest", color: "#22c55e" };
  return { AI_MODEL, AI_API_KEY, AI_PROXY_URL, profile };
};

export const saveSettings = ({ aiApiKey, aiProxyUrl, aiModel, profile }) => {
  const current = JSON.parse(localStorage.getItem("settings") || "{}");
  const next = { ...current, aiApiKey, aiProxyUrl, aiModel, profile };
  localStorage.setItem("settings", JSON.stringify(next));
};
