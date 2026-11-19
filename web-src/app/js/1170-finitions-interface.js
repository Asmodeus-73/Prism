/* ================= 1.0 : finitions de l'interface =================
   - zoom en douceur : Ajuster, 100 %, zoom avant / arrière (clavier, boutons, menus, outil Zoom) glissent jusqu'au nouveau cadrage
     au lieu de sauter ; la molette et le pincement restent directs, une grosse photo lente saute comme avant ;
   - onglets de droite : le trait souligné glisse d'un onglet à l'autre ;
   - groupes de réglages : Alt + clic sur un titre ouvre ce groupe seul, Ctrl / ⌘ + clic ouvre ou ferme tous les groupes ;
     option « Un seul groupe ouvert à la fois » ; les groupes ouverts sont retenus d'une session à l'autre ;
   - glisser sur le nom d'un réglage change sa valeur (Maj : réglage fin), double-clic sur le nom le remet à zéro ;
   - un nouveau calque apparaît avec un léger fondu, la photo ouverte aussi ;
   - Affichage > Animations de l'interface coupe tout ce mouvement (le réglage « réduire les animations » du système aussi).
   Les styles sont dans css/0095-mouvement.css. */
const UIX={
  on:()=>PREF.get('anim',true)&&!matchMedia('(prefers-reduced-motion: reduce)').matches,
  apply(){document.documentElement.classList.toggle('no-anim',!PREF.get('anim',true))}};
UIX.apply();

/* ---- zoom en douceur ---- */
(()=>{
let A=null;   // animation en cours : {to:{z,x,y},raf}
const USER=/^(keydown|click|dblclick|pointerdown|pointerup)$/;
const finish=()=>{if(!A)return;cancelAnimationFrame(A.raf);const t=A.to;A=null;S.zoom=t.z;S.panX=t.x;S.panY=t.y;markContent()};
let inside=false,seen={};
/* on ne glisse qu'entre deux cadrages de la même photo, à la même taille : une photo qui s'ouvre ou un recadrage sautent directement */
const same=d=>{const ok=seen.d===d&&seen.w===d.w&&seen.h===d.h;seen={d,w:d.w,h:d.h};return ok};
function glide(run){
  const d=S.doc,e=window.event;
  if(inside||!d||!same(d)||!UIX.on()||!e||!USER.test(e.type)||(S.contentMs||0)>24||S.stroke||S.drag)return run();
  finish();const a={z:S.zoom,x:S.panX,y:S.panY},w=d.w,h=d.h;
  inside=true;let r;try{r=run()}finally{inside=false}
  const b={z:S.zoom,x:S.panX,y:S.panY};
  if(S.doc!==d||d.w!==w||d.h!==h||!(a.z>0&&b.z>0))return r;
  const lr=Math.log(b.z/a.z);if(Math.abs(lr)<1e-4&&Math.hypot(b.x-a.x,b.y-a.y)<1)return r;
  /* le point de l'écran qui reste immobile pendant le zoom (sinon on glisse simplement la vue) */
  const fx=Math.abs(lr)>1e-3?(b.x*a.z-a.x*b.z)/(a.z-b.z):null,fy=Math.abs(lr)>1e-3?(b.y*a.z-a.y*b.z)/(a.z-b.z):null;
  const still=fx!=null&&isFinite(fx)&&isFinite(fy)&&Math.abs(fx)<1e5&&Math.abs(fy)<1e5;
  S.zoom=a.z;S.panX=a.x;S.panY=a.y;
  const t0=performance.now(),D=Math.min(260,150+Math.abs(lr)*40);
  const step=now=>{if(!A)return;const t=Math.min(1,(now-t0)/D),k=1-Math.pow(1-t,3);
    if(t>=1){finish();return}
    const z=a.z*Math.exp(lr*k);S.zoom=z;
    if(still){S.panX=fx-(fx-a.x)*z/a.z;S.panY=fy-(fy-a.y)*z/a.z}else{S.panX=a.x+(b.x-a.x)*k;S.panY=a.y+(b.y-a.y)*k}
    markContent();A.raf=requestAnimationFrame(step)};
  A={to:b,raf:requestAnimationFrame(step)};
  return r}
/* la molette, un pincement ou un clic sur la photo reprennent la main tout de suite */
['wheel','pointerdown'].forEach(t=>window.addEventListener(t,e=>{if(A&&e.target&&e.target.closest&&e.target.closest('#stage'))finish()},{capture:true,passive:true}));
const _fit=fit;fit=function(){return glide(()=>_fit.apply(this,arguments))};
const _za=zoomAt;zoomAt=function(){return glide(()=>_za.apply(this,arguments))};
const _zs=zoomStep;zoomStep=function(){return glide(()=>_zs.apply(this,arguments))};
UIX.finishZoom=finish;
})();

