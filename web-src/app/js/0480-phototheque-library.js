/* ================= photothèque (library) ================= */
const LBL=[['red','Rouge','#e5534b'],['yellow','Jaune','#d9a520'],['green','Vert','#3fa45b'],['blue','Bleu','#4a7fe0'],['purple','Violet','#9a63d6']];
const LIB={items:[],sel:new Set(),anchor:null,q:'',minR:0,label:'',tag:'',cam:'',coll:'all',src:'all',sort:'date',thumbs:new Map(),open:false};
const libOf=m=>Object.assign({rating:0,label:'',tags:[],at:0},m&&m.lib||{});
const camOf=meta=>camFromMeta(meta);
async function libLoad(){const locals=await IDB.all('projects').catch(()=>[]);const map=new Map();
  locals.forEach(m=>map.set(m.id,{id:m.id,name:m.name,w:m.w,h:m.h,updatedAt:m.updatedAt,meta:m.meta||'',lib:libOf(m),local:m,cloud:null,hi:(m.layers||[]).some(L=>L.hi)}));
  Cloud.list.forEach(c=>{const e=map.get(c.id)||{id:c.id,name:c.name,w:c.w,h:c.h,updatedAt:c.updatedAt,meta:c.meta||'',lib:libOf(c),local:null};e.cloud=c;if(c.updatedAt>e.updatedAt){e.updatedAt=c.updatedAt;e.name=c.name}const cl=libOf(c);if(cl.at>e.lib.at)e.lib=cl;map.set(c.id,e)});
  const d=S.doc;if(d&&d.pid&&map.has(d.pid)&&d.lib){const e=map.get(d.pid);if((d.lib.at||0)>=e.lib.at)e.lib=libOf(d)}
  LIB.items=[...map.values()];for(const id of [...LIB.sel])if(!map.has(id))LIB.sel.delete(id)}
function libFiltered(){const q=LIB.q.trim().toLowerCase(),now=Date.now();let a=LIB.items.filter(it=>{const l=it.lib;
    if(l.rating<LIB.minR)return false;if(LIB.label&&l.label!==LIB.label)return false;if(LIB.tag&&!l.tags.includes(LIB.tag))return false;if(LIB.cam&&camOf(it.meta)!==LIB.cam)return false;
    if(LIB.src==='local'&&!it.local)return false;if(LIB.src==='cloud'&&!it.cloud)return false;
    if(LIB.coll==='recent'&&now-it.updatedAt>7*864e5)return false;if(LIB.coll==='fav'&&l.rating<4)return false;if(LIB.coll==='unrated'&&l.rating>0)return false;if(LIB.coll==='raw'&&!/RAW|ISO/.test(it.meta)&&!it.hi)return false;
    if(q&&!(it.name.toLowerCase().includes(q)||it.meta.toLowerCase().includes(q)||l.tags.some(t=>t.toLowerCase().includes(q))))return false;return true});
  const S2={date:(x,y)=>y.updatedAt-x.updatedAt,old:(x,y)=>x.updatedAt-y.updatedAt,name:(x,y)=>x.name.localeCompare(y.name,'fr',{numeric:true}),rating:(x,y)=>y.lib.rating-x.lib.rating||y.updatedAt-x.updatedAt}[LIB.sort];return a.sort(S2)}
async function libSet(ids,patch){const at=Date.now();for(const id of ids){const it=LIB.items.find(x=>x.id===id);if(!it)continue;const l={...it.lib};
    if('rating' in patch)l.rating=patch.rating;if('label' in patch)l.label=l.label===patch.label?'':patch.label;if(patch.addTags)l.tags=[...new Set([...l.tags,...patch.addTags])];if(patch.delTag)l.tags=l.tags.filter(t=>t!==patch.delTag);l.at=at;it.lib=l;
    if(S.doc&&S.doc.pid===id)S.doc.lib=l;
    if(it.local){it.local.lib=l;await IDB.put('projects',id,it.local).catch(()=>{})}
    if(it.cloud&&Cloud.ok){it.cloud.lib=l;Cloud.col.doc(id).update({lib:l}).catch(e=>console.warn(e))}}
  renderLibrary()}
