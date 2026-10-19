/* ===== fx_filters: audit du menu Filtre, des effets modifiables, des actions et des photos multiples ===== */
(()=>{
const px=s=>rx(s).getImageData(0,0,s.width,s.height);
const put=(w,h,im)=>{const c=mk(w,h);rx(c).putImageData(im,0,0);return c};
const rad=a=>a*Math.PI/180;
const luma=(d,i)=>d[i]*.299+d[i+1]*.587+d[i+2]*.114;
const kOf=d=>d?Math.max(1,Math.max(d.w,d.h)/2400):1;
function padEdge(src,p){const w=src.width,h=src.height,big=mk(w+2*p,h+2*p),b=cx(big);b.drawImage(src,p,p);b.drawImage(src,0,0,1,h,0,p,p,h);b.drawImage(src,w-1,0,1,h,w+p,p,p,h);b.drawImage(big,0,p,w+2*p,1,0,0,w+2*p,p);b.drawImage(big,0,h+p-1,w+2*p,1,0,h+p,w+2*p,p);return big}
const REC=()=>window.PrismC&&window.PrismC.REC;
/* remplace le calcul d'un filtre en gardant ce que les vagues précédentes y ajoutent (derniers réglages, enregistrement des actions) */
const hook=(id,impl)=>{const F=FILTERS[id];if(!F)return;F.run=function(s,p){F._lp={...p};const R=REC();if(R)R.last={id,p:{...p}};return impl(s,p)}};

/* ---------- libellés des réglages 0/1 : cases à cocher plutôt que curseurs ---------- */
FILTERS.noise.params[1][1]='Monochrome';
FILTERS.halftone.params[2][1]='Couleur';
FILTERS.edges.params[1][1]='Style';
const EDGE_STYLES=['Traits clairs sur noir','Traits sombres sur blanc','Traits sur l’image'];

/* ---------- les réglages en pixels suivent la résolution de la photo, partout (boîte de filtre, effets du calque) ---------- */
{const cache=new WeakMap();
 Object.keys(FILTERS).forEach(id=>{const F=FILTERS[id];let base=F.params;
  Object.defineProperty(F,'params',{configurable:true,enumerable:true,
   get(){const k=kOf(S.doc);if(k===1)return base;let m=cache.get(F);if(!m)cache.set(F,m=new Map());const key=Math.round(k*100);let r=m.get(key);
    if(!r){r=base.map(q=>{q=q.slice();if(q[7]){q[3]=Math.round(q[3]*k);q[5]=Math.round(q[5]*k)}return q});m.set(key,r)}return r},
   set(v){base=v;cache.delete(F)}})})}

/* ---------- Réduction du bruit : « Préserver les détails » était inversé (100 % lissait le plus) ---------- */
hook('denoise',(s,p)=>{const w=s.width,h=s.height,c=cloneC(s),g=rx(c),img=g.getImageData(0,0,w,h),a=img.data,b=rx(blurCanvas(s,1.4)).getImageData(0,0,w,h).data,k=p.a/100,e3=3*(4+(100-p.d)*0.6);
  for(let i=0;i<a.length;i+=4){const df=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);let wt=1-df/e3;if(wt<=0)continue;wt*=k;
    a[i]+=(b[i]-a[i])*wt;a[i+1]+=(b[i+1]-a[i+1])*wt;a[i+2]+=(b[i+2]-a[i+2])*wt}
  g.putImageData(img,0,0);return c});

/* ---------- Ajout de bruit : graine fixe, l'aperçu = le résultat, et un effet modifiable ne change plus de grain à chaque recalcul ---------- */
{const F=FILTERS.noise,W=F.run;
 F.run=function(s,p){if(p.seed==null)p.seed=(Math.random()*4294967296)>>>0;let t=p.seed>>>0;const mr=Math.random;
  Math.random=()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r=(r+Math.imul(r^(r>>>7),61|r))^r;return((r^(r>>>14))>>>0)/4294967296};
  try{return W.call(this,s,p)}finally{Math.random=mr}}}

