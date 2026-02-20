#!/usr/bin/env node
import { mkdir, copyFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    const src = resolve(__dirname, '../node_modules/p2pt/dist/p2pt.iife.js');
    const outDir = resolve(__dirname, '../public/vendor');
    const dest = resolve(outDir, 'p2pt.iife.js');
    await mkdir(outDir, { recursive: true });
    // Ensure source exists
    await stat(src);
    await copyFile(src, dest);
    console.log(`[vendor] Copied p2pt to ${dest}`);
  } catch (err) {
    console.warn('[vendor] Could not vendor p2pt:', err?.message || err);
  }
}

main();
