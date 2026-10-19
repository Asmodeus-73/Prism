/* ================= fx_layers: audit of the layers area ================= */
(()=>{
const $L=s=>document.querySelector(s);
const resnap=()=>{const h=S.history[S.hi];if(h&&h.layers&&S.doc)S.history[S.hi]=snap(h.label)};
const uniqueName=(d,base,keep)=>{const used=new Set(d.layers.filter(l=>l!==keep).map(l=>l.name));if(!used.has(base))return base;const m=/^(.*?) (\d+)$/.exec(base),root=m?m[1]:base;let n=m?+m[2]+1:2,nm;do{nm=root+' '+n++}while(used.has(nm));return nm};

/* ---------- CSS: the layers dock kept 40 px too much height, so its button row was cut off (merge and delete unreachable) ---------- */
(()=>{const st=document.createElement('style');st.id='fxLayersCss';st.textContent=`
body:not(.compact) #lyrDock .layers-panel{flex:1 1 0;height:auto;min-height:0}
body:not(.compact) #lyrDock .lyr-btns{flex-wrap:nowrap;gap:1px;padding:4px}
body:not(.compact) #lyrDock .lyr-btns .ib{flex:1 1 0;width:auto;min-width:0;max-width:30px}
.lyrs li.lyr.fx-drag{opacity:.45}
.lyrs li.lyr.fx-above{box-shadow:inset 0 2px 0 var(--accent-fg)}
.lyrs li.lyr.fx-below{box-shadow:inset 0 -2px 0 var(--accent-fg)}
body.fx-dragging,body.fx-dragging *{cursor:grabbing!important;user-select:none!important}
.lyr .mth.moff{opacity:.38}
`;document.body.appendChild(st)})();

/* ---------- blend-if: applied after layer styles, and kept when merging ---------- */
function bifBake(s,b){const c=mk(s.width,s.height),g=cx(c);g.drawImage(s,0,0);const id=g.getImageData(0,0,c.width,c.height),p=id.data,[a0,a1]=b.lo,[c0,c1]=b.hi;
  for(let i=0;i<p.length;i+=4){const l=.2126*p[i]+.7152*p[i+1]+.0722*p[i+2];let k=1;
    if(l<a1)k*=a1>a0?Math.max(0,(l-a0)/(a1-a0)):(l<a0?0:1);
    if(l>c0)k*=c1>c0?Math.max(0,(c1-l)/(c1-c0)):(l>c0?0:1);
    p[i+3]=p[i+3]*k}
  g.putImageData(id,0,0);c.__fx=true;return c}
const BC2=new WeakMap();
const _lsL=layerSrc;
layerSrc=function(L){const s=_lsL.apply(this,arguments),b=L.bif;
  if(b&&L.kind==='pixel'&&s!==L.canvas&&L.canvas&&fxOn(L.fx)){const f=FXC.get(L.canvas);if(f&&f.c===s){const key=b.lo+','+b.hi,hit=BC2.get(s);if(hit&&hit.key===key)return hit.c;const c=bifBake(s,b);BC2.set(s,{key,c});return c}}
  return s};
function bakeLayerLook(L){/* what the layer shows (styles, blend-if) becomes its pixels */
  if(L.kind!=='pixel')return;
  if(L.bif){const src=fxOn(L.fx)?fxBake(L):L.canvas;L.canvas=bifBake(src,L.bif);L.canvas.__fx=false;L.bif=null;L.fx=null;delete L.txt;delete L.shp}
  if(L.moff){L.mask=null;delete L.moff}}
const _mdL=mergeDown;
mergeDown=function(){const d=S.doc;if(d&&d.active>=1){const top=d.layers[d.active],bot=d.layers[d.active-1];
  /* refuse before the inner wrappers bake styles or drop text/shape data of a layer that is not merged */
  if(top&&bot&&(top.kind!=='pixel'||bot.kind!=='pixel')){toast('Fusion possible entre deux calques de pixels. Pour figer des réglages : Calque > Fusionner les calques visibles.');return}
  if(top&&bot&&top.kind==='pixel'&&bot.kind==='pixel'){if(top.visible&&!bot.visible){toast('Le calque du dessous est masqué : affichez-le pour fusionner');return}bakeLayerLook(top);bakeLayerLook(bot)}}return _mdL.apply(this,arguments)};
const _psdL=exportPSD;
exportPSD=async function(...a){const sw=[];for(const L of S.doc.layers)if(L.kind==='pixel'&&((L.bif&&!L.hi)||L.moff)){sw.push([L,L.canvas,L.mask]);if(L.bif&&!L.hi)L.canvas=bifBake(fxOn(L.fx)?fxBake(L):L.canvas,L.bif);if(L.moff)L.mask=null}
  try{return await _psdL.apply(this,a)}finally{sw.forEach(([L,c,m])=>{L.canvas=c;L.mask=m})}};

/* ---------- mask: disabled masks are ignored by every renderer ---------- */
XKEYS.push('moff');
const _maskSrc=maskSrc;
maskSrc=function(L){if(L&&L.moff)return null;return _maskSrc.apply(this,arguments)};

/* ---------- adding a mask: never overwrites an existing one, works on adjustment layers, Alt hides ---------- */
let altMask=false;
{const pane=$L('#pane-layers');pane.addEventListener('click',e=>{altMask=!!e.altKey&&!!e.target.closest('[data-la="mask"]');if(altMask)setTimeout(()=>{altMask=false},0)},true)}
addMask=function(fromSel,hide){const d=S.doc,L=AL();if(!d||!L)return;if(hide===undefined)hide=altMask;altMask=false;
  if(L.mask){if(L.kind==='pixel'&&!L.editMask){L.editMask=true;syncAll()}toast('Ce calque a déjà un masque');return}
  let m;const sel=fromSel&&d.sel;
  if(!hide)m=sel?cloneC(d.sel):fullMask();
  else if(!sel)m=mk(d.w,d.h);
  else{m=fullMask();const g=cx(m);g.globalCompositeOperation='destination-out';g.drawImage(d.sel,0,0)}
  L.mask=m;if(L.kind==='pixel')L.editMask=true;markComp();pushHistory('Ajouter un masque');syncAll()};
function toggleMaskOff(){const L=AL();if(!L||!L.mask)return;const off=!L.moff;if(off){L.moff=true;if(L.kind==='pixel')L.editMask=false}else delete L.moff;markComp();pushHistory(off?'Désactiver le masque':'Activer le masque');syncAll()}
function applyMask(){const L=AL();if(!L||L.kind!=='pixel'||!L.mask)return;const c=cloneC(L.canvas),g=cx(c);g.globalCompositeOperation='destination-in';g.drawImage(L.mask,0,0);
  L.canvas=c;L.mask=null;L.editMask=false;delete L.moff;if(L.txt||L.shp){delete L.txt;delete L.shp}markComp();pushHistory('Appliquer le masque');syncAll()}
function refineMaskUI(){const d=S.doc;if(!d)return;const s=d.sel;d.sel=null;try{refineDialog()}finally{d.sel=s}}
maskSub=function(){const d=S.doc,L=d&&AL(),has=!!(L&&L.mask),no=d?false:NODOC,nm=has?false:'Ce calque n’a pas de masque',sel=!!(d&&d.sel),dup=has?'Ce calque a déjà un masque':no;
  return[MI(sel?'Ajouter un masque depuis la sélection':'Ajouter un masque',{icon:'mask',fn:()=>addMask(true,false),dis:dup}),
    MI(sel?'Masquer la sélection':'Tout masquer',{icon:'mask',fn:()=>addMask(true,true),dis:dup}),
    MI('Inverser le masque',{icon:'invert',fn:invertMask,dis:nm}),
    MI(L&&L.moff?'Activer le masque':'Désactiver le masque',{fn:toggleMaskOff,dis:nm}),
    MI('Appliquer le masque',{fn:applyMask,dis:nm||(L.kind!=='pixel'?'Seulement pour les calques de pixels':false)}),
    MI('Affiner le masque…',{fn:refineMaskUI,dis:nm}),
    MI('Afficher le masque',{kbd:'⇧M',check:!!S.showMask,fn:toggleMask,dis:nm}),
    MI('Supprimer le masque',{icon:'trash',danger:true,fn:deleteMask,dis:nm})]};
deleteMask=function(){const L=AL();if(!L||!L.mask)return;L.mask=null;L.editMask=false;delete L.moff;markComp();pushHistory('Supprimer le masque');syncAll()};

/* ---------- erase / fill while a mask is being edited act on the mask (Backspace hides, Shift+Backspace reveals) ---------- */
const maskDst=()=>{const L=maskTarget();return L&&L.mask&&!L.moff?L:null};
const _clrL=clearSel,_filL=fillSel;
clearSel=function(){const d=S.doc,L=d&&maskDst();if(!L||!d.sel)return _clrL.apply(this,arguments);
  const m=cloneC(L.mask),g=cx(m);g.globalCompositeOperation='destination-out';g.drawImage(d.sel,0,0);L.mask=m;markComp();pushHistory('Masque : masquer la sélection');syncAll()};
fillSel=function(){const d=S.doc,L=d&&maskDst();if(!L)return _filL.apply(this,arguments);
  const m=cloneC(L.mask),g=cx(m);g.globalCompositeOperation='source-over';
  if(d.sel){const t=mk(d.w,d.h),tg=cx(t);tg.fillStyle='#fff';tg.fillRect(0,0,d.w,d.h);tg.globalCompositeOperation='destination-in';tg.drawImage(d.sel,0,0);g.drawImage(t,0,0)}
  else{g.fillStyle='#fff';g.fillRect(0,0,d.w,d.h)}
  L.mask=m;markComp();pushHistory(d.sel?'Masque : révéler la sélection':'Masque : tout révéler');syncAll()};
/* painting on a disabled mask switches it back on */
const _bsL=beginStroke;
beginStroke=function(p,e){const A=AL();if(A&&A.moff&&(S.tool==='brush'||S.tool==='eraser')&&(A.kind==='adjust'||A.editMask)){delete A.moff;toast('Masque réactivé');markComp()}return _bsL.apply(this,arguments)};

/* ---------- new layers get a unique name ---------- */
addLayer=function(){const d=S.doc;if(!d)return;let n=d.layers.filter(l=>l.kind==='pixel').length,nm;do{nm='Calque '+n++}while(d.layers.some(l=>l.name===nm));insertLayer(newPixel(nm,mk(d.w,d.h)),'Nouveau calque')};

/* adjustment layers get unique names too (the Develop list is by name) */
const uniqAdj=(d,n0)=>{const N=S.doc===d&&d?AL():null;if(N&&N.kind==='adjust'&&d.layers.length===n0+1){const nm=uniqueName(d,N.name,N);if(nm!==N.name){N.name=nm;resnap();syncAll()}}};
const _aaL=addAdjust;addAdjust=function(){const d=S.doc,n0=d?d.layers.length:0;const r=_aaL.apply(this,arguments);uniqAdj(d,n0);return r};
const _asL=addSubjectAdjust;addSubjectAdjust=async function(){const d=S.doc,n0=d?d.layers.length:0;const r=await _asL.apply(this,arguments);uniqAdj(d,n0);return r};

/* ---------- duplicate: the copy keeps everything (and so does redo), 16-bit data included, the mask is applied for "par copier" ---------- */
const _dupL=dupLayer;
dupLayer=function(){const d=S.doc,src=AL(),sel=!!(d&&d.sel),n0=d?d.layers.length:0;const r=_dupL.apply(this,arguments);
  const N=AL();if(d&&S.doc===d&&src&&N&&N!==src&&d.layers.length===n0+1){
    if(N.kind==='pixel'){
      if(!sel&&src.hi&&N.canvas===src.canvas){N.hi=src.hi;N.hiC=src.hiC}
      if(sel&&src.mask&&!src.moff){const c=cloneC(N.canvas),g=cx(c);g.globalCompositeOperation='destination-in';g.drawImage(src.mask,0,0);N.canvas=c}
      if(src.moff&&N.mask)N.moff=true}
    if(!sel&&/ copie$/.test(N.name)){const root=src.name.replace(/ copie( \d+)?$/,'');N.name=uniqueName(d,root+' copie',N)}else N.name=uniqueName(d,N.name,N);
    resnap();markComp();syncAll()}
  return r};

/* ---------- undo / redo keep the selected layer when the layers themselves did not change ---------- */
const _rsL=restore;
restore=function(i){const d=S.doc,s=S.history[i];let keep=null;
  if(d&&s&&s.layers&&i!==S.hi&&s.layers.length===d.layers.length&&s.layers.every((l,k)=>l.id===d.layers[k].id)&&d.layers[d.active])keep=d.layers[d.active].id;
  const r=_rsL.apply(this,arguments);
  if(keep!=null&&S.doc===d){const k=d.layers.findIndex(l=>l.id===keep);if(k>=0&&k!==d.active){d.active=k;syncAll()}}
  return r};

/* ---------- layer panel: tooltips and dim thumbnail for a disabled mask ---------- */
let lastActId=null;
const _slL=syncLayers;
syncLayers=function(){const pane=$L('#pane-layers'),ul0=pane&&pane.querySelector('ul.lyrs'),st=ul0?ul0.scrollTop:0,pt=pane?pane.scrollTop:0;const ae=document.activeElement,fid=ae&&(ae.id==='lyOp'||ae.id==='lyBlend')?ae.id:null;const r=_slL.apply(this,arguments);try{const d=S.doc;if(d){
  if(fid){const e=document.getElementById(fid);if(e)e.focus({preventScroll:true})}/* keyboard use of the opacity slider / blend list keeps focus across the rebuild */
  const mb=$L('#pane-layers [data-la="mask"]');if(mb){mb.title='Ajouter un masque (depuis la sélection s’il y en a une ; Alt : tout masquer)'}
  document.querySelectorAll('#pane-layers li.lyr').forEach(li=>{const L=d.layers[+li.dataset.i],m=li.querySelector('.mth');if(L&&m){m.classList.toggle('moff',!!L.moff);m.title=L.moff?'Masque désactivé':'Masque'}const nm=li.querySelector('.nm');if(L&&nm)nm.title=L.name});
  /* the list keeps its scroll position, and scrolls to the selected layer when the selection changed */
  const ul=pane.querySelector('ul.lyrs');if(ul){ul.scrollTop=st;pane.scrollTop=pt;const A=d.layers[d.active],id=A&&A.id+':'+d.active;
    if(id!==lastActId){lastActId=id;const on=ul.querySelector('li.lyr.on');if(on){const a=on.getBoundingClientRect(),b=ul.getBoundingClientRect();if(b.height>0&&(a.top<b.top||a.bottom>b.bottom))on.scrollIntoView({block:'nearest'})}}}}}catch(e){console.warn(e)}return r};

/* ---------- the list is not rebuilt while the mouse button is down on it (a rename committed by the blur used to swallow the click on the next row or button) ---------- */
{let down=false,pend=false,tm=0;const pane=$L('#pane-layers');
  const release=()=>{if(!down)return;down=false;clearTimeout(tm);if(pend){pend=false;setTimeout(()=>{try{syncLayers()}catch(e){console.warn(e)}},0)}};
  pane.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('input,select,textarea')||!e.target.closest('li.lyr,li.grp,.lyr-btns'))return;down=true;clearTimeout(tm);tm=setTimeout(release,1500)},true);
  document.addEventListener('pointerup',release,true);document.addEventListener('pointercancel',release,true);window.addEventListener('blur',release);
  const _slP=syncLayers;syncLayers=function(){if(down){pend=true;return}return _slP.apply(this,arguments)}}