/* ---------- Demi-teinte : la trame ne remplit plus les zones transparentes ---------- */
{const F=FILTERS.halftone,W=F.run;
 F.run=function(s,p){const o=W.call(this,s,p),g=cx(o);g.globalCompositeOperation='destination-in';g.drawImage(s,0,0);g.globalCompositeOperation='source-over';return o}}

/* ---------- Relief : direction continue (la direction n'avait que 8 positions) et épaisseur proportionnelle à la résolution ---------- */
hook('emboss',(s,p)=>{const w=s.width,h=s.height,d=px(s),a=d.data,L=new Float32Array(w*h);for(let i=0;i<w*h;i++)L[i]=luma(a,i*4);
  const R=1.2*kOf({w,h}),dx=Math.cos(rad(p.ang))*R,dy=Math.sin(rad(p.ang))*R,k=p.d/20,cc=p.c/100;
  const at=(x,y)=>{x=x<0?0:x>w-1?w-1:x;y=y<0?0:y>h-1?h-1:y;const x0=x|0,y0=y|0,x1=x0+1<w?x0+1:x0,y1=y0+1<h?y0+1:y0,fx=x-x0,fy=y-y0;
    return(L[y0*w+x0]*(1-fx)+L[y0*w+x1]*fx)*(1-fy)+(L[y1*w+x0]*(1-fx)+L[y1*w+x1]*fx)*fy};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=128+(at(x+dx,y+dy)-at(x-dx,y-dy))*k,j=(y*w+x)*4,f=v/128;
    a[j]=a[j]*cc*f+v*(1-cc);a[j+1]=a[j+1]*cc*f+v*(1-cc);a[j+2]=a[j+2]*cc*f+v*(1-cc)}
  return put(w,h,d)});

/* ---------- Flous directionnels : moyenne par doublement (jusqu'à 512 échantillons au lieu de 48 copies espacées) ---------- */
const avg2=(cur,w,h,draw)=>{const o=mk(w,h),g=cx(o);g.drawImage(cur,0,0);g.globalAlpha=.5;draw(g);g.globalAlpha=1;return o};
hook('motion',(s,p)=>{const w=s.width,h=s.height,len=Math.max(1,p.len),pd=Math.ceil(len/2)+2,ca=Math.cos(rad(p.ang)),sa=Math.sin(rad(p.ang));
  const m=Math.max(1,Math.min(9,Math.ceil(Math.log2(len+1)))),N=1<<m,sp=len/(N-1);let cur=padEdge(s,pd);const W=cur.width,H=cur.height;
  for(let i=0;i<m;i++){const o=sp*(1<<i),ox=o*ca,oy=o*sa;cur=avg2(cur,W,H,g=>g.drawImage(cur,ox,oy))}
  const out=mk(w,h);cx(out).drawImage(cur,-len/2*ca-pd,-len/2*sa-pd);
  /* le décalage -len/2 est appliqué en sens inverse : A(x') = moyenne de cur(x'-j.sp), on veut cur(x+len/2-j.sp) */
  return out});
hook('zoomblur',(s,p)=>{const w=s.width,h=s.height,cxp=w*p.x/100,cyp=h*p.y/100,m=p.a>=30?7:6,N=1<<m,r=Math.pow(1+p.a/100,1/(N-1));let cur=s;
  for(let i=0;i<m;i++){const f=Math.pow(r,1<<i);cur=avg2(cur,w,h,g=>{g.imageSmoothingQuality='high';g.drawImage(cur,0,0,w,h,cxp-cxp*f,cyp-cyp*f,w*f,h*f)})}
  return cur});

