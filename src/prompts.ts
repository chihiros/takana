// Dynamically load prompts in ../prompts with numeric prefixes like 01_*.md
// Uses Vite's import.meta.glob to include files at build time.
// Vite 5: use query/import instead of deprecated `as: 'raw'`
const files = import.meta.glob('../prompts/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export type PromptDef = { id: string; name: string; order: number; body: string };

const list: PromptDef[] = Object.entries(files).map(([path, body]) => {
  const fname = path.split('/').pop() || '';
  const match = fname.match(/^(\d+)_([^.]*)\.md$/);
  const order = match ? parseInt(match[1], 10) : 9999;
  const name = match ? match[2].replace(/[-_]/g, ' ') : fname.replace(/\.md$/, '');
  const id = fname.replace(/\.md$/, '');
  return { id, name, order, body: String(body || '') };
}).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

export const PROMPTS_LIST = list;
export function getDefaultPrompt() { return list[0]; }
export function getPromptById(id: string) { return list.find(p => p.id === id); }
