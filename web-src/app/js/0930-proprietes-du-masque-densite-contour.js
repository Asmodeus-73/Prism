/* ====================================================================================================
   fx_zmask : "Propriétés du masque" (densité, contour progressif, netteté du contour, expansion, fondu,
   inverser, voir, réinitialiser, opacité) for the masks of adjustment layers AND pixel layers.

   Model: the bake is destructive (L.mask is replaced by a new canvas, one history step), but the ORIGINAL mask
   is kept in a WeakMap keyed by the produced mask canvas: MK: maskCanvas -> {base, p}. Every slider is recomputed
   from `base`, so moving a slider back and forth never compounds, "Réinitialiser" restores `base`, and undo/redo
   restore the right canvases (and so the right slider positions) for free. Painting / any other operation
   replaces L.mask with a canvas that is not in MK, which drops the entry (the effect is then baked for good).
   Order of the pipeline: inverser -> expansion -> fondu -> contour progressif -> netteté -> densité.
   Preview: downscaled computation (<=1600 px) upscaled into one reused doc-size canvas, assigned to L.maskPreview
   (the same mechanism as the gradient tool), full-resolution recompute on release.
   ==================================================================================================== */
(()=>{
const ZS={drag:null,busy:false,raf:0,pv:null,sb:null,pop:null};
const MK=new WeakMap();
const P0=()=>({dens:100,feather:0,contrast:0,grow:0,fade:0,inv:false});
const KEYS=['dens','feather','contrast','grow','fade','inv'];
const eqP=(a,b)=>KEYS.every(k=>a[k]===b[k]);
const isDef=p=>eqP(p,P0());
const zfree=c=>{if(c){try{c.width=c.height=0}catch(e){}}};
const clampN=(v,a,b)=>v<a?a:v>b?b:v;

/* ---------------- pixel pipeline (on 8-bit alpha arrays; a mask is white pixels whose alpha is the value) ---------------- */
function alphaOf(c){const w=c.width,h=c.height,g=rx(c).getImageData(0,0,w,h).data,n=w*h,a=new Uint8Array(n);for(let i=0,j=3;i<n;i++,j+=4)a[i]=g[j];return a}
function canvasFromAlpha(a,w,h){const c=mk(w,h),g=cx(c),img=g.createImageData(w,h),d=img.data,n=w*h;for(let i=0,j=0;i<n;i++,j+=4){d[j]=d[j+1]=d[j+2]=255;d[j+3]=a[i]}g.putImageData(img,0,0);return c}
/* gaussian (3 box passes, O(N) whatever the radius, same edge replication as blurCanvas) directly on the alpha array */
function blurAlpha(a,w,h,s){const f=gaussF(a,w,h,s),n=w*h,r=new Uint8Array(n);for(let i=0;i<n;i++)r[i]=f[i]+.5;return r}
/* sliding-window maximum along one direction, window [k-R,k+R], all lines of the image */
function slideMax(src,dst,w,h,dx,dy,R){
  const m=Math.max(w,h)+2,v=new Uint8Array(m),q=new Int32Array(m),ix=new Int32Array(m);
  const line=(x0,y0)=>{let n=0,x=x0,y=y0;while(x>=0&&x<w&&y>=0&&y<h){const i=y*w+x;ix[n]=i;v[n]=src[i];n++;x+=dx;y+=dy}
    let hd=0,tl=0,nx=0;
    for(let k=0;k<n;k++){const hi=k+R<n-1?k+R:n-1;
      while(nx<=hi){const val=v[nx];while(tl>hd&&v[q[tl-1]]<=val)tl--;q[tl++]=nx;nx++}
      while(q[hd]<k-R)hd++;dst[ix[k]]=v[q[hd]]}};
  if(dx===1&&dy===0){for(let y=0;y<h;y++)line(0,y)}
  else if(dx===0&&dy===1){for(let x=0;x<w;x++)line(x,0)}
  else if(dy===1){for(let y=0;y<h;y++)line(0,y);for(let x=1;x<w;x++)line(x,0)}
  else{for(let y=0;y<h;y++)line(0,y);for(let x=1;x<w;x++)line(x,h-1)}}
/* grayscale dilation by an octagon of radius r (horizontal + vertical + 2 diagonal segments: axis reach = r exactly) */
function dilate(a,w,h,r){if(r<1)return a;const k=Math.round(.2929*r),hh=r-2*k,N=w*h;let s=a,t=new Uint8Array(N);
  const pass=(dx,dy,R)=>{if(R<1)return;slideMax(s,t,w,h,dx,dy,R);const u=s;s=t;t=(u===a)?new Uint8Array(N):u};
  pass(1,0,hh);pass(0,1,hh);pass(1,1,k);pass(1,-1,k);return s===a?a.slice():s}
const inv8=a=>{for(let i=0,n=a.length;i<n;i++)a[i]=255-a[i]};
function lutOf(p){const l=new Uint8Array(256),k=p.contrast>=0?1+p.contrast/20:1/(1+(-p.contrast)/20),d=p.dens/100;
  for(let i=0;i<256;i++){let v=i/255;if(p.contrast!==0)v=v<.5?.5*Math.pow(2*v,k):1-.5*Math.pow(2*(1-v),k);l[i]=Math.round(255*(1-d+d*v))}return l}
/* base: mask canvas, p: properties, sc: scale of the working canvas relative to the document (px values are in document pixels) */
function runPipe(base,p,sc){const w=base.width,h=base.height,N=w*h;let a=alphaOf(base);
  if(p.inv)inv8(a);
  const g=Math.round(p.grow*sc);
  if(g>0)a=dilate(a,w,h,g);else if(g<0){inv8(a);a=dilate(a,w,h,-g);inv8(a)}
  const f=p.fade*sc;
  if(Math.abs(f)>=.5){const b=blurAlpha(a,w,h,Math.abs(f)/2);
    if(f>0){for(let i=0;i<N;i++){const v=b[i]*2;if(v>a[i])a[i]=v>255?255:v}}
    else{for(let i=0;i<N;i++){const v=b[i]*2-255;a[i]=v<0?0:v<a[i]?v:a[i]}}}
  const fe=p.feather*sc;if(fe>=.3)a=blurAlpha(a,w,h,fe);
  if(p.contrast!==0||p.dens!==100){const l=lutOf(p);for(let i=0;i<N;i++)a[i]=l[a[i]]}
  return canvasFromAlpha(a,w,h)}

/* ---------------- state ---------------- */
const hasMask=L=>!!(L&&L.mask&&(L.kind==='adjust'||L.kind==='pixel'));
const entryOf=L=>L&&L.mask?MK.get(L.mask):null;
const curP=L=>{const e=entryOf(L);return e?{...P0(),...e.p}:P0()};
const baseOf=L=>{const e=entryOf(L);return e?e.base:L.mask};
const docScale=()=>{const d=S.doc;return d?Math.max(1,Math.max(d.w,d.h)/2000):1};
const ROWS=()=>{const f=Math.round(100*docScale());return[
  ['dens','Densité',0,100,'%','Force du masque : en dessous de 100 %, les zones masquées laissent passer une partie de l’effet.'],
  ['feather','Contour progressif',0,f,'px','Adoucit le bord du masque (flou gaussien, rayon en pixels du document).'],
  ['contrast','Netteté du contour',-100,100,'','Plus de netteté : bord plus franc. Moins : transition plus douce, sans toucher aux zones pleines.'],
  ['grow','Expansion',-f,f,'px','Agrandit (+) ou réduit (−) la zone du masque, en pixels.'],
  ['fade','Fondu',-f,f,'px','Dégradé du bord d’un seul côté : positif vers l’extérieur (la zone garde sa pleine force), négatif vers l’intérieur.']]};
const fmtV=(k,v,u)=>(k==='dens'||k==='feather')?v+(u?' '+u:''):(v>0?'+'+v:v<0?'−'+(-v):'0')+(u?' '+u:'');

/* ---------------- live preview ---------------- */
const previewScale=()=>{const d=S.doc;return Math.min(1,1600/Math.max(d.w,d.h))};
function smallBase(base,ps){const s=ZS.sb;if(s&&s.base===base&&s.ps===ps&&s.c.width>0)return s.c;if(s)zfree(s.c);
  const c=resample(base,Math.max(1,Math.round(base.width*ps)),Math.max(1,Math.round(base.height*ps)));ZS.sb={base,ps,c};return c}
function applyPreview(L,p){const d=S.doc;if(!d||!hasMask(L)||!d.layers.includes(L))return;const base=baseOf(L),ps=previewScale();let out;
  if(ps>=1)out=runPipe(base,p,1);
  else{const sb=smallBase(base,ps),o=runPipe(sb,p,sb.width/d.w);
    if(!S.showMask){o.__dw=d.w;o.__dh=d.h;out=o}/* small canvas, stretched to the document by drawMip (see below): no 24 Mpx canvas per frame */
    else{if(!ZS.pv||ZS.pv.width!==d.w||ZS.pv.height!==d.h){zfree(ZS.pv);ZS.pv=mk(d.w,d.h)}
      const g=cx(ZS.pv);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='copy';g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(o,0,0,d.w,d.h);g.globalCompositeOperation='source-over';zfree(o);out=ZS.pv}}
  const old=L.maskPreview;L.maskPreview=out;if(old&&old!==out&&old!==ZS.pv&&old!==L.mask)zfree(old);markComp()}
function endPreview(L){if(L&&L.maskPreview&&L.maskPreview!==L.mask){const o=L.maskPreview;delete L.maskPreview;if(o!==ZS.pv)zfree(o)}else if(L)delete L.maskPreview;
  zfree(ZS.pv);ZS.pv=null;if(ZS.sb){zfree(ZS.sb.c);ZS.sb=null}if(ZS.raf){cancelAnimationFrame(ZS.raf);ZS.raf=0}ZS.drag=null}
function schedule(){if(ZS.raf)return;ZS.raf=requestAnimationFrame(()=>{ZS.raf=0;const dr=ZS.drag;if(dr)try{applyPreview(dr.L,dr.p)}catch(e){console.error(e)}})}

{const _dm=drawMip;drawMip=function(g,src,x,y,scale,ok){if(src&&src.__dw){g.imageSmoothingEnabled=true;g.drawImage(src,0,0,src.width,src.height,x,y,src.__dw,src.__dh);return}return _dm.apply(this,arguments)}}
/* ---------------- commit: ONE history step ---------------- */
async function commitProps(L,p,label){const d=S.doc;if(!d||!hasMask(L)||ZS.busy)return false;
  const cur=L.mask,e=MK.get(cur),base=e?e.base:cur,prev=e?e.p:P0();
  if(eqP(prev,p)){endPreview(L);markComp();refresh();return false}
  ZS.busy=true;const big=d.w*d.h>3e6;let out;
  try{if(big){busy(true,'Propriétés du masque…');await tick()}
    out=isDef(p)?base:runPipe(base,p,1)}
  catch(err){console.error(err);toast('Propriétés du masque impossibles : '+(err.message||err),4000);endPreview(L);ZS.busy=false;busy(false);refresh();return false}
  if(big)busy(false);ZS.busy=false;
  if(S.doc!==d||!d.layers.includes(L)||L.mask!==cur){if(out!==base)zfree(out);endPreview(L);refresh();return false}
  L.mask=out;if(out!==base)MK.set(out,{base,p:{...p}});
  endPreview(L);markComp();pushHistory(label||'Propriétés du masque');refresh();return true}

/* ---------------- UI ---------------- */
const IC={
  inv:'<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" stroke="none"/></svg>',
  eye:'<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"/><circle cx="10" cy="10" r="2.6"/></svg>',
  rs:'<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10a6 6 0 1 0 1.9-4.4"/><path d="M4 3.8v3.4h3.4"/></svg>',
  x:'<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>',
  sl:'<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 6h14M3 14h14"/><circle cx="7" cy="6" r="2" fill="var(--chrome)"/><circle cx="13" cy="14" r="2" fill="var(--chrome)"/></svg>'};
function bodyHTML(){const rows=ROWS().map(([k,l,mn,mx,u,t])=>`<div class="zm-row" data-zmr="${k}" title="${esc(t)}"><label>${l}</label><output data-zmo="${k}"></output><input type="range" data-zmk="${k}" min="${mn}" max="${mx}" step="1" aria-label="${l}"></div>`).join('');
  return rows+`<div class="zm-row" data-zmr="op" title="Opacité du calque"><label>Opacité du calque</label><output data-zmo="op"></output><input type="range" data-zmk="op" min="0" max="100" step="1" aria-label="Opacité du calque"></div>
  <div class="zm-acts"><button type="button" class="btn sm" data-zm="inv" title="Inverser le masque (le blanc devient noir)">${IC.inv}<span>Inverser</span></button><button type="button" class="btn sm" data-zm="show" title="Afficher le masque en rouge sur la photo (⇧M)" aria-pressed="false">${IC.eye}<span>Voir</span></button><button type="button" class="btn sm" data-zm="reset" title="Revenir au masque d’origine">${IC.rs}<span>Réinitialiser</span></button></div>`}
function fillRoot(root,L){if(!root||!hasMask(L))return;const p=ZS.drag&&ZS.drag.L===L?ZS.drag.p:curP(L),rows=ROWS();
  rows.forEach(([k,l,mn,mx,u])=>{const i=root.querySelector(`[data-zmk="${k}"]`),o=root.querySelector(`[data-zmo="${k}"]`);if(!i)return;
    if(+i.min!==mn)i.min=mn;if(+i.max!==mx)i.max=mx;if(document.activeElement!==i||!ZS.drag){if(+i.value!==p[k])i.value=p[k]}
    if(o)o.textContent=fmtV(k,p[k],u);const r=i.closest('.zm-row');r&&r.classList.toggle('zero',p[k]===P0()[k])});
  const oi=root.querySelector('[data-zmk="op"]'),oo=root.querySelector('[data-zmo="op"]'),ov=Math.round(L.opacity*100);
  if(oi){if(+oi.value!==ov)oi.value=ov;if(oo)oo.textContent=ov+' %'}
  const e=entryOf(L),sh=root.querySelector('[data-zm="show"]'),rs=root.querySelector('[data-zm="reset"]'),iv=root.querySelector('[data-zm="inv"]');
  if(sh){sh.classList.toggle('on',!!S.showMask);sh.setAttribute('aria-pressed',!!S.showMask)}
  if(rs)rs.disabled=!e;if(iv)iv.classList.toggle('on',!!p.inv)}
function sectionOpenPref(){try{const o=JSON.parse(PREF.get('w47Sec','{}'))||{};return o.mask===undefined?true:!!o.mask}catch(e){return false}}
function syncSection(){const body=document.getElementById('devBody'),A=S.doc&&AL();let sec=document.getElementById('zmSec');
  const show=!!(body&&A&&A.kind==='adjust'&&A.mask);
  if(!show){if(sec)sec.remove();return}
  if(!sec){sec=document.createElement('details');sec.className='sec';sec.id='zmSec';sec.dataset.sec='mask';sec.open=sectionOpenPref();
    sec.innerHTML=`<summary>Masque<span class="dot" aria-hidden="true"></span><button type="button" class="zm-rs" data-zm="reset" title="Revenir au masque d’origine" aria-label="Réinitialiser le masque">${IC.rs}</button></summary><div class="secbody zm-root">${bodyHTML()}</div>`;
    body.insertBefore(sec,body.firstChild)}
  else if(sec.parentNode!==body||body.firstChild!==sec)body.insertBefore(sec,body.firstChild);
  sec.classList.toggle('mod',!isDef(curP(A)));
  const rs=sec.querySelector('summary .zm-rs');if(rs)rs.disabled=!entryOf(A);
  fillRoot(sec.querySelector('.zm-root'),A)}

/* compact floating panel (pixel layers) */
function popPlace(pop){const pr=document.getElementById('pane-develop'),r=pr&&pr.getBoundingClientRect(),w=pop.offsetWidth||272;
  let x=r&&r.width>0?r.left-w-12:innerWidth-w-12,y=r&&r.width>0?Math.max(96,r.top+8):100;x=clampN(x,8,innerWidth-w-8);y=clampN(y,8,Math.max(8,innerHeight-pop.offsetHeight-8));
  pop.style.left=x+'px';pop.style.top=y+'px'}
function openPop(focusKey){const L=S.doc&&AL();if(!hasMask(L))return;let pop=document.getElementById('zmPop');
  if(!pop){pop=document.createElement('div');pop.id='zmPop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Propriétés du masque');
    pop.innerHTML=`<div class="zm-h"><span>Propriétés du masque</span><small></small><button type="button" class="zm-x" data-zm="close" title="Fermer (Échap)" aria-label="Fermer">${IC.x}</button></div><div class="zm-root zm-body">${bodyHTML()}</div>`;
    document.body.appendChild(pop);fillRoot(pop.querySelector('.zm-root'),L);popPlace(pop);
    const h=pop.querySelector('.zm-h');let dr=null;
    h.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const r=pop.getBoundingClientRect();dr={dx:e.clientX-r.left,dy:e.clientY-r.top};h.setPointerCapture(e.pointerId);h.style.cursor='grabbing'});
    h.addEventListener('pointermove',e=>{if(!dr)return;pop.style.left=clampN(e.clientX-dr.dx,0,innerWidth-60)+'px';pop.style.top=clampN(e.clientY-dr.dy,0,innerHeight-40)+'px'});
    const up=()=>{dr=null;h.style.cursor=''};h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
    pop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closePop()}})}
  refresh();const i=focusKey&&pop.querySelector(`[data-zmk="${focusKey}"]`);if(i)i.focus({preventScroll:true})}