/* ---------- distorsions : interpolation sur couleurs prémultipliées (sinon un halo sombre borde les calques détourés) ---------- */
function warp2(src,map){const w=src.width,h=src.height,sd=px(src).data,o=new ImageData(w,h),od=o.data,q=[0,0];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){map(x,y,q);let sx=q[0],sy=q[1];if(sx<0)sx=0;else if(sx>w-1)sx=w-1;if(sy<0)sy=0;else if(sy>h-1)sy=h-1;
    const x0=sx|0,y0=sy|0,x1=x0+1<w?x0+1:x0,y1=y0+1<h?y0+1:y0,fx=sx-x0,fy=sy-y0,a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4,j=(y*w+x)*4;
    const a0=sd[a+3]*(1-fx)*(1-fy),a1=sd[b+3]*fx*(1-fy),a2=sd[c+3]*(1-fx)*fy,a3=sd[d+3]*fx*fy,A=a0+a1+a2+a3;if(A<=0)continue;
    od[j]=(sd[a]*a0+sd[b]*a1+sd[c]*a2+sd[d]*a3)/A;od[j+1]=(sd[a+1]*a0+sd[b+1]*a1+sd[c+1]*a2+sd[d+1]*a3)/A;od[j+2]=(sd[a+2]*a0+sd[b+2]*a1+sd[c+2]*a2+sd[d+2]*a3)/A;od[j+3]=A}
  return put(w,h,o)}
hook('bulge',(s,p)=>{const w=s.width,h=s.height,cxp=w*p.x/100,cyp=h*p.y/100,R=Math.min(w,h)*p.r/100,a=p.a/100;return warp2(s,(x,y,q)=>{const dx=x-cxp,dy=y-cyp,d=Math.sqrt(dx*dx+dy*dy);if(d>=R){q[0]=x;q[1]=y;return}const t=d/R,f=1-a*(1-t)*(1-t);q[0]=cxp+dx*f;q[1]=cyp+dy*f})});
hook('twirl',(s,p)=>{const w=s.width,h=s.height,cxp=w*p.x/100,cyp=h*p.y/100,R=Math.min(w,h)*p.r/100;return warp2(s,(x,y,q)=>{const dx=x-cxp,dy=y-cyp,d=Math.sqrt(dx*dx+dy*dy);if(d>=R){q[0]=x;q[1]=y;return}const t=1-d/R,th=rad(p.a)*t*t,c=Math.cos(th),sn=Math.sin(th);q[0]=cxp+dx*c-dy*sn;q[1]=cyp+dx*sn+dy*c})});
hook('ripple',(s,p)=>warp2(s,(x,y,q)=>{q[0]=x+p.a*Math.sin(2*Math.PI*y/p.l);q[1]=y+p.a*Math.sin(2*Math.PI*x/p.l)}));
hook('kaleido',(s,p)=>{const w=s.width,h=s.height,cxp=w/2,cyp=h/2,seg=2*Math.PI/p.n,rot=rad(p.ang),z=100/p.z;return warp2(s,(x,y,q)=>{const dx=x-cxp,dy=y-cyp,r=Math.sqrt(dx*dx+dy*dy)*z;let a=Math.atan2(dy,dx)-rot;a=((a%seg)+seg)%seg;if(a>seg/2)a=seg-a;a+=rot;q[0]=cxp+r*Math.cos(a);q[1]=cyp+r*Math.sin(a)})});
hook('chroma',(s,p)=>{const w=s.width,h=s.height,k=p.a/100*.012,cxp=w/2,cyp=h/2,R=warp2(s,(x,y,q)=>{q[0]=cxp+(x-cxp)*(1+k);q[1]=cyp+(y-cyp)*(1+k)}),B=warp2(s,(x,y,q)=>{q[0]=cxp+(x-cxp)*(1-k);q[1]=cyp+(y-cyp)*(1-k)}),o=px(s),rd=px(R).data,bd=px(B).data,a=o.data;
  for(let i=0;i<a.length;i+=4){if(rd[i+3]>0)a[i]=rd[i];if(bd[i+3]>0)a[i+2]=bd[i+2]}return put(w,h,o)});

