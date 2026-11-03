/* Prism : serveur de synchronisation.
   Cloudflare n'est qu'un intermédiaire :
   - D1 garde les comptes, les appareils et un journal d'évènements (« ce projet a changé », « ce projet a été supprimé ») ;
   - R2 garde les fichiers en transit : effacés dès que tous les appareils du compte les ont reçus, au plus tard après 24 h ;
   - un Durable Object par compte prévient les appareils connectés et relaie leurs messages WebRTC
     (quand deux appareils sont allumés, les fichiers passent directement de l'un à l'autre).
   Si le transit approche la limite (9,5 Go), l'envoi est refusé avec 507 et un délai : l'appareil le garde en file d'attente. */

const H = { 'content-type': 'application/json; charset=utf-8' };
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-max-age': '86400',
};
/* aucune réponse n'est une page : le navigateur ne doit ni deviner le type, ni exécuter quoi que ce soit */
const SAFE = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; sandbox", 'cache-control': 'no-store' };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...H, ...CORS, ...SAFE, ...extra } });
/* types rendus tels quels pour un fichier en transit ; tout le reste (HTML, SVG, scripts…) repart en binaire brut */
const BLOB_TYPES = /^(image\/(jpeg|png|webp|avif|gif|heic|heif|tiff|jxl|x-[a-z0-9.+-]+)|application\/(json|octet-stream)|video\/(mp4|quicktime))$/;
const fail = (status, code, msg, extra) => json({ error: code, message: msg, ...extra }, status);
const now = () => Date.now();
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rid = (n = 16) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const KEY_RE = /^[A-Za-z0-9_.-]{1,128}$/;
const PID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const MAX_BODY = 4 << 20;          // un manifeste de projet (JSON) : 4 Mo au plus
const MAX_BLOB = 500 << 20;        // un fichier : 500 Mo au plus

async function hashPw(pw, salt = rid(16)) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256);
  return salt + '$' + hex(bits);
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

async function body(req, max = MAX_BODY) {
  const len = +req.headers.get('content-length') || 0;
  if (len > max) throw Object.assign(new Error('trop gros'), { status: 413 });
  const t = await req.text();
  if (t.length > max) throw Object.assign(new Error('trop gros'), { status: 413 });
  try { return JSON.parse(t || '{}'); } catch { throw Object.assign(new Error('JSON invalide'), { status: 400 }); }
}

async function auth(env, req, url) {
  const h = req.headers.get('authorization') || '';
  // le jeton dans l'adresse n'est accepté que pour la WebSocket (un navigateur ne peut pas y mettre d'en-tête)
  const t = h.startsWith('Bearer ') ? h.slice(7) : url.pathname === '/v1/live' ? url.searchParams.get('token') : null;
  if (!t || t.length > 128) return null;
  const s = await env.DB.prepare('SELECT s.user, s.device, d.name FROM sessions s JOIN devices d ON d.id = s.device WHERE s.token = ?').bind(await sha(t)).first();
  if (!s) return null;
  await env.DB.prepare('UPDATE devices SET last = ? WHERE id = ?').bind(now(), s.device).run();
  return { user: s.user, device: s.device, name: s.name };
}

async function newSession(env, user, dev) {
  const name = String(dev?.name || 'Appareil').slice(0, 60), platform = String(dev?.platform || 'web').slice(0, 20);
  let device = dev?.id && PID_RE.test(dev.id) ? dev.id : null;
  if (device) {
    const d = await env.DB.prepare('SELECT user FROM devices WHERE id = ?').bind(device).first();
    if (!d || d.user !== user) device = null;
  }
  if (!device) {
    device = rid(8);
    // un nouvel appareil ne reçoit que ce qui arrive après lui (il demandera le reste avec « Synchroniser maintenant »)
    const top = await env.DB.prepare('SELECT COALESCE(MAX(seq),0) AS s FROM events WHERE user = ?').bind(user).first();
    await env.DB.prepare('INSERT INTO devices(id,user,name,platform,created,last,cursor) VALUES(?,?,?,?,?,?,?)').bind(device, user, name, platform, now(), now(), top.s).run();
  } else await env.DB.prepare('UPDATE devices SET name = ?, platform = ?, last = ? WHERE id = ?').bind(name, platform, now(), device).run();
  const token = rid(32);
  await env.DB.prepare('INSERT INTO sessions(token,user,device,created) VALUES(?,?,?,?)').bind(await sha(token), user, device, now()).run();
  return { token, user, device };
}

