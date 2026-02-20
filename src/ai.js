import { loadEnv } from "./config.js";

export async function askAI(messages) {
  const { AI_API_KEY, AI_PROXY_URL, AI_MODEL } = loadEnv();
  const body = { model: AI_MODEL || "gpt-4o-mini", messages };
  const headers = { "Content-Type": "application/json" };
  let url = AI_PROXY_URL?.trim();
  if (!url) {
    if (!AI_API_KEY) throw new Error("Provide AI API key or proxy URL in Settings");
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${AI_API_KEY}`;
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI error: ${res.status} ${text}`);
  }
  const json = await res.json();
  // Support OpenAI compatible response
  const content = json.choices?.[0]?.message?.content || json.reply || "";
  return content;
}