/* ---- onglets de droite : trait qui glisse ---- */
(()=>{const tabs=$('.side .tabs')||$('.tabs');if(!tabs)return;
  const ink=document.createElement('span');ink.className='tab-ink';ink.setAttribute('aria-hidden','true');tabs.appendChild(ink);
  let first=true;
  const place=()=>{const b=tabs.querySelector('button.on');if(!b||!b.offsetWidth||getComputedStyle(b).display==='none'){tabs.classList.remove('inked');ink.style.width='0';return}
    const w=Math.max(16,b.offsetWidth-16);if(first)ink.style.transition='none';
    ink.style.width=w+'px';ink.style.transform=`translateX(${b.offsetLeft+(b.offsetWidth-w)/2}px)`;tabs.classList.add('inked');
    if(first){first=false;ink.offsetWidth;ink.style.transition=''}};
  const _sw=switchTab;switchTab=function(){const r=_sw.apply(this,arguments);try{place()}catch(e){}return r};
  new ResizeObserver(()=>{first=true;place()}).observe(tabs);place();UIX.placeInk=place})();

/* ---- groupes de réglages : solo, tout ouvrir / fermer, mémoire ---- */
(()=>{
/* « Préréglages » est une fenêtre qui s'ouvre depuis son bouton : jamais concernée */
const SEL='#pane-develop details.sec[data-sec]:not([data-sec=presets])';
const secs=()=>$$(SEL);
const save=()=>{const m=PREF.get('secOpen',{})||{};secs().forEach(s=>{m[s.dataset.sec]=s.open});PREF.set('secOpen',m)};
const restoreOpen=()=>{const m=PREF.get('secOpen',null);if(!m||typeof m!=='object')return;secs().forEach(s=>{const v=m[s.dataset.sec];if(typeof v==='boolean'&&s.open!==v){s.dataset.quiet='1';s.open=v}})};
let busyT=0;
document.addEventListener('click',e=>{const sm=e.target.closest&&e.target.closest(SEL+'>summary');if(!sm||e.target.closest('button,input'))return;
  const mod=e.ctrlKey||e.metaKey;if(!e.altKey&&!mod)return;e.preventDefault();const me=sm.parentNode;
  busyT=1;if(e.altKey){secs().forEach(s=>{s.open=s===me});setTimeout(()=>me.scrollIntoView({block:'nearest',behavior:UIX.on()?'smooth':'auto'}),UIX.on()?220:0)}
  else{const open=!me.open;secs().forEach(s=>{s.open=open})}
  setTimeout(()=>{busyT=0;save()},0)},true);
/* « Un seul groupe ouvert à la fois », et la mémoire des groupes ouverts */
document.addEventListener('toggle',e=>{const s=e.target;if(!s.matches||!s.matches(SEL))return;
  if(s.dataset.quiet){delete s.dataset.quiet;return}if(busyT)return;
  if(s.open&&PREF.get('secSolo',false)){busyT=1;secs().forEach(o=>{if(o!==s&&o.open){o.dataset.quiet='1';o.open=false}});busyT=0}
  save()},true);
restoreOpen();
const _bd=buildDevelop;buildDevelop=function(){const r=_bd.apply(this,arguments);try{restoreOpen()}catch(e){}return r};
UIX.secs={save,restoreOpen,list:secs};
})();

