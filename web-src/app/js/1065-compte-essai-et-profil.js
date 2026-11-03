/* ================= 1.0 : compte d'essai (bêta) et profil =================
   Tant que le serveur n'est pas en ligne, « Créer un compte » sans adresse de serveur crée un compte d'essai sur cet
   appareil : mêmes règles et mêmes messages que le vrai serveur (adresse valide, 8 caractères, adresse déjà prise,
   mauvais mot de passe), mot de passe haché (PBKDF2). Rien n'est synchronisé dans ce mode.
   Profil : nom affiché et photo de profil (recadrée en carré 256 px), dans Fichier > Compte Prism ; la pastille du
   compte s'affiche en haut à droite. Avec le vrai serveur, le profil passe par PATCH /v1/me. */
const SY_ESSAI = 'local:essai';
function syEssai(url) { const u = url != null ? url : (SY.cfg && SY.cfg.url); return typeof u === 'string' && u.startsWith('local:') }
const ESSAI = {
  KEY: 'prism-essai-comptes',
  load() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}') } catch (e) { return {} } },
  save(d) { try { localStorage.setItem(this.KEY, JSON.stringify(d)) } catch (e) { throw Object.assign(new Error('Stockage plein sur cet appareil'), { status: 507 }) } },
  hex: b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''),
  rnd(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return this.hex(a) },
  async hash(pw, salt) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    return this.hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, k, 256)) }
};
const syFail = (status, code, message) => { throw Object.assign(new Error(message), { status, code, data: { error: code, message } }) };
const SY_EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;
const SY_AVATAR = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
async function syEssaiApi(path, { method = 'GET', json } = {}) {
  const d = ESSAI.load(); d.users = d.users || {}; d.sessions = d.sessions || {};
  const b = json || {}, dev = b.device || {};
  const session = async (u) => { const token = ESSAI.rnd(24), device = dev.id || ESSAI.rnd(8); d.sessions[token] = { user: u.id, device, name: dev.name || syDeviceName(), platform: dev.platform || syPlatform(), last: Date.now() }; ESSAI.save(d); return { token, device, user: u.id, email: u.email } };
  if (path === '/v1/signup' && method === 'POST') {
    const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (!SY_EMAIL.test(email)) syFail(400, 'email', 'Adresse e-mail invalide.');
    if (pw.length < 8 || pw.length > 200) syFail(400, 'password', 'Le mot de passe doit faire au moins 8 caractères.');
    if (d.users[email]) syFail(409, 'exists', 'Un compte existe déjà avec cette adresse.');
    const salt = ESSAI.rnd(16), u = { id: ESSAI.rnd(8), email, salt, pw: await ESSAI.hash(pw, salt), created: Date.now(), name: '', avatar: null };
    d.users[email] = u; return session(u);
  }
  if (path === '/v1/login' && method === 'POST') {
    const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || ''), u = d.users[email];
    const h = await ESSAI.hash(pw, u ? u.salt : 'absent');      // même temps de calcul, compte connu ou non
    if (!u || h !== u.pw) syFail(401, 'login', 'E-mail ou mot de passe incorrect.');
    return session(u);
  }
  const tok = SY.cfg && SY.cfg.token, ses = tok && d.sessions[tok], u = ses && Object.values(d.users).find(x => x.id === ses.user);
  if (!u) syFail(401, 'auth', 'Connecte-toi à ton compte Prism.');
  ses.last = Date.now();
  if (path === '/v1/logout' && method === 'POST') { delete d.sessions[tok]; ESSAI.save(d); return { ok: true } }
  if (path === '/v1/me' && method === 'GET') {
    const devs = Object.values(d.sessions).filter(x => x.user === u.id).map(x => ({ id: x.device, name: x.name, platform: x.platform, last: x.last }));
    ESSAI.save(d); return { user: u.id, email: u.email, name: u.name || '', avatar: u.avatar || null, device: ses.device, devices: devs };
  }
  if (path === '/v1/me' && method === 'PATCH') {
    if ('name' in b) u.name = String(b.name ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 60);
    if ('avatar' in b) { const a = b.avatar; if (a !== null && !(typeof a === 'string' && a.length <= 280000 && SY_AVATAR.test(a))) syFail(400, 'avatar', 'La photo de profil doit être une image JPEG, PNG ou WebP de 200 Ko au plus.'); u.avatar = a }
    ESSAI.save(d); return { ok: true };
  }
  if (path === '/v1/usage') return { used: 0, limit: 1, hours: 24 };
  if (path === '/v1/shares' && method === 'GET') return { shares: [] };
  const dm = path.match(/^\/v1\/devices\/(.+)$/);
  if (dm && method === 'DELETE') { for (const t in d.sessions) if (d.sessions[t].user === u.id && d.sessions[t].device === decodeURIComponent(dm[1])) delete d.sessions[t]; ESSAI.save(d); return { ok: true } }
  syFail(503, 'essai', 'Pas encore de serveur : en mode essai, rien ne se synchronise.');
}
{ const _api = syApi;
  syApi = async function (path, o = {}) { const base = o.url || (SY.cfg && SY.cfg.url) || SYNC_URL_DEFAULT || '';
    if (syEssai(base)) return syEssaiApi(path, o);
    return _api.apply(this, arguments) };
  if (window.PrismSync) window.PrismSync.api = syApi }