function stars(n,id,small){return `<span class="stars${small?' sm':''}" role="group" aria-label="Note : ${n} sur 5">${[1,2,3,4,5].map(k=>`<button data-star="${k}" ${id?`data-sid="${esc(id)}"`:''} aria-label="${k} étoile${k>1?'s':''}" class="${k<=n?'on':''}">★</button>`).join('')}</span>`}
async function libThumb(it,img){const key=it.local?it.local.thumb:null;const c=LIB.thumbs.get(it.id);if(c&&c.key===(key||it.cloud&&it.cloud.thumb)){img.src=c.url;return}
  if(key){try{const b=await IDB.get('blobs',key);if(b){const u=URL.createObjectURL(b);if(c&&c.url.startsWith('blob:'))URL.revokeObjectURL(c.url);LIB.thumbs.set(it.id,{key,url:u});img.src=u;return}}catch(e){}}
  if(it.cloud&&it.cloud.thumb){const u='/_blob/'+it.cloud.thumb;LIB.thumbs.set(it.id,{key:it.cloud.thumb,url:u});img.src=u}}
async function openLibrary(){await flushSave().catch(()=>{});let r=$('#library');if(!r){r=document.createElement('section');r.id='library';r.className='library';r.setAttribute('aria-label','Photothèque');document.body.appendChild(r)}
  LIB.open=true;closeMenu&&closeMenu();closeDialog();if(S.doc&&S.doc.pid){LIB.sel=new Set([S.doc.pid]);LIB.auto=true}
  r.innerHTML=`<header class="lb-top"><button class="btn sm" id="lbBack" ${S.doc?'':'hidden'}>← Retour à la retouche</button><b class="lb-title">Photothèque</b>
    <input type="search" id="lbQ" placeholder="Rechercher : nom, mot-clé, appareil…" aria-label="Rechercher" value="${esc(LIB.q)}">
    <select id="lbSort" aria-label="Trier"><option value="date">Plus récentes</option><option value="old">Plus anciennes</option><option value="rating">Mieux notées</option><option value="name">Nom</option></select>
    <span class="lb-sp"></span><button class="btn sm" id="lbImp">Importer un projet ou un PSD…</button><button class="btn sm primary" id="lbAdd">Ajouter des photos…</button><button class="ib" id="lbX" aria-label="Fermer la photothèque"><svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg></button></header>
    <div class="lb-body"><nav class="lb-side" id="lbSide"></nav><div class="lb-main"><div class="lb-filters" id="lbFil"></div><div class="lb-grid" id="lbGrid" tabindex="0" aria-label="Photos"></div></div><aside class="lb-info" id="lbInfo"></aside></div>`;
  $('#lbSort').value=LIB.sort;$('#lbSort').onchange=e=>{LIB.sort=e.target.value;renderLibrary()};$('#lbQ').oninput=e=>{LIB.q=e.target.value;clearTimeout(LIB.qt);LIB.qt=setTimeout(renderLibrary,120)};
  $('#lbBack').onclick=closeLibrary;$('#lbX').onclick=closeLibrary;$('#lbAdd').onclick=async()=>{const fs=await pickFiles('image/*,.tif,.tiff,.pdf,.tga,.svg,.jxl,.bmp,.ico,.avif,.heic,.heif,.psd,'+RAW_ACCEPT);if(fs.length)importToLibrary(fs)};$('#lbImp').onclick=()=>$('#fileProject').click();
  r.addEventListener('click',libClick);r.addEventListener('dblclick',e=>{const c=e.target.closest('.lb-card');if(c)libOpen(c.dataset.id)});r.addEventListener('keydown',e=>{libKey(e);e.stopPropagation()});r.addEventListener('dragover',e=>{e.preventDefault();r.classList.add('drop')});r.addEventListener('dragleave',e=>{if(e.target===r||!r.contains(e.relatedTarget))r.classList.remove('drop')});r.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();r.classList.remove('drop');const fs=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||RAW_EXT.test(f.name)||/\.(heic|heif|psd|png|tiff?|pdf|tga|svg|jxl)$/i.test(f.name));if(fs.length)importToLibrary(fs)});
  await libLoad();renderLibrary();if(Cloud.ok)Cloud.refreshUsage().then(()=>LIB.open&&renderLibrary());setTimeout(()=>$('#lbGrid')?.focus({preventScroll:true}),50)}
