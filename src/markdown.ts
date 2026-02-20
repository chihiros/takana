import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md || '') as string;
  // Vite runs in browser; global window is present
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

