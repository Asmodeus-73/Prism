/* ===== wave32: formes combinées (union, soustraction, intersection, exclusion) et repères enregistrés ===== */
(()=>{
const OPS=[['add','Union','Fusionne les formes en une seule'],['sub','Soustraction','Retire les formes du dessus de celle du dessous'],['int','Intersection','Garde uniquement la zone commune'],['xor','Exclusion','Garde les zones non communes']];
const COMP={add:'source-over',sub:'destination-out',int:'destination-in',xor:'xor'};
const simple=s=>s&&s.type!=='compound'&&s.type!=='line'&&s.type!=='arrow';
const _dst=drawShapeTo;
drawShapeTo=function(c,s){
  if(!s||s.type!=='compound')return _dst(c,s);
  const w=c.width,h=c.height,m=mk(w,h),mg=cx(m);
  s.parts.forEach((p,i)=>{const t=mk(w,h);_dst(t,{...p.s,fill:'#000',stroke:null,sw:0});mg.globalCompositeOperation=i?COMP[p.op]||'source-over':'source-over';mg.drawImage(t,0,0)});
  const g=cx(c);g.clearRect(0,0,w,h);g.drawImage(m,0,0);g.globalCompositeOperation='source-in';g.fillStyle=s.fill||'#ffffff';g.fillRect(0,0,w,h);g.globalCompositeOperation='source-over'};
function combine(idx,op){const d=S.doc;if(!d)return;const ls=idx.map(i=>d.layers[i]).filter(L=>L&&L.shp);
  if(ls.length<2){toast('Choisissez au moins deux formes');return false}
  const base=ls[0];
  if(ls.slice(1).some(L=>!simple(L.shp))){toast('Seules les formes simples peuvent être ajoutées (pas les lignes, flèches ni formes déjà combinées)');return false}
  const parts=base.shp.type==='compound'?base.shp.parts.map(p=>({...p})):[{s:{...base.shp,fill:'#000',stroke:null},op:'add'}];
  if(base.shp.type!=='compound'&&!simple(base.shp)){toast('Une ligne ou une flèche ne peut pas être combinée');return false}
  ls.slice(1).forEach(L=>parts.push({s:{...L.shp,fill:'#000',stroke:null},op}));
  const fill=base.shp.fill||base.shp.stroke||S.opts.shape.fill;
  base.shp={type:'compound',parts,fill,stroke:null,sw:0};base.name='Forme combinée';finalizeMeta(base);
  const rm=new Set(ls.slice(1));d.layers=d.layers.filter(L=>!rm.has(L));d.active=d.layers.indexOf(base);
  markComp();pushHistory('Combiner les formes');syncAll();return true}
function combineDialog(){const d=S.doc;if(!d)return;
  const idx=d.layers.map((L,i)=>L.shp&&L.kind==='pixel'?i:-1).filter(i=>i>=0);
  if(idx.length<2){toast('Il faut au moins deux calques de forme : dessinez-les avec l’outil Formes');return}
  const pre=new Set([d.active,...idx.filter(i=>i<d.active).slice(-1)]);
  dialog({title:'Combiner les formes',light:true,body:`<p class="muted" style="margin:0 0 8px">Cochez les formes à combiner. Celle du dessous sert de base.</p><div class="cb-list">${idx.slice().reverse().map(i=>`<label class="cb-row"><input type="checkbox" data-i="${i}" ${pre.has(i)?'checked':''}> ${esc(d.layers[i].name)}</label>`).join('')}</div>
    <div class="cb-ops">${OPS.map(([v,n,t],k)=>`<label title="${t}"><input type="radio" name="cbOp" value="${v}" ${k===0?'checked':''}> ${n}</label>`).join('')}</div>
    <style>.cb-list{display:grid;gap:4px;max-height:200px;overflow:auto;margin-bottom:10px}.cb-row{display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--line);border-radius:8px}.cb-ops{display:flex;flex-wrap:wrap;gap:6px 14px}</style>`,
    buttons:[{label:'Annuler'},{label:'Combiner',primary:true,onClick:()=>{const ids=[...document.querySelectorAll('.cb-row input:checked')].map(x=>+x.dataset.i).sort((a,b)=>a-b),op=document.querySelector('input[name=cbOp]:checked').value;combine(ids,op)}}]})}
const _se=shapeEdit;
shapeEdit=function(L){
  if(L&&L.shp&&L.shp.type==='compound'){const orig=L.shp;let fin=false;
    dialog({title:'Modifier la forme combinée',light:true,body:`<div class="dlg-grid"><label>Remplissage<input type="color" class="swatch" id="ccF" value="${esc(orig.fill&&orig.fill[0]==='#'?orig.fill:'#ffffff')}"></label></div>`,
      onOpen:el=>{$('#ccF',el).oninput=e=>{L.shp={...orig,fill:e.target.value};L.preview=pvCanvas(L);drawShapeTo(L.preview,L.shp);markComp()}},
      buttons:[{label:'Annuler',onClick:()=>{L.shp=orig;delete L.preview;PV.delete(L.id);markComp()}},{label:'Appliquer',primary:true,onClick:()=>{const v=$('#ccF').value;L.shp={...orig,fill:v};finalizeMeta(L);markComp();pushHistory('Modifier la forme');syncAll()}}]});return}
  return _se(L)};
/* menu Calque */
const _li=MENU2.layer.items;
MENU2.layer.items=()=>{const a=_li();const k=a.findIndex(x=>x&&x.label==='Styles de calque…');const it=MI('Combiner les formes…',{icon:'shape',dis:S.doc?false:NODOC,fn:combineDialog});if(k>=0)a.splice(k+1,0,it);else a.push(it);return a};
window.PrismShapes={combine,combineDialog};

})();