function closePop(){const p=document.getElementById('zmPop');if(!p)return;if(ZS.drag)finishDrag();p.remove()}
function syncPop(){const pop=document.getElementById('zmPop'),L=S.doc&&AL();if(!pop)return;
  if(!hasMask(L)||L.kind==='adjust'){pop.remove();return}
  const s=pop.querySelector('.zm-h small');if(s)s.textContent=L.name;fillRoot(pop.querySelector('.zm-root'),L)}

function openMaskProps(focusKey){const d=S.doc,L=d&&AL();if(!d){toast('Ouvrez d’abord une photo');return}
  if(!hasMask(L)){toast('Ce calque n’a pas de masque');return}
  if(L.kind==='adjust'){closePop();switchTab('develop');syncSection();const sec=document.getElementById('zmSec');
    if(sec){sec.open=true;setTimeout(()=>{try{sec.scrollIntoView({block:'nearest'});const i=focusKey&&sec.querySelector(`[data-zmk="${focusKey}"]`);if(i)i.focus({preventScroll:true})}catch(e){}},40)}}
  else openPop(focusKey)}

function refresh(){try{
  if(ZS.drag&&(S.doc!==ZS.drag.d||!S.doc.layers.includes(ZS.drag.L))){endPreviewStale()}
  syncSection();syncPop();syncThumbButtons()}catch(e){console.warn('zmask',e)}}
