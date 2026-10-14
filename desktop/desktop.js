// Prism desktop bridge. Loaded before the app: it stands in for the claude.ai
// runtime (window.claude) with native equivalents where the desktop app has one.
//   downloads      -> the system save dialog
//   db, assets,    -> a sync folder the person picks (Fichier > Dossier de
//   user              synchronisation), kept in sync between computers by
//                     Syncthing, iCloud Drive or Dropbox
(() => {
  const T = window.__TAURI__;
  if (!T) return;
  const invoke = T.core.invoke;

  // Stored sync files are served by the app at this address (the web version
  // reads them from /_blob/; scripts/prepare.mjs points those reads here).
  window.PRISM_BLOB = T.core.convertFileSrc('', 'prismsync');

  const toBytes = async (data) =>
    data instanceof Blob ? new Uint8Array(await data.arrayBuffer())
    : data instanceof Uint8Array ? data
    : data instanceof ArrayBuffer ? new Uint8Array(data)
    : new TextEncoder().encode(String(data));

  const fail = (message, code) => Object.assign(new Error(message), { code });

  // Same shape as the claude.ai "downloads" capability: save({filename, data}),
  // rejects with code "declined" when the person cancels the dialog.
  const downloads = {
    async save({ filename, data }) {
      const path = await invoke('save_file', await toBytes(data), {
        headers: { 'x-filename': encodeURIComponent(filename || 'photo') },
      });
      if (path == null) throw fail('Enregistrement annulé', 'declined');
      return { path };
    },
  };

  // ---- folder-backed document database (the subset of the claude.ai "db" API Prism uses) ----
  const docSnap = (id, data) => ({
    id,
    exists: data != null,
    data: () => (data == null ? undefined : structuredClone(data)),
  });

  const collections = new Map();
  function collection(path) {
    if (collections.has(path)) return collections.get(path);
    // Shared reviews only make sense on claude.ai: on the desktop the list stays empty.
    const readOnly = path === 'reviews';
    const cache = new Map(); // id -> {mtime, size, data}
    const subs = new Set();
    let timer = null;
    let running = Promise.resolve();

    const snapshot = () => {
      const docs = [...cache.entries()].map(([id, e]) => docSnap(id, e.data));
      return { docs, size: docs.length, empty: !docs.length };
    };
    // Reads only the documents whose file changed since the last look.
    const refresh = async () => {
      if (readOnly) return false;
      const list = await invoke('db_scan', { col: path });
      const seen = new Set();
      let changed = false;
      for (const s of list) {
        seen.add(s.id);
        const c = cache.get(s.id);
        if (c && c.mtime === s.mtime && c.size === s.size) continue;
        const text = await invoke('db_get', { col: path, id: s.id });
        let data;
        try { data = text == null ? null : JSON.parse(text); } catch (e) { continue; } // still syncing
        if (data == null) continue;
        cache.set(s.id, { mtime: s.mtime, size: s.size, data });
        changed = true;
      }
      for (const id of [...cache.keys()]) if (!seen.has(id)) { cache.delete(id); changed = true; }
      return changed;
    };
    const tick = () => (running = running.then(async () => {
      try {
        if (await refresh()) {
          const s = snapshot();
          subs.forEach((sub) => { try { sub.next(s); } catch (e) { console.error(e); } });
        }
      } catch (e) {
        subs.forEach((sub) => sub.error && sub.error(e));
      }
    }));

    const col = {
      doc(id) {
        return {
          id,
          async get() {
            if (readOnly) return docSnap(id, null);
            const text = await invoke('db_get', { col: path, id });
            return docSnap(id, text == null ? null : JSON.parse(text));
          },
          async set(data) {
            if (readOnly) throw fail('Indisponible dans l’application de bureau', 'unavailable');
            await invoke('db_set', { col: path, id, json: JSON.stringify(data) });
            await tick();
          },
          async update(part) {
            const cur = await this.get();
            await this.set({ ...(cur.exists ? cur.data() : {}), ...part });
          },
          async delete() {
            if (readOnly) return;
            await invoke('db_delete', { col: path, id });
            await tick();
          },
        };
      },
      onSnapshot(next, error) {
        const sub = { next, error };
        subs.add(sub);
        running = running.then(async () => {
          try { await refresh(); } catch (e) { error && error(e); }
          if (subs.has(sub)) next(snapshot());
        });
        // Another computer's changes arrive as files: look for them regularly.
        if (!timer && !readOnly) timer = setInterval(tick, 4000);
        return () => {
          subs.delete(sub);
          if (!subs.size && timer) { clearInterval(timer); timer = null; }
        };
      },
    };
    collections.set(path, col);
    return col;
  }
  const db = { collection };

  const assets = {
    async upload(data, opts = {}) {
      const type = opts.type || (data && data.type) || '';
      const id = await invoke('asset_put', await toBytes(data), { headers: { 'x-type': type } });
      return { id };
    },
    async delete(id) { await invoke('asset_delete', { id }); },
    async list() {
      const bytes = await invoke('asset_usage');
      return { usage: { bytes, maxBytes: Math.max(bytes * 2, 1e12) }, assets: [] };
    },
  };

  // The same id on every computer, so they all read the same projects.
  const user = {
    id: async () => 'desktop',
    isOwner: async () => false,
  };

  const syncFolder = invoke('sync_folder').catch(() => null);
  const caps = { downloads };
  const synced = { db, assets, user };

  window.claude = {
    use: async (name) => {
      if (caps[name]) return caps[name];
      if (synced[name] && (await syncFolder)) return synced[name];
      throw fail('Indisponible dans l’application de bureau', 'unavailable');
    },
  };

  // ---- Fichier > Dossier de synchronisation… ----
  async function syncDialog() {
    const folder = await invoke('sync_folder').catch(() => null);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const body = folder
      ? `<p>Vos projets synchronisés sont enregistrés dans :</p><p><b>${esc(folder)}</b></p>
         <p class="muted">Pour les retrouver sur votre autre ordinateur, synchronisez ce dossier (Syncthing, iCloud Drive ou Dropbox) et choisissez-le aussi dans Prism sur l’autre ordinateur.</p>`
      : `<p>Choisissez un dossier que vous synchronisez entre vos ordinateurs (avec Syncthing, iCloud Drive ou Dropbox).</p>
         <p class="muted">Prism y enregistrera vos projets avec leurs calques. Choisissez le même dossier dans Prism sur l’autre ordinateur. Si un projet est ouvert sur les deux à la fois, Prism vous prévient, et ne remplace jamais une version par une autre.</p>`;
    const choose = async () => {
      const chosen = await invoke('sync_choose').catch((e) => { toast('Dossier impossible à utiliser : ' + e, 6000); return null; });
      if (chosen) location.reload();
    };
    const stop = async () => { await invoke('sync_stop'); location.reload(); };
    dialog({
      title: 'Dossier de synchronisation',
      body,
      // "Fermer" first: clicking outside the dialog runs the first button.
      buttons: [
        { label: 'Fermer' },
        ...(folder ? [{ label: 'Arrêter la synchronisation', onClick: () => { stop(); } }] : []),
        { label: folder ? 'Changer de dossier…' : 'Choisir un dossier…', primary: true, onClick: () => { choose(); } },
      ],
    });
  }

  addEventListener('DOMContentLoaded', () => {
    try {
      const items = MENU2.file.items;
      MENU2.file.items = () => {
        const a = items();
        a.push(SEP, MI('Dossier de synchronisation…', { icon: 'cloud', fn: syncDialog }));
        return a;
      };
    } catch (e) {
      console.warn('menu', e);
    }
  });

  // ---- automatic updates: offered a few seconds after launch, like a game launcher ----
  async function checkUpdate(manual) {
    let found = null;
    try { found = await invoke('update_check'); } catch (e) {
      if (manual) toast('Impossible de vérifier les mises à jour : ' + e, 6000);
      return;
    }
    if (!found) { if (manual) toast('Prism est à jour.'); return; }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const notes = found.notes && found.notes.trim() ? `<p class="muted" style="white-space:pre-wrap">${esc(found.notes.trim())}</p>` : '';
    const install = async () => {
      try { if (typeof flushSave === 'function') await flushSave(); } catch (e) {}
      busy(true, 'Installation de la mise à jour…', null);
      try { await invoke('update_install'); } catch (e) { busy(false); toast(String(e), 6000); }
    };
    dialog({
      title: 'Nouvelle version disponible',
      body: `<p>Prism ${esc(found.version)} est disponible (vous avez la ${esc(found.current)}).</p>${notes}
             <p class="muted">Votre travail est enregistré avant l’installation, puis Prism se relance tout seul.</p>`,
      buttons: [
        { label: 'Plus tard' },
        { label: 'Installer et relancer', primary: true, onClick: () => { install(); } },
      ],
    });
  }
  addEventListener('load', () => setTimeout(() => checkUpdate(false), 5000));

  addEventListener('DOMContentLoaded', () => {
    try {
      const items = MENU2.help.items;
      MENU2.help.items = () => {
        const a = items();
        a.push(SEP, MI('Rechercher une mise à jour…', { fn: () => checkUpdate(true) }));
        return a;
      };
    } catch (e) {
      console.warn('menu', e);
    }
  });

  window.PRISM_DESKTOP = { invoke, syncDialog, checkUpdate };
})();
