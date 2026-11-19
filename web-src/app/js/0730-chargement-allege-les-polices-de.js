/* ===== wave27: chargement allégé. Les polices de texte ne sont téléchargées qu'à la première utilisation ===== */
(()=>{
// fonts/fonts.css (loaded by the page) declares them: a face is downloaded the first time it is drawn.
const LAZY={'Newsreader':'italic 500','Playfair Display':'700','Bebas Neue':'400','Caveat':'600'};
const pend={};
function ensureFamily(name){
  const q=LAZY[name];if(!q)return Promise.resolve();
  if(pend[name])return pend[name];
  return pend[name]=Promise.race([FontFaceSet.prototype.load.call(document.fonts,q+' 16px "'+name+'"').catch(()=>{}),new Promise(res=>setTimeout(res,4000))]);
}
window.ensureTextFonts=()=>Promise.all(Object.keys(LAZY).map(ensureFamily));
const fam=f=>{const m=/"([^"]+)"/.exec(f);return m?m[1]:''};
const _load=document.fonts.load.bind(document.fonts);
document.fonts.load=function(f,t){
  const n=fam(f);
  if(LAZY[n])return ensureFamily(n).then(()=>_load(f,t));
  return _load(f,t);
};
// redraws, in place (same canvas, so history stays consistent; no new step), the text layers drawn in the fallback font
function redrawFont(n){const d=S.doc;let k=0;if(d)for(const L of d.layers){const sp=!L.preview&&L.txt&&L.txt.font===n&&spOf(L);if(sp){const c=mk(d.w,d.h),bb=drawTextTo(c,L.txt);spReplace(sp,c);L.txt=Object.assign({},L.txt,{bbox:bb});k++;continue}
  if(!L.txt||L.txt.font!==n||L.preview||!L.canvas||L.canvas.width!==d.w||L.canvas.height!==d.h)continue;const bb=drawTextTo(L.canvas,L.txt);L.txt=Object.assign({},L.txt,{bbox:bb});encCache.delete(L.canvas);L.canvas._v=(L.canvas._v|0)+1;k++}
  if(k){markComp();scheduleSave()}else render()}
// un calque texte rendu avant que sa police soit arrivée : on le redessine à l'arrivée
const _draw=drawTextTo;
drawTextTo=function(c,t){
  const n=t&&t.font;
  if(LAZY[n]&&!pend[n]){ensureFamily(n).then(()=>{try{document.fonts.load(fontOf(t),t.text||'A').then(()=>{try{redrawFont(n)}catch(e){}})}catch(e){}})}
  return _draw(c,t);
};
})();

