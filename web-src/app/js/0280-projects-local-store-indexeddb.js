/* ================= projects: local store (IndexedDB) ================= */
const uid8=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const DEVICE=(()=>{try{let d=localStorage.getItem('rv-device');if(!d){d=uid8();localStorage.setItem('rv-device',d)}return d}catch(e){return uid8()}})();
const b64enc=u=>{let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(s)},b64dec=t=>{try{const s=atob(t),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}catch(e){return null}};
const PREF=(()=>{let p={};try{p=JSON.parse(localStorage.getItem('rv-prefs')||'{}')}catch(e){}return{get:(k,d)=>k in p?p[k]:d,set:(k,v)=>{p[k]=v;try{localStorage.setItem('rv-prefs',JSON.stringify(p))}catch(e){}}}})();
const IDB={_db:null,
  open(){if(this._db)return this._db;this._db=new Promise((res,rej)=>{let r;try{r=indexedDB.open('revelateur',1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{const db=r.result;['projects','blobs','amap'].forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s)})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});this._db.catch(()=>{});return this._db},
  async tx(store,mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction(store,mode),s=t.objectStore(store);let out;const q=fn(s);if(q)q.onsuccess=()=>out=q.result;t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
  get(s,k){return this.tx(s,'readonly',st=>st.get(k))},put(s,k,v){return this.tx(s,'readwrite',st=>st.put(v,k))},del(s,k){return this.tx(s,'readwrite',st=>st.delete(k))},
  all(s){return this.tx(s,'readonly',st=>st.getAll())},keys(s){return this.tx(s,'readonly',st=>st.getAllKeys())}};

/* A canvas is encoded once into 2048 px PNG tiles; copy-on-write editing means an unchanged canvas keeps its identity, so it is never re-encoded or re-uploaded. */
const TILE=2048,encCache=new WeakMap(),PIN=new Set();let PINLOG=null;const pin=k=>{PIN.add(k);PINLOG&&PINLOG.push(k)}; // PINLOG: keys pinned by the save in flight, unpinned if it fails
/* manifests from a zip, IndexedDB or the cloud are untrusted: w/h must be sane integers (they reach innerHTML and canvas sizes) */
function checkDims(m){if(!m||!(Number.isInteger(m.w)&&Number.isInteger(m.h)&&m.w>0&&m.h>0&&m.w<=65536&&m.h<=65536))throw new Error('projet illisible (dimensions invalides)');return m}
const toBlob=(c,type='image/png',q)=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('encodage')),type,q));
async function encodeCanvas(c){const hit=encCache.get(c);if(hit)return hit;const tiles=[];
  const ox=c.__sp?c.__sx:0,oy=c.__sp?c.__sy:0; // a sparse layer's cropped canvas: its tiles are placed in photo coordinates, so older versions load it too
  for(let y=0;y<c.height;y+=TILE)for(let x=0;x<c.width;x+=TILE){const w=Math.min(TILE,c.width-x),h=Math.min(TILE,c.height-y),t=mk(w,h);cx(t).drawImage(c,x,y,w,h,0,0,w,h);const key='t_'+uid8();pin(key);await IDB.put('blobs',key,await toBlob(t));tiles.push({x:x+ox,y:y+oy,w,h,key});await tick()}
  encCache.set(c,tiles);return tiles}