function endPreviewStale(){const dr=ZS.drag;if(!dr)return;try{delete dr.L.maskPreview}catch(e){}zfree(ZS.pv);ZS.pv=null;if(ZS.sb){zfree(ZS.sb.c);ZS.sb=null}if(ZS.raf){cancelAnimationFrame(ZS.raf);ZS.raf=0}ZS.drag=null}
function finishDrag(){const dr=ZS.drag;if(!dr)return;const{L,p}=dr;ZS.drag=null;if(ZS.raf){cancelAnimationFrame(ZS.raf);ZS.raf=0}return commitProps(L,p,'Propriétés du masque')}

/* ---- events (delegated on the document, scoped to .zm-root / [data-zm]) ---- */
document.addEventListener('input',e=>{const i=e.target;if(!i||!i.matches||!i.matches('input[data-zmk]'))return;const root=i.closest('.zm-root');if(!root)return;
  const L=S.doc&&AL();if(!hasMask(L))return;const k=i.dataset.zmk,v=+i.value;
  if(k==='op'){L.opacity=v/100;markComp();document.querySelectorAll('.zm-root [data-zmk="op"]').forEach(x=>{if(x!==i)x.value=v});document.querySelectorAll('[data-zmo="op"]').forEach(o=>o.textContent=v+' %');return}
  if(!ZS.drag||ZS.drag.L!==L){if(ZS.drag)endPreviewStale();ZS.drag={L,d:S.doc,p:curP(L)}}
  ZS.drag.p[k]=v;
  document.querySelectorAll('.zm-root').forEach(r=>fillRoot(r,L));schedule()},true);
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.matches||!i.matches('input[data-zmk]'))return;const L=S.doc&&AL();if(!hasMask(L))return;
  if(i.dataset.zmk==='op'){pushHistory('Opacité du calque');try{syncLayers()}catch(_){}return}
  if(ZS.drag)finishDrag();else refresh()},true);