/* ================== boîte de filtre ================== */
let LASTF=null;
const m2g=m=>{const c=mk(m.width,m.height),g=cx(c);g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);const t=cloneC(m),tg=cx(t);tg.globalCompositeOperation='source-in';tg.fillStyle='#fff';tg.fillRect(0,0,c.width,c.height);g.drawImage(t,0,0);return c};
const g2m=c=>{const im=px(c),a=im.data;for(let i=0;i<a.length;i+=4){const v=luma(a,i)*a[i+3]/255;a[i]=a[i+1]=a[i+2]=255;a[i+3]=v+.5}return put(c.width,c.height,im)};
const mixSel=(o,r,sel)=>{const out=cloneC(o),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(sel,0,0);const t=cloneC(r),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(sel,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};
const target=()=>{const d=S.doc;if(!d)return null;const M=maskTarget();if(M)return{L:M,mask:true};const L=pixelTarget();return L?{L,mask:false}:null};
const alive=(d,L)=>S.doc===d&&d.layers.includes(L);

/* texte et formes deviennent des pixels dès qu'un filtre les modifie (comme le pinceau) : sinon la modification du texte effaçait le filtre */
{const _am=applyMasked;
 applyMasked=function(L,result,label){if(L&&(L.txt||L.shp)){delete L.txt;delete L.shp;toast('Ce calque devient un calque de pixels : le texte ou la forme ne sera plus modifiable',4000)}return _am.apply(this,arguments)}}

function runOn(T,F,p,sel){const d=S.doc,L=T.L;
  if(T.mask){const src=L.mask;let r=g2m(F.run(m2g(src),p));if(sel)r=mixSel(src,r,sel);return r}
  let r=F.run(L.canvas,p);if(sel)r=mixSel(L.canvas,r,sel);return r}
function applyFilter(T,F,p){const d=S.doc,L=T.L;
  LASTF={id:Object.keys(FILTERS).find(k=>FILTERS[k]===F),p:{...p}};
  if(T.mask){L.mask=runOn(T,F,p,d.sel);delete L.maskPreview;markComp();pushHistory(F.name+' (masque)');syncAll();return}
  applyMasked(L,F.run(L.canvas,p),F.name)}

filterDialog=function(id){const d=S.doc,F=FILTERS[id];if(!d||!F)return;
  const T=target();if(!T){toast('Aucun calque de pixels à filtrer');return}
  const L=T.L;if(!T.mask&&L.visible===false){toast('Ce calque est masqué : affichez-le pour appliquer un filtre');return}
  const P=F.params,p={};P.forEach(q=>p[q[0]]=q[5]);
  if(!P.length){try{applyFilter(T,F,p)}catch(e){console.error(e);toast('Filtre impossible : '+(e.message||e),4000)}return}
  let tmr=null;
  const clear=()=>{clearTimeout(tmr);delete L.preview;delete L.maskPreview};
  const prev=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(!alive(d,L))return;try{const r=runOn(T,F,p,d.sel);if(T.mask)L.maskPreview=r;else L.preview=r;markComp()}catch(e){console.error(e);toast('Aperçu impossible : '+(e.message||e),3000)}},120)};
  dialog({title:F.name,light:true,
    body:P.map(q=>rangeRow('f-'+q[0],q[1],q[2],q[3],q[4],q[5],q[6])).join('')+(T.mask?'<p class="muted">Appliqué au masque du calque.</p>':'')+(d.sel?'<p class="muted">Appliqué uniquement à la sélection.</p>':''),
    onOpen:el=>{P.forEach(q=>{const i=$('#f-'+q[0],el);i.oninput=()=>{p[q[0]]=+i.value;$('#f-'+q[0]+'-o',el).textContent=fmtN(+i.value,q[4])+q[6];prev()}});prev()},
    buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
      {label:'Appliquer',primary:true,onClick:()=>{clear();if(!alive(d,L)){toast('Le calque n’existe plus');return}
        try{applyFilter(T,F,p)}catch(e){console.error(e);markComp();toast('Filtre impossible : '+(e.message||e),4000);return false}}}]})};

