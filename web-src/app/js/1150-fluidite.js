/* ================= 1.0 : fluidité de la photothèque =================
   La grille ne se redessine pas sous le pointeur : un rendu demandé pendant un clic (vignettes, doublons,
   fin d'enregistrement) attend que le clic soit fini, pour que le double-clic tombe toujours sur la bonne photo. */
(()=>{
const _rl=renderLibrary;let wait=0;
renderLibrary=function(...a){const dt=performance.now()-(LIB._press||0);
  if(LIB.open&&dt<450){clearTimeout(wait);wait=setTimeout(()=>renderLibrary(...a),460-dt);return}
  clearTimeout(wait);return _rl.apply(this,a)};
})();

/* ================= enregistrer une photo importée sans la ré-encoder =================
   Une photo ouverte telle quelle était ré-encodée en tuiles PNG (1,5 à 2 s pour 24 Mpx ici, bien plus sur Mac).
   Tant que le calque n'a pas changé, son « fichier d'origine » suffit : on le garde comme une seule tuile.
   Garde-fou : on vérifie d'abord que le navigateur relit ce fichier exactement comme la photo affichée
   (même taille, même orientation, mêmes couleurs) ; sinon on enregistre comme avant. */
(()=>{
const SRC=new WeakMap(),OK=/^image\/(jpeg|webp|avif|heic|heif|png)$/i;
const _lif=loadImageFile;loadImageFile=async function(file){const im=await _lif.apply(this,arguments);try{if(im&&file)im.__file=file}catch(e){}return im};
async function same(c,bm){const w=64,h=Math.max(1,Math.round(64*c.height/c.width)),a=mk(w,h),b=mk(w,h),ga=cx(a),gb=cx(b);
  ga.drawImage(c,0,0,w,h);gb.drawImage(bm,0,0,w,h);const A=ga.getImageData(0,0,w,h).data,B=gb.getImageData(0,0,w,h).data;let s=0;for(let i=0;i<A.length;i++)s+=Math.abs(A[i]-B[i]);return s/A.length<1.5}
const _sd=setDoc;setDoc=function(src,name,opts){const r=_sd.apply(this,arguments);
  try{const f=src&&src.__file,d=S.doc,L=d&&d.layers[0],c=L&&L.canvas;
    if(f&&c&&!c.__sp&&!L.hi&&(d.space||'srgb')==='srgb'&&c.width===d.w&&c.height===d.h&&OK.test(f.type||'')&&typeof createImageBitmap==='function'){
      const w=c.width,h=c.height;const p=(async()=>{const bm=await createImageBitmap(f);try{if(bm.width!==w||bm.height!==h||!await same(c,bm))return;
          const key='t_'+uid8();pin(key);await IDB.put('blobs',key,f);if(!encCache.get(c))encCache.set(c,[{x:0,y:0,w,h,key}])}finally{bm.close&&bm.close()}})()
        .catch(e=>console.warn('tuile d’origine',e)).finally(()=>SRC.delete(c));SRC.set(c,p)}}catch(e){console.warn(e)}
  return r};
const _ec=encodeCanvas;encodeCanvas=async function(c){const p=SRC.get(c);if(p)await p;return _ec.apply(this,arguments)};
})();

/* ================= la photo d'abord, les vignettes ensuite =================
   À l'ouverture, les vignettes des calques (qui réduisent la photo entière) bloquaient l'affichage :
   pour une nouvelle photo, elles se dessinent juste après la première image à l'écran. */
(()=>{
const _d=drawLayerThumbs;let seen=null,tm=0;
drawLayerThumbs=function(){const d=S.doc;if(d&&d!==seen){clearTimeout(tm);tm=setTimeout(()=>requestAnimationFrame(()=>{seen=S.doc;try{_d()}catch(e){console.warn(e)}}),120);return}return _d.apply(this,arguments)};
})();

/* ================= aperçu rapide : réglable =================
   Pendant un glissé de curseur sur une grosse photo lente, Prism calcule l'image en plus petit (elle paraît floue) puis revient au net.
   Affichage > Aperçu rapide pendant les réglages l'arrête : l'image reste nette, le curseur peut être moins fluide. */
{const _vi=MENU2.view.items;MENU2.view.items=()=>[..._vi(),MI('Affichage économe (plus fluide, moins net)',{check:PREF.get('eco',false),fn:()=>{PREF.set('eco',!PREF.get('eco',false));vrDirty=true;S.contentDirty=true;requestRender();toast(PREF.get('eco',false)?'Affichage économe : la photo est calculée à la taille de l’écran, sans le double de pixels.':'Affichage net rétabli.')}}),MI('Aperçu rapide pendant les réglages',{check:PREF.get('lq',true),fn:()=>{PREF.set('lq',!PREF.get('lq',true));toast(PREF.get('lq',true)?'Aperçu rapide activé.':'Aperçu rapide arrêté : l’image reste nette.')}})]}

/* ================= rendu logiciel : on le dit =================
   Sans carte graphique utilisable (pilote absent, bloqué ou ancien), les réglages et les traits sur une grosse photo passent par le processeur : 10 à 50 fois plus lent.
   Le message s'affiche une fois, à la première photo. */
{const _sd=setDoc;setDoc=function(src,name,opts){const r=_sd.apply(this,arguments);
  try{if(!navigator.webdriver&&!PREF.get('swWarn',0)){setTimeout(()=>{try{const g=window.PrismReport&&PrismReport.gpu&&String(PrismReport.gpu()),soft=!g||/swiftshader|llvmpipe|software|basic render|warp|indisponible/i.test(g)||(typeof GPU!=='undefined'&&GPU.ok===false);
    if(soft&&S.doc){PREF.set('swWarn',Date.now());toast('Prism n’utilise pas la carte graphique ('+(g||'rendu logiciel')+'). Les grosses photos seront lentes. Mettez à jour le pilote de la carte graphique.',12000)}}catch(e){}},2500)}}catch(e){}
  return r}}