async function decodeTiles(tiles,w,h,getBlob){const c=mk(w,h),g=cx(c);for(const t of tiles){const b=await getBlob(t);if(!b)throw new Error('tuile manquante');const bm=await createImageBitmap(b);g.drawImage(bm,t.x,t.y);bm.close&&bm.close()}return c}
async function projectThumb(){const d=S.doc,s=Math.min(1,480/Math.max(d.w,d.h));const c=await renderDoc(s);const o=mk(c.width,c.height),g=cx(o);g.fillStyle='#808080';g.fillRect(0,0,o.width,o.height);g.drawImage(c,0,0);return toBlob(o,'image/jpeg',0.82)}
async function buildManifest(d=S.doc){const layers=[],meta=S.meta||'',name=d.name,active=d.active,src=d.layers.slice(),W=d.w,H=d.h,thumbB=await projectThumb(); // snapshot: d can change across the awaits
  for(const L of src){const e={id:L.id,kind:L.kind,name:L.name,visible:L.visible!==false,opacity:L.opacity,blend:L.blend,editMask:!!L.editMask,...xtra(L)};
    if(L.kind==='adjust')e.dev=JSON.parse(JSON.stringify(L.dev));if(lcv(L))e.canvas=await encodeCanvas(lcv(L));if(L.hi){try{e.hi=await encodeHi(L)}catch(err){console.warn(err)}}e.mask=L.mask?await encodeCanvas(L.mask):null;if(L.so&&L.so.out===L.canvas){try{e.so={t:await encodeCanvas(L.so.src),m:{...L.so.m}}}catch(err){console.warn(err)}}if(L.fbase&&L.filters&&L.filters.length&&L.fout===L.canvas){try{e.fbase=await encodeCanvas(L.fbase);e.filters=JSON.parse(JSON.stringify(L.filters))}catch(err){console.warn(err)}}layers.push(e)}
  const tk='t_'+uid8();pin(tk);await IDB.put('blobs',tk,thumbB);
  return{v:1,app:'revelateur',id:d.pid,name,w:W,h:H,active,meta,space:d.space||'srgb',lib:d.lib||null,exif:d.exif?b64enc(d.exif):null,path:d.path?JSON.parse(JSON.stringify(d.path)):null,raw:d.raw?{key:d.raw.key,name:d.raw.name,set:d.raw.set,w:d.raw.w,h:d.raw.h}:null,updatedAt:Date.now(),device:DEVICE,sync:!!d.sync,thumb:tk,guides:(d.guides&&(d.guides.v.length||d.guides.h.length))?{v:d.guides.v.slice(),h:d.guides.h.slice()}:null,layers}}
function manifestKeys(m){const k=new Set();if(m.thumb)k.add(m.thumb);if(m.raw&&m.raw.key)k.add(m.raw.key);(m.layers||[]).forEach(L=>{(L.canvas||[]).forEach(t=>k.add(t.key));(L.mask||[]).forEach(t=>k.add(t.key));(L.hi||[]).forEach(t=>k.add(t.key));(L.fbase||[]).forEach(t=>k.add(t.key));((L.so&&L.so.t)||[]).forEach(t=>k.add(t.key))});return k}
async function gcBlobs(){const ms=await IDB.all('projects'),keep=new Set();ms.forEach(m=>manifestKeys(m).forEach(k=>keep.add(k)));PIN.forEach(k=>keep.add(k));if(S.doc){if(S.doc.raw&&S.doc.raw.key)keep.add(S.doc.raw.key);for(const L of S.doc.layers)for(const c of [lcv(L),L.mask,L.fbase,L.so&&L.so.src]){const t=c&&encCache.get(c);t&&t.forEach(x=>keep.add(x.key))}}const hk=await (window.PrismHist?PrismHist.keep(keep,ms):[]);const all=await IDB.keys('blobs');for(const k of all)if(!keep.has(k)&&!String(k).startsWith('icc_')&&!hk.includes(k)){await IDB.del('blobs',k);await IDB.del('amap',k).catch(()=>{})}}

const SAVE={timer:null,running:false,again:false,state:'idle',err:''};
function scheduleSave(ms=2500){const d=S.doc;if(!d||d.nosave||(S.sample&&S.hi<1&&!d.saved))return;clearTimeout(SAVE.timer);SAVE.timer=setTimeout(()=>{SAVE.timer=null;saveNow()},ms);setSaveState('pending')}
async function flushSave(){clearTimeout(SAVE.timer);SAVE.timer=null;while(SAVE.running)await new Promise(r=>setTimeout(r,50));const d=S.doc;if(d&&!d.nosave&&!(S.sample&&S.hi<1&&!d.saved)&&(SAVE.again||SAVE.state==='pending'||!d.saved)){SAVE.again=false;await saveNow()}}
async function saveNow(quiet=true){clearTimeout(SAVE.timer);SAVE.timer=null;const d=S.doc;if(!d||d.nosave)return;if(SAVE.running){SAVE.again=true;return}SAVE.running=true;setSaveState('saving');PINLOG=[];
  let m;try{m=await buildManifest(d);await IDB.put('projects',m.id,m);manifestKeys(m).forEach(k=>PIN.delete(k));d.saved=true;if(S.doc===d)PREF.set('last',m.id);gcBlobs().catch(()=>{});setSaveState(SAVE.timer||SAVE.again?'pending':'saved');if(!quiet)toast('Projet enregistré sur cet appareil');
    if(d.sync)Cloud.push(m).catch(e=>console.error(e))}
  catch(e){console.error(e);if(m)manifestKeys(m).forEach(k=>PIN.delete(k));(PINLOG||[]).forEach(k=>PIN.delete(k));SAVE.err=e.message||String(e);setSaveState('error');if(!quiet)toast('Enregistrement impossible : '+SAVE.err,5000)}
  finally{PINLOG=null;SAVE.running=false;if(SAVE.again){SAVE.again=false;scheduleSave(400)}}}
