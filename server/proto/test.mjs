// Prototype Rust : vérifie chaque brique dans Miniflare et mesure, en comparant à la même chose écrite en JavaScript.
// cd server/proto && worker-build --release && node test.mjs
import { createRequire } from 'node:module';
import { pbkdf2Sync, createHash } from 'node:crypto';
const here = new URL('.', import.meta.url).pathname;
const { Miniflare } = createRequire(here + '../package.json')('miniflare');

const rust = new Miniflare({
  modules: true, scriptPath: here + 'build/index.js', compatibilityDate: '2026-07-30',
  modulesRules: [{ type: 'CompiledWasm', include: ['**/*.wasm'] }],
  d1Databases: ['DB'], r2Buckets: ['TRANSIT'], durableObjects: { LIVE: { className: 'Live', useSQLite: true } },
});
// la même chose en JavaScript, pour comparer les temps
const js = new Miniflare({
  modules: true, compatibilityDate: '2026-07-30', script: `
  const enc = new TextEncoder(), hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  export default { async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === '/p/pbkdf2') { const pw = await req.text(), salt = 'a'.repeat(32);
      const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256);
      return new Response(salt + '$' + hex(bits)); }
    if (p === '/p/json') { const b = JSON.parse(await req.text()); return new Response(JSON.stringify(b.body)); }
    return new Response('?', { status: 404 });
  } };` });

let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const B = 'http://localhost';
const call = (mf, path, init) => mf.dispatchFetch(B + path, init);
const ms = async (fn, n) => { await fn(); const t = performance.now(); for (let i = 0; i < n; i++) await fn(); return (performance.now() - t) / n; };

// 1. démarrage
ok((await (await call(rust, '/v1')).json()).service === 'prism-sync', 'le Worker Rust démarre dans Miniflare');

// 2. empreintes identiques au JavaScript (et à Node)
const h = await (await call(rust, '/p/pbkdf2', { method: 'POST', body: 'motdepasse1' })).text();
const ref = 'a'.repeat(32) + '$' + pbkdf2Sync('motdepasse1', 'a'.repeat(32), 100000, 32, 'sha256').toString('hex');
ok(h === ref, 'PBKDF2 via WebCrypto : même empreinte que le serveur JavaScript');
ok((await (await call(rust, '/p/sha', { method: 'POST', body: 'jeton' })).text()) === createHash('sha256').update('jeton').digest('hex'), 'SHA-256 via WebCrypto');

// 3. D1 : batch, RETURNING, tâche de fond
const d = await (await call(rust, '/p/d1', { method: 'POST' })).json();
ok(d.seq === 3 && d.count === 3, 'D1 : batch, INSERT … RETURNING seq, first(colonne)');
await new Promise(r => setTimeout(r, 200));
const db = await rust.getD1Database('DB');
ok((await db.prepare("SELECT COUNT(*) AS n FROM t WHERE v = 'fond'").first()).n === 1, 'wait_until : la tâche de fond a tourné après la réponse');

// 4. R2 : flux à taille fixe, natif et via le WASM
for (const mode of ['natif', 'wasm']) {
  const q = mode === 'wasm' ? '?mode=wasm' : '';
  ok((await call(rust, '/p/blob/a' + mode + q, { method: 'PUT', body: new Uint8Array(1000), headers: { 'content-length': '1000' } })).status === 200, `R2 (${mode}) : fichier de la bonne taille accepté`);
  const short = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(10)); c.close(); } });
  const r = await call(rust, '/p/blob/b' + mode + q, { method: 'PUT', body: short, headers: { 'content-length': '1000' }, duplex: 'half' }).catch(e => ({ status: 'coupé' }));
  const bucket = await rust.getR2Bucket('TRANSIT');
  ok(r.status !== 200 && !(await bucket.head('b' + mode)), `R2 (${mode}) : corps trop court refusé, rien ne reste (${r.status})`);
}

