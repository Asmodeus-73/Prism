/* ================= v9: sync v2 (large projects, several devices, automatic conflict copies) ================= */
const DEVNAME=(()=>{const u=navigator.userAgent;return /iPad/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)?'iPad':/iPhone/.test(u)?'iPhone':/Android/.test(u)?'Android':/Mac/.test(u)?'Mac':/Windows/.test(u)?'Windows':/Linux/.test(u)?'Linux':'autre appareil'})();
const _pushHistory15=pushHistory;pushHistory=function(){S.lastEdit=Date.now();return _pushHistory15.apply(this,arguments)};
async function pool(items,n,fn){let i=0,err=null;const run=async()=>{while(i<items.length&&!err){const k=i++;try{await fn(items[k],k)}catch(e){err=e}}};await Promise.all(Array.from({length:Math.min(n,items.length)},run));if(err)throw err}
const retry=async(fn,tries=4)=>{let d=1500;for(let k=0;;k++){try{return await fn()}catch(e){if(k>=tries-1||e&&(e.code==='quota_exceeded'||e.code==='quota_or_state'||e.code==='not_granted'))throw e;await new Promise(r=>setTimeout(r,d));d*=2}}};
const LAYJ=new Map();
async function layersOf(cm){if(!cm.layersAsset)return cm.layers||[];let j=LAYJ.get(cm.layersAsset);if(!j){const r=await retry(()=>fetch('/_blob/'+cm.layersAsset).then(x=>{if(!x.ok)throw new Error('fichier '+x.status);return x.json()}));j=r.layers||[];LAYJ.set(cm.layersAsset,j)}return j}
async function cloudAssetsDeep(m){const k=new Set();if(!m)return k;if(m.thumb)k.add(m.thumb);if(m.layersAsset)k.add(m.layersAsset);if(m.raw&&m.raw.asset)k.add(m.raw.asset);let ls=[];try{ls=await layersOf(m)}catch(e){console.warn('layers',e)}
  ls.forEach(L=>{['canvas','mask','hi'].forEach(f=>(L[f]||[]).forEach(t=>t.asset&&k.add(t.asset)))});return k}
function exifGeo(b64){try{if(!b64)return null;const T=tiffRead(b64dec(b64)),i0=T.ifds[0];if(!i0)return null;const o={};const ep=T.val(i0,0x8769);if(ep){const e=T.readIFD(ep),m=/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(T.str(e,0x9003)||'');if(m)o.taken=new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5],+m[6]).getTime()}
  const gp=T.val(i0,0x8825);if(gp){const g=T.readIFD(gp),la=T.arr(g,2),lo=T.arr(g,4);if(la&&lo&&la.length>=3&&lo.length>=3){let lat=la[0]+la[1]/60+la[2]/3600,lon=lo[0]+lo[1]/60+lo[2]/3600;if(T.str(g,1)==='S')lat=-lat;if(T.str(g,3)==='W')lon=-lon;if(isFinite(lat)&&isFinite(lon)&&(lat||lon)){o.lat=lat;o.lon=lon}}}return o}catch(e){return null}}