async function loadManifest(m,getBlob){checkDims(m);busy(true,'Ouverture du projet…',0);const cs0=CS;setCS(m.space||'srgb');try{const layers=[];let i=0;
    for(const e of m.layers){const L={id:S.nextId++,kind:e.kind,name:e.name,visible:e.visible!==false,opacity:e.opacity??1,blend:e.blend||'source-over',editMask:!!e.editMask,mask:null,...xtra(e)};
      if(e.kind==='adjust')L.dev=Object.assign(DEV0(),e.dev||{});if(e.canvas)await loadLayerCanvas(L,e,m.w,m.h,getBlob);
      if(e.mask){L.mask=await decodeTiles(e.mask,m.w,m.h,getBlob);encCache.set(L.mask,e.mask)}if(e.so&&L.canvas){try{const sc=await decodeTiles(e.so.t,m.w,m.h,getBlob);encCache.set(sc,e.so.t);L.so={src:sc,m:e.so.m,out:L.canvas}}catch(err){console.warn(err)}}if(e.fbase&&e.filters&&L.canvas){try{L.fbase=await decodeTiles(e.fbase,m.w,m.h,getBlob);encCache.set(L.fbase,e.fbase);L.filters=e.filters;L.fout=L.canvas}catch(err){console.warn(err)}}if(e.hi&&L.canvas){try{L.hi=await decodeHi(e.hi,m.w,m.h,getBlob);L.hiC=L.canvas;hiEnc.set(L.hi,e.hi)}catch(err){console.warn(err)}}layers.push(L);busy(true,'Ouverture du projet…',++i/m.layers.length)}
    S.doc={w:m.w,h:m.h,name:m.name,layers,active:clamp(m.active??layers.length-1,0,layers.length-1),sel:null,pid:m.id,sync:!!m.sync,saved:true,guides:m.guides?{v:(m.guides.v||[]).slice(),h:(m.guides.h||[]).slice()}:null,updatedAt:m.updatedAt,lib:m.lib||null,exif:m.exif?b64dec(m.exif):null,space:CS,path:m.path||null,raw:m.raw&&m.raw.key?{...m.raw}:null};
    S.sample=false;S.meta=m.meta||'';S.history=[];S.hi=-1;S.crop=null;S.cloneSrc=null;S.cloneOff=null;S.maxHist=clamp(Math.floor(HIST_BUDGET/(m.w*m.h*4)),3,40);AI.subjectCache=null;
    pushHistory('Ouverture du projet',true);selChanged();markComp();fit(true);syncAll();$('#empty').hidden=true;updateDocName();if(S.tool==='crop')initCrop();PREF.set('last',m.id);setSaveState('saved')}
  catch(e){setCS(cs0);throw e}finally{busy(false)}}
async function openLocalProject(id){const m=await IDB.get('projects',id);if(!m){toast('Projet introuvable');return false}
  const c=Cloud.list.find(p=>p.id===id);if(m.sync&&c&&c.updatedAt>m.updatedAt&&Cloud.ok){return Cloud.open(id)}
  await loadManifest(m,t=>IDB.get('blobs',t.key));return true}


/* leaving the page (closing the tab or the app, switching apps on a phone): the last edits are saved now rather than in 2.5 s */
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&SAVE.timer)flushSave().catch(e=>console.error(e))});
addEventListener('pagehide',()=>{if(SAVE.timer)flushSave().catch(e=>console.error(e))});
