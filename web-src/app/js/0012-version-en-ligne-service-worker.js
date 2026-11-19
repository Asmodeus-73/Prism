/* ===== Version en ligne : service worker (web-src/sw.js) =====
   Isolation de la page (l'IA sur plusieurs fils), mode hors ligne, cache des modèles d'IA.
   Pas dans l'app de bureau, ni dans un cadre. */
(()=>{
if(window.__TAURI__||!('serviceWorker' in navigator)||!window.isSecureContext||window.top!==window)return;
// automated tests (navigator.webdriver) get it only when they ask for it (tests/hors-ligne.mjs)
if(navigator.webdriver&&!/[?&]sw=1\b/.test(location.search))return;
// The first visit has no worker yet: the page reloads once to get the headers, unless the
// person has already started (a click or a key), in which case isolation comes next visit.
let touched=false;const touch=()=>{touched=true};
addEventListener('pointerdown',touch,{once:true,capture:true});addEventListener('keydown',touch,{once:true,capture:true});
const KEY='prism-sw-reload';
navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{
  if(self.crossOriginIsolated){try{sessionStorage.removeItem(KEY)}catch(e){}return}
  let tried=false;try{tried=sessionStorage.getItem(KEY)==='1'}catch(e){tried=true}
  if(tried||touched)return;
  const go=()=>{if(touched)return;try{sessionStorage.setItem(KEY,'1')}catch(e){return}location.reload()};
  if(navigator.serviceWorker.controller)go();else navigator.serviceWorker.addEventListener('controllerchange',go,{once:true});
}).catch(()=>{});
})();