document.addEventListener('dblclick',e=>{const r=e.target.closest&&e.target.closest('.zm-root .zm-row');if(!r||e.target.tagName==='INPUT')return;const L=S.doc&&AL();if(!hasMask(L))return;
  const k=r.dataset.zmr;if(k==='op'){L.opacity=1;markComp();pushHistory('Opacité du calque');refresh();try{syncLayers()}catch(_){}return}
  const p=curP(L);p[k]=P0()[k];commitProps(L,p,'Propriétés du masque')},true);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-zm]');if(!b)return;const L=S.doc&&AL();
  const a=b.dataset.zm;e.preventDefault();e.stopPropagation();
  if(a==='close'){closePop();return}
  if(a==='props'){openMaskProps();return}
  if(!hasMask(L))return;
  if(a==='inv'){invertMask();return}
  if(a==='show'){toggleMask();refresh();return}
  if(a==='reset'){resetMask();return}},true);

function resetMask(){const L=S.doc&&AL();if(!hasMask(L))return;const e=entryOf(L);if(!e){toast('Le masque est déjà dans son état d’origine');return}
  if(ZS.drag)endPreview(L);commitProps(L,P0(),'Réinitialiser le masque')}

/* Inverser (menu, Zone du réglage, panel): goes through the pipeline so the original mask is kept and Réinitialiser still works */
const _invertMask=invertMask;
invertMask=function(){const L=S.doc&&AL();if(!hasMask(L))return _invertMask.apply(this,arguments);if(ZS.drag)endPreview(L);const p=curP(L);p.inv=!p.inv;return commitProps(L,p,'Inverser le masque')};