/* dernier filtre : Ctrl+Alt+F le rejoue tel quel, Filtre > Dernier filtre */
function repeatLast(){const d=S.doc;if(!d||!LASTF)return;const F=FILTERS[LASTF.id];if(!F)return;const T=target();if(!T){toast('Aucun calque de pixels à filtrer');return}
  if(!T.mask&&T.L.visible===false){toast('Ce calque est masqué : affichez-le pour appliquer un filtre');return}
  const p={...LASTF.p};delete p.seed;
  busy(true,F.name+'…',null);setTimeout(()=>{try{applyFilter(T,F,p)}catch(e){console.error(e);toast('Filtre impossible : '+(e.message||e),4000)}finally{busy(false)}},20)}
{const _f=MENU2.filter.items;
 MENU2.filter.items=()=>{const a=_f();const nm=LASTF&&FILTERS[LASTF.id]?FILTERS[LASTF.id].name:null;
  a.unshift(MI(nm?'Dernier filtre : '+nm:'Dernier filtre',{icon:'filter',kbd:MOD+(IS_MAC?'⌥':'Alt+')+'F',dis:!S.doc?NODOC:(nm?false:'Aucun filtre appliqué'),fn:repeatLast}),SEP);
  /* « Effets du calque » : si un calque de réglage est actif, on regarde le calque de photo que les filtres modifient */
  return a.map(it=>it&&it.label==='Effets du calque…'?{...it,fn:()=>{const d=S.doc,L=pixelTarget();if(d&&L&&AL()&&AL().kind!=='pixel'){d.active=d.layers.indexOf(L);syncAll()}it.fn()}}:it)}}
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!e.altKey||e.shiftKey||e.code!=='KeyF'||(e.getModifierState&&e.getModifierState('AltGraph')))return;const t=e.target;if(t&&t.matches&&t.matches('textarea,select,[contenteditable],input:not([type=range]):not([type=checkbox])'))return;
  if($('#scrim')||!S.doc)return;e.preventDefault();e.stopPropagation();repeatLast()},true);

/* ---------- dialog : cases à cocher pour les réglages 0/1, liste pour le style des contours, Entrée valide un filtre ---------- */
const FNAMES=()=>new Set(Object.values(FILTERS).map(f=>f.name));
{const _dialog=dialog;
 dialog=function(o){const dl=_dialog.apply(this,arguments);
  try{if(o&&o.light&&FNAMES().has(o.title)){
    $$('input[type=range]',dl).forEach(r=>{const row=r.closest('.row'),out=row&&row.querySelector('output');if(!row)return;
      if(+r.min===0&&+r.max===1&&+r.step===1){const cb=document.createElement('input');cb.type='checkbox';cb.checked=+r.value===1;cb.setAttribute('aria-label',row.querySelector('label').textContent);
        cb.onchange=()=>{r.value=cb.checked?1:0;r.dispatchEvent(new Event('input',{bubbles:true}))};r.style.display='none';if(out)out.style.display='none';r.after(cb);cb.style.justifySelf='start'}
      else if(r.id==='f-m'&&o.title===FILTERS.edges.name){const se=document.createElement('select');EDGE_STYLES.forEach((t,i)=>{const op=document.createElement('option');op.value=i;op.textContent=t;se.appendChild(op)});se.value=r.value;
        se.onchange=()=>{r.value=se.value;r.dispatchEvent(new Event('input',{bubbles:true}))};r.style.display='none';if(out)out.style.display='none';r.after(se)}});
    const sc=dl.closest('.scrim');if(sc)sc.dataset.fxEnter='1'}
   if(o&&o.title==='Actions'){const l=$('#acL',dl);if(l)l.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-p]');if(!b)return;ev.stopPropagation();const a=PrismC.acts()[+b.dataset.p];closeDialog();playAction2(a)},true)}
  }catch(e){console.error(e)}
  return dl}}
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing)return;const sc=$('#scrim');if(!sc||sc.dataset.fxEnter!=='1')return;const t=e.target;
  if(t&&t.matches&&t.matches('textarea,select,button,a,input:not([type=range]):not([type=checkbox])'))return;
  const b=sc.querySelector('.foot .btn.primary');if(b){e.preventDefault();e.stopPropagation();b.click()}},true);

/* ---------- actions : « Lancer » marche aussi quand un calque de réglage est actif (comme les filtres), avec un grain neuf ---------- */
async function playAction2(a){const d=S.doc,L=pixelTarget();if(!d||!L){toast('Choisissez un calque de pixels');return}
  if(L.visible===false){toast('Ce calque est masqué : affichez-le pour lancer une action');return}
  const R=REC(),was=R.on;R.on=false;busy(true,'Action « '+a.name+' »…',0);let ok=false;
  try{let r=L.canvas,i=0;for(const s of a.steps){const F=FILTERS[s.id];if(F){const p={...s.p};delete p.seed;r=F.run(r,p)}busy(true,'Action « '+a.name+' »…',++i/a.steps.length);await tick()}
    if(alive(d,L)){applyMasked(L,r,'Action : '+a.name);ok=true}}
  catch(e){console.error(e);toast('Action impossible : '+(e.message||e),4000)}
  busy(false);R.on=was;return ok}