function closeLibrary(){LIB.open=false;$('#library')?.remove();if(!S.doc)$('#empty').hidden=false;requestRender()}
function renderLibrary(){const r=$('#library');if(!r)return;const all=LIB.items,list=libFiltered();
  const tags=new Map(),cams=new Map();all.forEach(it=>{it.lib.tags.forEach(t=>tags.set(t,(tags.get(t)||0)+1));const c=camOf(it.meta);if(c)cams.set(c,(cams.get(c)||0)+1)});
  const coll=[['all','Toutes les photos',all.length],['recent','7 derniers jours',all.filter(i=>Date.now()-i.updatedAt<7*864e5).length],['fav','Favoris (4 ★ et plus)',all.filter(i=>i.lib.rating>=4).length],['unrated','Sans note',all.filter(i=>!i.lib.rating).length],['raw','RAW et 16 bits',all.filter(i=>/RAW|ISO/.test(i.meta)||i.hi).length]];
  $('#lbSide').innerHTML=`<div class="lb-h">Collections</div>${coll.map(([k,l,n])=>`<button class="lb-nav${LIB.coll===k?' on':''}" data-coll="${k}"><span>${l}</span><small>${n}</small></button>`).join('')}
    ${tags.size?`<div class="lb-h">Mots-clés</div>${[...tags].sort((a,b)=>a[0].localeCompare(b[0],'fr')).map(([t,n])=>`<button class="lb-nav${LIB.tag===t?' on':''}" data-tag="${esc(t)}"><span># ${esc(t)}</span><small>${n}</small></button>`).join('')}`:''}
    ${cams.size?`<div class="lb-h">Appareils</div>${[...cams].map(([c,n])=>`<button class="lb-nav${LIB.cam===c?' on':''}" data-cam="${esc(c)}"><span>${esc(c)}</span><small>${n}</small></button>`).join('')}`:''}
    ${Cloud.ok?`<div class="lb-h">Emplacement</div>${[['all','Partout'],['local','Sur cet appareil'],['cloud','Sur mon compte']].map(([k,l])=>`<button class="lb-nav${LIB.src===k?' on':''}" data-src="${k}"><span>${l}</span></button>`).join('')}
      <label class="lb-auto"><input type="checkbox" id="lbAuto" ${PREF.get('autoSync',true)?'checked':''}> Synchroniser les nouveaux projets</label>${Cloud.usage?`<p class="lb-use">Espace utilisé : ${fmtMo(Cloud.usage.bytes)} sur ${fmtMo(Cloud.usage.maxBytes)}</p>`:''}`:`<p class="lb-use">Projets enregistrés sur cet appareil.</p>`}`;
  const au=$('#lbAuto');if(au)au.onchange=e=>PREF.set('autoSync',e.target.checked);
  const active=LIB.minR||LIB.label||LIB.tag||LIB.cam||LIB.q||LIB.coll!=='all'||LIB.src!=='all';
  $('#lbFil').innerHTML=`<span class="lb-fl">Note</span><span class="lb-minr">${[0,1,2,3,4,5].map(k=>`<button data-minr="${k}" class="${LIB.minR===k?'on':''}">${k?k+' ★ +':'Toutes'}</button>`).join('')}</span>
    <span class="lb-fl">Étiquette</span>${LBL.map(([k,l,c])=>`<button class="lb-dot${LIB.label===k?' on':''}" data-flabel="${k}" style="--c:${c}" aria-label="${l}" title="${l}"></button>`).join('')}
    <span class="lb-count">${list.length} photo${list.length>1?'s':''}${active?` · <button class="lnk" data-act="reset">Tout afficher</button>`:''}</span>
    <span class="lb-mob">${LIB.tag?`<button class="chip on" data-tag="${esc(LIB.tag)}"># ${esc(LIB.tag)} ×</button>`:''}<select id="lbColl" aria-label="Collection">${coll.map(([k,l])=>`<option value="${k}" ${LIB.coll===k?'selected':''}>${l}</option>`).join('')}${[...tags.keys()].map(t=>`<option value="#${esc(t)}" ${LIB.tag===t?'selected':''}># ${esc(t)}</option>`).join('')}</select></span>`;
  const cs=$('#lbColl');if(cs)cs.onchange=e=>{const v=e.target.value;if(v.startsWith('#')){LIB.tag=v.slice(1);LIB.coll='all'}else{LIB.coll=v;LIB.tag=''}renderLibrary()};
  const g=$('#lbGrid'),cur=S.doc&&S.doc.pid;
  g.innerHTML=list.length?list.map(it=>{const l=it.lib,lb=LBL.find(x=>x[0]===l.label);return `<div class="lb-card${LIB.sel.has(it.id)?' on':''}" data-id="${esc(it.id)}" role="button" tabindex="-1" aria-selected="${LIB.sel.has(it.id)}">
      <div class="lb-th"><img alt="" data-lth="${esc(it.id)}">${lb?`<i class="lb-lbl" style="--c:${lb[2]}"></i>`:''}${it.id===cur?'<em class="lb-badge">Ouvert</em>':''}${it.hi?'<em class="lb-badge b16">16 bits</em>':''}${it.cloud?'<svg class="lb-cl" viewBox="0 0 20 20" aria-label="Synchronisé"><path d="M5.5 15.5h9a3.5 3.5 0 00.5-7 5 5 0 00-9.6-1.2A4 4 0 005.5 15.5z"/></svg>':''}</div>
      <div class="lb-meta"><b title="${esc(it.name)}">${esc(it.name)}</b>${stars(l.rating,it.id,true)}</div></div>`}).join('')
    :`<div class="lb-empty"><p>${all.length?'Aucune photo ne correspond à ces filtres.':'Votre photothèque est vide.'}</p>${all.length?'<button class="btn sm" data-act="reset">Tout afficher</button>':'<button class="btn primary sm" data-act="add">Ajouter des photos…</button>'}</div>`;
  libLazy(g,list)
  renderLibInfo()}