/* trop d'essais de mot de passe : 10 par quart d'heure et par adresse */
async function throttle(env, email, ok) {
  const a = await env.DB.prepare('SELECT n, since FROM attempts WHERE email = ?').bind(email).first();
  const t = now();
  if (ok) { if (a) await env.DB.prepare('DELETE FROM attempts WHERE email = ?').bind(email).run(); return true; }
  if (!a || t - a.since > 15 * 60e3) { await env.DB.prepare('INSERT OR REPLACE INTO attempts(email,n,since) VALUES(?,1,?)').bind(email, t).run(); return true; }
  await env.DB.prepare('UPDATE attempts SET n = n + 1 WHERE email = ?').bind(email).run();
  return a.n < 10;
}
async function blocked(env, email) {
  const a = await env.DB.prepare('SELECT n, since FROM attempts WHERE email = ?').bind(email).first();
  return a && now() - a.since <= 15 * 60e3 && a.n >= 10;
}
/* par adresse IP : 30 échecs de connexion par quart d'heure (essais sur plusieurs comptes), 5 créations de compte par heure */
const ipOf = req => (req.headers.get('cf-connecting-ip') || 'local').slice(0, 64);
async function ipCount(env, key, max, win, add) {
  const t = now(), a = await env.DB.prepare('SELECT n, since FROM attempts WHERE email = ?').bind(key).first();
  const fresh = !a || t - a.since > win;
  if (!add) return !fresh && a.n >= max;
  if (fresh) await env.DB.prepare('INSERT OR REPLACE INTO attempts(email,n,since) VALUES(?,1,?)').bind(key, t).run();
  else await env.DB.prepare('UPDATE attempts SET n = n + 1 WHERE email = ?').bind(key).run();
  return false;
}
let DUMMY;   // une empreinte factice : une adresse inconnue coûte autant de calcul qu'un mauvais mot de passe
const dummy = async () => DUMMY || (DUMMY = await hashPw('x'.repeat(12)));

const used = async (env, user) => (await (user ? env.DB.prepare('SELECT COALESCE(SUM(size),0) AS s FROM transit WHERE user = ?').bind(user) : env.DB.prepare('SELECT COALESCE(SUM(size),0) AS s FROM transit')).first()).s;
const limit = env => +(env.TRANSIT_LIMIT || 9.5e9);
const userLimit = env => +(env.USER_LIMIT || limit(env) * 0.6);   // un seul compte ne peut pas remplir tout le transit

/* efface les fichiers en transit que tous les appareils du compte ont reçus */
/* un fichier envoyé par un compte peut aussi être attendu par les comptes avec qui la photo est partagée (copies d'évènement, origin = ce compte) */
async function sweepUser(env, user) {
  const rows = (await env.DB.prepare('SELECT user, seq, blobs FROM events WHERE (user = ? AND origin IS NULL) OR origin = ?').bind(user, user).all()).results.filter(r => r.blobs !== '[]');
  const mins = new Map();
  for (const u of new Set(rows.map(r => r.user))) mins.set(u, (await env.DB.prepare('SELECT MIN(cursor) AS c FROM devices WHERE user = ?').bind(u).first())?.c ?? 0);
  const done = new Set(), need = new Set();
  for (const r of rows) for (const k of JSON.parse(r.blobs)) (r.seq <= mins.get(r.user) ? done : need).add(k);
  const gone = [...done].filter(k => !need.has(k));
  for (const k of gone) {
    await env.TRANSIT.delete(user + '/' + k);
    await env.DB.prepare('DELETE FROM transit WHERE user = ? AND key = ?').bind(user, k).run();
  }
  return gone.length;
}

