/* ================= 1.0: compte Prism et synchronisation entre appareils =================
   Cloudflare (server/) n'est qu'un intermédiaire : quand un projet est enregistré, ses fichiers partent dans la boîte de transit
   et un évènement « projet modifié » prévient les autres appareils du compte, qui les récupèrent. Le transit est effacé dès que
   tous les appareils l'ont reçu (24 h au plus). Une suppression part de la même façon. Si le transit est plein (507),
   l'envoi reste dans la file d'attente de l'appareil et repart tout seul.
   « Synchroniser maintenant » renvoie ce qui attend et demande aux autres appareils de renvoyer leurs projets. */
const SYNC_URL_DEFAULT = '';   // adresse du Worker une fois en ligne (sinon on la saisit dans la fenêtre Compte)
const SY = {
  cfg: PREF.get('sync2', null),        // {url, token, device, email}
  out: PREF.get('sync2Out', []),       // file d'attente : [{kind, pid, at}]
  cursor: PREF.get('sync2Cursor', 0),
  ws: null, wsTry: 0, peers: [], running: false, again: false, timer: 0, retryAt: 0,
  state: 'off', msg: '', got: 0, sent: 0,
};
const syLog = (...a) => { try { console.info('[synchro]', ...a) } catch (e) { } };
const sySave = () => { PREF.set('sync2', SY.cfg); PREF.set('sync2Out', SY.out); PREF.set('sync2Cursor', SY.cursor) };
const syState = (s, msg = '') => { SY.state = s; SY.msg = msg; try { document.dispatchEvent(new CustomEvent('prism-sync', { detail: { state: s, msg } })) } catch (e) { } };
const syPlatform = () => window.__TAURI__ ? (/Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows') : 'web';
const syDeviceName = () => ({ mac: 'Mac', windows: 'PC Windows', web: 'Navigateur' })[syPlatform()] + (window.__TAURI__ ? '' : ' (' + (/iPhone|iPad|Android/i.test(navigator.userAgent) ? 'mobile' : 'ordinateur') + ')');

async function syApi(path, { method = 'GET', json, body, headers = {}, raw = false, url } = {}) {
  const base = (url || (SY.cfg && SY.cfg.url) || SYNC_URL_DEFAULT).replace(/\/+$/, '');
  if (!base) throw Object.assign(new Error('Adresse du serveur manquante'), { code: 'nourl' });
  const h = { ...headers };
  if (SY.cfg && SY.cfg.token && !url) h.authorization = 'Bearer ' + SY.cfg.token;
  if (json) h['content-type'] = 'application/json';
  let r;
  try { r = await fetch(base + path, { method, headers: h, body: json ? JSON.stringify(json) : body }) }
  catch (e) { throw Object.assign(new Error('Serveur injoignable'), { code: 'offline' }) }
  if (raw && r.ok) return r;
  let d = null; try { d = await r.json() } catch (e) { }
  if (!r.ok) throw Object.assign(new Error((d && d.message) || ('Erreur ' + r.status)), { status: r.status, code: d && d.error, retryAfter: d && d.retryAfter, data: d });
  return d;
}

/* les autres appareils du compte sont-ils tous allumés ? (liste du compte gardée 5 minutes) */
let syDevs = { at: 0, ids: [] };
async function syAllOnline() {
  if (Date.now() - syDevs.at > 300000) { try { const me = await syApi('/v1/me'); syDevs = { at: Date.now(), ids: me.devices.map(d => d.id).filter(id => id !== SY.cfg.device) } } catch (e) { return false } }
  const on = new Set(SY.peers.map(p => p.device));
  return syDevs.ids.length > 0 && syDevs.ids.every(id => on.has(id));
}
const syKnown = k => IDB.get('amap', 'sy:' + k).then(v => !!v).catch(() => false);
const syMark = k => IDB.put('amap', 'sy:' + k, 1).catch(() => { });
/* ---- file d'attente ---- */
function syEnqueue(kind, pid, force = false) {
  if (!SY.cfg) return;
  SY.out = SY.out.filter(x => !(x.pid === pid && (x.kind === kind || (kind !== 'want' && x.kind !== 'want'))));
  SY.out.push({ kind, pid, at: Date.now(), ...(force ? { force: true } : {}) }); sySave(); syKick(2500);
}
function syKick(ms = 0) { clearTimeout(SY.timer); if (!SY.cfg || syEssai()) return; const wait = Math.max(ms, SY.retryAt - Date.now()); SY.timer = setTimeout(syRun, Math.max(0, wait)) }

async function syPushOne(it) {
  if (it.kind === 'put') {
    const m = await IDB.get('projects', it.pid).catch(() => null);
    if (!m) return true;                                // supprimé entre-temps : rien à envoyer
    const keys = [...manifestKeys(m)];
    /* tous les autres appareils sont allumés : les fichiers passeront directement, rien n'est déposé chez Cloudflare */
    const direct = !it.force && window.PrismPeer && !(window.PrismShare && PrismShare.isShared(m.id)) && await syAllOnline();   // une photo partagée passe toujours par le transit : les autres comptes ne sont pas en direct
    if (direct) SY.direct = (SY.direct || 0) + 1;
    /* une tuile déjà partie (ou reçue) lors d'une version précédente est déjà sur les autres appareils : on ne la renvoie pas,
       sauf si un appareil l'a redemandée (force) */
    if (!direct) for (const k of keys) {
      if (!it.force && await syKnown(k)) continue;
      const b = await IDB.get('blobs', k).catch(() => null); if (!b) continue;
      await syApi('/v1/blobs/' + encodeURIComponent(k), { method: 'PUT', body: b, headers: { 'content-type': b.type || 'application/octet-stream' } });
    }
    try { await syApi('/v1/events', { method: 'POST', json: { kind: 'put', pid: m.id, body: m, blobs: keys } }) }
    catch (err) { if (err.status === 423) { syLog('photo partagée tenue par quelqu’un d’autre', m.id); return true } throw err }   // chacun son tour : rien à envoyer
    for (const k of keys) syMark(k);
  } else await syApi('/v1/events', { method: 'POST', json: { kind: it.kind, pid: it.pid } });
  SY.sent++; return true;
}

async function syPull() {
  for (let guard = 0; guard < 50; guard++) {
    const r = await syApi('/v1/events?after=' + SY.cursor);
    for (const e of r.events) {
      if (e.device !== SY.cfg.device) { try { await syApply(e) } catch (err) { console.warn('[synchro] évènement ignoré', e.seq, err) } }
      SY.cursor = e.seq; sySave();
    }
    if (r.events.length) await syApi('/v1/ack', { method: 'POST', json: { seq: SY.cursor } }).catch(() => { });
    if (!r.more) break;
  }
}

async function syApply(e) {
  if (e.kind === 'want') {
    const all = await IDB.all('projects').catch(() => []);
    for (const m of all) if (m && m.id && (e.pid === '*' || e.pid === m.id)) syEnqueue('put', m.id, true);   // redemandé : on passe par le transit
    return;
  }
  if (e.kind === 'delete') {
    const had = await IDB.get('projects', e.pid).catch(() => null); if (!had) return;
    GONE.add([e.pid]);
    const open = S.doc && S.doc.pid === e.pid;
    if (open) { S.doc.nosave = true; clearTimeout(SAVE.timer); SAVE.timer = null }
    await IDB.del('projects', e.pid).catch(() => { });
    SY.out = SY.out.filter(x => x.pid !== e.pid); sySave();
    if (open) { closeDoc(); toast('« ' + (had.name || 'Sans titre') + ' » a été supprimée sur un autre appareil') }
    gcBlobs().catch(() => { }); await syRefreshLib(); SY.got++; return;
  }
  if (e.kind === 'put' && e.body) {
    // un appareil du compte peut être piraté : le projet doit être un objet sain, au bon identifiant, aux dimensions possibles
    let m; try { m = checkDims(e.body) } catch (err) { syLog('projet refusé', e.pid, err.message); return }
    if (typeof m !== 'object' || Array.isArray(m) || m.id !== e.pid || !/^[A-Za-z0-9_.-]{1,64}$/.test(m.id) || !Array.isArray(m.layers) || !m.layers.length || !m.layers.every(L => L && typeof L === 'object' && !Array.isArray(L))) { syLog('projet refusé', e.pid); return }
    m = JSON.parse(JSON.stringify(m), (k, v) => (k === '__proto__' || k === 'constructor' || k === 'prototype') ? undefined : v);
    if (typeof m.name !== 'string') m.name = 'Sans titre'; m.name = m.name.slice(0, 200);
    const local = await IDB.get('projects', m.id).catch(() => null);
    if (local && (local.updatedAt || 0) >= (m.updatedAt || 0)) return;          // la version d'ici est plus récente
    if (S.doc && S.doc.pid === m.id && !S.doc.saved) return;                    // en cours de retouche ici : elle repartira à l'enregistrement
    const miss = [];
    for (const k of e.blobs || []) {
      if (await IDB.get('blobs', k).catch(() => null)) { syMark(k); continue }
      try { const r = await syApi('/v1/blobs/' + encodeURIComponent(k) + (e.origin ? '?from=' + encodeURIComponent(e.origin) : ''), { raw: true }); await IDB.put('blobs', k, await r.blob()); syMark(k) }
      catch (err) { if (err.status === 404) miss.push(k); else throw err }
    }
    if (miss.length) {
      const got = window.PrismPeer ? await PrismPeer.fetchMany(miss).catch(() => []) : [];
      got.forEach(syMark);
      if (got.length < miss.length) { syLog('fichiers manquants pour', m.id, miss.length - got.length); syEnqueue('want', m.id); return }
    }
    PREF.set('libGone', GONE.get().filter(x => x.id !== m.id));
    await IDB.put('projects', m.id, m); SY.got++;
    await syRefreshLib();
  }
}
async function syRefreshLib() { try { await libLoad(); if (LIB.open) renderLibrary(); const e = $('#empty'); if (e && !e.hidden) e.dispatchEvent(new Event('prism-refresh')) } catch (e) { } }

async function syRun() {
  if (syEssai()) return;
  if (!SY.cfg) return;
  if (SY.running) { SY.again = true; return }
  SY.running = true; syState('busy');
  try {
    while (SY.out.length) {
      const it = SY.out[0];
      try { await syPushOne(it) }
      catch (err) {
        if (err.status === 507) { SY.retryAt = Date.now() + (err.retryAfter || 600) * 1000; syState('wait', 'Transit plein : l’envoi reprendra tout seul.'); return }
        if (err.status === 401) { syState('error', 'Reconnecte-toi à ton compte Prism.'); return }
        if (err.status >= 400 && err.status < 500 && err.status !== 429) { syLog('envoi abandonné', it, err.message); }
        else throw err;
      }
      SY.out.shift(); sySave();
    }
    await syPull();
    SY.retryAt = 0; syState('ok');
  } catch (err) {
    SY.retryAt = Date.now() + 30000;
    syState('error', err.code === 'offline' ? 'Hors ligne : la synchronisation reprendra toute seule.' : err.message);
  } finally {
    SY.running = false;
    if (SY.again) { SY.again = false; syKick(500) } else if (SY.retryAt) syKick()
  }
}

/* ---- en direct : « il y a du nouveau », et qui est allumé ---- */
function syLive() {
  if (syEssai()) return;
  if (!SY.cfg || SY.ws || typeof WebSocket === 'undefined') return;
  const u = SY.cfg.url.replace(/^http/, 'ws').replace(/\/+$/, '') + '/v1/live?token=' + encodeURIComponent(SY.cfg.token);
  let ws; try { ws = new WebSocket(u) } catch (e) { return }
  SY.ws = ws;
  ws.onopen = () => { SY.wsTry = 0; syKick(0) };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data) } catch (e) { return }
    if (m.type === 'event' && m.from !== SY.cfg.device) syKick(300);
    else if (m.type === 'peers') { SY.peers = (m.devices || []).filter(d => d.device !== SY.cfg.device); document.dispatchEvent(new CustomEvent('prism-peers')) }
    else if (m.type === 'signal' && window.PrismPeer) PrismPeer.onSignal(m.from, m.data);
    else if ((m.type === 'share' || m.type === 'lock') && window.PrismShare) PrismShare.onLive(m);
  };
  ws.onclose = () => { SY.ws = null; SY.peers = []; if (!SY.cfg) return; const d = Math.min(60000, 1000 * 2 ** SY.wsTry++); setTimeout(syLive, d) };
  ws.onerror = () => { try { ws.close() } catch (e) { } };
}
const sySignal = (to, data) => { if (SY.ws && SY.ws.readyState === 1) SY.ws.send(JSON.stringify({ type: 'signal', to, data })) };

