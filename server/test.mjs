// Tests du serveur de synchronisation, en local avec Miniflare (D1, R2 et Durable Objects simulés).
// node server/test.mjs   (Miniflare : npm i -D miniflare@4 dans server/)
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const mf = new Miniflare({ modules: true, scriptPath: dir + 'src/index.js', compatibilityDate: '2026-07-30',
  d1Databases: ['DB'], r2Buckets: ['TRANSIT'], durableObjects: { LIVE: { className: 'Live', useSQLite: true } },
  bindings: { TRANSIT_LIMIT: '5000', TRANSIT_HOURS: '24', EVENTS_DAYS: '30' } });
const db = await mf.getD1Database('DB');
for (const s of readFileSync(dir + 'schema.sql', 'utf8').split(';').map(x => x.trim()).filter(x => x && !x.startsWith('--') || x.includes('CREATE'))) await db.exec(s.replace(/--.*\n/g, '').replace(/\s+/g, ' '));
const B = 'http://localhost';
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const call = async (path, { method = 'GET', token, json, body, headers = {} } = {}) => {
  const h = { ...headers }; if (token) h.authorization = 'Bearer ' + token; if (json) h['content-type'] = 'application/json';
  const r = await mf.dispatchFetch(B + path, { method, headers: h, body: json ? JSON.stringify(json) : body });
  const t = r.headers.get('content-type') || ''; return { status: r.status, data: t.includes('json') ? await r.json() : await r.text() };
};
const mac = await call('/v1/signup', { method: 'POST', json: { email: 'Draco@Example.com', password: 'motdepasse1', device: { name: 'Mac', platform: 'mac' } } });
ok(mac.status === 201 && mac.data.token, 'inscription');
ok((await call('/v1/signup', { method: 'POST', json: { email: 'draco@example.com', password: 'motdepasse1' } })).status === 409, 'adresse déjà prise');
ok((await call('/v1/login', { method: 'POST', json: { email: 'draco@example.com', password: 'mauvais' } })).status === 401, 'mauvais mot de passe refusé');
const win = await call('/v1/login', { method: 'POST', json: { email: 'draco@example.com', password: 'motdepasse1', device: { name: 'Tour', platform: 'windows' } } });
ok(win.status === 200 && win.data.device !== mac.data.device, 'connexion d’un second appareil');
const T1 = mac.data.token, T2 = win.data.token;
ok((await call('/v1/me', { token: 'faux' })).status === 401, 'jeton inconnu refusé');
const me = await call('/v1/me', { token: T1 }); ok(me.data.devices.length === 2, 'deux appareils sur le compte');
// le Mac envoie une photo
ok((await call('/v1/blobs/tile1', { method: 'PUT', token: T1, body: new Uint8Array(1000), headers: { 'content-length': '1000' } })).status === 201, 'fichier déposé en transit');
ok((await call('/v1/blobs/tile2', { method: 'PUT', token: T1, body: new Uint8Array(4500), headers: { 'content-length': '4500' } })).status === 507, 'transit plein : 507, l’appareil attendra');
const ev = await call('/v1/events', { method: 'POST', token: T1, json: { kind: 'put', pid: 'p1', body: { name: 'lac.jpg' }, blobs: ['tile1'] } });
ok(ev.status === 201 && ev.data.seq > 0, 'évènement « projet modifié »');
// la tour récupère
const list = await call('/v1/events?after=0', { token: T2 });
ok(list.data.events.length === 1 && list.data.events[0].pid === 'p1' && list.data.events[0].body.name === 'lac.jpg', 'la tour voit le changement');
const got = await call('/v1/blobs/tile1', { token: T2 }); ok(got.status === 200 && got.data.length === 1000, 'la tour télécharge le fichier');
ok((await call('/v1/blobs/tile1', { token: 'x' })).status === 401, 'sans compte, pas de fichier');
// tant que le Mac n'a pas confirmé son propre évènement, le fichier reste ; ensuite il disparaît
await call('/v1/ack', { method: 'POST', token: T2, json: { seq: ev.data.seq } }); await new Promise(r => setTimeout(r, 100));
ok((await call('/v1/blobs/tile1', { token: T2 })).status === 200, 'gardé tant qu’un appareil ne l’a pas reçu');
await call('/v1/ack', { method: 'POST', token: T1, json: { seq: ev.data.seq } }); await new Promise(r => setTimeout(r, 100));
ok((await call('/v1/blobs/tile1', { token: T2 })).status === 404, 'effacé quand tous l’ont reçu');
ok((await call('/v1/usage', { token: T1 })).data.used === 0, 'transit vide');
// suppression synchronisée
const del = await call('/v1/events', { method: 'POST', token: T1, json: { kind: 'delete', pid: 'p1' } });
const l2 = await call('/v1/events?after=' + ev.data.seq, { token: T2 }); ok(l2.data.events[0]?.kind === 'delete', 'la suppression arrive sur la tour');
// « Synchroniser maintenant »
ok((await call('/v1/events', { method: 'POST', token: T2, json: { kind: 'want', pid: '*' } })).status === 201, 'demande de resynchronisation');
// un autre compte ne voit rien
const other = await call('/v1/signup', { method: 'POST', json: { email: 'autre@example.com', password: 'motdepasse2' } });
ok((await call('/v1/events?after=0', { token: other.data.token })).data.events.length === 0, 'un autre compte ne voit rien');
// ménage des 24 h
await call('/v1/blobs/old', { method: 'PUT', token: T1, body: new Uint8Array(10), headers: { 'content-length': '10' } });
await db.prepare('UPDATE transit SET created = 0 WHERE key = ?').bind('old').run();
const w = await mf.getWorker(); await w.scheduled({ cron: '17 * * * *' }); await new Promise(r => setTimeout(r, 200));
ok((await call('/v1/blobs/old', { token: T1 })).status === 404, 'transit de plus de 24 h effacé');
// trop d'essais
for (let i = 0; i < 10; i++) await call('/v1/login', { method: 'POST', json: { email: 'autre@example.com', password: 'x' } });
ok((await call('/v1/login', { method: 'POST', json: { email: 'autre@example.com', password: 'motdepasse2' } })).status === 429, 'trop d’essais : bloqué un quart d’heure');
// présence et relais WebRTC
const ws1 = (await mf.dispatchFetch(B + '/v1/live?token=' + T1, { headers: { upgrade: 'websocket' } })).webSocket;
const ws2 = (await mf.dispatchFetch(B + '/v1/live?token=' + T2, { headers: { upgrade: 'websocket' } })).webSocket;
const got1 = [], got2 = []; ws1.accept(); ws2.accept(); ws1.addEventListener('message', e => got1.push(JSON.parse(e.data))); ws2.addEventListener('message', e => got2.push(JSON.parse(e.data)));
await new Promise(r => setTimeout(r, 200));
ws1.send(JSON.stringify({ type: 'signal', to: win.data.device, data: { sdp: 'offre' } })); await new Promise(r => setTimeout(r, 200));
ok(got2.some(m => m.type === 'signal' && m.from === mac.data.device && m.data.sdp === 'offre'), 'message WebRTC relayé à la tour');
await call('/v1/events', { method: 'POST', token: T2, json: { kind: 'put', pid: 'p2' } }); await new Promise(r => setTimeout(r, 300));
ok(got1.some(m => m.type === 'event'), 'le Mac est prévenu en direct d’un changement');
ws1.close(); ws2.close();
await mf.dispose();
console.log(fails ? fails + ' échec(s)' : 'tout est bon'); process.exit(fails ? 1 : 0);
