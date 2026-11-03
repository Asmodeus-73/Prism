/* ================= 1.0: Corbeille de la Photothèque =================
   Une photo supprimée garde son projet (et ses tuiles) 30 jours dans la Corbeille de CET appareil : elle n'est pas synchronisée.
   « Restaurer » la remet dans la Photothèque (et, avec la synchronisation, elle repart vers les autres appareils).
   Rangement : une base IndexedDB à part, « prism-corbeille », pour ne pas toucher à la base des projets. */
const TRASH={DAYS:30,_db:null,
  open(){if(this._db)return this._db;this._db=new Promise((res,rej)=>{let r;try{r=indexedDB.open('prism-corbeille',1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('items'))db.createObjectStore('items',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error||new Error('Corbeille indisponible'))});
    this._db.catch(()=>{this._db=null});return this._db},
  async tx(mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('items',mode),s=t.objectStore('items');let out;const q=fn(s);if(q)q.onsuccess=()=>out=q.result;
    t.oncomplete=()=>res(out);const f=()=>rej(t.error||new Error('Corbeille indisponible'));t.onerror=f;t.onabort=f})},
  all(){return this.tx('readonly',s=>s.getAll()).then(a=>a||[])},
  put(e){return this.tx('readwrite',s=>s.put(e))},
  del(id){return this.tx('readwrite',s=>s.delete(id))},
  async purge(){const now=Date.now();let n=0;for(const e of await this.all())if(now-e.deletedAt>this.DAYS*864e5){await this.del(e.id);n++}if(n)gcBlobs().catch(()=>{});return n}};
window.PrismTrash={
  keys:async()=>{const k=[];for(const e of await TRASH.all())if(e.m)manifestKeys(e.m).forEach(x=>k.push(x));return k},
  list:()=>TRASH.all(),
  async restore(id){const e=(await TRASH.all()).find(x=>x.id===id);if(!e)return false;
    PREF.set('libGone',GONE.get().filter(x=>x.id!==id));
    await IDB.put('projects',e.m.id,{...e.m,updatedAt:Date.now()});await TRASH.del(id);await libLoad();if(LIB.open)renderLibrary();return true},
  async remove(id){await TRASH.del(id);gcBlobs().catch(()=>{})},
  async empty(){for(const e of await TRASH.all())await TRASH.del(e.id);gcBlobs().catch(()=>{})},
  count:0};
/* la suppression passe d'abord par la Corbeille : le projet est copié avant, et gardé seulement s'il a bien été supprimé */
(()=>{const _del=libDelete;
  libDelete=async function(ids){const keep=[];for(const id of ids){const it=LIB.items.find(i=>i.id===id);if(it&&it.local)keep.push(it.local)}
    /* les tuiles restent tant que la copie n'est pas écrite : on les épingle pendant la suppression */
    const pinned=[];keep.forEach(m=>manifestKeys(m).forEach(k=>{if(!PIN.has(k)){PIN.add(k);pinned.push(k)}}));
    try{const r=await _del.apply(this,arguments);
      for(const m of keep){const still=await IDB.get('projects',m.id).catch(()=>null);if(!still)await TRASH.put({id:m.id,m,deletedAt:Date.now()}).catch(e=>console.warn('corbeille',e))}
      await trRefresh();return r}
    finally{pinned.forEach(k=>PIN.delete(k))}}})();
/* entrée « Corbeille » sous les collections, et sa fenêtre */
const trRefresh=async()=>{try{PrismTrash.count=(await TRASH.all()).length}catch(e){PrismTrash.count=0}if(LIB.open)try{renderLibrary()}catch(e){}};
(()=>{const st=document.createElement('style');st.textContent=`
.lb-trash svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;margin-right:6px;vertical-align:-3px}
.tr-list{display:grid;gap:6px;max-height:min(56vh,520px);overflow:auto}
.dlg:has(.tr-list){width:min(560px,calc(100vw - 32px));max-width:none}
.tr-it{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:center;padding:6px;border-radius:10px;background:var(--chrome-2)}
.tr-it img{width:64px;height:44px;object-fit:cover;border-radius:6px;background:var(--chrome)}
.tr-it b{display:block;font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr-it small{color:var(--fg-2);font-size:11.5px}
.tr-it .acts{display:flex;gap:6px}
@media (max-width:520px){.tr-it{grid-template-columns:56px minmax(0,1fr)}.tr-it img{width:56px}.tr-it .acts{grid-column:1/-1;justify-content:flex-end}}
.tr-empty{color:var(--fg-2);padding:18px 4px;text-align:center}
`;document.head.appendChild(st)})();
const _sideHTML=sideHTML;
sideHTML=function(){const h=_sideHTML.apply(this,arguments);
  return h+`<div class="lb-h">Cet appareil</div><button class="lb-nav lb-trash" data-trash="1"><span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>Corbeille</span><small>${PrismTrash.count}</small></button>`};