/* ---- branchements : enregistrer, supprimer, restaurer ---- */
(() => {
  const _sv = saveNow;
  saveNow = async function () { const d = S.doc; const r = await _sv.apply(this, arguments); try { if (SY.cfg && d && d.pid && d.saved && SAVE.state !== 'error' && !d.nosave) syEnqueue('put', d.pid) } catch (e) { } return r };
  const _del = libDelete;
  libDelete = async function (ids) { const r = await _del.apply(this, arguments); try { for (const id of ids) if (!(await IDB.get('projects', id).catch(() => null))) syEnqueue('delete', id) } catch (e) { } return r };
  if (window.PrismTrash) { const _rs = PrismTrash.restore; PrismTrash.restore = async function (id) { const r = await _rs.apply(this, arguments); if (r) syEnqueue('put', id); return r } }
  addEventListener('online', () => syKick(0));
  addEventListener('focus', () => syKick(1000));
  setInterval(() => { if (SY.cfg && !SY.running) syKick(0) }, 90000);
})();

/* ---- compte ---- */
async function syConnect(mode, url, email, password) {
  const r = await syApi(mode === 'signup' ? '/v1/signup' : '/v1/login', { method: 'POST', url, json: { email, password, device: { id: (SY.cfg && SY.cfg.device) || PREF.get('sync2Device', null), name: syDeviceName(), platform: syPlatform() } } });
  SY.cfg = { url: url.replace(/\/+$/, ''), token: r.token, device: r.device, email: r.email }; PREF.set('sync2Device', r.device);
  syProfile().catch(() => { });
  SY.cursor = PREF.get('sync2CursorFor', {})[r.user] || SY.cursor; sySave();
  const all = await IDB.all('projects').catch(() => []);      // ce qui est sur cet appareil part vers les autres
  for (const m of all) if (m && m.id) SY.out.push({ kind: 'put', pid: m.id, at: Date.now() });
  SY.out.push({ kind: 'want', pid: '*', at: Date.now() }); sySave();
  syLive(); syKick(0); return r;
}
async function syLogout() {
  try { await syApi('/v1/logout', { method: 'POST' }) } catch (e) { }
  try { SY.ws && SY.ws.close() } catch (e) { }
  SY.cfg = null; SY.out = []; SY.ws = null; SY.peers = []; sySave(); syState('off'); PREF.set('sync2Prof', null); syBadge();
}
async function sySyncNow() {
  if (!SY.cfg) { syAccountDialog(); return }
  SY.retryAt = 0; syEnqueue('want', '*'); syKick(0); toast('Synchronisation demandée à tes appareils');
}

