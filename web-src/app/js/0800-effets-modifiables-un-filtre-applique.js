/* ===== wave34: effets modifiables. Un filtre appliqué garde la photo d'origine du calque et ses réglages ===== */
(()=>{
const valid=L=>!!(L&&L.fbase&&L.filters&&L.filters.length&&L.fout===L.canvas);
/* bêta 17 : un filtre appliqué à une sélection reste modifiable. La sélection est gardée avec l'effet (f.m) :
   un FxMask en mémoire, enregistré en PNG (toJSON) ; à la réouverture f.m est ce PNG, décodé par ready() avant tout recalcul */
class FxMask{constructor(c){Object.defineProperty(this,'c',{value:c});this.u=null;
  setTimeout(()=>{try{c.toBlob(b=>{if(!b||this.u)return;const r=new FileReader();r.onload=()=>{if(!this.u)this.u=r.result};r.readAsDataURL(b)},'image/png')}catch(e){}},300)}
 toJSON(){if(!this.u)this.u=this.c.toDataURL('image/png');return this.u}}
const DEC=new Map();
const maskOf=f=>!f.m?null:f.m instanceof FxMask?f.m.c:DEC.get(f.m)||null;
const ready=list=>Promise.all((list||[]).filter(f=>typeof f.m==='string'&&!DEC.has(f.m)).map(f=>new Promise((ok,ko)=>{const im=new Image();im.onload=()=>{const c=mk(im.width,im.height);cx(c).drawImage(im,0,0);DEC.set(f.m,c);ok()};im.onerror=()=>ko(new Error('masque illisible'));im.src=f.m})));
const mix=(prev,res,m)=>{const out=cloneC(prev),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(m,0,0);const t=cloneC(res),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(m,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};
const step=(r,f,p)=>{const F=FILTERS[f.id];if(!F||f.off)return r;const o=F.run(r,p||f.p);if(!f.m)return o;const m=maskOf(f);if(!m)throw new Error('masque non chargé');return mix(r,o,m)};
const chain=(base,list,upto)=>{let r=base;(list||[]).forEach((f,i)=>{if(upto!=null&&i>=upto)return;r=step(r,f)});return r};
/* on retient les derniers réglages utilisés par chaque filtre */
Object.keys(FILTERS).forEach(id=>{const F=FILTERS[id],run=F.run;F.run=function(s,p){F._lp={...p};return run.call(F,s,p)}});
const byName=n=>Object.keys(FILTERS).find(k=>FILTERS[k].name===n);
let quiet=0;
const _am=applyMasked;
applyMasked=function(L,result,label){
  const id=byName(label),d=S.doc;
  if(id&&L&&L.kind==='pixel'&&d&&!L.txt&&!L.shp&&!L.hi){
    const had=valid(L),base=had?L.fbase:L.canvas,f={id,p:{...(FILTERS[id]._lp||{})}};
    if(d.sel)f.m=new FxMask(cloneC(d.sel));
    const out=d.sel?mix(L.canvas,result,d.sel):result;
    L.fbase=base;L.filters=(had?L.filters:[]).concat([f]);L.canvas=out;L.fout=out;markComp();pushHistory(label);return}
  if(L){delete L.fbase;delete L.filters;delete L.fout}
  return _am(L,result,label)};
/* peindre, déformer ou appliquer un réglage d'image fusionne les effets : on le dit, une seule fois par changement */
const _ph=pushHistory;
pushHistory=function(label){try{if(!quiet)lostCheck()}catch(e){console.warn(e)}return _ph.apply(this,arguments)};
function lostCheck(){const d=S.doc,h=S.history&&S.history[S.hi];if(!d||!h||!h.layers)return;
  const was=new Set(h.layers.filter(valid).map(l=>l.id));if(!was.size)return;
  const lost=d.layers.filter(L=>was.has(L.id)&&!valid(L));if(!lost.length)return;
  lost.forEach(L=>{delete L.fbase;delete L.filters;delete L.fout});
  toast(lost.length>1?'Effets fusionnés aux calques : ils ne sont plus modifiables':'Les effets de « '+lost[0].name+' » sont fusionnés au calque',4000)}

function editEffect(L,i,after){
  const list=L.filters,f=list&&list[i],F=f&&FILTERS[f.id];if(!F)return;
  ready(list).then(()=>openEdit(L,i,after),e=>{console.warn(e);toast('Effet illisible : '+(e.message||e),4000)})}
function openEdit(L,i,after){
  const d=S.doc,list=L.filters,f=list[i],F=FILTERS[f.id];
  const prefix=chain(L.fbase,list,i),p={...f.p};let tmr=null;
  const run=()=>{let r=step(prefix,{...f,off:false},p);for(let k=i+1;k<list.length;k++)r=step(r,list[k]);return r};
  const prev=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{L.preview=run();markComp()},120)};
  dialog({title:F.name,light:true,body:F.params.map(q=>rangeRow('f-'+q[0],q[1],q[2],q[3],q[4],p[q[0]],q[6])).join(''),
    onOpen:el=>{F.params.forEach(q=>{const inp=$('#f-'+q[0],el);inp.oninput=()=>{p[q[0]]=+inp.value;$('#f-'+q[0]+'-o',el).textContent=fmtN(+inp.value,q[4])+q[6];prev()}})},
    buttons:[{label:'Annuler',onClick:()=>{clearTimeout(tmr);delete L.preview;markComp();after&&after()}},
      {label:'Appliquer',primary:true,onClick:()=>{clearTimeout(tmr);delete L.preview;const out=run();L.filters=list.map((g,k)=>k===i?{...g,p:{...p}}:g);L.canvas=out;L.fout=out;markComp();pushHistory('Modifier l’effet : '+F.name);syncAll();after&&after()}}]})}
function setList(L,list,label){
  return ready(list).then(()=>{if(!S.doc||!S.doc.layers.includes(L)||!valid(L))return;
    const out=chain(L.fbase,list);L.filters=list;L.canvas=out;L.fout=out;if(!list.length){delete L.fbase;delete L.filters;delete L.fout}markComp();quiet++;try{pushHistory(label)}finally{quiet--}syncAll()},e=>{console.warn(e);toast('Effet illisible : '+(e.message||e),4000)})}
function effectsDialog(){
  const d=S.doc;if(!d)return;const L=AL();
  if(!L||L.kind!=='pixel'){toast('Choisissez un calque de photo pour voir ses effets');return}
  if(!valid(L)){toast('Ce calque n’a pas d’effet modifiable. Un filtre du menu Filtre reste modifiable.');return}
  const row=(f,i)=>{const F=FILTERS[f.id];return `<div class="fxr"><label><input type="checkbox" data-t="${i}" ${f.off?'':'checked'}> <b>${esc(F?F.name:f.id)}</b></label><span class="fxs">${F&&F.params.length?F.params.slice(0,2).map(q=>esc(q[1])+' '+fmtN(f.p[q[0]],q[4])+q[6]).join(' · '):''}${f.m?(F&&F.params.length?' · ':'')+'sélection':''}</span><span class="fxb">${F&&F.params.length?`<button class="btn sm" data-e="${i}">Modifier</button>`:''}<button class="btn sm" data-d="${i}">Retirer</button></span></div>`};
  dialog({title:'Effets de filtre',light:true,body:`<p class="muted" style="margin:0 0 8px">Ces effets s’appliquent dans l’ordre, de haut en bas. Décochez pour comparer, ou rouvrez un effet pour changer ses réglages.</p><div class="fxl">${L.filters.map(row).join('')}</div>
   <style>.fxl{display:grid;gap:6px}.fxr{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:9px}.fxs{grid-column:1;font-size:11.5px;color:var(--fg-3)}.fxb{grid-column:2;grid-row:1/3;display:flex;gap:6px}</style>`,
    onOpen:el=>{
      el.addEventListener('change',e=>{const c=e.target.closest('[data-t]');if(!c)return;const i=+c.dataset.t;setList(L,L.filters.map((f,k)=>k===i?{...f,off:!c.checked}:f),'Effet '+(c.checked?'activé':'désactivé')).then(()=>{if($('#scrim'))effectsDialog()})});
      el.addEventListener('click',e=>{const b=e.target.closest('button[data-e],button[data-d]');if(!b)return;
        if(b.dataset.e!=null){closeDialog();editEffect(L,+b.dataset.e,()=>setTimeout(()=>{if(!$('#scrim'))effectsDialog()},0))}
        else{const i=+b.dataset.d;const nm=(FILTERS[L.filters[i].id]||{}).name||'effet';setList(L,L.filters.filter((f,k)=>k!==i),'Retirer : '+nm).then(()=>{if(valid(AL()))effectsDialog();else closeDialog()})}})},
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
    const rows=L.filters.map((f,k)=>{const F=FILTERS[f.id],ed=F&&F.params.length;
      return `<div class="lfx-r${f.off?' off':''}"><button class="ib" data-fxt="${i}:${k}" aria-label="${f.off?'Afficher l’effet':'Masquer l’effet'}" title="${f.off?'Afficher l’effet':'Masquer l’effet'}"><svg viewBox="0 0 20 20">${f.off?EYE_OFF:EYE_ON}</svg></button><button class="lfx-n" data-fxe="${i}:${k}" ${ed?'title="Modifier l’effet"':'disabled'}>${esc(F?F.name:f.id)}${f.m?'<i>sélection</i>':''}</button><button class="ib lfx-x" data-fxd="${i}:${k}" aria-label="Retirer l’effet" title="Retirer l’effet">×</button></div>`}).join('');
    li.insertAdjacentHTML('afterend',`<li class="lfx${li.classList.contains('ingrp')?' ingrp':''}" data-fxl="${i}"${li.hidden?' hidden':''}><div class="lfx-h">Effets</div>${rows}</li>`)})}
const _slx=syncLayers;syncLayers=function(){const r=_slx.apply(this,arguments);try{decorateFx()}catch(e){console.warn(e)}return r};
$('#pane-layers').addEventListener('click',e=>{const b=e.target.closest('[data-fxt],[data-fxe],[data-fxd]');if(!b)return;e.stopPropagation();
  const d=S.doc,[i,k]=(b.dataset.fxt||b.dataset.fxe||b.dataset.fxd).split(':').map(Number),L=d&&d.layers[i],f=valid(L)&&L.filters[k];if(!f)return;
  const nm=(FILTERS[f.id]||{}).name||'effet';
  if(b.dataset.fxt!=null)setList(L,L.filters.map((g,j)=>j===k?{...g,off:!g.off}:g),f.off?'Effet activé':'Effet désactivé');
  else if(b.dataset.fxd!=null)setList(L,L.filters.filter((g,j)=>j!==k),'Retirer : '+nm);
  else{if(d.active!==i){d.active=i;syncAll()}editEffect(L,k)}},true);
/* menu Filtre : accès aux effets du calque */
const _fi=MENU2.filter.items;
MENU2.filter.items=()=>[..._fi(),SEP,MI('Effets du calque…',{icon:'filter',dis:S.doc?false:NODOC,fn:effectsDialog})];
window.PrismEffects={valid,effectsDialog,editEffect,setList,ready};
})();

