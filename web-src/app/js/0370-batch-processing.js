/* ================= batch processing ================= */
async function batchDialog(preIds){const locals=await IDB.all('projects').catch(()=>[]);const st={src:S.doc?'look':'style',files:[],ids:preIds||[],out:'both',q:90,edge:'full',local:true};
  const dl=dialog({title:'Traitement par lot',body:`
    <div class="field">Appliquer<div class="seg" id="bSrc"><button data-v="look" ${S.doc?'':'disabled'}>Les réglages de la photo ouverte</button><button data-v="style">Le style d’une photo de référence</button></div></div>
    <label class="inline" id="bLocalRow"><input type="checkbox" id="bLocal" checked> Inclure les réglages locaux (masques redimensionnés)</label>
    <div id="bRefRow" hidden><button class="btn sm" id="bRef">Choisir la photo de référence…</button> <span class="muted" id="bRefName">${STYLE_REF?esc(STYLE_REF.name):'aucune'}</span><p class="muted">Chaque photo est ajustée séparément pour se rapprocher de la référence : la série devient homogène même si les photos de départ diffèrent.</p></div>
    <div class="field">Sur<div class="inline"><button class="btn sm" id="bFiles">Ajouter des photos…</button><span class="muted" id="bCount"></span></div></div>
    ${locals.length?`<details class="bproj"><summary>Ou choisir des projets existants</summary><div class="bplist">${locals.sort((a,b)=>b.updatedAt-a.updatedAt).map(m=>`<label class="inline"><input type="checkbox" data-pid="${esc(m.id)}" ${st.ids.includes(m.id)?'checked':''}> ${esc(m.name)}</label>`).join('')}</div></details>`:''}
    <div class="field">Résultat<div class="seg" id="bOut"><button data-v="both" class="on">Projets et export JPEG</button><button data-v="projects">Projets seulement</button><button data-v="jpeg">Export JPEG seulement</button></div></div>
    <label class="field" id="bEdgeRow">Taille des JPEG<select id="bEdge"><option value="full">Taille d’origine</option><option value="4096">Grand côté 4096 px</option><option value="2048">Grand côté 2048 px</option><option value="1080">Grand côté 1080 px</option></select></label>`,
    buttons:[{label:'Annuler'},{label:'Lancer',primary:true,onClick:el=>{runBatch(st);}}]});dl.classList.add('wide');
  const upd=()=>{$$('#bSrc button',dl).forEach(b=>b.classList.toggle('on',b.dataset.v===st.src));$$('#bOut button',dl).forEach(b=>b.classList.toggle('on',b.dataset.v===st.out));$('#bRefRow',dl).hidden=st.src!=='style';$('#bLocalRow',dl).hidden=st.src!=='look';$('#bEdgeRow',dl).hidden=st.out==='projects';
    st.ids=$$('[data-pid]',dl).filter(i=>i.checked).map(i=>i.dataset.pid);const n=st.files.length+st.ids.length;$('#bCount',dl).textContent=n?`${n} photo${n>1?'s':''} sélectionnée${n>1?'s':''}`:'aucune photo';};
  $$('#bSrc button',dl).forEach(b=>b.onclick=()=>{st.src=b.dataset.v;upd()});$$('#bOut button',dl).forEach(b=>b.onclick=()=>{st.out=b.dataset.v;upd()});dl.addEventListener('change',e=>{if(e.target.id==='bLocal')st.local=e.target.checked;if(e.target.id==='bEdge')st.edge=e.target.value;upd()});
  $('#bFiles',dl).onclick=async()=>{const fs=await pickFile('image/*,.tif,.tiff,.pdf,.tga,.svg,.jxl,.bmp,.ico,.avif,.heic,.heif,'+RAW_ACCEPT,true);st.files.push(...fs);upd()};
  $('#bRef',dl).onclick=async()=>{const f=await pickFile('image/*,.tif,.tiff,.pdf,.tga,.svg,.jxl,.bmp,.ico,.avif,.heic,.heif,'+RAW_ACCEPT);if(!f)return;busy(true,'Analyse de la référence…',null);try{const c=await styleFromFile(f);STYLE_REF={name:(f.name||'référence').replace(/\.[^.]+$/,''),img:thumbData(c)};$('#bRefName',dl).textContent=STYLE_REF.name}catch(e){toast('Référence illisible')}finally{busy(false)}};
  upd()}
