// Builds dist/ for Tauri: the web version from web/ (kept identical to the
// published artifact) plus the desktop additions from desktop/.
import { cpSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
cpSync(join(root, 'web'), dist, { recursive: true });
cpSync(join(root, 'desktop'), join(dist, 'desktop'), { recursive: true });

const file = join(dist, 'index.html');
let html = readFileSync(file, 'utf8');
const swaps = [
  // Fonts come from the bundle so the app works offline (lazy text fonts first).
  ["'https://fonts.googleapis.com/css2?'+q+'&display=swap'", "'desktop/fonts/fonts.css'"],
  [/https:\/\/fonts\.googleapis\.com\/css2\?[^"']*/g, 'desktop/fonts/fonts.css'],
  [/<link rel="preconnect"[^>]*>/g, ''],
];
for (const [from, to] of swaps) {
  const before = html;
  html = typeof from === 'string' ? html.split(from).join(to) : html.replace(from, to);
  if (html === before) console.warn(`prepare: nothing replaced for ${from}`);
}
// The bridge must run before the app's own scripts.
html = html.replace(/<head>/i, '<head><script src="desktop/desktop.js"></script>');
writeFileSync(file, html);
console.log('dist/ ready');