window.PrismFX=Object.assign(window.PrismFX||{},{playAction2,repeatLast,m2g,g2m,mixSel});

/* ---------- menu Image > Mode : libellés sans redite ---------- */
const walk=(items,fn)=>items.map(it=>{if(!it||it==='-')return it;const x=fn(it);if(x.sub){const s=x.sub;x.sub=()=>walk(s(),fn)}return x});
{const _i=MENU2.image.items;
 MENU2.image.items=()=>walk(_i(),it=>{if(it.label==='Mode : niveaux de gris')return{...it,label:'Niveaux de gris'};if(it.label==='Mode : couleurs indexées…')return{...it,label:'Couleurs indexées…'};return{...it}})}

/* ================== photos multiples ================== */
function pickMany(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='image/*,.heic,.heif,.tif,.tiff,'+RAW_ACCEPT;i.onchange=()=>res([...i.files]);i.oncancel=()=>res([]);i.click()})}
async function loadScaled(f,maxPx){let bm=null;if(!RAW_EXT.test(f.name||'')&&!/\.(heic|heif|avif|tiff?)$/i.test(f.name||'')){try{bm=await createImageBitmap(f)}catch(e){}}
  if(!bm){const src=await styleFromFile(f);const s=Math.min(1,maxPx/Math.max(src.width,src.height)),c=mk(Math.round(src.width*s),Math.round(src.height*s));cx(c).drawImage(src,0,0,c.width,c.height);return c}
  const s=Math.min(1,maxPx/Math.max(bm.width,bm.height)),c=mk(Math.round(bm.width*s),Math.round(bm.height*s));cx(c).drawImage(bm,0,0,c.width,c.height);bm.close&&bm.close();return c}
/* gris normalisé (moyenne 0, écart-type 1) : l'alignement ne dépend pas de l'exposition */
function grayN(c,w,h){const t=mk(w,h),g=cx(t);g.imageSmoothingQuality='high';g.drawImage(c,0,0,w,h);const d=rx(t).getImageData(0,0,w,h).data,a=new Float32Array(w*h);let m=0;
  for(let i=0;i<a.length;i++){const v=d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114;a[i]=v;m+=v}m/=a.length;let v2=0;for(let i=0;i<a.length;i++){const e=a[i]-m;v2+=e*e}const sd=Math.sqrt(v2/a.length)||1;for(let i=0;i<a.length;i++)a[i]=(a[i]-m)/sd;return a}
/* erreur moyenne quand B est posée en (sx,sy) sur A */
function shiftErr(A,B,w,h,sx,sy,st,minOv){const x0=Math.max(0,sx),x1=Math.min(w,w+sx),y0=Math.max(0,sy),y1=Math.min(h,h+sy);if(x1-x0<w*minOv||y1-y0<h*minOv)return 1e9;let s=0,n=0;
  for(let y=y0;y<y1;y+=st){const ra=y*w,rb=(y-sy)*w-sx;for(let x=x0;x<x1;x+=st){const e=A[ra+x]-B[rb+x];s+=e<0?-e:e;n++}}return n?s/n:1e9}
function searchShift(A,B,w,h,cx0,cy0,rx_,ry_,st,minOv){let best=1e9,bx=cx0,by=cy0;
  for(let sy=cy0-ry_;sy<=cy0+ry_;sy++)for(let sx=cx0-rx_;sx<=cx0+rx_;sx++){const e=shiftErr(A,B,w,h,sx,sy,st,minOv);if(e<best){best=e;bx=sx;by=sy}}return{x:bx,y:by,e:best}}