/* ---- glisser sur le nom d'un réglage ---- */
(()=>{let g=null;
const rangeOf=lab=>{const row=lab.closest('.row');if(!row||lab.querySelector('input'))return null;const i=row.querySelector(':scope>input[type=range]');return i&&!i.disabled?i:null};
document.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch')return;const lab=e.target.closest&&e.target.closest('.row[data-k]>label');if(!lab)return;
  const i=rangeOf(lab);if(!i)return;g={i,lab,x0:e.clientX,v0:+i.value,x:e.clientX,v:+i.value,on:false,id:e.pointerId}},true);
document.addEventListener('pointermove',e=>{if(!g||e.pointerId!==g.id)return;
  if(!g.on){if(Math.abs(e.clientX-g.x0)<4)return;g.on=true;g.x=e.clientX;try{g.lab.setPointerCapture(e.pointerId)}catch(_){}
    document.body.classList.add('scrub');g.lab.closest('.row').classList.add('scrubbing');S.sliding=true;S.slideEl=g.i;if(typeof LQ!=='undefined')LQ.lock=0}
  const i=g.i,mn=+i.min,mx=+i.max,st=parseFloat(i.step)||1,W=Math.max(80,i.getBoundingClientRect().width);
  /* même vitesse que le curseur lui-même ; Maj : dix fois plus lent */
  g.v+= (e.clientX-g.x)*(mx-mn)/W*(e.shiftKey?0.1:1);g.x=e.clientX;g.v=Math.min(mx,Math.max(mn,g.v));
  const v=Math.round(g.v/st)*st;if(+i.value!==v){i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))}},true);
const end=e=>{if(!g||(e&&e.pointerId!==g.id))return;const G=g;g=null;if(!G.on)return;
  document.body.classList.remove('scrub');G.lab.closest('.row').classList.remove('scrubbing');S.sliding=false;try{markContent()}catch(_){}
  if(+G.i.value!==G.v0)G.i.dispatchEvent(new Event('change',{bubbles:true}));
  /* pas de clic parasite après un glissé */
  const stop=ev=>{ev.stopPropagation();ev.preventDefault()};window.addEventListener('click',stop,{capture:true,once:true});setTimeout(()=>window.removeEventListener('click',stop,true),0)};
document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);
/* double-clic sur le nom : comme un double-clic sur le curseur, remet la valeur d'origine */
document.addEventListener('dblclick',e=>{const lab=e.target.closest&&e.target.closest('#pane-develop .row[data-k]>label');if(!lab)return;const i=rangeOf(lab);if(!i)return;
  e.preventDefault();i.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}))},true);
})();

/* ---- un nouveau calque apparaît en douceur ---- */
(()=>{const seen=new WeakMap();
const _sl=syncLayers;syncLayers=function(){const r=_sl.apply(this,arguments);try{const d=S.doc;if(!d)return r;
    let s=seen.get(d);const first=!s;if(first){s=new WeakSet();seen.set(d,s)}
    $$('#pane-layers .lyr[data-i]').forEach(li=>{const L=d.layers[+li.dataset.i];if(!L||s.has(L))return;s.add(L);if(!first&&UIX.on())li.classList.add('fresh')})}catch(e){}
  return r}})();

/* ---- la photo ouverte apparaît en fondu ---- */
(()=>{let last=null;const v=$('#view');
const _rr=requestRender;requestRender=function(){const d=S.doc;if(d!==last){last=d;if(d&&v&&v.animate&&UIX.on())try{v.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'})}catch(e){}}
  return _rr.apply(this,arguments)}})();

/* ---- menu Affichage : options ---- */
{const _vi=MENU2.view.items;MENU2.view.items=()=>[..._vi(),SEP,
  MI('Animations de l’interface',{check:PREF.get('anim',true),fn:()=>{PREF.set('anim',!PREF.get('anim',true));UIX.apply();toast(PREF.get('anim',true)?'Animations activées.':'Animations coupées : tout change d’un coup.')}}),
  MI('Un seul groupe de réglages ouvert',{check:PREF.get('secSolo',false),fn:()=>{const on=!PREF.get('secSolo',false);PREF.set('secSolo',on);
    if(on){const o=UIX.secs.list().filter(s=>s.open);o.slice(1).forEach(s=>{s.open=false})}
    toast(on?'Ouvrir un groupe de réglages ferme les autres. Alt + clic sur un titre fait de même à tout moment.':'Les groupes de réglages s’ouvrent librement.')}})]}
