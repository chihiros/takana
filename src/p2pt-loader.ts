let cached: any = null;

export async function loadP2PT(): Promise<any> {
  if (cached) return cached;
  const sources = [
    // Vendored by postinstall script
    '/vendor/p2pt.iife.js',
    // Fallback: raw from node_modules (served by Vite dev). May not work in some setups.
    '/node_modules/p2pt/dist/p2pt.iife.js',
  ];
  let lastErr: any = null;
  for (const src of sources) {
    try {
      await injectScript(src, 10000);
      const mod = (window as any).P2PT;
      if (mod) { cached = mod; return mod; }
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Failed to initialize P2PT: ${lastErr?.message || 'unknown'}`);
}

function injectScript(src: string, timeoutMs = 10000) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; cleanup(); reject(new Error('timeout')); } }, timeoutMs);
    function cleanup() { clearTimeout(to); s.onload = null; s.onerror = null; }
    s.src = src; s.async = true;
    s.onload = () => { if (!done) { done = true; cleanup(); resolve(); } };
    s.onerror = () => { if (!done) { done = true; cleanup(); reject(new Error('load-error')); } };
    document.head.appendChild(s);
  });
}
