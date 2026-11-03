/* ================= 1.0 : versions d'une photo =================
   Prism garde des versions datées de chaque photo : une à l'enregistrement si la dernière a plus de 15 minutes,
   plus celles qu'on crée à la main (avec un nom). Fichier > Versions de la photo… : revenir à une version, ou l'ouvrir en copie.
   Revenir à une version garde d'abord l'état actuel comme version : rien n'est perdu.
   Rangement : base IndexedDB à part, « prism-versions » ; les tuiles des versions sont gardées par le ménage (0830 gcOnce).
   Jusqu'à 25 versions automatiques par photo, 90 jours ; les versions nommées restent. Propres à cet appareil. */
const VERS={EVERY:15*60e3,MAX:25,DAYS:90,_db:null,
  open(){if(this._db)return this._db;this._db=new Promise((res,rej)=>{let r;try{r=indexedDB.open('prism-versions',1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('items')){const s=db.createObjectStore('items',{keyPath:'id'});s.createIndex('pid','pid')}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error||new Error('Versions indisponibles'))});
    this._db.catch(()=>{this._db=null});return this._db},
  async tx(mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('items',mode),s=t.objectStore('items');let out;const q=fn(s);if(q)q.onsuccess=()=>out=q.result;
    t.oncomplete=()=>res(out);const f=()=>rej(t.error||new Error('Versions indisponibles'));t.onerror=f;t.onabort=f})},
  all(){return this.tx('readonly',s=>s.getAll()).then(a=>a||[])},
  of(pid){return this.tx('readonly',s=>s.index('pid').getAll(pid)).then(a=>(a||[]).sort((x,y)=>y.at-x.at))},
  put(e){return this.tx('readwrite',s=>s.put(e))},
  del(id){return this.tx('readwrite',s=>s.delete(id))}};
const vSig=m=>JSON.stringify((m.layers||[]).map(L=>[L.kind,L.name,L.visible,L.opacity,L.blend,(L.canvas||[]).map(t=>t.key).join(','),(L.mask||[]).map(t=>t.key).join(','),L.dev||null]))+m.w+'x'+m.h;
async function vPrune(pid){const list=await VERS.of(pid),now=Date.now();let auto=0;
  for(const v of list){if(v.named)continue;auto++;if(auto>VERS.MAX||now-v.at>VERS.DAYS*864e5)await VERS.del(v.id)}}
async function vAdd(pid,o={}){const m=await IDB.get('projects',pid).catch(()=>null);if(!m||!m.layers)return null;
  const last=(await VERS.of(pid))[0];if(last&&vSig(last.m)===vSig(m)&&!o.name)return null;   // rien n'a changé depuis la dernière
  const v={id:pid+'@'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),pid,at:Date.now(),name:o.name||'',named:!!o.name,why:o.why||'',m};
  await VERS.put(v);await vPrune(pid);return v}
window.PrismVersions={
  keys:async()=>{const k=[];for(const v of await VERS.all())manifestKeys(v.m).forEach(x=>k.push(x));return k},
  list:pid=>VERS.of(pid),add:vAdd,
  async restore(id){const v=(await VERS.all()).find(x=>x.id===id);if(!v)return false;const pid=v.pid,d=S.doc,open=d&&d.pid===pid;
    if(open&&!d.saved){d.nosave=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow()}
    await vAdd(pid,{why:'Avant le retour à la version du '+new Date(v.at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})});
    const cur=await IDB.get('projects',pid).catch(()=>null);
    await IDB.put('projects',pid,{...v.m,id:pid,name:cur?cur.name:v.m.name,updatedAt:Date.now()});
    if(open){d.nosave=true;clearTimeout(SAVE.timer);SAVE.timer=null;closeDoc()}
    await libLoad();if(open)await libOpen(pid);
    if(window.PrismSync&&PrismSync.push)PrismSync.push(pid);   // les autres appareils reçoivent la version remise
    return true},
  async openCopy(id){const v=(await VERS.all()).find(x=>x.id===id);if(!v)return false;const nid=uid8(),when=new Date(v.at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});
    await IDB.put('projects',nid,{...v.m,id:nid,name:(v.m.name||'Sans titre').replace(/\.[^.]+$/,'')+' (version du '+when+')',createdAt:Date.now(),updatedAt:Date.now()});
    await libLoad();await libOpen(nid);if(window.PrismSync&&PrismSync.push)PrismSync.push(nid);return nid},
  async remove(id){await VERS.del(id);gcBlobs().catch(()=>{})},
  async forget(pid){for(const v of await VERS.of(pid))await VERS.del(v.id)}};
/* une version à l'enregistrement, au plus tous les quarts d'heure */
(()=>{const _sn=saveNow;saveNow=async function(){const r=await _sn.apply(this,arguments);try{const d=S.doc;if(d&&d.pid&&!d.nosave&&d.saved){const pid=d.pid,last=(await VERS.of(pid))[0];
    if(!last||Date.now()-last.at>=VERS.EVERY)await vAdd(pid)}}catch(e){console.warn('versions',e)}return r}})();
