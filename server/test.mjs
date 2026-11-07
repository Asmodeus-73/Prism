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
// dernière activité : pas réécrite à chaque requête, seulement après une minute
await db.prepare('UPDATE devices SET last = ? WHERE id = ?').bind(Date.now() - 30e3, mac.data.device).run();
await call('/v1/me', { token: T1 });
const l30 = (await db.prepare('SELECT last FROM devices WHERE id = ?').bind(mac.data.device).first()).last;
ok(Date.now() - l30 >= 29e3, 'dernière activité de moins d’une minute : pas réécrite');
await db.prepare('UPDATE devices SET last = ? WHERE id = ?').bind(Date.now() - 61e3, mac.data.device).run();
await call('/v1/me', { token: T1 });
const l61 = (await db.prepare('SELECT last FROM devices WHERE id = ?').bind(mac.data.device).first()).last;
ok(Date.now() - l61 < 5e3, 'dernière activité de plus d’une minute : mise à jour');
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
// travail à plusieurs : Draconix partage une photo avec Marie, chacun son tour
await db.exec('DELETE FROM attempts');
const marie = await call('/v1/signup', { method: 'POST', json: { email: 'marie@example.com', password: 'motdepasse3', device: { name: 'Portable' } }, headers: { 'cf-connecting-ip': '10.9.0.1' } });
const TM = marie.data.token;
await call('/v1/blobs/t_sh', { method: 'PUT', token: T1, body: new Uint8Array(100), headers: { 'content-length': '100' } });
const pe = await call('/v1/events', { method: 'POST', token: T1, json: { kind: 'put', pid: 'p_sh', body: { name: 'mariage.jpg' }, blobs: ['t_sh'] } });
ok((await call('/v1/shares', { method: 'POST', token: TM, json: { pid: 'p_sh', email: 'draco@example.com' } })).status === 404, 'impossible de partager la photo de quelqu’un d’autre');
ok((await call('/v1/shares', { method: 'POST', token: T1, json: { pid: 'p_sh', email: 'personne@example.com' } })).status === 404, 'adresse sans compte : refusé');
ok((await call('/v1/shares', { method: 'POST', token: T1, json: { pid: 'p_sh', email: 'marie@example.com' } })).status === 201, 'photo partagée avec Marie');
const sh = await call('/v1/shares', { token: TM }); ok(sh.data.shares.length === 1 && sh.data.shares[0].members.length === 2 && sh.data.shares[0].role === 'edit', 'Marie voit le partage et ses membres');
const want = (await call('/v1/events?after=' + pe.data.seq, { token: T1 })).data.events.find(e => e.kind === 'want' && e.pid === 'p_sh');
ok(!!want, 'les appareils de Draconix sont priés de renvoyer la photo');
const pe2 = await call('/v1/events', { method: 'POST', token: T1, json: { kind: 'put', pid: 'p_sh', body: { name: 'mariage.jpg', v: 2 }, blobs: ['t_sh'] } });
const me1 = (await call('/v1/events?after=0', { token: TM })).data.events.find(e => e.pid === 'p_sh' && e.kind === 'put');
ok(me1 && me1.origin === mac.data.user && me1.body.v === 2, 'la photo arrive chez Marie');
ok((await call('/v1/blobs/t_sh?from=' + me1.origin, { token: TM })).status === 200, 'Marie télécharge ses fichiers');
ok((await call('/v1/blobs/t_sh?from=' + me1.origin, { token: other.data.token })).status === 404, 'un compte hors du partage ne peut pas');
// chacun son tour
ok((await call('/v1/locks/p_sh', { method: 'POST', token: TM })).status === 200, 'Marie prend la main');
const busyLk = await call('/v1/locks/p_sh', { method: 'POST', token: T1 }); ok(busyLk.status === 409 && /marie/.test(busyLk.data.holder.name), 'Draconix voit que Marie retouche');
ok((await call('/v1/events', { method: 'POST', token: T1, json: { kind: 'put', pid: 'p_sh', body: { v: 3 } } })).status === 423, 'son enregistrement attend son tour');
await call('/v1/blobs/t_m', { method: 'PUT', token: TM, body: new Uint8Array(50), headers: { 'content-length': '50' } });
ok((await call('/v1/events', { method: 'POST', token: TM, json: { kind: 'put', pid: 'p_sh', body: { v: 4 }, blobs: ['t_m'] } })).status === 201, 'Marie enregistre');
const back = (await call('/v1/events?after=' + pe2.data.seq, { token: T1 })).data.events.find(e => e.kind === 'put' && e.pid === 'p_sh');
ok(back && back.body.v === 4 && back.origin === marie.data.user, 'la retouche de Marie arrive chez Draconix');
ok((await call('/v1/locks/p_sh', { method: 'DELETE', token: TM })).status === 200 && (await call('/v1/locks/p_sh', { method: 'POST', token: T1 })).status === 200, 'Marie rend la main, Draconix la prend');
// transit vidé quand tous les appareils des deux comptes ont reçu
const maxS = Math.max(...(await call('/v1/events?after=0', { token: TM })).data.events.map(e => e.seq));
await call('/v1/ack', { method: 'POST', token: TM, json: { seq: maxS } });
for (const t of [T1, T2]) await call('/v1/ack', { method: 'POST', token: t, json: { seq: 1e9 } });
await new Promise(r => setTimeout(r, 300));
ok((await call('/v1/usage', { token: T1 })).data.used === 0, 'transit vidé une fois reçu par les deux comptes');
// Marie quitte, la propriétaire arrête le partage
ok((await call('/v1/shares/p_sh/' + marie.data.user, { method: 'DELETE', token: other.data.token })).status === 404, 'un inconnu ne peut pas retirer Marie');
ok((await call('/v1/shares/p_sh/' + marie.data.user, { method: 'DELETE', token: T1 })).status === 200 && (await call('/v1/shares', { token: TM })).data.shares.length === 0, 'Draconix retire Marie');
// ---- profil : nom et photo ----
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==';
ok((await call('/v1/me', { method: 'PATCH', token: T1, json: { name: 'Draconix <b>', avatar: PX } })).status === 200, 'profil : nom et photo enregistrés');
const prof = await call('/v1/me', { token: T2 }); ok(prof.data.name === 'Draconix b' && prof.data.avatar === PX, 'profil vu depuis l’autre appareil, balises retirées');
ok((await call('/v1/me', { method: 'PATCH', token: T1, json: { avatar: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } })).status === 400, 'photo SVG refusée');
ok((await call('/v1/me', { method: 'PATCH', token: T1, json: { avatar: 'data:image/png;base64,' + 'A'.repeat(290000) } })).status >= 400, 'photo trop lourde refusée');
ok((await call('/v1/me', { method: 'PATCH', json: { name: 'x' } })).status === 401, 'profil : il faut être connecté');
ok((await call('/v1/me', { method: 'PATCH', token: T1, json: { avatar: null } })).status === 200 && (await call('/v1/me', { token: T1 })).data.avatar === null, 'photo retirée');
await mf.dispose();
console.log(fails ? fails + ' échec(s)' : 'tout est bon'); process.exit(fails ? 1 : 0);