const syFmt = n => n >= 1e9 ? (n / 1e9).toFixed(1).replace('.', ',') + ' Go' : n >= 1e6 ? Math.round(n / 1e6) + ' Mo' : Math.round(n / 1e3) + ' Ko';
async function syAccountDialog() {
  if (!SY.cfg) {
    /* Un vrai formulaire de connexion, pour que les gestionnaires de mots de passe (1Password, Bitwarden, trousseau iCloud,
       Chrome…) le reconnaissent : <form> envoyé, champs nommés, « username » / « current-password » pour se connecter,
       « new-password » (avec ses règles) pour créer un compte, afin qu'ils proposent d'en générer un et de l'enregistrer. */
    const url0 = PREF.get('sync2Url', SYNC_URL_DEFAULT);
    let mode = 'login';
    const body = `<p class="sy-p">Votre compte relie vos appareils : une photo retouchée ici arrive sur les autres.</p>
      <form id="syForm" class="sy-form" method="post" action="#" autocomplete="on" novalidate>
      <div class="sy-mode" role="tablist" aria-label="Compte"><button type="button" role="tab" data-m="login" aria-selected="true">Se connecter</button><button type="button" role="tab" data-m="signup" aria-selected="false">Créer un compte</button></div>
      ${SYNC_URL_DEFAULT ? '' : `<label class="sy-f"><span>Serveur</span><input id="syUrl" name="server" type="url" placeholder="Vide : compte d’essai" value="${esc(url0.startsWith('local:') ? '' : url0)}" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore></label><p class="sy-note">Bêta : sans serveur, le compte est créé en essai, sur cet appareil. Pas encore de synchronisation.</p>`}
      <label class="sy-f"><span>E-mail</span><input id="syEmail" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" required value="${esc(PREF.get('sync2Email', ''))}"></label>
      <label class="sy-f"><span>Mot de passe</span><input id="syPw" name="password" type="password" autocomplete="current-password" minlength="8" required passwordrules="minlength: 8;"></label>
      <p class="sy-hint" id="syHint" hidden>8 caractères minimum. Votre gestionnaire de mots de passe peut en proposer un.</p>
      <button type="submit" class="sy-submit" tabindex="-1" aria-hidden="true">Valider</button>
      </form>
      <p class="sy-err" id="syErr" role="alert"></p>`;
    const run = dl => {
      const url = SYNC_URL_DEFAULT || (($('#syUrl', dl) || {}).value || '').trim() || SY_ESSAI, email = $('#syEmail', dl).value.trim(), pw = $('#syPw', dl).value, er = $('#syErr', dl);
      if (!email || !/.+@.+/.test(email)) { er.textContent = 'Entrez votre adresse e-mail'; $('#syEmail', dl).focus(); return }
      if (pw.length < 8) { er.textContent = 'Le mot de passe fait au moins 8 caractères'; $('#syPw', dl).focus(); return }
      PREF.set('sync2Url', url); PREF.set('sync2Email', email);
      er.textContent = mode === 'signup' ? 'Création du compte…' : 'Connexion…';
      syConnect(mode, url, email, pw).then(() => { closeDialog(); toast(mode === 'signup' ? 'Compte créé : cet appareil est relié' : 'Connecté : la synchronisation démarre') })
        .catch(e => { er.textContent = e.message || 'Connexion impossible' });
    };
    const setMode = (dl, m) => {
      mode = m; const pw = $('#syPw', dl);
      pw.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
      $('#syHint', dl).hidden = m !== 'signup';
      dl.querySelectorAll('.sy-mode [data-m]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.m === m)));
      const ok = dl.querySelector('.foot .btn.primary'); if (ok) ok.textContent = m === 'signup' ? 'Créer le compte' : 'Se connecter';
      $('#syErr', dl).textContent = '';
    };
    dialog({ title: 'Compte Prism', body, buttons: [{ label: 'Annuler' }, { label: 'Se connecter', primary: true, onClick: dl => { const f = $('#syForm', dl); if (f.requestSubmit) f.requestSubmit(); else run(dl); return false } }],
      onOpen: dl => {
        const f = $('#syForm', dl); f.addEventListener('submit', e => { e.preventDefault(); run(dl) });
        dl.querySelector('.sy-mode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { setMode(dl, b.dataset.m); $(b.dataset.m === 'signup' || !$('#syEmail', dl).value ? '#syEmail' : '#syPw', dl).focus() } });
        const e0 = $('#syEmail', dl); (e0.value ? $('#syPw', dl) : e0).focus();
      } });
    return;
  }
  const dl = dialog({ title: 'Compte Prism', body: `<div id="syProf" class="sy-prof"></div>${syEssai() ? '<p class="sy-note">Compte d’essai, sur cet appareil seulement.</p>' : ''}<div id="syInfo" class="sy-info">Chargement…</div>`,
    buttons: [{ label: 'Fermer' }, { label: 'Se déconnecter', onClick: () => { syLogout().then(() => toast('Déconnecté : cet appareil ne se synchronise plus')) } }, { label: 'Synchroniser maintenant', primary: true, onClick: () => { sySyncNow(); return false } }] });
  const fill = async () => {
    const box = $('#syInfo', dl); if (!box) return;
    let me = null, use = null; try { [me, use] = await Promise.all([syApi('/v1/me'), syApi('/v1/usage')]) } catch (e) { box.textContent = e.message; return }
    syProfFill($('#syProf', dl), me);
    const on = new Set(SY.peers.map(p => p.device));
    box.innerHTML = `<div class="sy-h">Appareils</div>${me.devices.map(d => `<div class="sy-dev"><span class="sy-dot${d.id === SY.cfg.device || on.has(d.id) ? ' on' : ''}"></span><b>${esc(d.name)}</b>${d.id === SY.cfg.device ? '<small>cet appareil</small>' : `<small>${on.has(d.id) ? 'allumé' : 'vu ' + esc(window.PrismHome ? PrismHome.rel(d.last) : new Date(d.last).toLocaleString('fr-FR'))}</small><button class="btn sm" data-rm="${esc(d.id)}">Retirer</button>`}</div>`).join('')}
      ${syEssai() ? '' : `<div class="sy-h">Transit Cloudflare</div><div class="sy-bar"><i style="width:${Math.min(100, 100 * use.used / use.limit).toFixed(1)}%"></i></div><small class="sy-u">${syFmt(use.used)} sur ${syFmt(use.limit)} · effacé dès réception, ${use.hours} h au plus</small>`}
      <div class="sy-h">Cet appareil</div><small class="sy-u">${SY.state === 'ok' ? 'À jour' : SY.state === 'busy' ? 'Synchronisation…' : esc(SY.msg || 'En attente')}${SY.out.length ? ` · ${SY.out.length} envoi${SY.out.length > 1 ? 's' : ''} en attente` : ''}</small>`;
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { if (!await askConfirm('Retirer cet appareil du compte ? Il ne recevra plus rien.', { title: 'Retirer l’appareil', ok: 'Retirer', danger: true })) return syAccountDialog(); await syApi('/v1/devices/' + encodeURIComponent(b.dataset.rm), { method: 'DELETE' }).catch(e => toast(e.message)); syAccountDialog() });
  };
  fill(); const h = () => fill(); document.addEventListener('prism-sync', h); document.addEventListener('prism-peers', h);
  new MutationObserver((_, o) => { if (!dl.isConnected) { document.removeEventListener('prism-sync', h); document.removeEventListener('prism-peers', h); o.disconnect() } }).observe(document.body, { childList: true });
}
(() => {
  const st = document.createElement('style'); st.textContent = `
.sy-p{margin:0 0 12px;color:var(--fg-2);line-height:1.45;max-width:440px}
.sy-form{margin:0}.sy-mode{display:inline-flex;gap:2px;padding:2px;margin:0 0 12px;border-radius:9px;background:var(--chrome-2)}.sy-mode button{height:28px;padding:0 12px;border:0;border-radius:7px;background:none;color:var(--fg-3);font:500 12.5px var(--ui);cursor:pointer}.sy-mode button[aria-selected=true]{background:var(--raise);color:var(--fg);box-shadow:var(--shadow-s)}.sy-hint{margin:-4px 0 10px;font-size:12px;color:var(--fg-3)}.sy-submit{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);border:0}.sy-f{display:grid;gap:4px;margin:0 0 10px}.sy-f span{font-size:12px;color:var(--fg-2)}.sy-f input{height:34px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--chrome);color:var(--fg);font:inherit}
.sy-err{min-height:18px;margin:0;color:var(--danger,#c33);font-size:12.5px}
.sy-info{display:grid;gap:6px;min-width:min(420px,78vw)}.sy-h{margin-top:8px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--fg-2)}
.sy-dev{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:var(--chrome-2)}.sy-dev b{font-weight:600}.sy-dev small{color:var(--fg-2);margin-right:auto}
.sy-dot{width:8px;height:8px;border-radius:50%;background:var(--line-2,#bbb)}.sy-dot.on{background:#2fb36b}
.sy-bar{height:6px;border-radius:3px;background:var(--chrome-2);overflow:hidden}.sy-bar i{display:block;height:100%;background:var(--accent)}
.sy-u{color:var(--fg-2)}`; document.head.appendChild(st);
  const mi = MENU2.file.items; MENU2.file.items = () => { const a = mi(); a.push(SEP, MI(SY.cfg ? 'Compte Prism…' : 'Se connecter à son compte Prism…', { fn: syAccountDialog }), MI('Synchroniser maintenant', { fn: sySyncNow, dis: !SY.cfg })); return a };
  window.PrismSync = { push: pid => { if (SY.cfg) syEnqueue('put', pid, true) }, api: syApi, kick: () => syKick(0), dialog: syAccountDialog, now: sySyncNow, connect: syConnect, logout: syLogout, run: syRun, signal: sySignal, get state() { return { ...SY, cfg: SY.cfg && { ...SY.cfg, token: undefined } } }, _SY: SY };
  if (SY.cfg) { syLive(); syKick(1500) }
})();
