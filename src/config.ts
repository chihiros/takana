export type Profile = { name: string; color: string };
export type AppEnv = {
  AI_MODEL: string;
  AI_API_KEY: string;
  AI_PROXY_URL: string;
  profile: Profile;
};

export const loadEnv = (): AppEnv => {
  const local = safeParse(localStorage.getItem('settings')) || {} as any;
  // env from Vite
  const injected: Record<string, string | undefined> = {
    AI_MODEL: (import.meta as any).env?.VITE_AI_MODEL,
    AI_PROXY_URL: (import.meta as any).env?.VITE_AI_PROXY_URL,
    AI_API_KEY: (import.meta as any).env?.VITE_AI_API_KEY,
  };

  // sanitize env.js like values (if wired) — ignore sk- in proxy
  const AI_MODEL = (local.aiModel || injected.AI_MODEL || 'gpt-4o-mini') as string;
  const AI_API_KEY = (local.aiApiKey || injected.AI_API_KEY || '') as string;
  let AI_PROXY_URL = (local.aiProxyUrl || injected.AI_PROXY_URL || '') as string;
  if (AI_PROXY_URL && AI_PROXY_URL.includes('sk-')) AI_PROXY_URL = '';
  const profile: Profile = local.profile || { name: 'guest', color: '#22c55e' };
  return { AI_MODEL, AI_API_KEY, AI_PROXY_URL, profile };
};

export const saveSettings = ({ aiApiKey, aiProxyUrl, aiModel, profile }: { aiApiKey?: string; aiProxyUrl?: string; aiModel?: string; profile?: Profile; }) => {
  const current = safeParse(localStorage.getItem('settings')) || {};
  const next = { ...current, aiApiKey, aiProxyUrl, aiModel, profile };
  localStorage.setItem('settings', JSON.stringify(next));
};

function safeParse(s: string | null) {
  if (!s) return null; try { return JSON.parse(s); } catch { return null; }
}