/* les comptes qui partagent cette photo (sans soi-même) */
const others = async (env, pid, me) => (await env.DB.prepare('SELECT user, role FROM shares WHERE pid = ? AND user != ?').bind(pid, me).all()).results;
const roleOf = async (env, pid, me) => (await env.DB.prepare('SELECT role FROM shares WHERE pid = ? AND user = ?').bind(pid, me).first())?.role || null;
const LOCK_MS = 10 * 60e3;
async function lockOf(env, pid) { const l = await env.DB.prepare('SELECT user, device, name, until FROM locks WHERE pid = ?').bind(pid).first(); return l && l.until > now() ? l : null; }
async function tellShare(env, pid, me, msg) { for (const o of await others(env, pid, me)) await notify(env, o.user, msg); }

async function notify(env, user, msg) {
  try { await env.LIVE.get(env.LIVE.idFromName(user)).fetch('https://live/notify', { method: 'POST', body: JSON.stringify(msg) }); } catch { /* personne de connecté */ }
}

async function route(req, env, ctx) {
  const url = new URL(req.url), p = url.pathname, m = req.method;
  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (p === '/' || p === '/v1') return json({ ok: true, service: 'prism-sync' });

  if (p === '/v1/signup' && m === 'POST') {
    const b = await body(req), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (!EMAIL_RE.test(email)) return fail(400, 'email', 'Adresse e-mail invalide.');
    if (pw.length < 8 || pw.length > 200) return fail(400, 'password', 'Le mot de passe doit faire au moins 8 caractères.');
    const ipk = 'signup:' + ipOf(req);
    if (await ipCount(env, ipk, 5, 3600e3, false)) return fail(429, 'slow', 'Trop de comptes créés depuis ce réseau. Réessaie dans une heure.', { retryAfter: 3600 });
    await ipCount(env, ipk, 5, 3600e3, true);
    if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) return fail(409, 'exists', 'Un compte existe déjà avec cette adresse.');
    const id = rid(8);
    await env.DB.prepare('INSERT INTO users(id,email,pw,created) VALUES(?,?,?,?)').bind(id, email, await hashPw(pw), now()).run();
    return json({ ...(await newSession(env, id, b.device)), email }, 201);
  }
  if (p === '/v1/login' && m === 'POST') {
    const b = await body(req), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    const ipk = 'login:' + ipOf(req);
    if (await blocked(env, email) || await ipCount(env, ipk, 30, 15 * 60e3, false)) return fail(429, 'slow', 'Trop d’essais. Réessaie dans un quart d’heure.', { retryAfter: 900 });
    if (pw.length > 200) return fail(401, 'login', 'Adresse ou mot de passe incorrect.');
    const u = await env.DB.prepare('SELECT id, pw FROM users WHERE email = ?').bind(email).first();
    const ref = u ? u.pw : await dummy();
    const ok = same(await hashPw(pw, ref.split('$')[0]), ref) && !!u;
    await throttle(env, email, ok);
    if (!ok) { await ipCount(env, ipk, 30, 15 * 60e3, true); return fail(401, 'login', 'Adresse ou mot de passe incorrect.'); }
    return json({ ...(await newSession(env, u.id, b.device)), email });
  }

  const me = await auth(env, req, url);
  if (!me) return fail(401, 'auth', 'Connecte-toi à ton compte Prism.');

  if (p === '/v1/logout' && m === 'POST') {
    const t = (req.headers.get('authorization') || '').slice(7);
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(await sha(t)).run();
    return json({ ok: true });
  }
  if (p === '/v1/me' && m === 'GET') {
    const u = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(me.user).first();
    const devs = (await env.DB.prepare('SELECT id, name, platform, last FROM devices WHERE user = ? ORDER BY last DESC').bind(me.user).all()).results;
    return json({ user: me.user, email: u?.email, device: me.device, devices: devs });
  }
  const dm = p.match(/^\/v1\/devices\/([A-Za-z0-9_.-]{1,64})$/);
  if (dm && m === 'DELETE') {
    const id = dm[1];
    const d = await env.DB.prepare('SELECT user FROM devices WHERE id = ?').bind(id).first();
    if (!d || d.user !== me.user) return fail(404, 'device', 'Appareil inconnu.');
    await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE device = ?').bind(id), env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(id)]);
    ctx.waitUntil(sweepUser(env, me.user));   // un appareil retiré ne bloque plus le transit
    return json({ ok: true });
  }
  if (p === '/v1/usage' && m === 'GET') return json({ used: await used(env), limit: limit(env), hours: +(env.TRANSIT_HOURS || 24) });

  const bm = p.match(/^\/v1\/blobs\/(.+)$/);
  if (bm) {
    let key = ''; try { key = decodeURIComponent(bm[1]); } catch { /* encodage cassé */ }
    if (!KEY_RE.test(key) || key === '.' || key === '..') return fail(400, 'key', 'Nom de fichier invalide.');
    const rk = me.user + '/' + key;
    if (m === 'PUT') {
      const size = +req.headers.get('content-length');
      if (!(size > 0)) return fail(411, 'length', 'Taille du fichier manquante.');
      if (size > MAX_BLOB) return fail(413, 'big', 'Fichier trop gros pour le transit (500 Mo au plus).');
      if (await env.DB.prepare('SELECT 1 FROM transit WHERE user = ? AND key = ?').bind(me.user, key).first()) return json({ ok: true, already: true });
      if ((await used(env)) + size > limit(env) || (await used(env, me.user)) + size > userLimit(env)) return fail(507, 'full', 'Le transit est plein pour le moment : l’envoi reprendra tout seul.', { retryAfter: 600 });
      const ct = String(req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      await env.TRANSIT.put(rk, req.body, { httpMetadata: { contentType: BLOB_TYPES.test(ct) ? ct : 'application/octet-stream' } });
      await env.DB.prepare('INSERT OR REPLACE INTO transit(user,key,size,created) VALUES(?,?,?,?)').bind(me.user, key, size, now()).run();
      return json({ ok: true }, 201);
    }
    if (m === 'GET') {
      let o = await env.TRANSIT.get(rk);
      // un fichier d'un autre compte : seulement s'il est annoncé dans un évènement de photo partagée reçu ici
      const from = url.searchParams.get('from');
      if (!o && from && PID_RE.test(from) && from !== me.user) {
        const ok = await env.DB.prepare('SELECT 1 FROM events WHERE user = ? AND origin = ? AND blobs LIKE ? LIMIT 1').bind(me.user, from, '%"' + key + '"%').first();
        if (ok) o = await env.TRANSIT.get(from + '/' + key);
      }
      if (!o) return fail(404, 'gone', 'Ce fichier n’est plus en transit : il viendra d’un autre appareil.');
      const ct = o.httpMetadata?.contentType || '';
      return new Response(o.body, { headers: { ...CORS, ...SAFE, 'content-type': BLOB_TYPES.test(ct) ? ct : 'application/octet-stream', 'content-disposition': 'attachment', 'content-length': String(o.size) } });
    }
  }

  if (p === '/v1/events' && m === 'POST') {
    const b = await body(req);
    const kind = String(b.kind || '');
    if (!['put', 'delete', 'want'].includes(kind)) return fail(400, 'kind', 'Type d’évènement inconnu.');
    const pid = String(b.pid || '');
    if (!PID_RE.test(pid) && !(kind === 'want' && pid === '*')) return fail(400, 'pid', 'Identifiant de projet invalide.');
    const blobs = Array.isArray(b.blobs) ? b.blobs.filter(k => typeof k === 'string' && KEY_RE.test(k)).slice(0, 5000) : [];
    const bodyTxt = b.body == null ? null : JSON.stringify(b.body);
    if (bodyTxt && bodyTxt.length > MAX_BODY) return fail(413, 'big', 'Projet trop gros.');
    const role = pid === '*' ? null : await roleOf(env, pid, me.user);
    if (role && kind === 'put') {   // chacun son tour : une photo partagée ne s'enregistre que chez celui qui la tient
      const l = await lockOf(env, pid);
      if (l && l.user !== me.user) return fail(423, 'locked', 'Quelqu’un d’autre retouche cette photo en ce moment.', { holder: { name: l.name, until: l.until } });
    }
    const r = await env.DB.prepare('INSERT INTO events(user,device,kind,pid,body,blobs,created) VALUES(?,?,?,?,?,?,?) RETURNING seq')
      .bind(me.user, me.device, kind, pid, bodyTxt, JSON.stringify(blobs), now()).first();
    ctx.waitUntil(notify(env, me.user, { type: 'event', seq: r.seq, from: me.device }));
    if (role) {
      if (kind === 'delete' && role !== 'owner') {   // un invité qui supprime quitte seulement le partage
        await env.DB.prepare('DELETE FROM shares WHERE pid = ? AND user = ?').bind(pid, me.user).run();
        ctx.waitUntil(tellShare(env, pid, me.user, { type: 'share', pid }));
      } else {
        for (const o of await others(env, pid, me.user)) {
          const c = await env.DB.prepare('INSERT INTO events(user,device,kind,pid,body,blobs,created,origin) VALUES(?,?,?,?,?,?,?,?) RETURNING seq')
            .bind(o.user, me.device, kind, pid, bodyTxt, JSON.stringify(blobs), now(), me.user).first();
          ctx.waitUntil(notify(env, o.user, { type: 'event', seq: c.seq, from: me.device }));
        }
        if (kind === 'delete') await env.DB.batch([env.DB.prepare('DELETE FROM shares WHERE pid = ?').bind(pid), env.DB.prepare('DELETE FROM locks WHERE pid = ?').bind(pid)]);
      }
    }
    return json({ seq: r.seq }, 201);
  }
  if (p === '/v1/events' && m === 'GET') {
    const after = Math.max(0, +url.searchParams.get('after') || 0);
    const rows = (await env.DB.prepare('SELECT seq, device, kind, pid, body, blobs, created, origin FROM events WHERE user = ? AND seq > ? ORDER BY seq LIMIT 200').bind(me.user, after).all()).results;
    return json({ events: rows.map(r => ({ ...r, body: r.body ? JSON.parse(r.body) : null, blobs: JSON.parse(r.blobs) })), more: rows.length === 200 });
  }
  if (p === '/v1/ack' && m === 'POST') {
    const b = await body(req), seq = Math.max(0, +b.seq || 0);
    await env.DB.prepare('UPDATE devices SET cursor = MAX(cursor, ?) WHERE id = ?').bind(seq, me.device).run();
    ctx.waitUntil((async () => {
      await sweepUser(env, me.user);   // et les comptes dont on a reçu des photos partagées
      for (const r of (await env.DB.prepare('SELECT DISTINCT origin FROM events WHERE user = ? AND origin IS NOT NULL').bind(me.user).all()).results) await sweepUser(env, r.origin);
    })());
    return json({ ok: true });
  }
  /* ---------- travail à plusieurs ---------- */
  if (p === '/v1/shares' && m === 'GET') {
    const mine = (await env.DB.prepare('SELECT pid, role FROM shares WHERE user = ?').bind(me.user).all()).results;
    const out = [];
    for (const s of mine) {
      const mem = (await env.DB.prepare('SELECT s.user, s.role, u.email FROM shares s JOIN users u ON u.id = s.user WHERE s.pid = ? ORDER BY s.created').bind(s.pid).all()).results;
      const l = await lockOf(env, s.pid);
      out.push({ pid: s.pid, role: s.role, members: mem.map(x => ({ user: x.user, email: x.email, role: x.role, me: x.user === me.user })), lock: l && { user: l.user, device: l.device, name: l.name, until: l.until, me: l.user === me.user } });
    }
    return json({ shares: out });
  }
  if (p === '/v1/shares' && m === 'POST') {
    const b = await body(req), pid = String(b.pid || ''), email = String(b.email || '').trim().toLowerCase();
    if (!PID_RE.test(pid)) return fail(400, 'pid', 'Identifiant de projet invalide.');
    if (!EMAIL_RE.test(email)) return fail(400, 'email', 'Adresse e-mail invalide.');
    const ipk = 'share:' + me.user;
    if (await ipCount(env, ipk, 30, 3600e3, false)) return fail(429, 'slow', 'Trop d’invitations envoyées. Réessaie dans une heure.', { retryAfter: 3600 });
    await ipCount(env, ipk, 30, 3600e3, true);
    let role = await roleOf(env, pid, me.user);
    if (!role) {   // premier partage : il faut avoir soi-même envoyé cette photo, et que personne d'autre ne la partage déjà
      const own = await env.DB.prepare('SELECT 1 FROM events WHERE user = ? AND pid = ? AND origin IS NULL AND kind = \'put\' LIMIT 1').bind(me.user, pid).first();
      const taken = await env.DB.prepare('SELECT 1 FROM shares WHERE pid = ? LIMIT 1').bind(pid).first();
      if (!own || taken) return fail(404, 'pid', 'Photo inconnue : synchronise-la d’abord.');
      await env.DB.prepare('INSERT INTO shares(pid,user,role,created) VALUES(?,?,?,?)').bind(pid, me.user, 'owner', now()).run();
      role = 'owner';
    }
    if (role !== 'owner') return fail(403, 'owner', 'Seule la personne qui a partagé la photo peut inviter quelqu’un.');
    const u = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (!u) return fail(404, 'nouser', 'Aucun compte Prism avec cette adresse : la personne doit d’abord créer son compte.');
    if (u.id === me.user) return fail(400, 'self', 'C’est ton propre compte.');
    if ((await env.DB.prepare('SELECT COUNT(*) AS n FROM shares WHERE pid = ?').bind(pid).first()).n >= 10) return fail(400, 'full', 'Dix personnes au plus sur une même photo.');
    await env.DB.prepare('INSERT OR IGNORE INTO shares(pid,user,role,created) VALUES(?,?,?,?)').bind(pid, u.id, 'edit', now()).run();
    // l'invité n'a encore rien : on demande aux appareils de la propriétaire de renvoyer la photo (elle partira aussi chez lui)
    const w = await env.DB.prepare('INSERT INTO events(user,device,kind,pid,body,blobs,created,origin) VALUES(?,?,?,?,?,?,?,?) RETURNING seq').bind(me.user, 'partage', 'want', pid, null, '[]', now(), u.id).first();
    ctx.waitUntil(notify(env, me.user, { type: 'event', seq: w.seq, from: 'share' }));
    ctx.waitUntil(notify(env, u.id, { type: 'share', pid }));
    return json({ ok: true }, 201);
  }
  const sm = p.match(/^\/v1\/shares\/([A-Za-z0-9_.-]{1,64})\/([A-Za-z0-9_.-]{1,64})$/);
  if (sm && m === 'DELETE') {
    const [, pid, who] = sm, role = await roleOf(env, pid, me.user);
    if (!role || (role !== 'owner' && who !== me.user)) return fail(404, 'share', 'Partage inconnu.');
    if (role === 'owner' && who === me.user) await env.DB.batch([env.DB.prepare('DELETE FROM shares WHERE pid = ?').bind(pid), env.DB.prepare('DELETE FROM locks WHERE pid = ?').bind(pid)]);
    else { await env.DB.prepare('DELETE FROM shares WHERE pid = ? AND user = ? AND role != \'owner\'').bind(pid, who).run(); await env.DB.prepare('DELETE FROM locks WHERE pid = ? AND user = ?').bind(pid, who).run(); }
    ctx.waitUntil(notify(env, who, { type: 'share', pid })); ctx.waitUntil(tellShare(env, pid, me.user, { type: 'share', pid }));
    return json({ ok: true });
  }
  const lm = p.match(/^\/v1\/locks\/([A-Za-z0-9_.-]{1,64})$/);
  if (lm) {
    const pid = lm[1], role = await roleOf(env, pid, me.user);
    if (!role) return fail(404, 'share', 'Cette photo n’est pas partagée.');
    const l = await lockOf(env, pid);
    if (m === 'POST') {
      if (l && l.user !== me.user) return fail(409, 'locked', 'Quelqu’un d’autre retouche cette photo en ce moment.', { holder: { name: l.name, until: l.until } });
      const who = (await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(me.user).first())?.email || '';
      await env.DB.prepare('INSERT OR REPLACE INTO locks(pid,user,device,name,until) VALUES(?,?,?,?,?)').bind(pid, me.user, me.device, who.split('@')[0], now() + LOCK_MS).run();
      if (!l) ctx.waitUntil(tellShare(env, pid, me.user, { type: 'lock', pid }));
      return json({ ok: true, until: now() + LOCK_MS });
    }
    if (m === 'DELETE') {
      if (l && l.user === me.user) { await env.DB.prepare('DELETE FROM locks WHERE pid = ?').bind(pid).run(); ctx.waitUntil(tellShare(env, pid, me.user, { type: 'lock', pid })); }
      return json({ ok: true });
    }
  }
  if (p === '/v1/live' && req.headers.get('upgrade') === 'websocket') {
    const u = new URL('https://live/ws'); u.searchParams.set('device', me.device); u.searchParams.set('name', me.name);
    return env.LIVE.get(env.LIVE.idFromName(me.user)).fetch(new Request(u, req));
  }
  return fail(404, 'route', 'Adresse inconnue.');
}

