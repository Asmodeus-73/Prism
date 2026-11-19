// Builds dist/ for Tauri: the web version from web/ (kept identical to the
// published artifact) plus the desktop additions from desktop/.
import { cpSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
// web/index.html, app.js and sw.js are built from web-src/ (not kept in git)
if (spawnSync(process.execPath, [join(root, 'web-src', 'build.mjs')], { stdio: 'inherit' }).status !== 0) process.exit(1);
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
cpSync(join(root, 'web'), dist, { recursive: true });
cpSync(join(root, 'desktop'), join(dist, 'desktop'), { recursive: true });

// AI model files (about 460 MB) stay out of the app: it fetches each one the first
// time it is needed (src-tauri/src/models.rs), checked against the hash listed here.
const models = JSON.parse(readFileSync(join(root, 'web', 'ai', 'models.json'), 'utf8'));
for (const rel of Object.keys(models)) if (existsSync(join(dist, rel))) rmSync(join(dist, rel));
// Files that exist only in the GitHub release "modeles" (generative fill, src-tauri/src/sd.rs): path -> sha256
Object.assign(models, JSON.parse(readFileSync(join(root, 'desktop', 'models-extra.json'), 'utf8')).models);
writeFileSync(join(dist, 'desktop', 'models.js'), `window.PRISM_MODELS=${JSON.stringify(models)};\n`);
writeFileSync(join(dist, 'models.json'), JSON.stringify(models, null, 1) + '\n');

// The page (index.html) and its script (app.js): each swap applies to both.
const file = join(dist, 'index.html'), jsFile = join(dist, 'app.js');
let html = readFileSync(file, 'utf8'), js = readFileSync(jsFile, 'utf8');
const swaps = [
  // (web/index.html and web/app.js are minified: their script strings use double quotes)
  // Synced files are served by the app instead of claude.ai.
  ['"/_blob/"', 'PRISM_BLOB'],
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
const swap = (text, from, to) => typeof from === 'string' ? text.split(from).join(to) : text.replace(from, to);
for (const [from, to] of swaps) {
  const before = html + js;
  html = swap(html, from, to);
  js = swap(js, from, to);
  if (html + js === before) console.warn(`prepare: nothing replaced for ${from}`);
}
// The bridge must run before the app's own scripts.
html = html.replace(/<head>/i, '<head><script src="desktop/models.js"></script><script src="desktop/desktop.js"></script>');
writeFileSync(file, html);
writeFileSync(jsFile, js);
console.log('dist/ ready');
