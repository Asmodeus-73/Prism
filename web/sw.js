// Prism online: service worker (web-src/sw.js, copied to web/sw.js by web-src/build.mjs).
// - Cross-origin isolation: GitHub Pages cannot send COOP/COEP headers, so this worker adds
//   them to every page and file of Prism. The AI then runs on several processor threads.
// - Offline: each file is fetched from the network first, and kept for when there is none.
// - AI models: kept in their own cache under their SHA-256, so a model is downloaded once
//   and replaced only when its file changes.
// Not used by the desktop app (it has its own headers and files).
const VERSION = '1.0.2-5ca1a2784a9e';
const APP = 'prism-app-' + VERSION;
const MODELS = 'prism-models';
const MODEL_HASH = {"ai/ade1/0.wasm":"0af91597fb69c80d718c9ea42e7edf9e0e85afaf3e6dc37e6f151060f54b1fdb","ai/ade1/1.wasm":"86937d275e38ee5b43307f7af6d8a827ec52e376dc5acbca240f879c2fe7ddc4","ai/ade1/2.wasm":"63dd560efe331596f74869dc976b057112bf46258014453e7e04d7f5e89bc282","ai/ade1/3.wasm":"a409a217dd9f5fbc3920b903f88624584c0587c5239ee5e602b1f70d5af1c449","ai/ade1/4.wasm":"ea5c4de6c824ca95fee5a32a8d1044f5338b83a9793623c3043f113bbd8b1625","ai/ade1/5.wasm":"90311dcff72bd6ce7397124eb066c5d12dfcbe46a5a38cfa1cf197ab75579945","ai/ade1/6.wasm":"18449324b99e96202e4ca72e53f354c46214957eb938c501fd20790427b818d2","ai/ade1/7.wasm":"9cdb01e409aac1beee4fc74d99003ea9133e3c1495cfc149d5618ed472320975","ai/aidenoise/0.wasm":"5c9b86c7c1d27fca26d5e6ab28226c3d7d34939d26a5f571b13bb55c182c646b","ai/aidenoise/1.wasm":"3eda71a779519758605445edcfa569b2b2112ebb8117a6e0a9b88a4ee31e4045","ai/aidenoise/2.wasm":"02124eb23eeb57c57e61fef78139c366fb5f03d58ec52deca7219c36a7dcdebb","ai/aidenoise/3.wasm":"b7392c484e7a9f33f45bb75bb21b40b0bee32bee8e706da03a531ca21e9077a2","ai/depth1/0.wasm":"7e4cfdb85155c821106132e6db199fb08ba0ff386869fa3e5c40e1fc3e2a30bb","ai/depth1/1.wasm":"ad38a8c04adc1e9c31872137afaf552febb566660f3a3f2452da1b3d99acee4f","ai/depth1/2.wasm":"8353daf0221007d7c8ae45422acbe7d5b44e115ebb46ba820fb7d40774d710f6","ai/depth1/3.wasm":"50138ecbcf76c7f5299aaf5cf8788daa5255d43808e087241d89cc2f18d5b84c","ai/depth1/4.wasm":"5009c55bb3ebbcc1d9dc965e159410a918f6128229d7854afa438fe2dc6268e4","ai/esrgan4p/0.wasm":"fe12ebdc5022085b2713c30d3fbdfd15e2d023af45c24a678cfc34af5d626e30","ai/esrgan4p/1.wasm":"406b869b329c748ecfd108fe69c20fafe63e346b08ddf6b4971af2bc5e2c86a7","ai/esrgan4p/2.wasm":"c683e0d05a194ce27ac3985029a4b6ee67391bd33d50ce9d814bdc006048c081","ai/face1/0.wasm":"8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4","ai/isnet2/0.wasm":"880bcea52fa0ace1c1cf4f4f858f69130a7d4b142c8ea9fb097be60f9e226998","ai/isnet2/1.wasm":"b35b7628f02e20d118db0ed25c257feb0aa87f722991457807893aa1303d3800","ai/isnet2/2.wasm":"52ef1bb2abd65255b130da39b5c7d6d61df5e62101c25b1ade9c41dc60259d54","ai/isnet2/3.wasm":"39de58ea8195ed34b10efa90ca1ffa87357f8e59b63ee0c54313d1c0544e66f1","ai/isnet2/4.wasm":"b4fb42d1f2082ba2ba9a2f5b92724046341eb184caf7f2a27f8a337d66c330a9","ai/isnet2/5.wasm":"9571b896b65c13b1ef3fef4202b7598f666e87d1f39a5f2ca2d8c99bd982487c","ai/isnet2/6.wasm":"def7047925c988a719099ad9aac2c429532990bbcb135725103aa8161ed57792","ai/isnet2/7.wasm":"75cb7609b73afde5b8d55615e9bb67da09980768592f260b5ddbf7ebe9c0f4c5","ai/isnet2/8.wasm":"cdcda495717592e1532d4749a3eea28d757c5233808db5b755e604605d2fb26b","ai/lama/0.wasm":"bb401c72cdf9dcd8a2c73b67f8dc10f12e6d350662ca2785cb9fdec41f816668","ai/lama/1.wasm":"d5cbab76665da2ae8fc6812afaecb2f92388f38f02848e14bed7f1cf839e9dae","ai/lama/2.wasm":"b15549ae42057c7bc0d3e0ac970419151854acb4bf6ffbc0c0cbe10e3c0c8c70","ai/lama/3.wasm":"f5971f1fd812c6e4d7699eea9977b4092b6abb47f0694b7588798675540d9c19","ai/lama/4.wasm":"3bdadcc0cbe8055427eefa2f5c93497b3468cd56c87b700d0f94a12f9747d4df","ai/migan/0.wasm":"f36b2e3f2d96c191034dc417ff60ed4e10d4d00f9b331f7aba7db30133cc0fc3","ai/migan/1.wasm":"e61c65af65492b6142133cfead7d3105f09f103329e7d8fdb097a0d6facfa4b1","ai/ortgpu/0.wasm":"f5039287e2f19cf4a2b22a782dc85b347671dd61d1ad2323faf13c78312d79bc","ai/ortgpu/1.wasm":"35d749102340296224763938e0e7a4c650010970ce0fb407e46ec65c57f40fd2","ai/ortgpu/2.wasm":"740e7559572c9374b3bfd51be5542cce66361f549e9b7018bc4b70b14c5e163f","ai/people1/0.wasm":"a0ba864a277d3538307af039ee5d227361b183d44eb737bc05c0a65e4a1329fa","ai/realesr/weights.wasm":"c391666ecf3efd4294923e48906a7e5684d788f10e91bdee7c5c6ad4883027e7","ai/sam2t-dec/0.wasm":"a31104388b2b43afa51296e4deb89433502dc5a41a07fd5effa72dea46504c30","ai/sam2t-enc/0.wasm":"fc1b0f5fdd04faa2bcd7bb0e2c3a73ae68a032856e090919de275eddab638e22","ai/sam2t-enc/1.wasm":"a5796890c5a3346d9d7733b00df7e025d699599f38be1d13faebc9edfcb02417","ai/sam2t-enc/2.wasm":"ef139d0c6014d8312c54899cef53c5d7c54eb584c7839032a4c07e55571b5228","ai/sam2t-enc/3.wasm":"8f6d109b36e7a5d6ae49da029b309d58866acba73effdfae9488d61ea3be4a71","ai/sam2t-enc/4.wasm":"276bbb11aae413b4067b1bcd9f481abdc538847214419fd17efe81b1215e6435","ai/up-compact1/0.wasm":"d9e94391a7c996336d1dbccd69e886684ddedcd71b2d720b66abced5ce7c4ee8","ai/up-x4p1/0.wasm":"efe8a3a6d94a3d3cfda669263a8f87ebadfb5be1adbde1b4321ef2d082fddee9","ai/up-x4p1/1.wasm":"3463becbaefd517dd40b9ef8ebb803ba637445f8c0bb554804506904ac71af5b","ai/up-x4p1/2.wasm":"6bea5d876bca702691edd88db0a6d0d15f1ddab6f69d788e65634abd8774c28d","ai/up-x4p1/3.wasm":"378660cfd8f49dfdc64e1fff570a3ce48cf892c9b68da4d2d7dc6621cfcaba2e"}; // path relative to the app -> sha256

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
