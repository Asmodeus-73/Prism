/* ================= 1.0 : visite guidée =================
   Quand l'utilisateur crée ou importe sa première photo, Prism propose une visite de 30 secondes sur cette photo : chaque étape éclaire une zone
   de l'interface avec une bulle. Aide > Visite guidée la relance. Échap ou « Passer » l'arrête.
   Les étapes dont la zone n'est pas à l'écran (téléphone, panneau replié) sont sautées. */
(()=>{
const STEPS=[
  {t:'Bienvenue dans Prism',d:'30 secondes pour trouver vos repères.'},
  {sel:'#menubar,#bMenu',t:'Les menus',d:'Toutes les commandes. '+MOD+'K pour en chercher une.'},
  {sel:'#dock',t:'Les outils',d:'Deux appuis sur la touche d’un outil passent à ses voisins.'},
  {sel:'#stage',t:'La photo',d:'Molette pour zoomer, Espace + glisser pour se déplacer, clic droit pour les commandes.'},
  {sel:'#pane-develop',t:'Les réglages',d:'Tout reste modifiable. Double-clic : curseur à zéro. ⧉ : détacher une section.'},
  {sel:'#layersPanel,#lyrDock,#pane-layers',t:'Les calques',d:'Réglages locaux, masques, textes, formes. + pour en ajouter.'},
  {sel:'#bCompare',t:'Avant / après',d:'Y pour comparer, \\ maintenu pour voir l’original.'},
  {sel:'#bExport',t:'Exporter',d:'JPEG, PNG, TIFF, PSD, AVIF, WebP…'},
  {t:'C’est parti !',d:'Tout s’enregistre seul. Aide > Visite guidée pour revoir.'}];
const vis=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>8&&r.height>8&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&getComputedStyle(el).visibility!=='hidden'};
const target=s=>{if(!s.sel)return null;for(const q of s.sel.split(',')){const e=document.querySelector(q);if(vis(e))return e}return null};
let T=null;
function css(){if($('#tourCss'))return;const st=document.createElement('style');st.id='tourCss';st.textContent=`
#tour{position:fixed;inset:0;z-index:9000;pointer-events:auto}
#tour .tr-d{position:fixed;background:rgba(0,0,0,.5);pointer-events:none}
#tour .tr-hole{position:fixed;border-radius:12px;transition:all .25s ease;pointer-events:none;outline:2px solid var(--accent,#7aa2ff);outline-offset:2px}
#tour .tr-hole.none{left:50%;top:45%;width:0;height:0;outline:0}
#tour .tr-tip{position:fixed;width:min(340px,calc(100vw - 32px));background:var(--chrome,#1c1d21);color:var(--fg,#eee);border:1px solid var(--line-2,#333);border-radius:14px;padding:14px 16px 12px;box-shadow:0 18px 50px rgba(0,0,0,.45);transition:left .25s ease,top .25s ease}
#tour .tr-tip h3{margin:0 0 6px;font-size:15px;font-weight:600}#tour .tr-tip p{margin:0;font-size:13px;line-height:1.5;color:var(--fg-2,#bbb)}
#tour .tr-f{display:flex;align-items:center;gap:8px;margin-top:12px}#tour .tr-n{flex:1;font-size:11.5px;color:var(--fg-3,#888)}`;document.head.appendChild(st)}
function place(){if(!T)return;const s=T.list[T.i],el=target(s),hole=$('.tr-hole',T.el),tip=$('.tr-tip',T.el);
  const W=innerWidth,H=innerHeight,D=[...T.el.querySelectorAll('.tr-d')],box=(e,x,y,w,h)=>Object.assign(e.style,{left:x+'px',top:y+'px',width:Math.max(0,w)+'px',height:Math.max(0,h)+'px'});
  if(el){const r=el.getBoundingClientRect(),p=6,x0=Math.max(0,r.left-p),y0=Math.max(0,r.top-p),x1=Math.min(W,r.right+p),y1=Math.min(H,r.bottom+p);box(D[0],0,0,W,y0);box(D[1],0,y1,W,H-y1);box(D[2],0,y0,x0,y1-y0);box(D[3],x1,y0,W-x1,y1-y0);hole.classList.remove('none');Object.assign(hole.style,{left:r.left-p+'px',top:r.top-p+'px',width:r.width+2*p+'px',height:r.height+2*p+'px'});
    const tw=tip.offsetWidth,th=tip.offsetHeight,m=14;let x,y;
    if(r.right+m+tw<innerWidth)x=r.right+m,y=r.top;else if(r.left-m-tw>0)x=r.left-m-tw,y=r.top;else if(r.bottom+m+th<innerHeight)x=r.left,y=r.bottom+m;else x=r.left,y=r.top-m-th;
    tip.style.left=Math.max(16,Math.min(innerWidth-tw-16,x))+'px';tip.style.top=Math.max(16,Math.min(innerHeight-th-16,y))+'px'}
  else{box(D[0],0,0,W,H);D.slice(1).forEach(e=>box(e,0,0,0,0));hole.classList.add('none');hole.removeAttribute('style');tip.style.left=(innerWidth-tip.offsetWidth)/2+'px';tip.style.top=Math.max(16,innerHeight*.38-tip.offsetHeight/2)+'px'}}
function show(){const s=T.list[T.i],tip=$('.tr-tip',T.el),last=T.i===T.list.length-1;
  tip.innerHTML=`<h3>${esc(s.t)}</h3><p>${esc(s.d)}</p><div class="tr-f"><span class="tr-n">${T.i+1} / ${T.list.length}</span>${last?'':'<button class="btn sm" data-t="skip">Passer</button>'}${T.i?'<button class="btn sm" data-t="prev">Précédent</button>':''}<button class="btn sm primary" data-t="next">${last?'Terminer':T.i?'Suivant':'Commencer'}</button></div>`;
  requestAnimationFrame(place);$('[data-t="next"]',tip).focus()}
function end(){if(!T)return;T.el.remove();removeEventListener('resize',place);document.removeEventListener('keydown',T.kd,true);T=null;PREF.set('tourDone',Date.now())}
async function start(){if(T)return;closeDialog&&closeDialog();if(LIB&&LIB.open)try{closeLibrary()}catch(e){}
  if(!S.doc){toast('Ouvrez ou créez une photo pour lancer la visite.');return}
  if(window.PrismTablet&&!PrismTablet.isOpen()&&document.body.classList.contains('side-over'))try{PrismTablet.toggle()}catch(e){}
  try{switchTab('develop')}catch(e){}
  css();const el=document.createElement('div');el.id='tour';el.setAttribute('role','dialog');el.setAttribute('aria-label','Visite guidée');el.innerHTML='<div class="tr-d"></div><div class="tr-d"></div><div class="tr-d"></div><div class="tr-d"></div><div class="tr-hole none"></div><div class="tr-tip"></div>';document.body.appendChild(el);
  const list=STEPS.filter(s=>!s.sel||target(s));T={el,list,i:0};
  el.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;const a=b.dataset.t;if(a==='skip')return end();if(a==='prev'){T.i=Math.max(0,T.i-1);return show()}if(T.i>=T.list.length-1)return end();T.i++;show()});
  T.kd=e=>{if(!T)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();end()}else if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();if(T.i<T.list.length-1){T.i++;show()}else end()}else if(e.key==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();if(T.i){T.i--;show()}}else if(e.key!=='Tab'){e.stopImmediatePropagation()}};
  document.addEventListener('keydown',T.kd,true);addEventListener('resize',place);show()}
{const H=MENU2.help,_h=H.items;H.items=function(){const a=_h.apply(this,arguments);a.unshift(MI('Visite guidée',{icon:'help',fn:start}));return a}}
/* première photo créée ou importée : on propose la visite (jamais pendant les tests automatiques, jamais sur la photo d'exemple) */
{const _sd=setDoc;let offered=false;
 setDoc=function(src,name,opts={}){const r=_sd.apply(this,arguments);
  if(!offered&&!opts.sample&&!PREF.get('tourDone',0)&&!navigator.webdriver){offered=true;
   setTimeout(()=>{if(PREF.get('tourDone',0)||!S.doc||$('#scrim'))return;
    dialog({title:'Bienvenue dans Prism 1.0',body:'<p>Une visite de 30 secondes ?</p>',
     buttons:[{label:'Plus tard',onClick:()=>PREF.set('tourDone',Date.now())},{label:'Faire la visite',primary:true,onClick:()=>setTimeout(start,0)}]})},1500)}
  return r}}
window.PrismTour={start,end,get on(){return !!T},steps:()=>T?T.list.map(s=>s.t):[]};
})();
