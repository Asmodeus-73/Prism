/* ===== wave34 + bêta 17-18 : effets modifiables. Un filtre appliqué garde la photo d'origine du calque (L.fbase) et la liste de ses effets (L.filters).
   Chaque effet : {id,p} pour un filtre de FILTERS, ou {x,p} pour un effet déclaré par PrismEffects.defineX (pellicule, contraste local, IA…).
   f.m = la sélection d'origine (FxMask, enregistrée en PNG) ; f.den = un résultat intermédiaire coûteux gardé (FxSnap, enregistré en tuiles).
   La liste se recalcule depuis fbase, en asynchrone ; les sorties des effets lourds restent en cache tant que leur entrée ne change pas. ===== */
(()=>{
const valid=L=>!!(L&&L.fbase&&L.filters&&L.filters.length&&L.fout===L.canvas);
class FxMask{constructor(c){Object.defineProperty(this,'c',{value:c});this.u=null;
  setTimeout(()=>{try{c.toBlob(b=>{if(!b||this.u)return;const r=new FileReader();r.onload=()=>{if(!this.u)this.u=r.result};r.readAsDataURL(b)},'image/png')}catch(e){}},300)}
 toJSON(){if(!this.u)this.u=this.c.toDataURL('image/png');return this.u}}
/* un résultat intermédiaire lourd (débruitage IA) : en tuiles dans la base, comme fbase ; tant que l'encodage n'est pas fini, il n'est pas enregistré */
class FxSnap{constructor(c,t){Object.defineProperty(this,'c',{value:c});this.t=t||null;if(!t)encodeCanvas(c).then(x=>{this.t=x}).catch(e=>console.warn(e))}
 toJSON(){return this.t}}
const DEC=new Map(),XFX={};
const own=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
const FX=id=>own(FILTERS,id)?FILTERS[id]:null,XF=k=>own(XFX,k)?XFX[k]:null;
const maskOf=f=>!f.m?null:f.m instanceof FxMask?f.m.c:DEC.get(f.m)||null;
const snapOf=f=>f.den instanceof FxSnap?f.den.c:null;
const nameOf=f=>String(f.x?(XF(f.x)?XF(f.x).name:f.x):(FX(f.id)?FX(f.id).name:f.id)).slice(0,80);
const canEdit=f=>f.x?!!(XF(f.x)&&XF(f.x).edit):!!(FX(f.id)&&FX(f.id).params.length);
const strip=f=>{const o={...f};delete o.den;delete o.dsig;delete o.off;if(o.m){if(!o.mid)o.mid=typeof o.m==='string'?'s'+o.m.length:'m';delete o.m}return o};
const sigAt=(list,i)=>JSON.stringify(list.slice(0,i).filter(f=>!f.off).map(strip));
function ready(list,L){return Promise.all((list||[]).map(async f=>{
  /* un masque vient d'un projet, peut-être reçu : seulement une image PNG intégrée, jamais une adresse (elle trahirait l'ouverture du projet) */
  if(f.m!=null&&!(f.m instanceof FxMask)&&!(typeof f.m==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(f.m)))throw new Error('masque refusé');
  if(typeof f.m==='string'&&!DEC.has(f.m))await new Promise((ok,ko)=>{const im=new Image();im.onload=()=>{if(L&&L.fbase&&(im.width!==L.fbase.width||im.height!==L.fbase.height)){ko(new Error('masque refusé (taille)'));return}const c=mk(im.width,im.height);cx(c).drawImage(im,0,0);DEC.set(f.m,c);ok()};im.onerror=()=>ko(new Error('masque illisible'));im.src=f.m});
  if(Array.isArray(f.den)&&L&&L.fbase){try{const c=await decodeTiles(f.den,L.fbase.width,L.fbase.height,t=>IDB.get('blobs',t.key));encCache.set(c,f.den);f.den=new FxSnap(c,f.den)}catch(e){f.den=null}}}))}
const mix=(prev,res,m)=>{const out=cloneC(prev),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(m,0,0);const t=cloneC(res),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(m,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};
/* cache des effets déclarés : l'état du calque après un effet ne dépend que de fbase et des effets actifs jusqu'à lui (sigAt) ;
   on garde ces états pour les effets lourds, 50 Mpx au plus en mémoire */
const SC=new WeakMap(),LRU=[];let scPx=0;
const scGet=(b,k)=>{const m=SC.get(b);return m?m.get(k):null};
const scPut=(b,k,o)=>{if(!b||!o)return;let m=SC.get(b);if(!m)SC.set(b,m=new Map());if(m.has(k))return;m.set(k,o);LRU.push([b,k,o.width*o.height]);scPx+=o.width*o.height;
  while(scPx>5e7&&LRU.length>1){const [x,y,n]=LRU.shift();scPx-=n;const q=SC.get(x);q&&q.delete(y)}};
async function stepA(L,r,f,p,list,i,onP){if(f.off)return r;const q=p||f.p;let o;
  if(f.x){const X=XF(f.x);if(!X)throw new Error('effet inconnu');const sig=sigAt(list,i),ctx={snap:f.dsig===sig?snapOf(f):null,mask:maskOf(f),keep:c=>{f.den=new FxSnap(c);f.dsig=sig}};
    o=await X.run({...L,canvas:r},JSON.parse(JSON.stringify(q)),ctx,onP);if(!o)throw new Error(X.name+' impossible')}
  else{const F=FX(f.id);if(!F)return r;/* réglages venus d'un projet : bornés à ceux de la fenêtre du filtre */
    const c={...q};for(const t of F.params){const v=+c[t[0]];c[t[0]]=Number.isFinite(v)?Math.min(t[3],Math.max(t[2],v)):t[5]}o=F.run(r,c)}
  if(f.m){const m=maskOf(f);if(!m)throw new Error('masque non chargé');o=mix(r,o,m)}
  if(f.x&&!p)scPut(L.fbase,sigAt(list,i+1),o);return o}
async function chainA(L,base,list,upto,from,start){let r=start||base,i0=from||0;const n=upto==null?list.length:upto;
  /* on repart du dernier état gardé en cache */
  for(let j=n-1;j>=i0;j--){if(list[j].off||!list[j].x)continue;const c=scGet(L.fbase,sigAt(list,j+1));if(c){r=c;i0=j+1;break}}
  for(let i=i0;i<n;i++)r=await stepA(L,r,list[i],null,list,i,v=>busy(true,'Recalcul : '+nameOf(list[i])+'…',v));return r}
/* recalcul avec la barre d'attente seulement s'il dure */
async function withBusy(fn){let shown=false;const t=setTimeout(()=>{shown=true;busy(true,'Recalcul des effets…',null)},250);try{return await fn()}finally{clearTimeout(t);if(shown||$('#busy:not([hidden])'))busy(false)}}
/* on retient les derniers réglages utilisés par chaque filtre */
Object.keys(FILTERS).forEach(id=>{const F=FILTERS[id],run=F.run;F.run=function(s,p){F._lp={...p};return run.call(F,s,p)}});
const byName=n=>Object.keys(FILTERS).find(k=>FILTERS[k].name===n);
let quiet=0,PEND=null,EDIT=null;
/* un effet déclaré annonce ses réglages juste avant applyMasked */
function note(key,p,extra){const q=JSON.parse(JSON.stringify(p||{}));PEND={key,p:q,extra:extra||null}}
function defineX(key,def){XFX[key]=def}
const _am=applyMasked;
applyMasked=function(L,result,label){
  const d=S.doc,pend=PEND;PEND=null;
  if(EDIT&&L===EDIT.L&&pend&&pend.key===EDIT.f.x){finishEdit(pend,result);return}
  const xk=pend&&XF(pend.key)&&XF(pend.key).name===label?pend.key:null,id=xk?null:byName(label);
  if((id||xk)&&L&&L.kind==='pixel'&&d&&!L.txt&&!L.shp&&!L.hi){
    const had=valid(L),base=had?L.fbase:L.canvas,prev=had?L.filters:[],f=xk?{x:xk,p:pend.p}:{id,p:{...(FILTERS[id]._lp||{})}};
    if(d.sel){f.m=new FxMask(cloneC(d.sel));f.mid=Math.random().toString(36).slice(2,10)}
    if(xk&&pend.extra&&pend.extra.den){f.den=new FxSnap(pend.extra.den);f.dsig=sigAt(prev,prev.length)}
    const out=d.sel?mix(L.canvas,result,d.sel):result;
    if(xk)scPut(base,sigAt(prev.concat([f]),prev.length+1),out);
    L.fbase=base;L.filters=prev.concat([f]);L.canvas=out;L.fout=out;markComp();pushHistory(label);return}
  if(L){delete L.fbase;delete L.filters;delete L.fout}
  return _am(L,result,label)};
/* peindre, déformer ou appliquer un réglage d'image fusionne les effets : on le dit, une seule fois par changement */
const _ph=pushHistory;
pushHistory=function(label){try{if(!quiet)lostCheck()}catch(e){console.warn(e)}return _ph.apply(this,arguments)};
function lostCheck(){const d=S.doc,h=S.history&&S.history[S.hi];if(!d||!h||!h.layers)return;
  const was=new Set(h.layers.filter(valid).map(l=>l.id));if(!was.size)return;
  const lost=d.layers.filter(L=>was.has(L.id)&&!valid(L)&&!(EDIT&&EDIT.L===L));if(!lost.length)return;
  lost.forEach(L=>{delete L.fbase;delete L.filters;delete L.fout});
  toast(lost.length>1?'Effets fusionnés aux calques : ils ne sont plus modifiables':'Les effets de « '+lost[0].name+' » sont fusionnés au calque',4000)}
const failed=e=>{console.warn(e);toast('Effet impossible à recalculer : '+(e.message||e),5000)};

/* ---------- modifier un effet déclaré : le calque revient à l'état d'avant l'effet, la fenêtre de l'effet s'ouvre avec ses réglages ---------- */
async function editX(L,i,after){const d=S.doc,list=L.filters,f=list[i],X=XF(f.x);if(!X||!X.edit)return;
  let prefix;try{prefix=await withBusy(()=>chainA(L,L.fbase,list,i))}catch(e){failed(e);return}
  if(S.doc!==d||!valid(L)||L.filters!==list)return;
  EDIT={L,i,list,f,orig:L.canvas,sel:d.sel,doc:d,after,t0:Date.now(),seen:false};
  L.canvas=prefix;d.sel=maskOf(f)||null;selChanged();markComp();
  try{X.edit(JSON.parse(JSON.stringify(f.p)),{snap:f.dsig===sigAt(list,i)?snapOf(f):null})}catch(e){console.error(e);cancelEdit();return}
  watchEdit()}
function cancelEdit(){const e=EDIT;if(!e)return;EDIT=null;if(S.doc===e.doc&&e.doc.layers.includes(e.L)){delete e.L.preview;e.L.canvas=e.orig;e.doc.sel=e.sel;selChanged();markComp();syncAll()}e.after&&e.after()}
/* la fenêtre fermée sans résultat (Annuler, Échap, échec du calcul) : on remet le calque comme avant */
function watchEdit(){const e=EDIT;if(!e)return;const tick=()=>{if(EDIT!==e)return;const open=$('#scrim')||$('#busy:not([hidden])');if(open)e.seen=true;
  if(!open&&(e.seen||Date.now()-e.t0>4000)){setTimeout(()=>{if(EDIT===e&&!$('#scrim')&&!$('#busy:not([hidden])'))cancelEdit();else if(EDIT===e)setTimeout(tick,300)},400);return}setTimeout(tick,300)};setTimeout(tick,300)}
async function finishEdit(pend,result){const e=EDIT;EDIT=null;const {L,i,list,f,doc:d}=e;if(S.doc!==d||!d.layers.includes(L))return;
  d.sel=e.sel;selChanged();
  const nf={...f,p:pend.p};if(pend.extra&&pend.extra.den){nf.den=new FxSnap(pend.extra.den);nf.dsig=sigAt(list,i)}
  const prefix=L.canvas,m=maskOf(f),first=m?mix(prefix,result,m):result,nl=list.map((g,k)=>k===i?nf:g);
  scPut(L.fbase,sigAt(nl,i+1),first);
  try{const out=await withBusy(()=>chainA(L,L.fbase,nl,null,i+1,first));delete L.preview;L.filters=nl;L.canvas=out;L.fout=out;markComp();quiet++;try{pushHistory('Modifier l’effet : '+nameOf(f))}finally{quiet--}syncAll()}
  catch(err){failed(err);L.canvas=e.orig;markComp();syncAll()}
  e.after&&e.after()}

function editEffect(L,i,after){
  const list=L.filters,f=list&&list[i];if(!f||!canEdit(f))return;
  ready(list,L).then(()=>f.x?editX(L,i,after):openEdit(L,i,after),e=>{console.warn(e);toast('Effet illisible : '+(e.message||e),4000)})}
async function openEdit(L,i,after){
  const d=S.doc,list=L.filters,f=list[i],F=FX(f.id);
  let prefix;try{prefix=await withBusy(()=>chainA(L,L.fbase,list,i))}catch(e){failed(e);return}
  const p={...f.p};let tmr=null,job=0;
  const run=async()=>{const first=await stepA(L,prefix,{...f,off:false},p,list,i);return chainA(L,L.fbase,list,null,i+1,first)};
  const prev=()=>{clearTimeout(tmr);tmr=setTimeout(async()=>{const my=++job;try{const r=await run();if(my===job){L.preview=r;markComp()}}catch(e){console.warn(e)}},120)};
  dialog({title:F.name,light:true,body:F.params.map(q=>rangeRow('f-'+q[0],q[1],q[2],q[3],q[4],p[q[0]],q[6])).join(''),
    onOpen:el=>{F.params.forEach(q=>{const inp=$('#f-'+q[0],el);inp.oninput=()=>{p[q[0]]=+inp.value;$('#f-'+q[0]+'-o',el).textContent=fmtN(+inp.value,q[4])+q[6];prev()}})},
    buttons:[{label:'Annuler',onClick:()=>{clearTimeout(tmr);job++;delete L.preview;markComp();after&&after()}},
      {label:'Appliquer',primary:true,onClick:()=>{clearTimeout(tmr);job++;withBusy(run).then(out=>{delete L.preview;L.filters=list.map((g,k)=>k===i?{...g,p:{...p}}:g);L.canvas=out;L.fout=out;markComp();quiet++;try{pushHistory('Modifier l’effet : '+F.name)}finally{quiet--}syncAll();after&&after()},e=>{delete L.preview;markComp();failed(e)})}}]})}
function setList(L,list,label){
  return ready(list,L).then(()=>withBusy(()=>chainA(L,L.fbase,list))).then(out=>{if(!S.doc||!S.doc.layers.includes(L)||!valid(L))return;
    L.filters=list;L.canvas=out;L.fout=out;if(!list.length){delete L.fbase;delete L.filters;delete L.fout}markComp();quiet++;try{pushHistory(label)}finally{quiet--}syncAll()},failed)}
function effectsDialog(){
  const d=S.doc;if(!d)return;const L=AL();
  if(!L||L.kind!=='pixel'){toast('Choisissez un calque de photo pour voir ses effets');return}
  if(!valid(L)){toast('Ce calque n’a pas d’effet modifiable. Un filtre du menu Filtre reste modifiable.');return}
  const row=(f,i)=>{const F=f.x?null:FX(f.id),info=F&&F.params.length?F.params.slice(0,2).map(q=>esc(q[1])+' '+fmtN(f.p[q[0]],q[4])+q[6]).join(' · '):'';
    return `<div class="fxr"><label><input type="checkbox" data-t="${i}" ${f.off?'':'checked'}> <b>${esc(nameOf(f))}</b></label><span class="fxs">${info}${f.m?(info?' · ':'')+'sélection':''}</span><span class="fxb">${canEdit(f)?`<button class="btn sm" data-e="${i}">Modifier</button>`:''}<button class="btn sm" data-d="${i}">Retirer</button></span></div>`};
  dialog({title:'Effets de filtre',light:true,body:`<p class="muted" style="margin:0 0 8px">Ces effets s’appliquent dans l’ordre, de haut en bas. Décochez pour comparer, ou rouvrez un effet pour changer ses réglages.</p><div class="fxl">${L.filters.map(row).join('')}</div>
   <style>.fxl{display:grid;gap:6px}.fxr{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:9px}.fxs{grid-column:1;font-size:11.5px;color:var(--fg-3)}.fxb{grid-column:2;grid-row:1/3;display:flex;gap:6px}</style>`,
    onOpen:el=>{
      el.addEventListener('change',e=>{const c=e.target.closest('[data-t]');if(!c)return;const i=+c.dataset.t;setList(L,L.filters.map((f,k)=>k===i?{...f,off:!c.checked}:f),'Effet '+(c.checked?'activé':'désactivé')).then(()=>{if($('#scrim'))effectsDialog()})});
      el.addEventListener('click',e=>{const b=e.target.closest('button[data-e],button[data-d]');if(!b)return;
        if(b.dataset.e!=null){closeDialog();editEffect(L,+b.dataset.e,()=>setTimeout(()=>{if(!$('#scrim'))effectsDialog()},0))}
        else{const i=+b.dataset.d;const nm=nameOf(L.filters[i]);setList(L,L.filters.filter((f,k)=>k!==i),'Retirer : '+nm).then(()=>{if(valid(AL()))effectsDialog();else closeDialog()})}})},
    buttons:[{label:'Fermer',primary:true}]})}
/* panneau Calques : les effets s'affichent sous leur calque (œil pour comparer, clic pour modifier, × pour retirer) */
const EYE_ON='<path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"/><circle cx="10" cy="10" r="2.6"/>',
  EYE_OFF='<path d="M3 3l14 14M8.3 4.7A8.4 8.4 0 0 1 10 4.5c5.5 0 8.5 5.5 8.5 5.5a14 14 0 0 1-2.3 3M5.3 6.2C2.9 7.8 1.5 10 1.5 10s3 5.5 8.5 5.5a8 8 0 0 0 3.6-.8"/>';
{const st=document.createElement('style');st.textContent=`
.lyrs li.lfx{list-style:none;display:grid;gap:1px;margin:0 0 4px 34px;padding:2px 0 2px 8px;border-left:2px solid var(--line)}
.lyrs li.lfx.ingrp{margin-left:48px}
.lfx-h{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--fg-3);padding:2px 0 1px}
.lfx-r{display:flex;align-items:center;gap:2px;min-height:24px;border-radius:6px}
.lfx-r:hover{background:color-mix(in srgb,currentColor 8%,transparent)}
.lfx-r .ib{width:22px;height:22px;padding:0;flex:none}
.lfx-r .ib svg{width:14px;height:14px}
.lfx-n{flex:1;min-width:0;text-align:left;background:none;border:0;color:inherit;font:inherit;font-size:12px;padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.lfx-n[disabled]{cursor:default;color:inherit}
.lfx-n i{font-style:normal;font-size:10.5px;color:var(--fg-3);margin-left:6px}
.lfx-r.off .lfx-n{opacity:.5;text-decoration:line-through}
.lfx-x{opacity:0;font-size:15px;line-height:1}
.lfx-r:hover .lfx-x,.lfx-x:focus-visible{opacity:.75}
@media (hover:none){.lfx-x{opacity:.6}}`;document.head.appendChild(st)}
function decorateFx(){const ul=document.querySelector('#pane-layers ul.lyrs'),d=S.doc;if(!ul||!d)return;
  ul.querySelectorAll('li.lyr').forEach(li=>{const i=+li.dataset.i,L=d.layers[i];if(!valid(L))return;
    const rows=L.filters.map((f,k)=>{const ed=canEdit(f);
      return `<div class="lfx-r${f.off?' off':''}"><button class="ib" data-fxt="${i}:${k}" aria-label="${f.off?'Afficher l’effet':'Masquer l’effet'}" title="${f.off?'Afficher l’effet':'Masquer l’effet'}"><svg viewBox="0 0 20 20">${f.off?EYE_OFF:EYE_ON}</svg></button><button class="lfx-n" data-fxe="${i}:${k}" ${ed?'title="Modifier l’effet"':'disabled'}>${esc(nameOf(f))}${f.m?'<i>sélection</i>':''}</button><button class="ib lfx-x" data-fxd="${i}:${k}" aria-label="Retirer l’effet" title="Retirer l’effet">×</button></div>`}).join('');
    li.insertAdjacentHTML('afterend',`<li class="lfx${li.classList.contains('ingrp')?' ingrp':''}" data-fxl="${i}"${li.hidden?' hidden':''}><div class="lfx-h">Effets</div>${rows}</li>`)})}
const _slx=syncLayers;syncLayers=function(){const r=_slx.apply(this,arguments);try{decorateFx()}catch(e){console.warn(e)}return r};
$('#pane-layers').addEventListener('click',e=>{const b=e.target.closest('[data-fxt],[data-fxe],[data-fxd]');if(!b)return;e.stopPropagation();
  const d=S.doc,[i,k]=(b.dataset.fxt||b.dataset.fxe||b.dataset.fxd).split(':').map(Number),L=d&&d.layers[i],f=valid(L)&&L.filters[k];if(!f)return;
  const nm=nameOf(f);
  if(b.dataset.fxt!=null)setList(L,L.filters.map((g,j)=>j===k?{...g,off:!g.off}:g),f.off?'Effet activé':'Effet désactivé');
  else if(b.dataset.fxd!=null)setList(L,L.filters.filter((g,j)=>j!==k),'Retirer : '+nm);
  else{if(d.active!==i){d.active=i;syncAll()}editEffect(L,k)}},true);
/* menu Filtre : accès aux effets du calque */
const _fi=MENU2.filter.items;
MENU2.filter.items=()=>[..._fi(),SEP,MI('Effets du calque…',{icon:'filter',dis:S.doc?false:NODOC,fn:effectsDialog})];
window.PrismEffects={valid,effectsDialog,editEffect,setList,ready,defineX,note,editing:L=>!!(EDIT&&(!L||EDIT.L===L)),cancelEdit};
})();