Cloud.prog=null;Cloud.pend=new Set();
const _ssState15=setSaveState;setSaveState=function(st){_ssState15(st);const b=$('#bSync');if(b&&st==='syncing'&&Cloud.prog)b.title=`Synchronisation… ${Cloud.prog.done} / ${Cloud.prog.total} fichiers · Ouvrir mes projets`};
Cloud.push=async function(m){if(!this.ok){setSaveState('saved');return}if(this.pushing){this.pushAgain=m;return}this.pushing=true;setSaveState('syncing');let fork=false;
  try{const ref=this.col.doc(m.id),prev=await ref.get().catch(()=>null),pd=prev&&prev.exists?prev.data():null;
    if(pd&&pd.device!==DEVICE&&S.doc&&S.doc.pid===m.id&&pd.updatedAt>(S.doc.updatedAt||0)+500&&!this.force){fork=true;return}
    this.force=false;const live=new Set([...await cloudAssetsDeep(pd),...this.pend]);
    const jobs=[];const reg=(arr,k)=>{(arr||[]).forEach(t=>jobs.push({t,k}))};const up=[];
    m.layers.forEach((L,i)=>{['canvas','mask','hi'].forEach(f=>(L[f]||[]).forEach(t=>up.push({i,f,t})))});
    const total=up.length+1+(m.raw&&m.raw.key?1:0);Cloud.prog={done:0,total};const out=m.layers.map(L=>({...L,canvas:L.canvas?[]:null,mask:L.mask?[]:null,hi:L.hi?[]:null}));
    await pool(up,4,async u=>{const id=await retry(()=>this.upTile(u.t,live,null).then(async id=>{this.pend.add(id);return id}));out[u.i][u.f].push({x:u.t.x,y:u.t.y,w:u.t.w,h:u.t.h,asset:id,_o:u.t.x+'_'+u.t.y});Cloud.prog.done++;if(Cloud.prog.done%3===0)setSaveState('syncing')});
    out.forEach(L=>['canvas','mask','hi'].forEach(f=>{if(L[f])L[f].sort((a,b)=>a.y-b.y||a.x-b.x).forEach(t=>delete t._o)}));
    const thumb=await retry(()=>this.upTile({key:m.thumb},live,null));this.pend.add(thumb);
    let raw=null;if(m.raw&&m.raw.key){try{const b=await IDB.get('blobs',m.raw.key);if(b&&b.size<120*1048576){const a=await retry(()=>this.upTile({key:m.raw.key},live,null));this.pend.add(a);raw={name:m.raw.name,set:m.raw.set,w:m.raw.w,h:m.raw.h,asset:a}}}catch(e){console.warn('raw not synced',e)}}Cloud.prog.done=total;
    const lj=new Blob([JSON.stringify({v:2,layers:out})],{type:'application/json'});const la=(await retry(()=>this.assets.upload(lj,{type:'application/json'}))).id;this.pend.add(la);LAYJ.set(la,out);
    const geo=exifGeo(m.exif)||null;
    const cm={...m,thumb,layersAsset:la,layers:m.layers.map(L=>({id:L.id,kind:L.kind,name:L.name,visible:L.visible,hi:!!L.hi})),sync:true,raw,exif:null,geo,deviceName:DEVNAME,v:2};
    await ref.set(cm);const keep=await cloudAssetsDeep(cm);this.pend.clear();S.doc&&S.doc.pid===m.id&&(S.doc.updatedAt=m.updatedAt);
    for(const a of live)if(!keep.has(a))this.assets.delete(a).catch(()=>{});Cloud.prog=null;
    if(!S.doc||S.doc.pid===m.id)setSaveState(SAVE.timer||SAVE.running?'pending':'synced')}
  catch(e){console.error(e);Cloud.prog=null;SAVE.err=e.code==='quota_or_state'||e.code==='quota_exceeded'?'espace de synchronisation plein':e.code==='not_granted'?'autorisation refusée':(e.message||e.code||'erreur réseau');setSaveState('syncerr');if(!/plein|refus/.test(SAVE.err)){clearTimeout(this.rt2);this.rt2=setTimeout(()=>{if(S.doc&&S.doc.pid===m.id&&S.doc.sync)scheduleSave(500)},20000)}}
  finally{this.pushing=false;if(fork){this.forkLocal(m)}else if(this.pushAgain){const n=this.pushAgain;this.pushAgain=null;this.push(n)}}};
/* another device saved first: keep this device's version as its own copy, nothing is lost, nothing to resolve */
Cloud.forkLocal=async function(m){const d=S.doc;if(!d||d.pid!==m.id)return;const oldId=m.id,stamp=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  try{await this.download(oldId)}catch(e){console.warn(e)}
  d.pid=uid8();d.name=`${d.name.replace(/ \(version .*\)$/,'')} (version ${DEVNAME} ${stamp})`;d.updatedAt=0;d.sync=true;d.saved=false;updateDocName();
  await saveNow();const keepName=d.name,newId=d.pid;
  toastAction(`Ce projet avait été modifié sur un autre appareil. Votre version est gardée à part : « ${keepName} ».`,'Voir l’autre version',async()=>{await flushSave();Cloud.open(oldId)});
  if(LIB.open){await libLoad();renderLibrary()}};