/* ---------- Alt + click on the eye isolates a layer (again: shows everything) ---------- */
{const pane=$L('#pane-layers');pane.addEventListener('click',e=>{if(!e.altKey)return;const ey=e.target.closest('[data-eye]');if(!ey)return;const d=S.doc;if(!d)return;e.preventDefault();e.stopPropagation();
  const i=+ey.dataset.eye,L=d.layers[i];if(!L)return;const others=d.layers.filter(l=>l!==L),solo=L.visible&&others.every(l=>!l.visible);
  d.layers.forEach(l=>{l.visible=solo?true:l===L});markComp();pushHistory(solo?'Tout afficher':'Isoler le calque');syncLayers()},true)}

/* ---------- drag a layer in the panel to reorder it ---------- */
function moveLayerTo(from,to){const d=S.doc;if(!d||from===to||from<0||to<0||from>=d.layers.length||to>=d.layers.length)return;
  const L=d.layers[from],act=d.layers[d.active],arr=d.layers.slice();arr.splice(from,1);arr.splice(to,0,L);
  const gAt=k=>arr[k]&&arr[k].grp?arr[k].grp.id:null,a=gAt(to-1),b=gAt(to+1);
  if(a&&a===b&&(!L.grp||L.grp.id!==a))L.grp=arr[to-1].grp;
  else if(L.grp&&L.grp.id!==a&&L.grp.id!==b&&arr.some(l=>l!==L&&l.grp&&l.grp.id===L.grp.id))delete L.grp;
  d.layers=arr;d.active=L===act?to:arr.indexOf(act);markComp();pushHistory('Déplacer le calque');syncAll()}
{const pane=$L('#pane-layers');let dr=null;
  const rows=()=>[...pane.querySelectorAll('ul.lyrs li.lyr')].filter(li=>!li.hidden&&li.offsetParent);
  const slotAt=y=>{const rs=rows();if(!rs.length)return null;let best=null,bd=1e9;for(const li of rs){const r=li.getBoundingClientRect(),c=(r.top+r.bottom)/2,dd=Math.abs(y-c);if(dd<bd){bd=dd;best={li,above:y<c}}}return best};
  const clear=()=>pane.querySelectorAll('.fx-above,.fx-below').forEach(x=>x.classList.remove('fx-above','fx-below'));
  const end=()=>{document.removeEventListener('pointermove',mv,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('keydown',kd,true);document.body.classList.remove('fx-dragging');clear();if(dr&&dr.li)dr.li.classList.remove('fx-drag');dr=null};
  const mv=e=>{if(!dr)return;if(!(e.buttons&1)){end();return}if(!dr.on){if(Math.hypot(e.clientX-dr.x,e.clientY-dr.y)<6)return;dr.on=true;dr.li.classList.add('fx-drag');document.body.classList.add('fx-dragging')}
    const ul=pane.querySelector('ul.lyrs');if(ul){const r=ul.getBoundingClientRect();if(e.clientY<r.top+22)ul.scrollTop-=12;else if(e.clientY>r.bottom-22)ul.scrollTop+=12}
    const pr=pane.getBoundingClientRect(),inside=e.clientX>=pr.left&&e.clientX<=pr.right&&e.clientY>=pr.top&&e.clientY<=pr.bottom;
    clear();const s=inside?slotAt(e.clientY):null;dr.slot=s;if(s&&+s.li.dataset.i!==dr.i)s.li.classList.add(s.above?'fx-above':'fx-below');
    else if(s)dr.slot=null};
  const up=e=>{const was=dr;const on=was&&was.on,s=was&&was.slot;end();if(!on)return;
    const swallow=ev=>{ev.stopPropagation();ev.preventDefault()};document.addEventListener('click',swallow,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',swallow,true),0);
    if(!s)return;const d=S.doc;if(!d)return;const ri=+s.li.dataset.i;let pos=s.above?ri+1:ri;if(was.i<pos)pos--;moveLayerTo(was.i,pos)};
  const kd=e=>{if(e.key==='Escape'&&dr){e.preventDefault();e.stopPropagation();end()}};
  window.addEventListener('blur',()=>{if(dr)end()});
  pane.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||!S.doc)return;if(e.target.closest('button,input,select,textarea'))return;const li=e.target.closest('ul.lyrs li.lyr');if(!li)return;
    dr={li,i:+li.dataset.i,x:e.clientX,y:e.clientY,on:false,slot:null};document.addEventListener('pointermove',mv,true);document.addEventListener('pointerup',up,true);document.addEventListener('keydown',kd,true)});
  window.fxMoveLayerTo=moveLayerTo}