async function runBatch(st){const n=st.files.length+st.ids.length;if(!n){toast('Ajoutez des photos à traiter');return}if(st.src==='style'&&!STYLE_REF){toast('Choisissez d’abord la photo de référence');return}
  const look=st.src==='look'?captureLook(st.local):null;if(look&&!look.layers.length){toast('La photo ouverte n’a aucun réglage à reporter');return}
  await flushSave();const backPid=S.doc&&S.doc.pid,backDoc=S.doc,backState=backDoc?{history:S.history,hi:S.hi,meta:S.meta,sample:S.sample,maxHist:S.maxHist}:null;try{const outs=[],fails=[];let i=0;const stop={v:false};
  const step=async(name,load)=>{busy(true,`Traitement ${i+1} / ${n} : ${name}`,i/n);await tick();try{await load();busy(true,`Traitement ${i+1} / ${n} : ${name}`,i/n); // the loaders hide the overlay when done
      if(st.out==='jpeg')S.doc.nosave=true;
      if(look)pasteLook(look,{silent:true});else await applyStyleToDoc(STYLE_REF,{silent:true});pushHistory(look?'Réglages collés (lot)':'Style appliqué (lot)');
      if(st.out!=='jpeg'){S.doc.saved=true;await flushSave();await saveNow()}
      if(st.out!=='projects'){const d=S.doc,sc=st.edge==='full'?1:Math.min(1,+st.edge/Math.max(d.w,d.h));const c=await renderDoc(sc);const w=mk(c.width,c.height),g=cx(w);g.fillStyle='#fff';g.fillRect(0,0,w.width,w.height);g.drawImage(c,0,0);
        outs.push({name:(d.name||'photo').replace(/\.[a-z0-9]+$/i,'').replace(/[\\/:*?"<>|]+/g,'-')+'-prism.jpg',data:await toBlob(w,'image/jpeg',st.q/100)})}}
    catch(e){console.error(e);fails.push(name)}i++};
  for(const f of st.files){await step(f.name,async()=>{const isRaw=RAW_EXT.test(f.name||'');const r=isRaw?await decodeRaw(f):{c:await loadImageFile(f),meta:''};setDoc(r.c,f.name,{meta:r.meta,raw:isRaw,quiet:true})})}
  for(const id of st.ids){const m=await IDB.get('projects',id);await step(m?m.name:id,async()=>{if(!m)throw new Error('introuvable');await loadManifest(m,t=>IDB.get('blobs',t.key))})}
  busy(false);if(backPid&&!backDoc.nosave&&(await IDB.get('projects',backPid).catch(()=>null)))await openLocalProject(backPid);else if(backDoc){setCS(backDoc.space||'srgb');S.doc=backDoc;Object.assign(S,backState);selChanged();markComp();fit(true);syncAll();renderHistory();updateUndo();updateDocName()}
  if(outs.length){const used=new Set();outs.forEach(o=>{let nm=o.name,k=2;while(used.has(nm))nm=o.name.replace(/\.jpg$/,`-${k++}.jpg`);used.add(nm);o.name=nm});busy(true,'Création de l’archive…',null);const z=await makeZip(outs);busy(false);await saveFile(z,'revelateur-lot-'+new Date().toISOString().slice(0,10)+'.zip')}
  toast(`${n-fails.length} photo${n-fails.length>1?'s':''} traitée${n-fails.length>1?'s':''}${st.out!=='jpeg'?' et ajoutée'+(n-fails.length>1?'s':'')+' à vos projets':''}${fails.length?`. Échec : ${fails.join(', ')}`:''}`,7000)}catch(e){console.error(e);toast('Traitement par lot interrompu : '+(e.message||e),6000)}finally{busy(false)}}