const trLeft=t=>{const d=Math.max(0,Math.ceil((TRASH.DAYS*864e5-(Date.now()-t))/864e5));return d<=1?'effacée demain':`effacée dans ${d} jours`};
async function trashDialog(){await TRASH.purge().catch(()=>{});const items=(await TRASH.all().catch(()=>[])).sort((a,b)=>b.deletedAt-a.deletedAt);
  const body=items.length?`<div class="tr-list">${items.map(e=>`<div class="tr-it" data-id="${esc(e.id)}"><img alt=""><div><b>${esc(e.m.name||'Sans titre')}</b><small>Supprimée ${esc(window.PrismHome?PrismHome.rel(e.deletedAt):new Date(e.deletedAt).toLocaleDateString('fr-FR'))} · ${trLeft(e.deletedAt)}</small></div>
      <div class="acts"><button class="btn sm primary" data-tr="restore">Restaurer</button><button class="btn sm" data-tr="del" aria-label="Supprimer définitivement">Supprimer</button></div></div>`).join('')}</div>`
    :`<p class="tr-empty">La Corbeille est vide. Les photos supprimées sur cet appareil y restent ${TRASH.DAYS} jours.</p>`;
  const dl=dialog({title:'Corbeille de cet appareil',body,buttons:items.length?[{label:'Fermer'},{label:'Vider la corbeille',onClick:()=>{(async()=>{if(await askConfirm(`Effacer définitivement ${items.length>1?'les '+items.length+' photos':'la photo'} de la Corbeille ?`,{title:'Vider la corbeille',ok:'Vider',danger:true})){await PrismTrash.empty();await trRefresh();toast('Corbeille vidée')}else trashDialog()})();}}]:[{label:'Fermer'}]});
  dl.querySelectorAll('.tr-it').forEach(r=>{const e=items.find(x=>x.id===r.dataset.id);const img=r.querySelector('img');
    if(e&&e.m.thumb)IDB.get('blobs',e.m.thumb).then(b=>{if(b){const u=URL.createObjectURL(b);img.onload=()=>URL.revokeObjectURL(u);img.src=u}}).catch(()=>{})});
  dl.addEventListener('click',async ev=>{const b=ev.target.closest('[data-tr]');if(!b)return;const id=b.closest('.tr-it').dataset.id;
    if(b.dataset.tr==='restore'){await PrismTrash.restore(id);toast('Photo restaurée dans la Photothèque')}
    else{await PrismTrash.remove(id);toast('Photo effacée définitivement')}
    await trRefresh();trashDialog()})}
window.PrismTrash.dialog=trashDialog;
/* sur téléphone, les collections sont dans une liste déroulante : la Corbeille y a sa ligne */
(()=>{const _rl=renderLibrary;renderLibrary=function(){const r=_rl.apply(this,arguments);try{const cs=$('#lbColl');if(cs&&!cs.querySelector('[value="__trash"]')){const o=document.createElement('option');o.value='__trash';o.textContent=`Corbeille (${PrismTrash.count})`;cs.appendChild(o);
    cs.addEventListener('change',e=>{if(cs.value==='__trash'){e.stopImmediatePropagation();cs.value=LIB.coll;trashDialog()}},true)}}catch(e){}return r}})();
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-trash]');if(b){e.preventDefault();e.stopPropagation();trashDialog()}},true);
TRASH.purge().catch(()=>{}).then(trRefresh);