/* ---- Calque > Masque, Sélection > Contour progressif, palette ---- */
const _maskSub=maskSub;
maskSub=function(){const a=_maskSub.apply(this,arguments),L=S.doc&&AL(),has=hasMask(L);
  const it=MI('Propriétés du masque…',{icon:'mask',fn:()=>openMaskProps(),dis:S.doc?(has?false:'Ce calque n’a pas de masque'):NODOC});
  const k=a.findIndex(x=>x&&x.label==='Affiner le masque…');a.splice(k<0?a.length:k+1,0,it);
  const r=MI('Réinitialiser le masque',{fn:resetMask,dis:has?(entryOf(L)?false:'Le masque n’a pas été modifié'):(S.doc?'Ce calque n’a pas de masque':NODOC)});a.splice(k<0?a.length:k+2,0,r);return a};
const _featherDialog=featherDialog;
featherDialog=function(){const d=S.doc;if(d&&!d.sel&&hasMask(AL())){openMaskProps('feather');return}return _featherDialog.apply(this,arguments)};
{const _ms=MENU2.select.items;MENU2.select.items=()=>{const a=_ms();try{const L=S.doc&&AL();if(S.doc&&!S.doc.sel&&hasMask(L)){const i=a.find(x=>x&&x.label==='Contour progressif…');if(i)i.dis=false}}catch(e){}return a}}
/* the "Sélection" menu entry of the older array-style menu used by the palette */
if(typeof cmdItems==='function'){const _ci=cmdItems;cmdItems=function(){const a=_ci.apply(this,arguments);try{const L=S.doc&&AL();if(hasMask(L)){a.forEach(i=>{if(i.label==='Contour progressif'&&i.g==='Sélection'&&!S.doc.sel)i.dis=false});
    if(!a.some(i=>i.label==='Propriétés du masque'))a.push({g:'Calque',label:'Propriétés du masque',kbd:'',fn:()=>openMaskProps(),dis:false})}
    else if(!a.some(i=>i.label==='Propriétés du masque'))a.push({g:'Calque',label:'Propriétés du masque',kbd:'',fn:()=>openMaskProps(),dis:S.doc?'Ce calque n’a pas de masque':NODOC})}catch(e){}return a}}

