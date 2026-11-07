// Parité : les mêmes requêtes (dont des requêtes bizarres) envoyées au serveur JavaScript d'origine et au serveur Rust ;
// statuts et corps JSON doivent être identiques (jetons, identifiants et heures mis de côté).
// Le serveur JavaScript n'existe plus que dans l'historique git :
//   (dans server/, après worker-build --release ; Miniflare veut les deux fichiers sous le même dossier)
//   git show cc551c3:server/src/index.js > build/ancien.js && node parite.mjs $PWD/build/ancien.js $PWD/build/index.js
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const [jsPath, rsPath] = process.argv.slice(2);
const mk = async p => {
  const mf = new Miniflare({ modules: true, scriptPath: p, modulesRules: [{ type: 'CompiledWasm', include: ['**/*.wasm'] }], compatibilityDate: '2026-07-30',
    d1Databases: ['DB'], r2Buckets: ['TRANSIT'], durableObjects: { LIVE: { className: 'Live', useSQLite: true } }, bindings: { TRANSIT_LIMIT: '5000', TRANSIT_HOURS: '24', EVENTS_DAYS: '30' } });
  const db = await mf.getD1Database('DB');
  for (const s of readFileSync(dir + 'schema.sql', 'utf8').replace(/--.*\n/g, '').split(';').map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean)) await db.exec(s);
  return mf;
};
const A = await mk(jsPath), B = await mk(rsPath);
// valeurs aléatoires remplacées par leur rôle, pour comparer
const names = [new Map(), new Map()];
const norm = (v, side) => {
  if (Array.isArray(v)) return v.map(x => norm(x, side));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ['created', 'last', 'until'].includes(k) ? typeof x : norm(x, side)]));
  if (typeof v === 'string' && /^[0-9a-f]{16}$|^[0-9a-f]{64}$/.test(v)) { const m = names[side]; if (!m.has(v)) m.set(v, '#' + m.size); return m.get(v); }
  return v;
};
let fails = 0, n = 0;
const tok = [{}, {}];
const call = async (mf, side, path, { method = 'GET', who, json, body, headers = {} } = {}) => {
  const h = { ...headers }; if (who) h.authorization = 'Bearer ' + tok[side][who]; if (json !== undefined) h['content-type'] = 'application/json';
  const r = await mf.dispatchFetch('http://localhost' + path, { method, headers: h, body: json !== undefined ? (typeof json === 'string' ? json : JSON.stringify(json)) : body });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d, ct: r.headers.get('content-type'), csp: r.headers.get('content-security-policy') };
};
const both = async (label, path, o = {}, keep) => {
  const [a, b] = [await call(A, 0, path, o), await call(B, 1, path, o)];
  if (keep) { if (a.data?.token) tok[0][keep] = a.data.token; if (b.data?.token) tok[1][keep] = b.data.token; }
  const x = JSON.stringify([a.status, norm(a.data, 0), a.ct, a.csp]), y = JSON.stringify([b.status, norm(b.data, 1), b.ct, b.csp]);
  n++; if (x !== y) { fails++; console.log('✗ ' + label + '\n   JS   ' + x + '\n   Rust ' + y); }
  return [a, b];
};
const P = { method: 'POST' };
const ip = i => ({ 'cf-connecting-ip': '10.0.0.' + i });
await both('santé', '/v1'); await both('santé racine POST', '/', P); await both('OPTIONS', '/v1/zzz', { method: 'OPTIONS' });
await both('inconnue sans jeton', '/v1/zzz'); await both('signup en GET', '/v1/signup');
await both('signup JSON invalide', '/v1/signup', { ...P, json: '{oups' });
await both('signup corps null', '/v1/signup', { ...P, json: 'null' });
await both('signup corps tableau', '/v1/signup', { ...P, json: '[1]' });
await both('signup corps vide', '/v1/signup', { ...P, body: '' });
await both('signup adresse nombre', '/v1/signup', { ...P, json: { email: 12, password: 'motdepasse1' } });
await both('signup mot de passe court', '/v1/signup', { ...P, json: { email: 'a@b.cd', password: '1234567' } });
await both('signup mot de passe nombre', '/v1/signup', { ...P, json: { email: 'a@b.cd', password: 123456789 }, headers: ip(1) });
await both('signup ok', '/v1/signup', { ...P, json: { email: ' Draco@Example.COM ', password: 'motdepasse1', device: { name: ' Mac <"x"> ', platform: 'mac', id: 'zz' } }, headers: ip(2) }, 'mac');
await both('signup existe', '/v1/signup', { ...P, json: { email: 'draco@example.com', password: 'motdepasse1' }, headers: ip(2) });
await both('signup device chaîne', '/v1/signup', { ...P, json: { email: 'b@b.cd', password: 'motdepasse1', device: 'texte' }, headers: ip(3) }, 'b');
await both('signup device null', '/v1/signup', { ...P, json: { email: 'c@b.cd', password: 'motdepasse1', device: null }, headers: ip(4) }, 'c');
for (let i = 0; i < 6; i++) await both('signup limite IP ' + i, '/v1/signup', { ...P, json: { email: `l${i}@b.cd`, password: 'motdepasse1' }, headers: ip(9) });
await both('login mauvais', '/v1/login', { ...P, json: { email: 'draco@example.com', password: 'faux' } });
await both('login long', '/v1/login', { ...P, json: { email: 'draco@example.com', password: 'x'.repeat(201) } });
await both('login inconnu', '/v1/login', { ...P, json: { email: 'zz@b.cd', password: 'motdepasse1' } });
await both('login ok', '/v1/login', { ...P, json: { email: 'DRACO@example.com', password: 'motdepasse1', device: { name: 'Tour', platform: 'windows' } } }, 'tour');
await both('me', '/v1/me', { who: 'mac' });
await both('me token query', '/v1/me?token=' + 'x');
await both('jeton trop long', '/v1/me', { headers: { authorization: 'Bearer ' + 'a'.repeat(129) } });
await both('me patch nom', '/v1/me', { method: 'PATCH', who: 'mac', json: { name: '  Draconix <b>\u0001 ' } });
await both('me patch nom nombre', '/v1/me', { method: 'PATCH', who: 'b', json: { name: 42 } });
await both('me patch nom vide', '/v1/me', { method: 'PATCH', who: 'c', json: { name: '   ' } });
await both('me patch vide', '/v1/me', { method: 'PATCH', who: 'mac', json: {} });
await both('me patch null', '/v1/me', { method: 'PATCH', who: 'mac', json: 'null' });
await both('me patch nombre', '/v1/me', { method: 'PATCH', who: 'mac', json: '5' });
await both('me patch tableau', '/v1/me', { method: 'PATCH', who: 'mac', json: '[]' });
await both('me patch avatar svg', '/v1/me', { method: 'PATCH', who: 'mac', json: { avatar: 'data:image/svg+xml;base64,AAAA' } });
await both('me patch avatar nombre', '/v1/me', { method: 'PATCH', who: 'mac', json: { avatar: 5 } });
await both('me patch avatar ok', '/v1/me', { method: 'PATCH', who: 'mac', json: { avatar: 'data:image/png;base64,AAAA==' } });
await both('me après', '/v1/me', { who: 'tour' });
await both('usage', '/v1/usage', { who: 'mac' });
await both('blob nom cassé', '/v1/blobs/%E0%A4%A', { method: 'PUT', who: 'mac', body: 'x' });
await both('blob slash', '/v1/blobs/a%2Fb', { who: 'mac' });
await both('blob ..', '/v1/blobs/..', { who: 'mac' });
await both('blob DELETE', '/v1/blobs/abc', { method: 'DELETE', who: 'mac' });
await both('blob absent', '/v1/blobs/abc', { who: 'mac' });
await both('blob html', '/v1/blobs/t1', { method: 'PUT', who: 'mac', body: new Uint8Array(100), headers: { 'content-type': 'text/html', 'content-length': '100' } });
await both('blob html lu', '/v1/blobs/t1', { who: 'mac' });
await both('blob déjà', '/v1/blobs/t1', { method: 'PUT', who: 'mac', body: new Uint8Array(100), headers: { 'content-length': '100' } });
await both('blob jpeg', '/v1/blobs/t2', { method: 'PUT', who: 'mac', body: new Uint8Array(10), headers: { 'content-type': 'Image/JPEG; q=1', 'content-length': '10' } });
await both('blob jpeg lu', '/v1/blobs/t2', { who: 'tour' });
await both('blob plein', '/v1/blobs/t3', { method: 'PUT', who: 'mac', body: new Uint8Array(4950), headers: { 'content-length': '4950' } });
await both('blob utilisateur plein', '/v1/blobs/t3', { method: 'PUT', who: 'mac', body: new Uint8Array(3000), headers: { 'content-length': '3000' } });
await both('events kind', '/v1/events', { ...P, who: 'mac', json: { kind: 'rename', pid: 'p1' } });
await both('events pid *', '/v1/events', { ...P, who: 'mac', json: { kind: 'delete', pid: '*' } });
await both('events null', '/v1/events', { ...P, who: 'mac', json: 'null' });
await both('events tableau', '/v1/events', { ...P, who: 'mac', json: '[]' });
await both('events put', '/v1/events', { ...P, who: 'mac', json: { kind: 'put', pid: 'p1', body: { name: 'lac.jpg', n: [1, 2.5, { a: null }], s: 'é"\\' }, blobs: ['t1', 't2', 5, 'a/b', '..'] } });
await both('events clés en double', '/v1/events', { ...P, who: 'mac', json: '{"kind":"put","pid":"p2","body":{"v":1},"body":{"v":2}}' });
await both('events espaces', '/v1/events', { ...P, who: 'mac', json: '{ "kind" : "put" , "pid" : "p3" , "body" : { "a" : [ 1 , 2 ] , "b" : "x y" } }' });
await both('events body null', '/v1/events', { ...P, who: 'mac', json: { kind: 'want', pid: '*', body: null } });
await both('events kind nombre', '/v1/events', { ...P, who: 'mac', json: { kind: 0, pid: 'p1' } });
await both('liste after=abc', '/v1/events?after=abc', { who: 'tour' });
await both('liste after=-5', '/v1/events?after=-5', { who: 'tour' });
await both('liste after=1.5', '/v1/events?after=1.5', { who: 'tour' });
await both('ack chaîne', '/v1/ack', { ...P, who: 'tour', json: { seq: '2' } });
await both('ack vrai', '/v1/ack', { ...P, who: 'tour', json: { seq: true } });
await both('ack null', '/v1/ack', { ...P, who: 'tour', json: 'null' });
await both('shares vide', '/v1/shares', { who: 'mac' });
await both('share pid invalide', '/v1/shares', { ...P, who: 'mac', json: { pid: 'a/b', email: 'b@b.cd' } });
await both('share photo inconnue', '/v1/shares', { ...P, who: 'mac', json: { pid: 'pX', email: 'b@b.cd' } });
await both('share sans compte', '/v1/shares', { ...P, who: 'mac', json: { pid: 'p1', email: 'zz@b.cd' } });
await both('share soi', '/v1/shares', { ...P, who: 'mac', json: { pid: 'p1', email: 'draco@example.com' } });
await both('share ok', '/v1/shares', { ...P, who: 'mac', json: { pid: 'p1', email: 'B@b.cd' } });
await both('share invité invite', '/v1/shares', { ...P, who: 'b', json: { pid: 'p1', email: 'c@b.cd' } });
await both('shares liste', '/v1/shares', { who: 'b' });
await both('lock b', '/v1/locks/p1', { ...P, who: 'b' });
await both('lock mac refusé', '/v1/locks/p1', { ...P, who: 'mac' });
await both('put pendant le tour', '/v1/events', { ...P, who: 'mac', json: { kind: 'put', pid: 'p1', body: { v: 3 } } });
await both('lock PUT', '/v1/locks/p1', { method: 'PUT', who: 'b' });
await both('lock non partagé', '/v1/locks/p9', { ...P, who: 'b' });
await both('shares liste verrou', '/v1/shares', { who: 'mac' });
await both('blob from', '/v1/blobs/t1?from=' + 'x', { who: 'b' });
await both('liste b', '/v1/events?after=0', { who: 'b' });
await both('lock rendu', '/v1/locks/p1', { method: 'DELETE', who: 'b' });
await both('delete invité', '/v1/events', { ...P, who: 'b', json: { kind: 'delete', pid: 'p1' } });
await both('shares après départ', '/v1/shares', { who: 'mac' });
await both('share retrait inconnu', '/v1/shares/p1/zz', { method: 'DELETE', who: 'c' });
await both('device inconnu', '/v1/devices/zz', { method: 'DELETE', who: 'mac' });
await both('live sans upgrade', '/v1/live', { who: 'mac' });
await both('logout', '/v1/logout', { ...P, who: 'c' });
await both('après logout', '/v1/me', { who: 'c' });
await both('route inconnue', '/v1/zzz', { who: 'mac' });
console.log(`${n} requêtes comparées, ${fails ? fails + ' différence(s)' : 'aucune différence'}`);
await A.dispose(); await B.dispose(); process.exit(fails ? 1 : 0);
