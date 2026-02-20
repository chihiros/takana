export const loadEnv = () => {
  const local = JSON.parse(localStorage.getItem("settings") || "{}");
  const injected = typeof window !== "undefined" ? (window.__ENV || {}) : {};
  const AI_MODEL = local.aiModel || injected.AI_MODEL || "gpt-4o-mini";
  const AI_API_KEY = local.aiApiKey || ""; // user-provided only
  const AI_PROXY_URL = local.aiProxyUrl || injected.AI_PROXY_URL || "";
  const profile = local.profile || { name: "guest", color: "#22c55e" };
  return { AI_MODEL, AI_API_KEY, AI_PROXY_URL, profile };
};

export const saveSettings = ({ aiApiKey, aiProxyUrl, aiModel, profile }) => {
  const current = JSON.parse(localStorage.getItem("settings") || "{}");
  const next = { ...current, aiApiKey, aiProxyUrl, aiModel, profile };
  localStorage.setItem("settings", JSON.stringify(next));
};
