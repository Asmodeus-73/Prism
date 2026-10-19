/* ================= cloud sync (claude.ai account: db + assets) ================= */
const Cloud={ok:false,db:null,assets:null,uid:null,list:[],state:'off',unsub:null,usage:null,
  async init(){try{if(!(window.claude&&window.claude.use))return;const [db,assets,user]=await Promise.all(['db','assets','user'].map(n=>window.claude.use(n).catch(()=>null)));
      if(!db||!assets||!user)return;const uid=await user.id().catch(()=>null);if(!uid)return;Object.assign(this,{db,assets,uid,ok:true});this.col=db.collection('data/users/'+uid);
      this.unsub=this.col.onSnapshot(snap=>{this.list=snap.docs.map(s=>s.data()).filter(Boolean).filter(p=>p.app==='revelateur');this.onRemote();if($('#projGrid'))renderProjects()},e=>console.warn('sync',e&&e.code));
      setSaveState(SAVE.state);if(S.doc&&S.doc.sync&&S.doc.saved)scheduleSave(800)}catch(e){console.warn(e)}},
  onRemote(){const d=S.doc;if(!d||!d.sync)return;const r=this.list.find(p=>p.id===d.pid);if(r&&r.device!==DEVICE&&r.updatedAt>(d.updatedAt||0)+500&&r.updatedAt!==this._warned){this._warned=r.updatedAt;
      toastAction('Ce projet a été modifié sur un autre appareil.','Charger cette version',()=>this.open(d.pid))}},
  async upTile(t,live,fresh){const hit=await IDB.get('amap',t.key);if(hit&&live&&live.has(hit))return hit;const b=await IDB.get('blobs',t.key);if(!b)throw new Error('tuile manquante');const r=await this.assets.upload(b,{type:b.type||'image/png'});fresh&&fresh.push(r.id);await IDB.put('amap',t.key,r.id);return r.id},
  async push(m){if(!this.ok){setSaveState('saved');return}if(this.pushing){this.pushAgain=m;return}this.pushing=true;setSaveState('syncing');
    const fresh=[];try{const ref=this.col.doc(m.id);const prev=(await ref.get().catch(()=>null));const pd=prev&&prev.exists?prev.data():null;const live=cloudAssets(pd);
      if(pd&&pd.device!==DEVICE&&S.doc&&S.doc.pid===m.id&&pd.updatedAt>(S.doc.updatedAt||0)+500&&!this.force){const e=new Error('conflit');e.code='conflict';throw e}this.force=false;
      if(JSON.stringify({...m,exif:null}).length>240000){const e=new Error('projet trop complexe pour la synchronisation');e.code='too_big';throw e}
      const conv=async arr=>{if(!arr)return null;const o=[];for(const t of arr)o.push({x:t.x,y:t.y,w:t.w,h:t.h,asset:await this.upTile(t,live,fresh)});return o};
      const layers=[];for(const L of m.layers){layers.push({...L,canvas:await conv(L.canvas),mask:await conv(L.mask),hi:null})}
      const cm={...m,thumb:await this.upTile({key:m.thumb},live,fresh),layers,sync:true,raw:null,exif:null};
      await ref.set(cm);fresh.length=0;S.doc&&S.doc.pid===m.id&&(S.doc.updatedAt=m.updatedAt);
      if(pd){const keep=cloudAssets(cm);for(const a of live)if(!keep.has(a))this.assets.delete(a).catch(()=>{})}
      if(!S.doc||S.doc.pid===m.id)setSaveState(SAVE.timer||SAVE.running?'pending':'synced')}
    catch(e){console.error(e);for(const a of fresh)this.assets.delete(a).catch(()=>{});if(e.code==='conflict'){SAVE.err='modifié sur un autre appareil';setSaveState('syncerr');toastAction('Ce projet a été modifié sur un autre appareil.','Charger cette version',()=>this.open(m.id));return}SAVE.err=e.code==='too_big'?'projet trop complexe pour la synchronisation':e.code==='quota_or_state'||e.code==='quota_exceeded'?'espace de synchronisation plein':e.code==='not_granted'?'autorisation refusée':(e.message||e.code||'erreur');setSaveState('syncerr')}
    finally{this.pushing=false;if(this.pushAgain){const n=this.pushAgain;this.pushAgain=null;this.push(n)}}},
  async open(id){const cm=this.list.find(p=>p.id===id);if(!cm){toast('Projet introuvable');return false}clearTimeout(SAVE.timer);SAVE.timer=null;while(SAVE.running||this.pushing)await new Promise(r=>setTimeout(r,50));const cur=S.doc&&S.doc.pid===id?S.doc:null;if(cur)cur.nosave=true;busy(true,'Téléchargement du projet…',null);
    try{const loc={...cm,layers:[]};const fetchKey=async t=>{const r=await fetch('/_blob/'+t.asset);if(!r.ok)throw new Error('fichier '+r.status);const b=await r.blob();const key='t_'+uid8();PIN.add(key);await IDB.put('blobs',key,b);await IDB.put('amap',key,t.asset);return{x:t.x,y:t.y,w:t.w,h:t.h,key}};
      for(const L of cm.layers){const n={...L};if(L.canvas){n.canvas=[];for(const t of L.canvas)n.canvas.push(await fetchKey(t))}if(L.mask){n.mask=[];for(const t of L.mask)n.mask.push(await fetchKey(t))}loc.layers.push(n)}
      loc.thumb=(await fetchKey({asset:cm.thumb,x:0,y:0,w:0,h:0})).key;loc.sync=true;await IDB.put('projects',loc.id,loc);manifestKeys(loc).forEach(k=>PIN.delete(k));busy(false);this._warned=0;
      await loadManifest(loc,t=>IDB.get('blobs',t.key));gcBlobs().catch(()=>{});return true}
    catch(e){console.error(e);if(cur)cur.nosave=false;busy(false);toast('Téléchargement impossible : '+(e.message||e),5000);return false}},
  async remove(id){const r=this.col.doc(id),s=await r.get().catch(()=>null);await r.delete();if(s&&s.exists){const dead=cloudAssets(s.data());for(const a of dead)await this.assets.delete(a).catch(()=>{});try{const db=await IDB.open();await new Promise((res,rej)=>{const t=db.transaction('amap','readwrite'),st=t.objectStore('amap');const q=st.openCursor();q.onsuccess=()=>{const c=q.result;if(!c)return;if(dead.has(c.value))c.delete();c.continue()};t.oncomplete=res;t.onerror=()=>rej(t.error)})}catch(e){}}},
  async refreshUsage(){try{this.usage=(await this.assets.list()).usage}catch(e){this.usage=null}return this.usage}};