/* ---- profil ---- */
async function syProfile() { if (!SY.cfg) return null; const me = await syApi('/v1/me'); PREF.set('sync2Prof', { name: me.name || '', avatar: me.avatar || null, email: me.email }); syBadge(); return me }
function syInitial(p) { const s = (p && (p.name || p.email) || '?').trim(); return esc((s[0] || '?').toUpperCase()) }
function syAvatarHtml(p, size) { return p && p.avatar ? `<img src="${esc(p.avatar)}" alt="" width="${size}" height="${size}">` : `<span>${syInitial(p)}</span>` }
async function syAvatarFrom(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Choisissez une image');
  const bm = await createImageBitmap(file), s = Math.min(bm.width, bm.height), c = document.createElement('canvas'); c.width = c.height = 256;
  c.getContext('2d').drawImage(bm, (bm.width - s) / 2, (bm.height - s) / 2, s, s, 0, 0, 256, 256); bm.close && bm.close();
  let q = 0.86, url = c.toDataURL('image/jpeg', q); while (url.length > 270000 && q > 0.4) { q -= 0.12; url = c.toDataURL('image/jpeg', q) }
  return url }
function syProfFill(box, me) {
  if (!box || !me) return; const p = { name: me.name, avatar: me.avatar, email: me.email };
  box.innerHTML = `<div class="sy-av">${syAvatarHtml(p, 64)}</div><div class="sy-pf"><label class="sy-f"><span>Nom affiché</span><input id="syName" type="text" maxlength="60" placeholder="Nom ou pseudo" value="${esc(me.name || '')}"></label>
    <small class="sy-u">${esc(me.email || '')}</small><div class="sy-pb"><button class="btn sm" id="syPic">${me.avatar ? 'Changer la photo' : 'Ajouter une photo'}</button>${me.avatar ? '<button class="btn sm" id="syPicRm">Retirer la photo</button>' : ''}<input id="syPicIn" type="file" accept="image/*" hidden></div></div>`;
  const save = async (o, ok) => { try { await syApi('/v1/me', { method: 'PATCH', json: o }); const m = await syProfile(); syProfFill(box, m); if (ok) toast(ok) } catch (e) { toast(e.message || 'Profil non enregistré') } };
  const nm = $('#syName', box); nm.onchange = () => save({ name: nm.value }, 'Nom enregistré'); nm.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); nm.blur() } };
  const inp = $('#syPicIn', box); $('#syPic', box).onclick = () => inp.click();
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { await save({ avatar: await syAvatarFrom(f) }, 'Photo de profil enregistrée') } catch (e) { toast(e.message) } };
  const rm = $('#syPicRm', box); if (rm) rm.onclick = () => save({ avatar: null }, 'Photo retirée');
}
/* la pastille du compte, en haut à droite */
function syBadge() {
  const ex = $('#bExport'); if (!ex) return; let b = $('#syBadge');
  if (!SY.cfg) { if (b) b.remove(); return }
  if (!b) { b = document.createElement('button'); b.id = 'syBadge'; b.type = 'button'; b.className = 'sy-badge'; b.onclick = () => syAccountDialog(); ex.before(b) }
  const p = PREF.get('sync2Prof', null) || { email: SY.cfg.email };
  b.innerHTML = syAvatarHtml(p, 26); b.title = 'Compte Prism · ' + (p.name || SY.cfg.email || ''); b.setAttribute('aria-label', 'Compte Prism');
}
(() => {
  const st = document.createElement('style'); st.textContent = `
.sy-note{margin:0 0 12px;padding:8px 10px;border-radius:8px;background:var(--accent-soft);color:var(--fg-2);font-size:12.5px;line-height:1.45;max-width:440px}
.sy-prof{display:flex;gap:14px;align-items:flex-start;margin:0 0 12px}
.sy-av{width:64px;height:64px;flex:none;border-radius:50%;overflow:hidden;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font-size:26px;font-weight:600}
.sy-av img{width:100%;height:100%;object-fit:cover;display:block}
.sy-pf{flex:1;min-width:0;display:grid;gap:4px}.sy-pf .sy-f{margin:0}.sy-pb{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.sy-badge{width:30px;height:30px;padding:0;border:1px solid var(--line-2);border-radius:50%;overflow:hidden;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font:600 13px/1 inherit;cursor:pointer;margin-right:6px;flex:none}
.sy-badge img{width:100%;height:100%;object-fit:cover;display:block}.sy-badge span{font-weight:600}`;
  document.head.appendChild(st);
  setTimeout(() => { syBadge(); if (SY.cfg) syProfile().catch(() => { }) }, 0);
})();
