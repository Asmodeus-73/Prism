/* ===== wave34: effets modifiables. Un filtre appliqué garde la photo d'origine du calque et ses réglages ===== */
(()=>{
const valid=L=>!!(L&&L.fbase&&L.filters&&L.filters.length&&L.fout===L.canvas);
const chain=(base,list,upto)=>{let r=base;(list||[]).forEach((f,i)=>{if(upto!=null&&i>=upto)return;if(f.off)return;const F=FILTERS[f.id];if(F)r=F.run(r,f.p)});return r};
/* on retient les derniers réglages utilisés par chaque filtre */
Object.keys(FILTERS).forEach(id=>{const F=FILTERS[id],run=F.run;F.run=function(s,p){F._lp={...p};return run.call(F,s,p)}});
const byName=n=>Object.keys(FILTERS).find(k=>FILTERS[k].name===n);
const _am=applyMasked;
applyMasked=function(L,result,label){
  const id=byName(label),d=S.doc;
  if(id&&L&&L.kind==='pixel'&&d&&!d.sel&&!L.txt&&!L.shp&&!L.hi){
    const had=valid(L),base=had?L.fbase:L.canvas,list=(had?L.filters:[]).concat([{id,p:{...(FILTERS[id]._lp||{})}}]);
    L.fbase=base;L.filters=list;L.fout=result;
    _am(L,result,label);L.fout=L.canvas;return}
  if(L){delete L.fbase;delete L.filters;delete L.fout}
  return _am(L,result,label)};

function editEffect(L,i,after){
  const d=S.doc,list=L.filters,f=list[i],F=FILTERS[f.id];if(!F)return;
  const prefix=chain(L.fbase,list,i),p={...f.p};let tmr=null,fin=false;
  const run=()=>{const first=F.run(prefix,p);let r=first;for(let k=i+1;k<list.length;k++){const g=list[k];if(g.off)continue;const G=FILTERS[g.id];if(G)r=G.run(r,g.p)}return r};
  const prev=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{L.preview=run();markComp()},120)};
  dialog({title:F.name,light:true,body:F.params.map(q=>rangeRow('f-'+q[0],q[1],q[2],q[3],q[4],p[q[0]],q[6])).join(''),
    onOpen:el=>{F.params.forEach(q=>{const inp=$('#f-'+q[0],el);inp.oninput=()=>{p[q[0]]=+inp.value;$('#f-'+q[0]+'-o',el).textContent=fmtN(+inp.value,q[4])+q[6];prev()}})},
    buttons:[{label:'Annuler',onClick:()=>{clearTimeout(tmr);delete L.preview;markComp();after&&after()}},
      {label:'Appliquer',primary:true,onClick:()=>{clearTimeout(tmr);delete L.preview;const out=run();L.filters=list.map((g,k)=>k===i?{...g,p:{...p}}:g);L.canvas=out;L.fout=out;markComp();pushHistory('Modifier l’effet : '+F.name);syncAll();after&&after()}}]})}
function setList(L,list,label){
  const out=chain(L.fbase,list);L.filters=list;L.canvas=out;L.fout=out;if(!list.length){delete L.fbase;delete L.filters;delete L.fout}markComp();pushHistory(label);syncAll()}
function effectsDialog(){
  const d=S.doc;if(!d)return;const L=AL();
  if(!L||L.kind!=='pixel'){toast('Choisissez un calque de photo pour voir ses effets');return}
  if(!valid(L)){toast('Ce calque n’a pas d’effet modifiable. Appliquez un filtre depuis le menu Filtre : il restera modifiable.');return}
  const row=(f,i)=>{const F=FILTERS[f.id];return `<div class="fxr"><label><input type="checkbox" data-t="${i}" ${f.off?'':'checked'}> <b>${esc(F?F.name:f.id)}</b></label><span class="fxs">${F&&F.params.length?F.params.slice(0,2).map(q=>esc(q[1])+' '+fmtN(f.p[q[0]],q[4])+q[6]).join(' · '):''}</span><span class="fxb">${F&&F.params.length?`<button class="btn sm" data-e="${i}">Modifier</button>`:''}<button class="btn sm" data-d="${i}">Retirer</button></span></div>`};
  dialog({title:'Effets de filtre',light:true,body:`<p class="muted" style="margin:0 0 8px">Ces effets s’appliquent dans l’ordre, de haut en bas. Décochez pour comparer, ou rouvrez un effet pour changer ses réglages.</p><div class="fxl">${L.filters.map(row).join('')}</div>
   <style>.fxl{display:grid;gap:6px}.fxr{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:9px}.fxs{grid-column:1;font-size:11.5px;color:var(--fg-3)}.fxb{grid-column:2;grid-row:1/3;display:flex;gap:6px}</style>`,
    onOpen:el=>{
      el.addEventListener('change',e=>{const c=e.target.closest('[data-t]');if(!c)return;const i=+c.dataset.t;setList(L,L.filters.map((f,k)=>k===i?{...f,off:!c.checked}:f),'Effet '+(c.checked?'activé':'désactivé'));setTimeout(effectsDialog,0)});
      el.addEventListener('click',e=>{const b=e.target.closest('button[data-e],button[data-d]');if(!b)return;
        if(b.dataset.e!=null){closeDialog();editEffect(L,+b.dataset.e,()=>setTimeout(effectsDialog,0))}
        else{const i=+b.dataset.d;const nm=(FILTERS[L.filters[i].id]||{}).name||'effet';setList(L,L.filters.filter((f,k)=>k!==i),'Retirer : '+nm);setTimeout(()=>{if(valid(AL()))effectsDialog();else closeDialog()},0)}})},
    buttons:[{label:'Fermer',primary:true}]})}
/* menu Filtre : accès aux effets du calque */
const _fi=MENU2.filter.items;
MENU2.filter.items=()=>[..._fi(),SEP,MI('Effets du calque…',{icon:'filter',dis:S.doc?false:NODOC,fn:effectsDialog})];
window.PrismEffects={valid,effectsDialog,editEffect,setList};
})();