// 5. Durable Object : hibernation, attachements, remplacement, notify, signal, ping
const open = async dev => { const ws = (await call(rust, '/p/live?device=' + dev, { headers: { upgrade: 'websocket' } })).webSocket; const got = []; ws.accept(); ws.addEventListener('message', e => got.push(JSON.parse(e.data))); ws.addEventListener('close', e => got.push({ closed: e.code })); return { ws, got }; };
const mac = await open('mac'), tour = await open('tour');
await new Promise(r => setTimeout(r, 200));
ok(mac.got.some(m => m.type === 'peers' && m.devices.length === 2), 'Durable Object : présence des deux appareils (attachements)');
mac.ws.send(JSON.stringify({ type: 'signal', to: 'tour', data: { sdp: 'offre' } }));
mac.ws.send(JSON.stringify({ type: 'ping' }));
await call(rust, '/p/notify', { method: 'POST', body: JSON.stringify({ type: 'event', seq: 7 }) });
await new Promise(r => setTimeout(r, 300));
ok(tour.got.some(m => m.type === 'signal' && m.from === 'mac' && m.data.sdp === 'offre'), 'relais WebRTC vers le bon appareil');
ok(mac.got.some(m => m.type === 'pong'), 'ping → pong');
ok(tour.got.some(m => m.type === 'event' && m.seq === 7), 'notify diffusé aux sockets');
const mac2 = await open('mac'); await new Promise(r => setTimeout(r, 300));
ok(mac.got.some(m => m.closed === 4000), 'ancienne socket du même appareil fermée (4000)');
tour.ws.close(); await new Promise(r => setTimeout(r, 300));
ok(mac2.got.some(m => m.type === 'peers' && m.devices.length === 1 && m.devices[0].device === 'mac'), 'départ : liste mise à jour sans la tour');
mac2.ws.close();

// 6. cron
await (await rust.getWorker()).scheduled({ cron: '17 * * * *' });
ok((await db.prepare('SELECT COUNT(*) AS n FROM cron').first()).n === 1, 'déclencheur planifié');

// 7. mesures (temps par requête, aller-retour local compris : comparer Rust et JavaScript entre eux)
const big = JSON.stringify({ kind: 'put', pid: 'p', body: { layers: Array.from({ length: 20000 }, (_, i) => ({ id: 'l' + i, x: i * 1.5, name: 'calque ' + i, on: true, v: [1, 2, 3] })) } });
console.log(`\nMesures (moyenne, ms)   corps JSON de ${(big.length / 1048576).toFixed(1)} Mio`);
const row = async (label, path, body, n) => {
  const r = await ms(() => call(rust, path, { method: 'POST', body }).then(x => x.text()), n), j = await ms(() => call(js, path, { method: 'POST', body }).then(x => x.text()), n);
  console.log(`  ${label.padEnd(28)} Rust ${r.toFixed(1).padStart(6)}   JavaScript ${j.toFixed(1).padStart(6)}`);
};
await row('connexion (PBKDF2)', '/p/pbkdf2', 'motdepasse1', 10);
await row('JSON lu et réécrit', '/p/json', big, 10);
{ const r = await ms(() => call(rust, '/p/json2', { method: 'POST', body: big }).then(x => x.text()), 10); console.log(`  ${'JSON, body gardé tel quel'.padEnd(28)} Rust ${r.toFixed(1).padStart(6)}`);
  ok((await (await call(rust, '/p/json2', { method: 'POST', body: big })).text()) === (await (await call(js, '/p/json', { method: 'POST', body: big })).text()), 'body gardé tel quel : identique au JavaScript pour un JSON compact'); }
const same = (await (await call(rust, '/p/json', { method: 'POST', body: big })).text()) === (await (await call(js, '/p/json', { method: 'POST', body: big })).text());
ok(same, 'JSON réécrit à l’identique (ordre des clés, nombres)');
const blob = new Uint8Array(50 << 20);
for (const mode of ['natif', 'wasm']) {
  const t = await ms(() => call(rust, '/p/blob/big' + mode + (mode === 'wasm' ? '?mode=wasm' : ''), { method: 'PUT', body: blob, headers: { 'content-length': String(blob.length) } }).then(x => x.text()), 3);
  console.log(`  ${('dépôt R2 50 Mo (' + mode + ')').padEnd(28)} Rust ${t.toFixed(1).padStart(6)}`);
}

await rust.dispose(); await js.dispose();
console.log(fails ? fails + ' échec(s)' : 'tout est bon'); process.exit(fails ? 1 : 0);
