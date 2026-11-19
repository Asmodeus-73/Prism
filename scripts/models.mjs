// AI model files of the web version (web/ai/<model>/*.wasm) are not kept in git:
// web/ai/models.json lists each one with its SHA-256, and the files themselves are in the
// GitHub release "modeles", each named by its SHA-256 (the desktop app fetches them there too).
// Usage:
//   node scripts/models.mjs            download the missing or changed files into web/ai (checked by hash)
//   node scripts/models.mjs --update   rewrite web/ai/models.json from the files in web/ai, and list
//                                      the ones the release does not have yet (to upload there under their hash)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ai = join(root, 'web', 'ai');
const list = join(ai, 'models.json');
const RELEASE = process.env.PRISM_MODELS_RELEASE || 'https://github.com/Asmodeus-73/Prism/releases/download/modeles/';
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

if (process.argv.includes('--update')) {
  const models = {};
  for (const d of readdirSync(ai).sort()) {
    const full = join(ai, d);
    if (!statSync(full).isDirectory()) continue;
    for (const f of readdirSync(full).sort()) if (f.endsWith('.wasm')) models[`ai/${d}/${f}`] = sha(readFileSync(join(full, f)));
  }
  writeFileSync(list, JSON.stringify(models, null, 1) + '\n');
  const missing = [];
  for (const [p, h] of Object.entries(models)) {
    const r = await fetch(RELEASE + h, { method: 'HEAD', redirect: 'manual' });
    if (r.status >= 400) missing.push(`${h}  web/${p}`);
  }
  console.log(`${Object.keys(models).length} fichiers listés dans web/ai/models.json`);
  if (missing.length) console.log('À ajouter à la release « modeles » sous ce nom :\n' + missing.join('\n'));
  process.exit(0);
}

const models = JSON.parse(readFileSync(list, 'utf8'));
const todo = Object.entries(models).filter(([p, h]) => {
  const f = join(root, 'web', p);
  return !existsSync(f) || sha(readFileSync(f)) !== h;
});
let done = 0;
async function get([p, h]) {
  const f = join(root, 'web', p);
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(RELEASE + h);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (sha(buf) !== h) throw new Error('empreinte inattendue');
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f + '.part', buf);
      renameSync(f + '.part', f);
      console.log(`${++done}/${todo.length} web/${p}`);
      return;
    } catch (e) {
      if (attempt >= 4) throw new Error(`web/${p} : ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}
const queue = [...todo];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await get(queue.shift()); }));
console.log(todo.length ? `${todo.length} modèle(s) téléchargé(s)` : 'Modèles à jour');
