
/* ===== wave48: garde-fou entre appareils. Un projet synchronisé ouvert sur un autre appareil est signalé avant de l'ouvrir ici ===== */
(()=>{
const TTL=150000,BEAT=60000,IDLE=10*60000;
const lockId=pid=>'open_'+pid;
const col=()=>Cloud.ok&&Cloud.col;
/* projects open here recently (several tabs can be open): pid -> last time it was the active document */
const active=new Map();
const mark=()=>{const d=S.doc;if(d&&d.pid&&d.sync&&!d.nosave)active.set(d.pid,Date.now())};
function release(pid){const c=col();if(!c)return;const r=c.doc(lockId(pid));r.get().then(s=>{if(s&&s.exists&&s.data().device===DEVICE)return r.delete()}).catch(()=>{})}
function beat(){mark();const c=col();if(!c)return;const now=Date.now();
  for(const [pid,t] of [...active]){if(now-t>IDLE||!(S.doc&&S.doc.pid===pid)&&!(window.PrismTabs&&PrismTabs.tabs.some(x=>x.doc&&x.doc.pid===pid))){active.delete(pid);release(pid);continue}
    c.doc(lockId(pid)).set({kind:'open',pid,device:DEVICE,deviceName:DEVNAME,at:now}).catch(()=>{})}}
setInterval(beat,BEAT);
addEventListener('pagehide',()=>{for(const pid of active.keys())release(pid)});
async function elsewhere(pid){const c=col();if(!c)return null;try{const s=await c.doc(lockId(pid)).get(),p=s&&s.exists?s.data():null;if(p&&p.device!==DEVICE&&Date.now()-(p.at||0)<TTL)return p}catch(e){}return null}
const ago=t=>{const m=Math.round((Date.now()-t)/60000);return m<1?'à l’instant':`il y a ${m} min`};
function ask(p){return new Promise(res=>{dialog({title:'Projet ouvert sur un autre appareil',
  body:`<p>Ce projet est ouvert sur <b>${esc(p.deviceName||'un autre appareil')}</b> (actif ${ago(p.at)}).</p><p class="muted">Si vous le modifiez des deux côtés, Prism garde les deux versions séparément, sans rien perdre. Pour l’éviter, ouvrez-le en lecture seule ou travaillez sur une copie.</p>`,
  buttons:[{label:'Annuler',onClick:()=>res('cancel')},{label:'Lecture seule',onClick:()=>res('ro')},{label:'Ouvrir quand même',onClick:()=>res('open')},{label:'Travailler sur une copie',primary:true,onClick:()=>res('copy')}]})})}
async function makeCopy(){const d=S.doc;if(!d)return;d.pid=uid8();d.name=d.name.replace(/ \(copie\)$/,'')+' (copie)';d.updatedAt=0;d.saved=false;d.nosave=false;d.readonly=false;updateDocName();await saveNow();toast(`Copie enregistrée : « ${d.name} »`,4000)}
function after(choice){const d=S.doc;if(!d)return;
  if(choice==='ro'){d.nosave=true;d.readonly=true;updateDocName();toastAction('Ouvert en lecture seule : vos changements ne seront pas enregistrés.','Travailler sur une copie',makeCopy)}
  else if(choice==='copy')makeCopy();
  else mark()}
let inGate=false;
const gated=fn=>async function(id,...a){
  /* the same project already open here (another device saved it, or a nested open): no question */
  if(inGate||(S.doc&&S.doc.pid===id))return fn.call(this,id,...a);
  const p=await elsewhere(id);const choice=p?await ask(p):'open';if(choice==='cancel')return false;
  inGate=true;let r;try{r=await fn.call(this,id,...a)}finally{inGate=false}
  if(r!==false&&S.doc&&S.doc.pid===id)after(choice);return r};
openLocalProject=gated(openLocalProject);
Cloud.open=gated(Cloud.open);
/* the read-only state shows next to the document name */
const _udn48=updateDocName;updateDocName=function(){const r=_udn48.apply(this,arguments);const d=S.doc,el=$('#docname');if(d&&d.readonly&&el&&!el.querySelector('.w48-ro'))el.insertAdjacentHTML('beforeend','<em class="tag w48-ro">Lecture seule</em>');return r};
/* presence notes change every minute: only real project changes refresh the lists */
const _or48=Cloud.onRemote;let sig48='';Cloud.onRemote=function(){const s=this.list.map(p=>p.id+':'+p.updatedAt).join(',');if(s===sig48)return;sig48=s;return _or48.apply(this,arguments)};
setTimeout(beat,3000);
})();