window.PrismL={addMask,toggleMaskOff,applyMask,moveLayerTo,bifBake,uniqueName};

/* ---------- Ctrl+[ / Ctrl+] by physical key, so they also work on AZERTY keyboards ---------- */
window.addEventListener('keydown',e=>{if(e.code!=='BracketLeft'&&e.code!=='BracketRight')return;if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return;const t=e.target;
  if(t&&t.matches&&t.matches('input:not([type=range]):not([type=checkbox]),textarea,select,[contenteditable]'))return;
  const bz=$L('#busy');if(!S.doc||(bz&&!bz.hidden)||($L('#scrim')&&!$L('#scrim').classList.contains('light'))||(typeof LIB!=='undefined'&&LIB.open))return;
  e.preventDefault();e.stopImmediatePropagation();moveLayer(e.code==='BracketRight'?1:-1)},true);

const _svL=stampVisible;
stampVisible=async function(){const d=S.doc,n0=d?d.layers.length:0;const r=await _svL.apply(this,arguments);const N=S.doc===d&&d?AL():null;
  if(N&&d.layers.length===n0+1&&N.name==='Calques fusionnés'){const nm=uniqueName(d,N.name,N);if(nm!==N.name){N.name=nm;resnap();syncAll()}}return r};

/* ---------- Ctrl+Alt+Shift+E: stamp the visible layers into a new layer ---------- */
window.addEventListener('keydown',e=>{if(e.code!=='KeyE'||!(e.ctrlKey||e.metaKey)||!e.shiftKey||!e.altKey)return;const t=e.target;if(t&&t.matches&&t.matches('input:not([type=range]),textarea,select,[contenteditable]'))return;
  if(!S.doc||($L('#scrim')&&!$L('#scrim').classList.contains('light')))return;e.preventDefault();e.stopImmediatePropagation();stampVisible()},true);
{const mi=MENU2.layer.items;MENU2.layer.items=()=>{const a=mi();a.forEach(x=>{if(x&&x.label==='Fusionner les calques visibles'&&!x.kbd)x.kbd=MOD+'⌥⇧E';else if(x&&x.label==='Monter le calque'&&!x.kbd)x.kbd=MOD+']';else if(x&&x.label==='Descendre le calque'&&!x.kbd)x.kbd=MOD+'['});return a}}
})();

