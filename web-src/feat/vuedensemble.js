/* ===== Vue d'ensemble (Photothèque) : les photos choisies côte à côte, aussi grandes que l'écran le permet =====
   Bouton « Comparer » de la photothèque (ou touche N) avec au moins deux photos choisies ; jusqu'à 60 photos.
   - Flèches : photo active · 0 à 5 : note · P : retenir · X : rejeter · U : sans drapeau
   - Suppr : retirer la photo de la vue (elle reste dans la photothèque) · Entrée ou double-clic : ouvrir · F : plein écran · Échap : fermer
   - Glisser une photo pour changer l'ordre.
   - La netteté (celle du Tri express, mesurée sur l'aperçu) est comparée entre les photos : la plus nette porte un repère. ===== */
{
const SV={list:[],i:0,el:null};
const css=document.createElement('style');css.textContent=`
#lbSurvey{position:fixed;inset:0;z-index:60;background:#111214;color:#e8e8ea;display:flex;flex-direction:column}
#lbSurvey .sv-top{display:flex;align-items:center;gap:12px;padding:10px 16px;font-size:13px;border-bottom:1px solid #2a2b2f}
#lbSurvey .sv-top b{font-weight:600}#lbSurvey .sv-top .sp{flex:1}
#lbSurvey .sv-top button{background:#2a2b30;color:#e8e8ea;border:1px solid #3a3b40;border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer}
#lbSurvey .sv-grid{flex:1;display:grid;gap:10px;padding:12px;min-height:0}
#lbSurvey .sv-c{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;border-radius:8px;padding:6px;border:2px solid transparent;cursor:pointer;background:#18191c}
#lbSurvey .sv-c.on{border-color:#5b8cff}
#lbSurvey .sv-c.rej img{opacity:.35}
#lbSurvey .sv-c img{flex:1;min-height:0;width:100%;object-fit:contain;display:block;pointer-events:none}
#lbSurvey .sv-i{display:flex;gap:8px;align-items:center;font-size:12px;padding-top:5px;white-space:nowrap;overflow:hidden}
#lbSurvey .sv-i .n{overflow:hidden;text-overflow:ellipsis;opacity:.75;flex:1}
#lbSurvey .sv-i .st{color:#f0b429;letter-spacing:1px}
#lbSurvey .sv-b{position:absolute;top:10px;left:10px;font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(0,0,0,.6)}
#lbSurvey .sv-b.pick{color:#3fd27a}#lbSurvey .sv-b.rej{color:#ef5350}
#lbSurvey .sv-sh{position:absolute;top:10px;right:10px;font-size:11px;padding:2px 7px;border-radius:10px;background:rgba(0,0,0,.6)}
#lbSurvey .sv-sh.best{color:#3fd27a;font-weight:600}
#lbSurvey .sv-c.drag{opacity:.4}
#lbSurvey .sv-help{font-size:11.5px;opacity:.55;padding:0 16px 10px}`;document.head.appendChild(css);
/* nombre de colonnes qui donne les plus grandes images pour la place disponible */
function layout(n,W,H,ar){let best=1,bs=0;for(let c=1;c<=n;c++){const r=Math.ceil(n/c),cw=(W-10*(c-1))/c,ch=(H-10*(r-1))/r-24,s=Math.min(cw,ch*ar);if(s>bs){bs=s;best=c}}return best}
function stars(n){return'★'.repeat(n)+'<span style="opacity:.3">'+'★'.repeat(5-n)+'</span>'}
function sharpOf(it){return it.lib&&it.lib.q&&it.lib.q.s||null}
function draw(){const q=SV.el;if(!q)return;const g=q.querySelector('.sv-grid'),L=SV.list,n=L.length;if(!n){close();return}SV.i=clamp(SV.i,0,n-1);
  const W=g.clientWidth-24,H=g.clientHeight-24,ars=L.map(it=>(it.w&&it.h)?it.w/it.h:1.5),ar=ars.reduce((a,b)=>a+b,0)/n,c=layout(n,W,H,ar);g.style.gridTemplateColumns=`repeat(${c},minmax(0,1fr))`;g.style.gridTemplateRows=`repeat(${Math.ceil(n/c)},minmax(0,1fr))`;
  const sh=L.map(sharpOf),mx=Math.max(0,...sh.filter(Boolean));
  const cells=[...g.children];while(cells.length>n)cells.pop().remove();
  L.forEach((it,k)=>{let el=g.children[k];if(!el){el=document.createElement('div');el.className='sv-c';el.draggable=true;el.innerHTML='<img alt=""><span class="sv-b" hidden></span><span class="sv-sh" hidden></span><div class="sv-i"><span class="st"></span><span class="n"></span></div>';g.appendChild(el)}
    el.dataset.k=k;el.classList.toggle('on',k===SV.i);const l=it.lib||{};el.classList.toggle('rej',l.flag==='reject');
    const b=el.querySelector('.sv-b');b.hidden=!l.flag;b.className='sv-b '+(l.flag==='pick'?'pick':l.flag==='reject'?'rej':'');b.textContent=l.flag==='pick'?'Retenue':l.flag==='reject'?'Rejetée':'';
    const s=el.querySelector('.sv-sh');s.hidden=!sh[k];if(sh[k]){const p=Math.round(sh[k]/mx*100);s.textContent=p>=100?'La plus nette':`Netteté ${p} %`;s.classList.toggle('best',p>=100)}
    el.querySelector('.st').innerHTML=stars(l.rating||0);el.querySelector('.n').textContent=it.name;
    const img=el.querySelector('img');if(img.dataset.id!==it.id){img.dataset.id=it.id;img.removeAttribute('src');thumbBlob(it).then(bl=>{if(!bl||img.dataset.id!==it.id)return;const u=URL.createObjectURL(bl);img.onload=()=>URL.revokeObjectURL(u);img.src=u})}});
  q.querySelector('.sv-n').textContent=`${n} photo${n>1?'s':''}`}
function close(){const q=SV.el;if(!q)return;q.remove();SV.el=null;removeEventListener('keydown',kd,true);removeEventListener('resize',draw);try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}
  LIB.sel=new Set(SV.list.map(i=>i.id));try{renderLibrary()}catch(e){}}
