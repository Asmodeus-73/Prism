/* ================= 1.0 : panneaux détachables =================
   Le panneau Calques et chaque section des réglages (Lumière et couleur, Présence, Courbe…) peuvent sortir de la colonne
   de droite : bouton ⧉ dans leur en-tête, ou glisser l'en-tête vers la photo. Détaché, le panneau flotte au-dessus de
   l'interface : on le déplace par son en-tête et on le redimensionne par son coin. ⧉ à nouveau, « Remettre » à sa place
   d'origine, ou le lâcher sur la colonne de droite le remet en place. Position et taille sont retenues (PREF floats).
   Le panneau reste le même élément de la page (il passe seulement en position fixe) : tous ses réglages marchent pareil.
   Sur tablette et téléphone, les panneaux restent rangés. */
(()=>{
const WIDE=matchMedia('(min-width:1101px)');
const st=document.createElement('style');st.textContent=`
.pf-float{position:fixed!important;z-index:15;margin:0!important;background:var(--chrome);border:1px solid var(--line-2)!important;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.45);overflow:auto;resize:both;min-width:240px;min-height:96px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);box-sizing:border-box}
.pf-float>.pf-h{position:sticky;top:0;z-index:2;background:var(--chrome);cursor:move;user-select:none;-webkit-user-select:none;touch-action:none}
details.sec.pf-float>summary{list-style:none}
details.sec.pf-float>summary::-webkit-details-marker{display:none}
#layersPanel.pf-float{display:flex;flex-direction:column}
#layersPanel.pf-float #pane-layers{flex:1;min-height:0;overflow:auto;max-height:none!important;height:auto!important}
#layersPanel.pf-float .lyr-resize,#layersPanel.pf-float #lyFold{display:none!important}
.pf-btn{flex:none;width:24px;height:24px;display:inline-grid;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--fg-3);cursor:pointer;padding:0;vertical-align:middle}
.pf-btn:hover{background:var(--hover,rgba(127,127,127,.15));color:var(--fg)}
.pf-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round}
.pf-float .pf-btn{color:var(--accent-fg)}
.pf-ph{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 12px;padding:6px 10px;border:1px dashed var(--line-2);border-radius:9px;color:var(--fg-3);font-size:12px}
.pf-ph button{border:0;background:none;color:var(--accent-fg);font:inherit;cursor:pointer;padding:2px 4px}
.pf-drop{position:fixed;z-index:14;pointer-events:none;border:2px dashed var(--accent-line);background:var(--accent-soft);border-radius:12px}
body.pf-moving{cursor:move}body.pf-moving *{user-select:none!important}`;
document.head.appendChild(st);
const ICON='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="2.5" width="8.5" height="8.5" rx="1.5"/><path d="M3 5.5v7a1 1 0 0 0 1 1h7"/></svg>';
const P=()=>PREF.get('floats',{}),saveP=o=>PREF.set('floats',o);
/* les éléments détachables : clé → [élément, en-tête, nom] */
function items(){const out=[];const lp=$('#layersPanel'),lh=$('#lyHead');if(lp&&lh)out.push(['layers',lp,lh,'Calques']);
  for(const s of $$('#devBody details.sec[data-sec]')){const sm=s.querySelector(':scope>summary');if(sm)out.push(['sec:'+s.dataset.sec,s,sm,(sm.childNodes[0]&&sm.childNodes[0].textContent||sm.textContent).trim()])}
  return out}
const find=k=>items().find(x=>x[0]===k);
const side=()=>$('aside.insp');
function clamp(el){const r=el.getBoundingClientRect(),W=innerWidth,H=innerHeight;let x=r.left,y=r.top;
  x=Math.max(8-r.width+120,Math.min(W-120,x));y=Math.max(48,Math.min(H-40,y));el.style.left=x+'px';el.style.top=y+'px'}
function remember(k,el){const o=P(),r=el.getBoundingClientRect();o[k]={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};saveP(o)}
function placeholder(k,el,name){let ph=el.previousElementSibling;if(ph&&ph.classList.contains('pf-ph'))return;ph=document.createElement('div');ph.className='pf-ph';ph.dataset.pf=k;
  ph.innerHTML=`<span>${esc(name)} · détaché</span><button type="button">Remettre</button>`;ph.querySelector('button').onclick=()=>dock(k);el.before(ph)}
function float(k,box,{save=true}={}){const it=find(k);if(!it||!WIDE.matches)return false;const [,el,h,name]=it;
  if(!el.classList.contains('pf-float')){const r=el.getBoundingClientRect();
    if(!box){const w=Math.max(280,r.width),hh=Math.min(innerHeight-120,Math.max(k==='layers'?320:220,el.tagName==='DETAILS'?el.scrollHeight+8:r.height));box={x:Math.max(70,r.left-w-24),y:Math.max(56,Math.min(innerHeight-hh-16,r.top)),w,h:hh}}
    if(el.tagName==='DETAILS'){el.dataset.pfWasOpen=el.open?'1':'';el.open=true}
    placeholder(k,el,name);el.classList.add('pf-float');h.classList.add('pf-h');front(el)}
  Object.assign(el.style,{left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px'});clamp(el);
  const b=h.querySelector('.pf-btn');if(b){b.title='Remettre en place';b.setAttribute('aria-label','Remettre '+name+' en place')}
  if(save)remember(k,el);try{if(k==='layers')renderLayers&&renderLayers()}catch(e){}return true}
function dock(k,{save=true}={}){const it=find(k);if(!it)return;const [,el,h,name]=it;if(!el.classList.contains('pf-float'))return;
  el.classList.remove('pf-float');h.classList.remove('pf-h');['left','top','width','height','zIndex'].forEach(p=>el.style[p]='');
  if(el.tagName==='DETAILS'&&el.dataset.pfWasOpen==='')el.open=false;delete el.dataset.pfWasOpen;
  const ph=el.previousElementSibling;if(ph&&ph.classList.contains('pf-ph'))ph.remove();
  const b=h.querySelector('.pf-btn');if(b){b.title='Détacher';b.setAttribute('aria-label','Détacher '+name)}
  if(save){const o=P();delete o[k];saveP(o)}}
function dockAll(){for(const [k] of items())dock(k);saveP({})}
/* déplacer un panneau détaché par son en-tête ; le lâcher sur la colonne de droite le remet en place */
let drop=null;
function overSide(x,y){const s=side();if(!s)return false;const r=s.getBoundingClientRect();return r.width>40&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom}
function showDrop(on){if(on&&!drop){const s=side();if(!s)return;const r=s.getBoundingClientRect();drop=document.createElement('div');drop.className='pf-drop';Object.assign(drop.style,{left:r.left+4+'px',top:r.top+4+'px',width:r.width-8+'px',height:r.height-8+'px'});document.body.appendChild(drop)}
  else if(!on&&drop){drop.remove();drop=null}}
function startMove(k,el,e,dx,dy){document.body.classList.add('pf-moving');let moved=false;
  const mv=ev=>{moved=true;el.style.left=ev.clientX-dx+'px';el.style.top=Math.max(44,ev.clientY-dy)+'px';showDrop(overSide(ev.clientX,ev.clientY))};
  const up=ev=>{removeEventListener('pointermove',mv,true);removeEventListener('pointerup',up,true);removeEventListener('pointercancel',up,true);document.body.classList.remove('pf-moving');showDrop(false);
    if(moved&&overSide(ev.clientX,ev.clientY))dock(k);else if(el.classList.contains('pf-float')){clamp(el);remember(k,el)}
    if(moved){const kill=c=>{c.preventDefault();c.stopPropagation()};addEventListener('click',kill,{capture:true,once:true});setTimeout(()=>removeEventListener('click',kill,true),0)}};
  addEventListener('pointermove',mv,true);addEventListener('pointerup',up,true);addEventListener('pointercancel',up,true)}
function wire(k,el,h,name){if(h.querySelector('.pf-btn'))return;
  const b=document.createElement('button');b.type='button';b.className='pf-btn';b.title='Détacher';b.setAttribute('aria-label','Détacher '+name);b.innerHTML=ICON;
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();el.classList.contains('pf-float')?dock(k):float(k)});
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  const before=h.querySelector('.eyeb,.rs,#lyAdd');before?before.before(b):h.appendChild(b);
  h.addEventListener('pointerdown',e=>{if(e.button!==0||!WIDE.matches)return;if(e.target.closest('button,input,select,textarea,a,label'))return;
    const r=el.getBoundingClientRect();
    if(el.classList.contains('pf-float')){e.preventDefault();startMove(k,el,e,e.clientX-r.left,e.clientY-r.top);return}
    /* rangé : tirer l'en-tête vers la photo le détache */
    const x0=e.clientX,y0=e.clientY;
    const mv=ev=>{if(x0-ev.clientX>48&&Math.abs(ev.clientY-y0)<x0-ev.clientX){off();const w=Math.max(280,r.width);float(k,{x:ev.clientX-40,y:ev.clientY-14,w,h:Math.min(innerHeight-120,Math.max(k==='layers'?320:220,el.tagName==='DETAILS'?el.scrollHeight+8:r.height))});startMove(k,el,ev,40,14)}};
    const off=()=>{removeEventListener('pointermove',mv,true);removeEventListener('pointerup',off,true)};
    addEventListener('pointermove',mv,true);addEventListener('pointerup',off,true)});
  /* détaché, un clic sur l'en-tête d'une section ne la replie pas */
  if(el.tagName==='DETAILS')h.addEventListener('click',e=>{if(el.classList.contains('pf-float')&&!e.target.closest('button'))e.preventDefault()});
  new ResizeObserver(()=>{if(el.classList.contains('pf-float')&&!document.body.classList.contains('pf-moving')){clearTimeout(el._pfT);el._pfT=setTimeout(()=>remember(k,el),250)}}).observe(el)}
let ztop=15;
function front(el){ztop++;if(ztop>19){ztop=16;for(const [,e] of items())if(e.classList.contains('pf-float'))e.style.zIndex=15}el.style.zIndex=ztop}
document.addEventListener('pointerdown',e=>{const el=e.target.closest&&e.target.closest('.pf-float');if(el)front(el)},true);
function setup(){for(const it of items())wire(...it)}
function restore(){setup();if(!WIDE.matches)return;const o=P();for(const k in o)float(k,o[k],{save:false})}
/* tablette, téléphone : tout se range (sans oublier les positions) ; retour sur grand écran : on les remet */
WIDE.addEventListener('change',()=>{if(WIDE.matches)restore();else for(const [k] of items())dock(k,{save:false})});
addEventListener('resize',()=>{for(const [,el] of items())if(el.classList.contains('pf-float'))clamp(el)});
/* Affichage > Remettre les panneaux en place */
{const V=MENU2.view,_v=V.items;V.items=function(){const a=_v.apply(this,arguments),n=items().filter(x=>x[1].classList.contains('pf-float')).length,i=a.findIndex(x=>x&&x.label==='Panneau Calques');
  a.splice(i<0?a.length:i+1,0,MI('Remettre les panneaux en place',{dis:n?false:'Aucun panneau détaché',fn:dockAll}));return a}}
setTimeout(restore,0);
window.PrismFloat={float,dock,dockAll,keys:()=>items().map(x=>x[0]),floating:()=>items().filter(x=>x[1].classList.contains('pf-float')).map(x=>x[0])};
})();
