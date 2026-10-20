/* ================= projects panel ================= */
const fmtDate=t=>{if(!t)return'';const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?'Aujourd’hui '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'})};
const fmtMo=b=>b>=1073741824?(b/1073741824).toFixed(1)+' Go':(b/1048576).toFixed(b<1e7?1:0)+' Mo';
/* stopping sync on a cloud-only project: keep a copy on this device first, never just delete it */
async function cloudToLocal(id){busy(true,'Téléchargement du projet…',null);try{const loc=await Cloud.download(id);loc.sync=false;await IDB.put('projects',id,loc);return true}
  catch(e){console.error(e);toast('Synchronisation non arrêtée : copie sur cet appareil impossible ('+(e.message||e)+')',6000);return false}finally{busy(false)}}
async function projectsDialog(){const dl=dialog({title:'Mes projets',body:`<div class="proj-top"><button class="btn primary sm" id="pjNew">Nouvelle photo…</button><button class="btn sm" id="pjImport">Importer un projet ou un PSD…</button><button class="btn sm" id="pjBatch">Traitement par lot…</button>${S.doc?'<button class="btn sm" id="pjSave">Enregistrer maintenant</button>':''}</div>
    <div class="proj-sync" id="pjSync"></div><div class="proj-grid" id="projGrid"><p class="muted">Chargement…</p></div>`,buttons:[{label:'Fermer'}]});dl.classList.add('wide');
  $('#pjBatch',dl).onclick=()=>{closeDialog();batchDialog()};$('#pjNew',dl).onclick=()=>{closeDialog();openFile()};$('#pjImport',dl).onclick=()=>{closeDialog();$('#fileProject').click()};const sv=$('#pjSave',dl);if(sv)sv.onclick=async()=>{await saveNow(false);renderProjects()};
  renderProjects();if(Cloud.ok){await Cloud.refreshUsage();renderProjects()}}
async function renderProjects(){const g=$('#projGrid'),sy=$('#pjSync');if(!g)return;const locals=await IDB.all('projects').catch(()=>[]);const map=new Map();
  locals.forEach(m=>map.set(m.id,{id:m.id,name:m.name,w:m.w,h:m.h,updatedAt:m.updatedAt,local:m,cloud:null}));
  Cloud.list.forEach(c=>{const e=map.get(c.id)||{id:c.id,name:c.name,w:c.w,h:c.h,updatedAt:c.updatedAt,local:null};e.cloud=c;if(c.updatedAt>e.updatedAt){e.updatedAt=c.updatedAt;e.name=c.name}map.set(c.id,e)});
  const items=[...map.values()].sort((a,b)=>b.updatedAt-a.updatedAt);
  if(sy)sy.innerHTML=Cloud.ok?`<label class="inline"><input type="checkbox" id="pjAuto" ${PREF.get('autoSync',true)?'checked':''}> Synchroniser automatiquement les nouveaux projets sur mon compte</label>${Cloud.usage?`<span class="muted">Espace utilisé : ${fmtMo(Cloud.usage.bytes)} sur ${fmtMo(Cloud.usage.maxBytes)}</span>`:''}`
    :`<span class="muted">Projets enregistrés sur cet appareil. La synchronisation entre appareils fonctionne quand Prism est ouvert depuis votre compte Claude par son propriétaire.</span>`;
  const au=$('#pjAuto');if(au)au.onchange=()=>PREF.set('autoSync',au.checked);
  if(!items.length){g.innerHTML='<p class="muted">Aucun projet pour l’instant. Ouvrez une photo : elle sera enregistrée automatiquement, avec ses calques.</p>';return}
  g.innerHTML=items.map(p=>{const cur=S.doc&&S.doc.pid===p.id;const where=p.local&&p.cloud?'Synchronisé':p.cloud?'Sur votre compte':p.local&&p.local.sync&&Cloud.ok?'À synchroniser':'Cet appareil';
    return`<div class="pj${cur?' on':''}" data-id="${esc(p.id)}"><button class="pj-th" data-act="open" aria-label="Ouvrir ${esc(p.name)}"><img alt="" data-thumb="${esc(p.id)}"></button><div class="pj-meta"><b title="${esc(p.name)}">${esc(p.name)}</b><span>${fmtDate(p.updatedAt)} · ${p.w|0} × ${p.h|0}</span><span class="pj-where">${cur?'Ouvert · ':''}${where}</span></div>
      <div class="pj-acts">${Cloud.ok?`<button class="btn sm" data-act="sync">${p.cloud||(p.local&&p.local.sync)?'Arrêter la synchro':'Synchroniser'}</button>`:''}<button class="btn sm" data-act="rename">Renommer</button><button class="btn sm" data-act="del">Supprimer</button></div></div>`}).join('');
  for(const p of items){const img=g.querySelector(`img[data-thumb="${CSS.escape(p.id)}"]`);if(!img)continue;
    if(p.local){IDB.get('blobs',p.local.thumb).then(b=>{if(b){const u=URL.createObjectURL(b);img.onload=()=>URL.revokeObjectURL(u);img.src=u}}).catch(()=>{})}else if(p.cloud)img.src='/_blob/'+p.cloud.thumb}
  g.onclick=async e=>{const b=e.target.closest('[data-act]');if(!b)return;const id=b.closest('.pj').dataset.id,p=map.get(id),act=b.dataset.act;
    if(act==='open'){closeDialog();await flushSave();if(p.local)await openLocalProject(id);else await Cloud.open(id);return}
    if(act==='rename'){const n=prompt('Nouveau nom du projet',p.name);if(!n||!n.trim())return;if(S.doc&&S.doc.pid===id){S.doc.name=n.trim();updateDocName();await saveNow()}else if(p.local){p.local.name=n.trim();p.local.updatedAt=Date.now();await IDB.put('projects',id,p.local);if(p.local.sync)Cloud.push(p.local)}else if(p.cloud){await Cloud.col.doc(id).update({name:n.trim()})}renderProjects();return}
    if(act==='del'){if(!await askConfirm(`Supprimer « ${p.name} »${p.cloud?' de cet appareil et de votre compte':''} ? Cette action est définitive.`,{ok:'Supprimer',danger:true}))return;
      await IDB.del('projects',id).catch(()=>{});if(p.cloud)await Cloud.remove(id).catch(e=>toast('Suppression du compte impossible : '+(e.code||e.message)));if(S.doc&&S.doc.pid===id){clearTimeout(SAVE.timer);SAVE.timer=null;for(const L of S.doc.layers){L.canvas&&encCache.delete(L.canvas);L.mask&&encCache.delete(L.mask)}S.doc.pid=uid8();S.doc.saved=false;S.doc.sync=false;S.doc.raw=null;setSaveState('idle')}gcBlobs().catch(()=>{});renderProjects();return}
    if(act==='sync'){const on=!(p.cloud||(p.local&&p.local.sync));if(S.doc&&S.doc.pid===id){S.doc.sync=on;if(on)await saveNow();else{await saveNow();await Cloud.remove(id).catch(()=>{})}}
      else if(p.local){p.local.sync=on;await IDB.put('projects',id,p.local);if(on)await Cloud.push(p.local);else await Cloud.remove(id).catch(()=>{})}
      else if(p.cloud&&!on){if(!await cloudToLocal(id))return;await Cloud.remove(id).catch(()=>{})}
      toast(on?'Projet synchronisé sur votre compte':'Synchronisation arrêtée : le projet reste sur cet appareil');renderProjects()}}}

