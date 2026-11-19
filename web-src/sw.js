// Prism online: service worker (web-src/sw.js, copied to web/sw.js by web-src/build.mjs).
// - Cross-origin isolation: GitHub Pages cannot send COOP/COEP headers, so this worker adds
//   them to every page and file of Prism. The AI then runs on several processor threads.
// - Offline: each file is fetched from the network first, and kept for when there is none.
// - AI models: kept in their own cache under their SHA-256, so a model is downloaded once
//   and replaced only when its file changes.
// Not used by the desktop app (it has its own headers and files).
const VERSION = '@@VERSION@@';
const APP = 'prism-app-' + VERSION;
const MODELS = 'prism-models';
const MODEL_HASH = @@MODELS@@; // path relative to the app -> sha256

const isolate = (res) => {
  if (!res || res.status === 0 || res.type === 'opaque' || res.type === 'opaqueredirect') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('prism-app-') && k !== APP) await caches.delete(k);
  const keep = new Set(Object.values(MODEL_HASH));
  const models = await caches.open(MODELS);
  for (const req of await models.keys()) if (!keep.has(new URL(req.url).pathname.split('/').pop())) await models.delete(req);
  await self.clients.claim();
})()));

const scope = () => new URL(self.registration.scope).pathname;

async function model(req, hash) {
  const cache = await caches.open(MODELS);
  const key = new URL(scope() + '__model/' + hash, self.location.origin).href;
  const hit = await cache.match(key);
  if (hit) return isolate(hit);
  const res = await fetch(req);
  if (res.ok && res.status === 200) await cache.put(key, res.clone()).catch(() => {});
  return isolate(res);
}

async function file(req) {
  const cache = await caches.open(APP);
  try {
    const res = await fetch(req);
    if (res.ok && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    return isolate(res);
  } catch (err) {
    const hit = await cache.match(req) || (req.mode === 'navigate' ? await cache.match(scope() + 'index.html') || await cache.match(scope()) : null);
    if (hit) return isolate(hit);
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope())) return;
  if (req.cache === 'no-store') { e.respondWith(fetch(req).then(isolate)); return; }
  const hash = MODEL_HASH[decodeURIComponent(url.pathname.slice(scope().length))];
  e.respondWith(hash ? model(req, hash) : file(req));
});
