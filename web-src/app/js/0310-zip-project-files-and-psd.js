/* ================= zip (project files and PSD delivery) ================= */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=t[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}})();
async function deflateRaw(u8){if(typeof CompressionStream==='undefined')return null;try{const s=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));return new Uint8Array(await new Response(s).arrayBuffer())}catch(e){return null}}
async function inflateRaw(u8){const s=new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(s).arrayBuffer())}
async function makeZip(entries){if(entries.length>65000)throw new Error('trop de fichiers pour une archive');const enc=new TextEncoder(),parts=[],central=[];let off=0;
  for(const e of entries){const name=enc.encode(e.name),data=e.data instanceof Uint8Array?e.data:new Uint8Array(await e.data.arrayBuffer());const crc=CRC(data);let body=data,method=0;
    if(e.compress){const z=await deflateRaw(data);if(z&&z.length<data.length){body=z;method=8}}
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,method,true);h.setUint32(14,crc,true);h.setUint32(18,body.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);
    parts.push(new Uint8Array(h.buffer),name,body);const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,method,true);c.setUint32(16,crc,true);c.setUint32(20,body.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),name);off+=30+name.length+body.length}
  const csz=central.reduce((a,b)=>a+b.length,0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);end.setUint32(12,csz,true);end.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(end.buffer)],{type:'application/zip'})}
async function readZip(blob){const b=new Uint8Array(await blob.arrayBuffer()),v=new DataView(b.buffer);let e=b.length-22;while(e>=0&&v.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('archive zip illisible');
  const n=v.getUint16(e+10,true);let p=v.getUint32(e+16,true);const out={},dec=new TextDecoder();
  for(let i=0;i<n;i++){const method=v.getUint16(p+10,true),csz=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),xl=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),lo=v.getUint32(p+42,true);const name=dec.decode(b.subarray(p+46,p+46+nl));
    const lnl=v.getUint16(lo+26,true),lxl=v.getUint16(lo+28,true),st=lo+30+lnl+lxl,raw=b.subarray(st,st+csz);out[name]={method,raw};p+=46+nl+xl+cl}
  return{names:Object.keys(out),async get(name){const f=out[name];if(!f)return null;return f.method===8?inflateRaw(f.raw):f.raw.slice()}}}
async function saveFile(blob,fname){await dlReady;if(dlNS){try{await dlNS.save({filename:fname,data:blob});toast('Fichier enregistré : '+fname);return}catch(e){if(e&&e.code==='declined'){toast('Enregistrement annulé');return}}}
  const url=URL.createObjectURL(blob);dialog({title:'Votre fichier est prêt',body:`<p><a class="btn primary" href="${url}" download="${esc(fname)}">Télécharger ${esc(fname)}</a></p><p class="muted">${fmtMo(blob.size)}</p>`,buttons:[{label:'Fermer',onClick:()=>setTimeout(()=>URL.revokeObjectURL(url),1000)}]})}
async function exportProjectFile(){const d=S.doc;if(!d)return;busy(true,'Préparation du projet…',null);try{d.nosave=false;await flushSave();await saveNow();const m=await IDB.get('projects',d.pid);if(!m)throw new Error('projet non enregistré');const files=[];const seen=new Set();
    for(const k of manifestKeys(m)){if(seen.has(k))continue;seen.add(k);files.push({name:'tiles/'+k+(k===m.thumb?'.jpg':'.png'),data:await IDB.get('blobs',k)})}
    files.unshift({name:'revelateur.json',data:new TextEncoder().encode(JSON.stringify({...m,sync:false})),compress:true});const z=await makeZip(files);busy(false);
    await saveFile(z,(d.name||'projet').replace(/\.[a-z0-9]+$/i,'').replace(/[\\/:*?"<>|]+/g,'-')+'.prism.zip')}
  catch(e){busy(false);console.error(e);toast('Export du projet impossible : '+(e.message||e),5000)}}
async function importZip(file){const z=await readZip(file);
  if(z.names.includes('revelateur.json')){const m=JSON.parse(new TextDecoder().decode(await z.get('revelateur.json')));const id=uid8(),remap=new Map();
    const take=async t=>{const nk='t_'+uid8();const ext=t.key===m.thumb?'.jpg':'.png';const data=await z.get('tiles/'+t.key+ext);if(!data)throw new Error('fichier manquant dans l’archive');await IDB.put('blobs',nk,new Blob([data],{type:ext==='.jpg'?'image/jpeg':'image/png'}));remap.set(t.key,nk);return{...t,key:nk}};
    for(const L of m.layers){if(L.canvas)L.canvas=await Promise.all(L.canvas.map(take));if(L.mask)L.mask=await Promise.all(L.mask.map(take));if(L.hi){try{L.hi=await Promise.all(L.hi.map(take))}catch(e){L.hi=null}}}if(m.raw&&m.raw.key){try{m.raw.key=(await take({key:m.raw.key})).key}catch(e){m.raw=null}}m.thumb=(await take({key:m.thumb})).key;
    Object.assign(m,{id,sync:Cloud.ok&&PREF.get('autoSync',true),updatedAt:Date.now(),device:DEVICE});await IDB.put('projects',id,m);await loadManifest(m,t=>IDB.get('blobs',t.key));toast('Projet importé avec ses calques');if(m.sync)scheduleSave(300);return}
  const psd=z.names.find(n=>/\.psd$/i.test(n));if(psd){await importPSD(new Blob([await z.get(psd)]),psd.split('/').pop());return}
  const img=z.names.find(n=>/\.(jpe?g|png|webp|tiff?|dng|cr2|cr3|nef|arw|raf)$/i.test(n));if(img){await openBlob(new File([await z.get(img)],img.split('/').pop()),false);return}
  throw new Error('aucun projet, PSD ni photo dans cette archive')}