/* ménage de chaque heure : transit de plus de 24 h, journal de plus de 30 jours */
async function sweepAll(env) {
  const old = now() - (+(env.TRANSIT_HOURS || 24)) * 3600e3;
  const rows = (await env.DB.prepare('SELECT user, key FROM transit WHERE created < ?').bind(old).all()).results;
  for (const r of rows) { await env.TRANSIT.delete(r.user + '/' + r.key); await env.DB.prepare('DELETE FROM transit WHERE user = ? AND key = ?').bind(r.user, r.key).run(); }
  await env.DB.prepare('DELETE FROM events WHERE created < ?').bind(now() - (+(env.EVENTS_DAYS || 30)) * 864e5).run();
  await env.DB.prepare('DELETE FROM attempts WHERE since < ?').bind(now() - 2 * 3600e3).run();
  await env.DB.prepare('DELETE FROM locks WHERE until < ?').bind(now()).run();
  // un appareil muet depuis 180 jours perd sa session (il faudra se reconnecter)
  await env.DB.prepare('DELETE FROM sessions WHERE device IN (SELECT id FROM devices WHERE last < ?)').bind(now() - 180 * 864e5).run();
  return rows.length;
}

export default {
  async fetch(req, env, ctx) {
    try { return await route(req, env, ctx); }
    catch (e) { return fail(e.status || 500, 'server', e.status ? e.message : 'Erreur du serveur.'); }
  },
  async scheduled(ev, env, ctx) { ctx.waitUntil(sweepAll(env)); },
  sweepAll,
};