/* affine la translation sur des images plus grandes (800 puis 1600 px de large) */
function refineShift(A,B,sh,w0){let w=w0,x=sh.x,y=sh.y;
  for(const target of [800,1600]){const ww=Math.min(target,A.width);if(ww<=w)continue;const hh=Math.max(8,Math.round(A.height*ww/A.width)),f=ww/w;
    const ga=grayN(A,ww,hh),gb=grayN(B,ww,hh),cxs=Math.round(x*f),cys=Math.round(y*f),R=Math.ceil(f)+1;const r=searchShift(ga,gb,ww,hh,cxs,cys,R,R,2,.05);x=r.x;y=r.y;w=ww}
  return{x:x*A.width/w,y:y*A.width/w}}
function sameSize(A,B){if(A.width===B.width&&A.height===B.height)return B;const t=mk(A.width,A.height);cx(t).drawImage(B,0,0,A.width,A.height);return t}
/* translation qui aligne B sur A (petit décalage entre prises) */
function alignShift(A,B0){const B=sameSize(A,B0),w=200,h=Math.max(8,Math.round(A.height*w/A.width)),ga=grayN(A,w,h),gb=grayN(B,w,h),R=Math.round(w*.06);
  const r=searchShift(ga,gb,w,h,0,0,R,R,1,.0);return refineShift(A,B,r,w)}
function boxBlur(a,w,h,r){const t=new Float32Array(a.length),o=new Float32Array(a.length),k=2*r+1;
  for(let y=0;y<h;y++){let s=0;const b=y*w;for(let x=-r;x<=r;x++)s+=a[b+Math.max(0,Math.min(w-1,x))];for(let x=0;x<w;x++){t[b+x]=s/k;s+=a[b+Math.min(w-1,x+r+1)]-a[b+Math.max(0,x-r)]}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[Math.max(0,Math.min(h-1,y))*w+x];for(let y=0;y<h;y++){o[y*w+x]=s/k;s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}
  return o}

async function fuseExposures(files){busy(true,'Fusion des expositions…',0);await tick();
  try{const imgs=[];for(const f of files)imgs.push(await loadScaled(f,3200));const W=imgs[0].width,H=imgs[0].height;let moved=0;
    for(let k=1;k<imgs.length;k++){const sh=alignShift(imgs[0],imgs[k]);if(Math.abs(sh.x)>=.5||Math.abs(sh.y)>=.5){const t2=mk(W,H);const g=cx(t2);g.imageSmoothingQuality='high';g.drawImage(sameSize(imgs[0],imgs[k]),sh.x,sh.y);imgs[k]=t2;moved++}else imgs[k]=sameSize(imgs[0],imgs[k]);busy(true,'Alignement des photos…',k/imgs.length/2);await tick()}
    const datas=imgs.map(c=>cx(c).getImageData(0,0,W,H).data);
    const n=W*H,ws=[];let k=0;
    for(const d of datas){const w=new Float32Array(n),gray=new Float32Array(n);
      for(let i=0;i<n;i++){const r=d[i*4]/255,g=d[i*4+1]/255,b=d[i*4+2]/255;gray[i]=.299*r+.587*g+.114*b;const mean=(r+g+b)/3,sat=Math.sqrt(((r-mean)**2+(g-mean)**2+(b-mean)**2)/3);
        const ex=Math.exp(-((r-.5)**2+(g-.5)**2+(b-.5)**2)/(2*.2*.2));w[i]=d[i*4+3]===0?1e-9:(sat+.02)*ex+1e-6}
      for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,lap=Math.abs(4*gray[i]-gray[i-1]-gray[i+1]-gray[i-W]-gray[i+W]);w[i]*=(lap+.01)}
      ws.push(boxBlur(w,W,H,Math.max(3,Math.round(Math.min(W,H)/80))));busy(true,'Fusion des expositions…',.5+(++k)/(datas.length*2));await tick()}
    const out=mk(W,H),og=cx(out),oi=og.createImageData(W,H),od=oi.data;
    for(let i=0;i<n;i++){let s=0;for(let j=0;j<ws.length;j++)s+=ws[j][i];let r=0,g=0,b=0;for(let j=0;j<ws.length;j++){const a=ws[j][i]/s;r+=datas[j][i*4]*a;g+=datas[j][i*4+1]*a;b+=datas[j][i*4+2]*a}od[i*4]=r;od[i*4+1]=g;od[i*4+2]=b;od[i*4+3]=255}
    og.putImageData(oi,0,0);busy(false);setDoc(out,'fusion-expositions.jpg',{});toast('Expositions fusionnées'+(moved?' (alignement corrigé sur '+moved+' photo'+(moved>1?'s':'')+')':'')+'. Un petit décalage est corrigé, pas une rotation.',6000)
  }catch(e){busy(false);console.error(e);toast('Fusion impossible : '+(e.message||e),5000)}}