function renderLibInfo(){const el=$('#lbInfo');if(!el)return;const sel=LIB.items.filter(i=>LIB.sel.has(i.id));$('#library').classList.toggle('has-info',sel.length>0);
  if(!sel.length){el.innerHTML=`<p class="lb-hint">Sélectionnez une photo pour la noter, l’étiqueter ou lui ajouter des mots-clés.<br><br><b>Raccourcis</b><br>1 à 5 : étoiles · 0 : sans note<br>6 à 9 : étiquettes rouge, jaune, vert, bleu<br>Entrée : ouvrir · Suppr : supprimer<br>${IS_MAC?'⌘':'Ctrl'}+clic ou Maj+clic : sélection multiple</p>`;return}
  const one=sel.length===1?sel[0]:null,l=one?one.lib:{rating:sel.every(s=>s.lib.rating===sel[0].lib.rating)?sel[0].lib.rating:0,label:sel.every(s=>s.lib.label===sel[0].lib.label)?sel[0].lib.label:'',tags:[...new Set(sel.flatMap(s=>s.lib.tags))]};
  el.innerHTML=`${one?`<div class="lb-big"><img alt="" id="lbBig"></div><input class="lb-name" id="lbName" value="${esc(one.name)}" aria-label="Nom du projet"><p class="lb-sub">${fmtDate(one.updatedAt)} · ${one.w} × ${one.h}${one.hi?' · 16 bits':''}${one.meta?'<br>'+esc(one.meta):''}<br>${one.local&&one.cloud?'Sur cet appareil et sur votre compte':one.cloud?'Sur votre compte':'Sur cet appareil'}</p>`:`<p class="lb-multi">${sel.length} photos sélectionnées</p>`}
    <div class="lb-row"><span>Note</span>${stars(l.rating,null)}</div>
    <div class="lb-row"><span>Étiquette</span><span>${LBL.map(([k,n,c])=>`<button class="lb-dot${l.label===k?' on':''}" data-label="${k}" style="--c:${c}" aria-label="${n}" title="${n}"></button>`).join('')}</span></div>
    <div class="lb-tags"><span>Mots-clés</span><div>${l.tags.map(t=>`<span class="chip">${esc(t)}<button data-deltag="${esc(t)}" aria-label="Retirer ${esc(t)}">×</button></span>`).join('')}</div><input id="lbTag" placeholder="Ajouter (Entrée), ex. mariage, Lisbonne" aria-label="Ajouter un mot-clé" list="lbTagList"><datalist id="lbTagList">${[...new Set(LIB.items.flatMap(i=>i.lib.tags))].map(t=>`<option value="${esc(t)}">`).join('')}</datalist></div>
    <div class="lb-acts">${one?`<button class="btn sm primary" data-act="open">Ouvrir</button>`:''}<button class="btn sm" data-act="batch">Traiter par lot…</button>${Cloud.ok&&one?`<button class="btn sm" data-act="sync">${one.cloud||(one.local&&one.local.sync)?'Arrêter la synchro':'Synchroniser'}</button>`:''}<button class="btn sm" data-act="del">Supprimer</button></div>`;
  if(one){const b=$('#lbBig',el);if(b)libThumb(one,b);const nm=$('#lbName',el);nm.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')nm.blur();if(e.key==='Escape'){nm.value=one.name;nm.blur()}};nm.onchange=()=>libRename(one,nm.value)}
  const ti=$('#lbTag',el);ti.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'&&ti.value.trim()){const t=ti.value.split(',').map(s=>s.trim()).filter(Boolean).map(s=>s.slice(0,40));ti.value='';libSet([...LIB.sel],{addTags:t}).then(()=>$('#lbTag')?.focus())}}}
async function libRename(it,n){n=(n||'').trim();if(!n||n===it.name)return;if(S.doc&&S.doc.pid===it.id){S.doc.name=n;updateDocName();await saveNow()}else if(it.local){it.local.name=n;it.local.updatedAt=Date.now();await IDB.put('projects',it.id,it.local);if(it.local.sync)Cloud.push(it.local)}else if(it.cloud){await Cloud.col.doc(it.id).update({name:n})}await libLoad();renderLibrary()}
/* the photo already open (the home screen's first card, often) only needs the library and the home screen out of the way; a double-click asks twice, the second ask waits for the first */
let libOpening=null;
async function libOpen(id){const it=LIB.items.find(i=>i.id===id);if(!it)return;if(libOpening){if(libOpening.id===id)return libOpening.p;await libOpening.p.catch(()=>{})}
  if(S.doc&&S.doc.pid===id){closeLibrary();$('#empty').hidden=true;try{updateDocName()}catch(e){}requestRender();return}
  const p=(async()=>{await flushSave();closeLibrary();if(it.local)await openLocalProject(id);else await Cloud.open(id)})();libOpening={id,p};
  try{return await p}finally{if(libOpening&&libOpening.p===p)libOpening=null}}
async function libSync(it){const id=it.id,on=!(it.cloud||(it.local&&it.local.sync));if(S.doc&&S.doc.pid===id){S.doc.sync=on;if(on)await saveNow();else{await saveNow();await Cloud.remove(id).catch(()=>{})}}
  else if(it.local){it.local.sync=on;await IDB.put('projects',id,it.local);if(on)await Cloud.push(it.local);else await Cloud.remove(id).catch(()=>{})}else if(it.cloud&&!on)await Cloud.remove(id).catch(()=>{});
  toast(on?'Projet synchronisé sur votre compte':'Synchronisation arrêtée : le projet reste sur cet appareil');await libLoad();renderLibrary()}
function libSelect(id,e){const list=libFiltered().map(i=>i.id);if(e&&e.shiftKey&&LIB.anchor&&list.includes(LIB.anchor)){const a=list.indexOf(LIB.anchor),b=list.indexOf(id);if(!(e.metaKey||e.ctrlKey))LIB.sel.clear();list.slice(Math.min(a,b),Math.max(a,b)+1).forEach(x=>LIB.sel.add(x))}
  else if(e&&(e.metaKey||e.ctrlKey)){LIB.sel.has(id)?LIB.sel.delete(id):LIB.sel.add(id);LIB.anchor=id}else{LIB.sel=new Set([id]);LIB.anchor=id}
  $$('#lbGrid .lb-card').forEach(c=>{const on=LIB.sel.has(c.dataset.id);c.classList.toggle('on',on);c.setAttribute('aria-selected',on)});renderLibInfo()}
function libClick(e){const t=e.target;
  const st=t.closest('[data-star]');if(st){e.stopPropagation();const k=+st.dataset.star,id=st.dataset.sid,ids=id?[id]:[...LIB.sel];const it=LIB.items.find(i=>i.id===ids[0]);libSet(ids,{rating:it&&it.lib.rating===k&&ids.length===1?0:k});return}
  const lb=t.closest('[data-label]');if(lb){libSet([...LIB.sel],{label:lb.dataset.label});return}
  const fl=t.closest('[data-flabel]');if(fl){LIB.label=LIB.label===fl.dataset.flabel?'':fl.dataset.flabel;renderLibrary();return}
  const dt=t.closest('[data-deltag]');if(dt){libSet([...LIB.sel],{delTag:dt.dataset.deltag});return}
  const mr=t.closest('[data-minr]');if(mr){LIB.minR=+mr.dataset.minr;renderLibrary();return}
  const nv=t.closest('[data-coll],[data-tag],[data-cam],[data-src]');if(nv){if(nv.dataset.coll){LIB.coll=nv.dataset.coll;LIB.tag='';LIB.cam=''}if(nv.dataset.tag!=null)LIB.tag=LIB.tag===nv.dataset.tag?'':nv.dataset.tag;if(nv.dataset.cam!=null)LIB.cam=LIB.cam===nv.dataset.cam?'':nv.dataset.cam;if(nv.dataset.src)LIB.src=nv.dataset.src;renderLibrary();return}
  const a=t.closest('[data-act]');if(a){const one=LIB.items.find(i=>LIB.sel.has(i.id));({reset:()=>{Object.assign(LIB,{minR:0,label:'',tag:'',cam:'',q:'',coll:'all',src:'all'});const q=$('#lbQ');if(q)q.value='';renderLibrary()},add:()=>$('#lbAdd').click(),open:()=>one&&libOpen(one.id),del:()=>libDelete([...LIB.sel]),sync:()=>one&&libSync(one),
      batch:()=>{const ids=[...LIB.sel].filter(id=>LIB.items.find(i=>i.id===id&&i.local));if(!ids.length){toast('Le traitement par lot porte sur les projets présents sur cet appareil');return}closeLibrary();batchDialog(ids)}})[a.dataset.act]?.();return}
  const c=t.closest('.lb-card');if(c){libSelect(c.dataset.id,e);return}
  if(t.closest('#lbGrid')&&!t.closest('.lb-card')&&!e.shiftKey&&!(e.metaKey||e.ctrlKey)){LIB.sel.clear();$$('#lbGrid .lb-card').forEach(c=>{c.classList.remove('on');c.setAttribute('aria-selected','false')});renderLibInfo()}}
function libKey(e){if(e.target.matches('input,select,textarea'))return;const k=e.key,ids=[...LIB.sel];
  if(k==='Escape'){e.preventDefault();e.stopPropagation();const q=$('#lbQ');if(LIB.q){LIB.q='';if(q)q.value='';renderLibrary()}else if(LIB.sel.size&&!LIB.auto){LIB.sel.clear();renderLibrary()}return}
  if(!ids.length&&!/^Arrow/.test(k))return;
  if(/^[0-5]$/.test(k)){e.preventDefault();libSet(ids,{rating:+k});return}
  if(/^[6-9]$/.test(k)){e.preventDefault();libSet(ids,{label:LBL[+k-6][0]});return}
  if(k==='Enter'&&ids.length===1){e.preventDefault();if(!LIB.auto)libOpen(ids[0]);return}
  if(k==='Delete'||k==='Backspace'){e.preventDefault();libDelete(ids);return}
  if(/^Arrow/.test(k)){e.preventDefault();const list=libFiltered().map(i=>i.id);if(!list.length)return;const g=$('#lbGrid'),cards=g.querySelectorAll('.lb-card');const cols=Math.max(1,Math.round(g.clientWidth/((cards[0]?.offsetWidth||180)+12)));
    let i=list.indexOf(LIB.anchor);if(i<0)i=0;else i+=k==='ArrowRight'?1:k==='ArrowLeft'?-1:k==='ArrowDown'?cols:-cols;i=clamp(i,0,list.length-1);libSelect(list[i],e.shiftKey?{shiftKey:true}:null);g.querySelector(`[data-id="${CSS.escape(list[i])}"]`)?.scrollIntoView({block:'nearest'})}}
function pickFiles(accept){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept=accept;i.onchange=()=>res([...i.files]);i.oncancel=()=>res([]);i.click()})}
async function importToLibrary(files){await flushSave();const backPid=S.doc&&S.doc.pid,backDoc=S.doc,backState=backDoc?{history:S.history,hi:S.hi,meta:S.meta,sample:S.sample,maxHist:S.maxHist}:null;let ok=0;const fails=[];
  try{for(let i=0;i<files.length;i++){const f=files[i];busy(true,`Import ${i+1} / ${files.length} : ${f.name}`,i/files.length);await tick();
      try{const isRaw=RAW_EXT.test(f.name||'');if(/\.(psd|psb)$/i.test(f.name)){await importPSD(f)}else if(!isRaw&&/\.png$/i.test(f.name)&&await open16(f)){}else{const r=isRaw?await decodeRaw(f):{c:await loadImageFile(f),meta:''};setDoc(r.c,f.name,{meta:r.meta,raw:isRaw,quiet:true});if(isRaw&&RAWC&&RAWC.file===f)await attachRaw(f,RAWC.set)}
        S.doc.saved=true;await flushSave();await saveNow();ok++}catch(e){console.error(e);fails.push(f.name)}}
    busy(false);if(backPid&&!backDoc.nosave&&(await IDB.get('projects',backPid).catch(()=>null)))await openLocalProject(backPid);else if(backDoc){setCS(backDoc.space||'srgb');S.doc=backDoc;Object.assign(S,backState);selChanged();markComp();fit(true);syncAll();renderHistory();updateUndo();updateDocName()}}
  finally{busy(false)}toast(`${ok} photo${ok>1?'s':''} ajoutée${ok>1?'s':''} à la photothèque${fails.length?`. Échec : ${fails.join(', ')}`:''}`,6000);if(!LIB.open)await openLibrary();else{await libLoad();renderLibrary()}}
projectsDialog=openLibrary;
$('#bProjEmpty').onclick=openLibrary;
const _onRemote=Cloud.onRemote.bind(Cloud);Cloud.onRemote=function(){_onRemote();if(LIB.open){clearTimeout(LIB.rt);LIB.rt=setTimeout(async()=>{await libLoad();renderLibrary()},300)}};

