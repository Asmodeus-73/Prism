// Prism desktop bridge. Loaded before the app: it stands in for the claude.ai
// runtime (window.claude) with native equivalents where the desktop app has one.
(() => {
  const T = window.__TAURI__;
  if (!T) return;
  const invoke = T.core.invoke;

  const toBytes = async (data) =>
    data instanceof Blob ? new Uint8Array(await data.arrayBuffer())
    : data instanceof Uint8Array ? data
    : data instanceof ArrayBuffer ? new Uint8Array(data)
    : new TextEncoder().encode(String(data));

  // Same shape as the claude.ai "downloads" capability: save({filename, data}),
  // rejects with code "declined" when the person cancels the dialog.
  const downloads = {
    async save({ filename, data }) {
      const path = await invoke('save_file', await toBytes(data), {
        headers: { 'x-filename': encodeURIComponent(filename || 'photo') },
      });
      if (path == null) {
        const e = new Error('Enregistrement annulé');
        e.code = 'declined';
        throw e;
      }
      return { path };
    },
  };

  const caps = { downloads };
  window.claude = {
    use: async (name) => {
      if (caps[name]) return caps[name];
      const e = new Error('Indisponible dans l’application de bureau');
      e.code = 'unavailable';
      throw e;
    },
  };
  window.PRISM_DESKTOP = { invoke };
})();