async function fusionDialog(){const fs=await pickMany();if(fs.length<2){if(fs.length)toast('Choisissez au moins deux photos');return}fuseExposures(fs)}

async function stitch(files){busy(true,'Assemblage du panorama…',0);await tick();
  try{const fulls=[];for(const f of files)fulls.push(await loadScaled(f,4000));
    const w0=200,pos=[{x:0,y:0}];
    for(let k=1;k<fulls.length;k++){const A=fulls[k-1],B=sameSize(A,fulls[k]),h0=Math.max(8,Math.round(A.height*w0/A.width)),ga=grayN(A,w0,h0),gb=grayN(B,w0,h0),my=Math.round(h0*.12);
      let best=1e9,bx=0,by=0;
      for(let sx=Math.round(w0*.15);sx<=w0*.9;sx++)for(let sy=-my;sy<=my;sy++){const e=shiftErr(ga,gb,w0,h0,sx,sy,2,.12);if(e<best){best=e;bx=sx;by=sy}}
      const r=refineShift(A,B,{x:bx,y:by},w0),prev=pos[k-1];pos.push({x:prev.x+r.x,y:prev.y+r.y});busy(true,'Assemblage du panorama…',k/fulls.length);await tick()}
    let minX=0,minY=0,maxX=0,maxY=0;pos.forEach((p,i)=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x+fulls[i].width);maxY=Math.max(maxY,p.y+fulls[i].height)});
    let W=Math.round(maxX-minX),H=Math.round(maxY-minY);if(W*H>MAX_PX)throw new Error('panorama trop grand');
    /* bords : on ne garde que le rectangle couvert par toutes les photos */
    let top=-Infinity,bot=Infinity;pos.forEach((p,i)=>{top=Math.max(top,p.y-minY);bot=Math.min(bot,p.y-minY+fulls[i].height)});
    top=Math.round(top);bot=Math.round(bot);const crop=bot-top>=H*.6&&(top>0||bot<H);
    const out=mk(W,H),g=cx(out);
    for(let i=0;i<fulls.length;i++){const c=fulls[i],x=Math.round(pos[i].x-minX),y=Math.round(pos[i].y-minY);
      if(i===0){g.drawImage(c,x,y);continue}
      const prevEnd=Math.round(pos[i-1].x-minX)+fulls[i-1].width,ov=Math.max(1,prevEnd-x),t=mk(c.width,c.height),tg=cx(t);tg.drawImage(c,0,0);
      tg.globalCompositeOperation='destination-in';const gr=tg.createLinearGradient(0,0,Math.min(ov,c.width),0);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,1)');tg.fillStyle=gr;tg.fillRect(0,0,c.width,c.height);
      g.drawImage(t,x,y)}
    let res=out;if(crop){res=mk(W,bot-top);cx(res).drawImage(out,0,-top)}
    busy(false);setDoc(res,'panorama.jpg',{});toast('Panorama assemblé'+(crop?' et recadré sur la zone commune':'')+' (translation seule).',6000)
  }catch(e){busy(false);console.error(e);toast('Panorama impossible : '+(e.message||e),5000)}}
async function panoDialog(){const fs=await pickMany();if(fs.length<2){if(fs.length)toast('Choisissez au moins deux photos');return}fs.sort((a,b)=>(a.name||'').localeCompare(b.name||''));stitch(fs)}
{const _f=MENU2.file.items;
 MENU2.file.items=()=>walk(_f(),it=>{if(it.label==='Fusion d’expositions (HDR)…')return{...it,fn:fusionDialog};if(it.label==='Panorama…')return{...it,fn:panoDialog};return{...it}})}
window.PrismF={fuseExposures,stitch,alignShift};
})();