function cloudAssets(m){const k=new Set();if(!m)return k;if(m.thumb)k.add(m.thumb);(m.layers||[]).forEach(L=>{(L.canvas||[]).forEach(t=>k.add(t.asset));(L.mask||[]).forEach(t=>k.add(t.asset))});return k}

function toastAction(msg,label,fn){toast(msg,9000);const t=$('#toast');const b=document.createElement('button');b.className='btn sm';b.style.marginLeft='10px';b.textContent=label;b.onclick=()=>{t.hidden=true;fn()};t.appendChild(b)}
const SYNC_IC={saved:'<path d="M4 10.5l4 4 8-9"/>',pending:'<circle cx="10" cy="10" r="1.6" fill="currentColor"/>',saving:'<path d="M10 3v9M6 8l4 4 4-4M4 16h12"/>',syncing:'<path d="M5.5 15.5h9a3.5 3.5 0 00.5-7 5 5 0 00-9.6-1.2A4 4 0 005.5 15.5z"/><path d="M10 13V9M8 11l2-2 2 2"/>',
  synced:'<path d="M5.5 15.5h9a3.5 3.5 0 00.5-7 5 5 0 00-9.6-1.2A4 4 0 005.5 15.5z"/><path d="M7.5 11.5l2 2 3.5-4"/>',error:'<path d="M10 4l7 12H3z"/><path d="M10 9v3M10 14.2v.1"/>',syncerr:'<path d="M5.5 15.5h9a3.5 3.5 0 00.5-7 5 5 0 00-9.6-1.2A4 4 0 005.5 15.5z"/><path d="M10 9v3M10 13.6v.1"/>',idle:'<path d="M4 10.5l4 4 8-9"/>'};
function setSaveState(st){SAVE.state=st;const b=$('#bSync');if(!b)return;const d=S.doc;let lbl;
  const local={pending:'Modifications en attente',saving:'Enregistrement…',saved:'Enregistré sur cet appareil',error:'Échec de l’enregistrement : '+SAVE.err,idle:'Pas encore enregistré'}[st];
  if(d&&d.sync&&Cloud.ok&&['saved','synced','syncing','syncerr'].includes(st))lbl={saved:'Enregistré, synchronisation en attente',synced:'Synchronisé sur votre compte',syncing:'Synchronisation…',syncerr:'Synchronisation impossible : '+SAVE.err}[st];
  if(st==='saved'&&d&&d.sync&&!Cloud.ok)lbl='Enregistré sur cet appareil (synchronisation indisponible ici)';
  b.innerHTML=`<svg viewBox="0 0 20 20">${SYNC_IC[st]||SYNC_IC.saved}</svg>`;b.title=(lbl||local||'')+' · Ouvrir mes projets';b.setAttribute('aria-label',b.title);b.dataset.st=st;b.classList.toggle('warn',st==='error'||st==='syncerr')}