async function set(patch){const it=SV.list[SV.i];if(!it)return;if(patch.flag!==undefined){await libPatch([it.id],l=>{l.flag=patch.flag})}else await libSet([it.id],patch);
  /* l'objet de la photothèque a pu être remplacé : on reprend le nouveau */
  SV.list=SV.list.map(x=>LIB.items.find(y=>y.id===x.id)||x);draw()}
function kd(e){if(e.target.matches&&e.target.matches('input,select,textarea'))return;const k=e.key,n=SV.list.length,c=(()=>{const g=SV.el.querySelector('.sv-grid');return getComputedStyle(g).gridTemplateColumns.split(' ').length})();let used=true;
  if(k==='Escape')close();else if(k==='ArrowRight')SV.i=Math.min(n-1,SV.i+1);else if(k==='ArrowLeft')SV.i=Math.max(0,SV.i-1);else if(k==='ArrowDown')SV.i=Math.min(n-1,SV.i+c);else if(k==='ArrowUp')SV.i=Math.max(0,SV.i-c);
  else if(/^[0-5]$/.test(k))set({rating:+k});else if(k==='p'||k==='P')set({flag:'pick'});else if(k==='x'||k==='X')set({flag:'reject'});else if(k==='u'||k==='U')set({flag:''});
  else if(k==='Delete'||k==='Backspace'){SV.list.splice(SV.i,1)}else if(k==='Enter'){const it=SV.list[SV.i];close();if(it)libOpen(it.id)}
  else if(k==='f'||k==='F'){try{document.fullscreenElement?document.exitFullscreen():SV.el.requestFullscreen()}catch(_){}}else used=false;
  if(used){e.preventDefault();e.stopPropagation();draw()}}
function survey(ids){const L=(ids||[...LIB.sel]).map(id=>LIB.items.find(i=>i.id===id)).filter(Boolean).slice(0,60);if(L.length<2){toast('Choisissez au moins deux photos à comparer (⇧ ou ⌘ + clic)');return}
  if(SV.el)close();const q=document.createElement('div');q.id='lbSurvey';q.setAttribute('role','dialog');q.setAttribute('aria-label','Vue d’ensemble');
  q.innerHTML='<div class="sv-top"><b>Vue d’ensemble</b><span class="sv-n"></span><span class="sp"></span><button type="button" data-sv="full">Plein écran</button><button type="button" data-sv="close">Fermer</button></div><div class="sv-grid"></div><div class="sv-help">← → ↑ ↓ photo · 0 à 5 note · P retenir · X rejeter · U sans drapeau · Suppr retirer de la vue · Entrée ouvrir · F plein écran · Échap fermer · glisser pour réordonner</div>';
  document.body.appendChild(q);SV.el=q;SV.list=L;SV.i=0;
  q.addEventListener('click',e=>{const b=e.target.closest('[data-sv]');if(b){if(b.dataset.sv==='close')close();else{try{document.fullscreenElement?document.exitFullscreen():q.requestFullscreen()}catch(_){}}return}
    const c=e.target.closest('.sv-c');if(c){SV.i=+c.dataset.k;draw()}});
  q.addEventListener('dblclick',e=>{const c=e.target.closest('.sv-c');if(!c)return;const it=SV.list[+c.dataset.k];close();if(it)libOpen(it.id)});
  let from=-1;q.addEventListener('dragstart',e=>{const c=e.target.closest('.sv-c');if(!c)return;from=+c.dataset.k;c.classList.add('drag');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(from))}catch(_){}});
  q.addEventListener('dragend',e=>{const c=e.target.closest('.sv-c');if(c)c.classList.remove('drag')});
  q.addEventListener('dragover',e=>{if(from>=0&&e.target.closest('.sv-c'))e.preventDefault()});
  q.addEventListener('drop',e=>{const c=e.target.closest('.sv-c');if(!c||from<0)return;e.preventDefault();const to=+c.dataset.k,[it]=SV.list.splice(from,1);SV.list.splice(to,0,it);SV.i=to;from=-1;draw()});
  addEventListener('keydown',kd,true);addEventListener('resize',draw);requestAnimationFrame(draw)}
window.PrismSurvey={open:survey,close,get list(){return SV.list}};
/* bouton dans la barre de la photothèque, et touche N */
{const _rl=renderLibrary;renderLibrary=function(){const r=_rl.apply(this,arguments);try{const t=document.querySelector('#lbFil .lb-tools');if(t&&!t.querySelector('[data-survey]'))t.insertAdjacentHTML('beforeend','<button class="btn sm" data-survey title="Comparer les photos choisies côte à côte (N)">Comparer</button>');
}catch(e){}return r}}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-survey]');if(!t)return;e.stopPropagation();survey()},true);
document.addEventListener('keydown',e=>{if(SV.el||e.metaKey||e.ctrlKey||e.altKey)return;if((e.key==='n'||e.key==='N')&&LIB.open&&!(e.target.matches&&e.target.matches('input,select,textarea,[contenteditable]'))){if(LIB.sel.size>=2){e.preventDefault();survey()}}},true);
}