/* ---- layers panel: a small button next to the mask thumbnail, double-click on the thumbnail ---- */
function syncThumbButtons(){const d=S.doc;if(!d)return;document.querySelectorAll('#pane-layers li.lyr').forEach(li=>{const L=d.layers[+li.dataset.i],m=li.querySelector('.mth');let b=li.querySelector('.zm-pb');
  if(!L||!m){if(b)b.remove();return}
  if(!b){b=document.createElement('button');b.type='button';b.className='zm-pb';b.innerHTML=IC.sl;b.dataset.zmp=li.dataset.i;li.appendChild(b)}
  b.title='Propriétés du masque…';b.setAttribute('aria-label','Propriétés du masque');m.title=(m.title||'Masque').replace(/ \(double-clic.*$/,'')+' (double-clic : propriétés)'})}
{const _sl=syncLayers;syncLayers=function(){const r=_sl.apply(this,arguments);try{syncThumbButtons()}catch(e){}return r}}
function openFromThumb(li){const i=+li.dataset.i,d=S.doc;if(!d||!d.layers[i])return;if(d.active!==i)setActiveLayer(i);openMaskProps()}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.zm-pb');if(!b)return;e.preventDefault();e.stopPropagation();openFromThumb(b.closest('li.lyr'))},true);
document.addEventListener('dblclick',e=>{const m=e.target.closest&&e.target.closest('#pane-layers .mth');if(!m)return;e.preventDefault();e.stopPropagation();openFromThumb(m.closest('li.lyr'))},true);

/* ---- keep the UI in step with the document ---- */
{const _sa=syncAll;syncAll=function(){const r=_sa.apply(this,arguments);refresh();return r}}
{const _rt=renderTarget;renderTarget=function(){const r=_rt.apply(this,arguments);try{syncSection();noticeButton()}catch(e){console.warn('zmask',e)}return r}}
function noticeButton(){const A=S.doc&&AL(),nb=document.querySelector('#target .w47-nb');if(!nb)return;let b=nb.querySelector('[data-zm="props"]');
  if(!(A&&A.kind==='pixel'&&A.mask)){if(b)b.remove();return}
  if(!b){b=document.createElement('button');b.type='button';b.className='btn sm';b.dataset.zm='props';b.textContent='Propriétés du masque…';nb.appendChild(b)}}
{let t=0;const _ph=pushHistory;pushHistory=function(){const r=_ph.apply(this,arguments);if(!t)t=requestAnimationFrame(()=>{t=0;refresh()});return r}}
{const _rs=restore;restore=function(){if(ZS.drag){const dr=ZS.drag;endPreviewStale();if(dr.L)delete dr.L.maskPreview}return _rs.apply(this,arguments)}}
{const _tm=toggleMask;toggleMask=function(){const r=_tm.apply(this,arguments);try{document.querySelectorAll('.zm-root').forEach(x=>fillRoot(x,S.doc&&AL()))}catch(e){}return r}}

/* ---- overlay: "Voir" also works for a pixel layer whose mask is not the edited target ---- */
{const _dov=drawOverlays;drawOverlays=function(c,pr){_dov.apply(this,arguments);
  try{const L=S.doc&&AL();if(S.showMask&&L&&L.kind==='pixel'&&L.mask&&!L.editMask){const ms=maskSrc(L);if(ms){const W=view.width,H=view.height,t=scr('mt',W,H),g=cx(t);
    g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.setTransform(...viewMatrix(0,0));g.drawImage(ms,0,0);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-in';g.fillStyle='rgba(235,70,60,.5)';g.fillRect(0,0,W,H);
    c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(t,0,0);c.restore()}}}catch(e){}}}

/* ---- style ---- */
{const st=document.createElement('style');st.id='zmaskCss';st.textContent=`
.zm-row{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"l o" "s s";column-gap:8px;row-gap:0;min-height:42px;align-content:center;padding:3px 0}
.zm-row label{grid-area:l;font-size:12.5px;color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:none;cursor:default}
.zm-row:hover label{color:var(--fg)}
.zm-row output{grid-area:o;font:12px var(--num);padding:1px 6px;border-radius:5px;min-width:44px;text-align:right;color:var(--fg)}
.zm-row.zero output{color:var(--fg-3)}
.zm-row input[type=range]{grid-area:s;width:100%}
.zm-acts{display:flex;gap:6px;padding:8px 0 0}
.zm-acts .btn{flex:1 1 auto;min-width:0;padding:3px 8px;gap:5px}
.zm-acts .btn:disabled{opacity:.45;pointer-events:none}
details.sec>summary .zm-rs{margin-left:auto;width:26px;height:24px;display:grid;place-items:center;color:var(--fg-3);background:none;border:0;border-radius:var(--r-s);padding:0}
details.sec>summary .zm-rs:hover{color:var(--fg);background:var(--raise)}
details.sec>summary .zm-rs:disabled{opacity:.35;pointer-events:none}
#zmSec .secbody{padding:2px 14px 12px}
#zmPop{position:fixed;z-index:60;width:272px;max-width:calc(100vw - 16px);background:var(--menu);border:1px solid var(--line-2);border-radius:12px;box-shadow:var(--shadow);padding-bottom:10px;animation:mIn .09s ease-out}
#zmPop .zm-h{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;cursor:grab;font-weight:600;font-size:13px;border-bottom:1px solid var(--line);user-select:none;touch-action:none}
#zmPop .zm-h small{margin-left:auto;font-weight:400;font-size:11.5px;color:var(--fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px}
#zmPop .zm-x{width:26px;height:26px;display:grid;place-items:center;border:0;background:none;color:var(--fg-3);border-radius:var(--r-s);padding:0}
#zmPop .zm-x:hover{background:var(--raise);color:var(--fg)}
#zmPop .zm-body{padding:4px 14px 0}
.lyr .zm-pb{position:absolute;right:4px;top:50%;margin-top:-11px;width:22px;height:22px;display:grid;place-items:center;border:0;background:none;border-radius:var(--r-s);color:var(--fg-3);padding:0;opacity:0;transition:opacity .12s}
.lyr:hover .zm-pb,.lyr.on .zm-pb,.lyr .zm-pb:focus-visible{opacity:.85}
.lyr .zm-pb:hover{background:var(--raise);color:var(--fg);opacity:1}
.lyr:has(.zm-pb){position:relative}
.lyr:has(.zm-pb) .nm{padding-right:20px}
@media (max-width:760px){#zmPop{left:8px!important;right:8px;top:auto!important;bottom:8px;width:auto}}
`;document.body.appendChild(st)}
window.PrismMask={open:openMaskProps,reset:resetMask,commit:commitProps,run:runPipe,entry:entryOf,P0,MK};
})();