/* ===== wave49: télécharger l'application de bureau depuis l'accueil (version web sur ordinateur) ===== */
(()=>{
if(window.PRISM_DESKTOP||IS_IOS||/Android/.test(navigator.userAgent))return;
const URL_APP='https://github.com/Asmodeus-73/Prism/releases/latest';
const st=document.createElement('style');st.textContent='.w49{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;font-size:12.5px;color:var(--fg-2)}.w49 a{color:var(--accent);font-weight:600;text-decoration:none}.w49 a:hover{text-decoration:underline}.w49 svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}';document.head.appendChild(st);
const put=()=>{const t=$('#wTiles');if(!t||$('#w49'))return;t.insertAdjacentHTML('afterend',`<div class="w49" id="w49"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>Prism existe aussi en application pour Mac et Windows, qui marche hors ligne.</span><a href="${URL_APP}" target="_blank" rel="noopener">Télécharger l’app</a></div>`)};
put();setTimeout(put,800);
/* le lien télécharge directement le bon fichier pour cet ordinateur (.dmg sur Mac, -setup.exe sur Windows) */
const mac=/Mac/.test(navigator.platform||navigator.userAgent),win=/Win/.test(navigator.platform||navigator.userAgent);
if(mac||win)fetch('https://api.github.com/repos/Asmodeus-73/Prism/releases/latest').then(r=>r.ok?r.json():null).then(j=>{
  const a=j&&(j.assets||[]).find(x=>mac?/\.dmg$/i.test(x.name):/-setup\.exe$/i.test(x.name));if(!a)return;
  const set=()=>{const l=$('#w49 a');if(!l)return false;l.href=a.browser_download_url;l.removeAttribute('target');l.textContent=mac?'Télécharger pour Mac':'Télécharger pour Windows';l.title='Prism '+(j.tag_name||'').replace(/^v/,'')+' : '+a.name;return true};
  if(!set())setTimeout(set,900)}).catch(()=>{});
})();

/* ===== wave50: le logo Prism (icône et nom) ramène à la photothèque ===== */
(()=>{
const m=document.querySelector('header.bar .mark');if(!m)return;
m.setAttribute('role','button');m.tabIndex=0;m.title='Photothèque (toutes vos photos)';m.setAttribute('aria-label','Prism : ouvrir la photothèque');m.style.cursor='pointer';
const st=document.createElement('style');st.textContent='header.bar .mark:focus{outline:none}header.bar .mark:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:8px}';document.head.appendChild(st);
const go=()=>{if(typeof LIB!=='undefined'&&LIB.open)return;try{openLibrary()}catch(e){console.warn(e)}};
m.addEventListener('click',go);
m.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
})();
/* ===== wave51: la croix de la photothèque n'existe que pour la colonne d'infos : elle enregistre puis ferme cette colonne.
   Échap fait pareil ; sans photo sélectionnée ni recherche, Échap quitte la photothèque. ===== */
(()=>{
const info=()=>LIB.open&&LIB.sel&&LIB.sel.size>0;
{const st=document.createElement('style');st.textContent='#lbBack{display:none!important}.library:not(.has-info) #lbX{display:none!important}';document.head.appendChild(st)}
const T='Enregistrer et fermer les infos';
const closeInfo=async()=>{const a=document.activeElement;if(a&&a.closest&&a.closest('#lbInfo'))a.blur();
  await new Promise(r=>setTimeout(r,0));
  try{await flushSave()}catch(err){console.warn(err)}
  LIB.sel.clear();LIB.auto=false;$$('#lbGrid .lb-card').forEach(c=>{c.classList.remove('on');c.setAttribute('aria-selected','false')});renderLibInfo()};
const _rli=renderLibInfo;renderLibInfo=function(){const r=_rli.apply(this,arguments);const x=$('#lbX');if(x){x.title=T;x.setAttribute('aria-label',T)}return r};
document.addEventListener('click',e=>{const x=e.target.closest&&e.target.closest('#lbX');if(!x||!info())return;e.preventDefault();e.stopPropagation();closeInfo()},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!LIB.open||!$('#library'))return;
  if(document.querySelector('#scrim,.menu'))return;
  const t=e.target;if(LIB.q&&(!info()||t&&t.id==='lbQ'))return;
  if(t&&t.closest&&t.closest('#lbInfo input,#lbInfo textarea'))return;
  e.preventDefault();e.stopPropagation();
  if(info())closeInfo();else closeLibrary()},true);
})();
/* ===== wave52: petites incohérences (Échap ferme l'écran des avis partagés ; menus assez larges pour les libellés longs) ===== */
(()=>{
const st=document.createElement('style');st.textContent='.menu{max-width:min(420px,calc(100vw - 16px))}';document.head.appendChild(st);
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!$('#review')||document.querySelector('#scrim,.menu'))return;e.preventDefault();e.stopPropagation();closeReview()},true);
})();
/* ===== wave53: le logo Prism apparaît aussi en haut à gauche de la photothèque et permet d'en sortir (vers la photo ouverte ou l'accueil) ===== */
(()=>{
const st=document.createElement('style');st.textContent='.lb-top .lb-mark{cursor:pointer;flex:none}.lb-top .lb-mark:focus{outline:none}.lb-top .lb-mark:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:8px}';document.head.appendChild(st);
const _o=openLibrary;openLibrary=async function(...a){const r=await _o.apply(this,a);
  const top=$('#library .lb-top'),src=$('header.bar .mark');
  if(top&&src&&!top.querySelector('.lb-mark')){const m=src.cloneNode(true);m.removeAttribute('id');m.classList.add('lb-mark');m.tabIndex=0;m.setAttribute('role','button');
    const t=S.doc?'Quitter la photothèque et revenir à la photo':'Quitter la photothèque';m.title=t;m.setAttribute('aria-label',t);
    const go=e=>{e.stopPropagation();closeLibrary()};m.addEventListener('click',go);m.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go(e)}});
    top.insertBefore(m,top.firstChild)}
  return r};
})();
