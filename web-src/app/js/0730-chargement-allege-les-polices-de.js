/* ===== wave27: chargement allégé. Les polices de texte ne sont téléchargées qu'à la première utilisation ===== */
(()=>{
const LAZY={'Newsreader':'family=Newsreader:ital,opsz,wght@1,6..72,500','Playfair Display':'family=Playfair+Display:wght@700','Bebas Neue':'family=Bebas+Neue','Caveat':'family=Caveat:wght@600'};
const pend={};
function ensureFamily(name){
  const q=LAZY[name];if(!q)return Promise.resolve();
  if(pend[name])return pend[name];
  return pend[name]=new Promise(res=>{
    const l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?'+q+'&display=swap';
    l.onload=()=>res();l.onerror=()=>res();document.head.appendChild(l);
    setTimeout(res,4000);
  });
}
window.ensureTextFonts=()=>Promise.all(Object.keys(LAZY).map(ensureFamily));
const fam=f=>{const m=/"([^"]+)"/.exec(f);return m?m[1]:''};
const _load=document.fonts.load.bind(document.fonts);
document.fonts.load=function(f,t){
  const n=fam(f);
  if(LAZY[n])return ensureFamily(n).then(()=>_load(f,t));
  return _load(f,t);
};
// un calque texte rendu avant que sa police soit arrivée : on le redessine à l'arrivée
const _draw=drawTextTo;
drawTextTo=function(c,t){
  const n=t&&t.font;
  if(LAZY[n]&&!pend[n]){ensureFamily(n).then(()=>{try{document.fonts.load(fontOf(t),t.text||'A').then(()=>{try{render()}catch(e){}})}catch(e){}})}
  return _draw(c,t);
};
})();