Cloud.download=async function(id){const cm=this.list.find(p=>p.id===id);if(!cm)throw new Error('Projet introuvable');
  const loc={...cm,layers:[]},ls=await layersOf(cm);let n=0;const all=[];ls.forEach(L=>['canvas','mask','hi'].forEach(f=>(L[f]||[]).forEach(t=>all.push(t))));const total=all.length+1;
  const fetchKey=async t=>{const b=await retry(()=>fetch('/_blob/'+t.asset).then(r=>{if(!r.ok)throw new Error('fichier '+r.status);return r.blob()}));const key='t_'+uid8();PIN.add(key);await IDB.put('blobs',key,b);await IDB.put('amap',key,t.asset);busy(true,'Téléchargement du projet…',++n/total);return{x:t.x,y:t.y,w:t.w,h:t.h,key}};
  const map=new Map();await pool(all,4,async t=>{map.set(t,await fetchKey(t))});
  for(const L of ls){const o={...L};['canvas','mask','hi'].forEach(f=>{if(L[f])o[f]=L[f].map(t=>map.get(t))});loc.layers.push(o)}
  loc.thumb=(await fetchKey({asset:cm.thumb,x:0,y:0,w:0,h:0})).key;
  if(cm.raw&&cm.raw.asset){try{const k=(await fetchKey({asset:cm.raw.asset,x:0,y:0,w:0,h:0})).key;loc.raw={key:k,name:cm.raw.name,set:cm.raw.set,w:cm.raw.w,h:cm.raw.h}}catch(e){loc.raw=null}}else loc.raw=null;
  delete loc.layersAsset;loc.sync=true;loc.deviceName=cm.deviceName;await IDB.put('projects',loc.id,loc);manifestKeys(loc).forEach(k=>PIN.delete(k));return loc};
Cloud.open=async function(id){const cm=this.list.find(p=>p.id===id);if(!cm){toast('Projet introuvable');return false}clearTimeout(SAVE.timer);SAVE.timer=null;while(SAVE.running||this.pushing)await new Promise(r=>setTimeout(r,50));const cur=S.doc&&S.doc.pid===id?S.doc:null;if(cur)cur.nosave=true;busy(true,'Téléchargement du projet…',null);
  try{const loc=await this.download(id);busy(false);this._warned=0;await loadManifest(loc,t=>IDB.get('blobs',t.key));gcBlobs().catch(()=>{});return true}
  catch(e){console.error(e);if(cur)cur.nosave=false;busy(false);toast('Téléchargement impossible : '+(e.message||e)+'. Réessayez quand la connexion est meilleure.',6000);return false}};
Cloud.remove=async function(id){const r=this.col.doc(id),s=await r.get().catch(()=>null);const data=s&&s.exists?s.data():null;await r.delete();if(data){const dead=await cloudAssetsDeep(data);for(const a of dead)await this.assets.delete(a).catch(()=>{});try{const db=await IDB.open();await new Promise((res,rej)=>{const t=db.transaction('amap','readwrite'),st=t.objectStore('amap');const q=st.openCursor();q.onsuccess=()=>{const c=q.result;if(!c)return;if(dead.has(c.value))c.delete();c.continue()};t.oncomplete=res;t.onerror=()=>rej(t.error)})}catch(e){}}};
/* a clean document follows the other device by itself */
(()=>{const prev=Cloud.onRemote.bind(Cloud);Cloud.onRemote=function(){const d=S.doc;if(d&&d.sync&&!d.nosave){const r=this.list.find(p=>p.id===d.pid);const clean=['saved','synced'].includes(SAVE.state)&&!SAVE.timer&&!SAVE.running&&!this.pushing&&!S.stroke&&!S.drag&&!$('#scrim')&&Date.now()-(S.lastEdit||0)>5000;
    if(r&&r.device!==DEVICE&&r.updatedAt>(d.updatedAt||0)+500&&r.updatedAt!==this._warned&&clean){this._warned=r.updatedAt;toast(`Mis à jour depuis ${r.deviceName||'votre autre appareil'}`,4000);this.open(d.pid);return}}return prev()}})();