/* une photo effacée pour de bon (Corbeille vidée) perd aussi ses versions */
if(window.PrismTrash){const _rm=PrismTrash.remove,_em=PrismTrash.empty;
  PrismTrash.remove=async function(id){await PrismVersions.forget(id).catch(()=>{});return _rm.apply(this,arguments)};
  PrismTrash.empty=async function(){for(const e of await PrismTrash.list().catch(()=>[]))await PrismVersions.forget(e.id).catch(()=>{});return _em.apply(this,arguments)}}

(()=>{const st=document.createElement('style');st.textContent=`
.vr-list{display:grid;gap:6px;max-height:min(56vh,520px);overflow:auto}
.dlg:has(.vr-list){width:min(600px,calc(100vw - 32px));max-width:none}
.vr-it{display:grid;grid-template-columns:72px minmax(0,1fr) auto;gap:12px;align-items:center;padding:6px;border-radius:10px;background:var(--chrome-2)}
.vr-it img{width:72px;height:48px;object-fit:cover;border-radius:6px;background:var(--chrome)}
.vr-it b{display:block;font-weight:600;font-size:13px}.vr-it small{color:var(--fg-2);font-size:11.5px}
.vr-it .acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.vr-new{display:flex;gap:8px;margin:0 0 10px}.vr-new input{flex:1}
@media (max-width:520px){.vr-it{grid-template-columns:56px minmax(0,1fr)}.vr-it img{width:56px}.vr-it .acts{grid-column:1/-1}}
.vr-empty{color:var(--fg-2);padding:18px 4px;text-align:center}`;document.head.appendChild(st)})();
async function versionsDialog(){const d=S.doc;if(!d||!d.pid){toast('Ouvrez une photo pour voir ses versions');return}
  if(!d.saved){d.nosave=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow()}
  const pid=d.pid,list=await VERS.of(pid).catch(()=>[]);
  const when=t=>new Date(t).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const body=`<div class="vr-new"><input id="vrName" type="text" maxlength="60" placeholder="Nom de la version (par exemple « Avant le ciel »)"><button class="btn" id="vrAdd">Créer une version</button></div>`+
    (list.length?`<div class="vr-list">${list.map(v=>`<div class="vr-it" data-id="${esc(v.id)}"><img alt=""><div><b>${esc(v.name||when(v.at))}</b><small>${v.name?esc(when(v.at))+' · ':''}${v.why?esc(v.why):v.named?'Version nommée':'Enregistrée automatiquement'} · ${v.m.layers.length} calque${v.m.layers.length>1?'s':''}</small></div>
      <div class="acts"><button class="btn sm primary" data-v="restore">Revenir à celle-ci</button><button class="btn sm" data-v="copy">Ouvrir en copie</button><button class="btn sm" data-v="del" aria-label="Supprimer la version">Supprimer</button></div></div>`).join('')}</div>`
      :`<p class="vr-empty">Pas encore de version. Prism en garde une tous les quarts d’heure.</p>`);
  const dl=dialog({title:'Versions de « '+(d.name||'Sans titre')+' »',body,buttons:[{label:'Fermer',primary:true}]});
  dl.querySelectorAll('.vr-it').forEach(r=>{const v=list.find(x=>x.id===r.dataset.id),img=r.querySelector('img');if(v&&v.m.thumb)IDB.get('blobs',v.m.thumb).then(b=>{if(b){const u=URL.createObjectURL(b);img.onload=()=>URL.revokeObjectURL(u);img.src=u}}).catch(()=>{})});
  const add=async()=>{const n=$('#vrName',dl).value.trim();const v=await vAdd(pid,{name:n||'Version du '+new Date().toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})});closeDialog();toast(v?'Version créée':'Rien de nouveau');versionsDialog()};
  $('#vrAdd',dl).onclick=add;$('#vrName',dl).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add()}};
  dl.addEventListener('click',async e=>{const b=e.target.closest('[data-v]');if(!b)return;const id=b.closest('.vr-it').dataset.id;
    if(b.dataset.v==='restore'){closeDialog();if(await PrismVersions.restore(id))toast('Version rétablie. L’état d’avant est gardé.')}
    else if(b.dataset.v==='copy'){closeDialog();await PrismVersions.openCopy(id);toast('Version ouverte en copie')}
    else{await PrismVersions.remove(id);b.closest('.vr-it').remove();toast('Version supprimée')}})}
window.PrismVersions.dialog=versionsDialog;
/* Fichier > Versions de la photo…, et dans le panneau Historique */
{const F=MENU2.file,_f=F.items;F.items=function(){const a=_f.apply(this,arguments),i=a.findIndex(x=>x&&x.label==='Renommer le document…');a.splice(i<0?a.length:i+1,0,MI('Versions de la photo…',{icon:'history',fn:versionsDialog,dis:S.doc?false:NODOC}));return a}}
{const E=MENU2.edit,_e=E.items;E.items=function(){const a=_e.apply(this,arguments),i=a.findIndex(x=>x&&x.label==='Historique');if(i>=0)a.splice(i+1,0,MI('Versions de la photo…',{icon:'history',fn:versionsDialog,dis:S.doc?false:NODOC}));return a}}