/* un Durable Object par compte : qui est connecté, « il y a du nouveau », et le relais WebRTC entre appareils */
export class Live {
  constructor(state) { this.state = state; }
  peers() { return this.state.getWebSockets().map(ws => ws.deserializeAttachment()).filter(Boolean); }
  broadcast(msg, except) { const t = JSON.stringify(msg); for (const ws of this.state.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.device !== except) try { ws.send(t); } catch { } } }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/notify') { this.broadcast(await req.json()); return new Response('ok'); }
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    const device = url.searchParams.get('device'), name = url.searchParams.get('name') || '';
    for (const ws of this.state.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.device === device) try { ws.close(4000, 'remplacé'); } catch { } }
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ device, name });
    this.broadcast({ type: 'peers', devices: this.peers() });
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, data) {
    let m; try { m = JSON.parse(data); } catch { return; }
    const me = ws.deserializeAttachment();
    if (m.type === 'signal' && typeof m.to === 'string' && m.to !== me.device && String(data).length <= 65536) {
      for (const w of this.state.getWebSockets()) { const a = w.deserializeAttachment(); if (a && a.device === m.to) w.send(JSON.stringify({ type: 'signal', from: me.device, data: m.data })); }
    } else if (m.type === 'ping') ws.send('{"type":"pong"}');
  }
  left(ws) { const me = ws.deserializeAttachment(); const t = JSON.stringify({ type: 'peers', devices: this.peers().filter(a => a.device !== me?.device) });
    for (const w of this.state.getWebSockets()) if (w !== ws) try { w.send(t); } catch { } }
  webSocketClose(ws) { this.left(ws); }
  webSocketError(ws) { this.left(ws); }
}
