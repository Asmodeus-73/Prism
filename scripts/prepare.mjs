// Builds dist/ for Tauri: the web version from web/ (kept identical to the
// published artifact) plus the desktop additions from desktop/.
import { cpSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
cpSync(join(root, 'web'), dist, { recursive: true });
cpSync(join(root, 'desktop'), join(dist, 'desktop'), { recursive: true });

// AI model files (about 460 MB) stay out of the app: it fetches each one the first
// time it is needed (src-tauri/src/models.rs), checked against the hash listed here.
// The TensorFlow.js models (esrgan-x2, esrgan-x4) stay in: their weights are found
// next to model.json, and they are small.
const models = {};
for (const dir of readdirSync(join(dist, 'ai'))) {
  const full = join(dist, 'ai', dir);
  if (!statSync(full).isDirectory() || /^esrgan-x\d$/.test(dir)) continue;
  for (const f of readdirSync(full)) {
    if (!f.endsWith('.wasm')) continue;
    const rel = `ai/${dir}/${f}`;
    models[rel] = createHash('sha256').update(readFileSync(join(full, f))).digest('hex');
    rmSync(join(full, f));
  }
}
writeFileSync(join(dist, 'desktop', 'models.js'), `window.PRISM_MODELS=${JSON.stringify(models)};\n`);
writeFileSync(join(dist, 'models.json'), JSON.stringify(models, null, 1) + '\n');

const file = join(dist, 'index.html');
let html = readFileSync(file, 'utf8');
const swaps = [
  // Fonts come from the bundle so the app works offline (lazy text fonts first).
  ["'https://fonts.googleapis.com/css2?'+q+'&display=swap'", "'desktop/fonts/fonts.css'"],
  [/https:\/\/fonts\.googleapis\.com\/css2\?[^"']*/g, 'desktop/fonts/fonts.css'],
  [/<link rel="preconnect"[^>]*>/g, ''],
  // Fonts load right away (the print/onload trick is an inline handler the app's CSP blocks).
  [` media="print" onload="this.media='all'"`, ''],
  // Synced files are served by the app instead of claude.ai.
  ["'/_blob/'", 'PRISM_BLOB'],
  ['"/_blob/${', '"${PRISM_BLOB}${'],
  // Sync goes through a folder, not a claude.ai account.
  ['La synchronisation entre appareils fonctionne quand Prism est ouvert depuis votre compte Claude par son propriétaire.',
    'Pour retrouver vos projets sur votre autre ordinateur, choisissez un dossier synchronisé : Fichier > Dossier de synchronisation…'],
  ['Disponible quand Prism est ouvert depuis votre compte Claude', 'Choisissez d’abord un dossier : Fichier > Dossier de synchronisation…'],
  ['Sur cet appareil et sur votre compte', 'Sur cet appareil et dans le dossier synchronisé'],
  ['de cet appareil et de votre compte', 'de cet appareil et du dossier synchronisé'],
  ['rouvrez le projet depuis votre compte', 'rouvrez le projet depuis le dossier synchronisé'],
  ['sur mon compte', 'dans le dossier synchronisé'],
  ['sur votre compte', 'dans le dossier synchronisé'],
  ['Sur mon compte', 'Dans le dossier synchronisé'],
  ['Sur votre compte', 'Dans le dossier synchronisé'],
];
for (const [from, to] of swaps) {
  const before = html;
  html = typeof from === 'string' ? html.split(from).join(to) : html.replace(from, to);
  if (html === before) console.warn(`prepare: nothing replaced for ${from}`);
}
// The bridge must run before the app's own scripts.
html = html.replace(/<head>/i, '<head><script src="desktop/models.js"></script><script src="desktop/desktop.js"></script>');
writeFileSync(file, html);
console.log('dist/ ready');
