/* ================= v8.1: everyday tools within reach ================= */
/* tool rail ordered by how often each tool is used, in clear families */
const TOOL_ORDER=['move','crop',0,'heal','remove','clone',0,'marquee','lasso','wand','pen',0,'brush','eraser','gradient','dodge','text','eyedropper',0,'hand','zoom'];
(()=>{const byId={};TOOLS.filter(Boolean).forEach(t=>byId[t[0]]=t);const order=TOOL_ORDER.map(k=>k?byId[k]:0).filter(x=>x!==undefined);Object.values(byId).forEach(t=>{if(!order.includes(t))order.splice(order.length-3,0,t)});TOOLS.length=0;order.forEach(t=>TOOLS.push(t));
  const dock=$('#dock'),btn={};$$('[data-tool]',dock).forEach(b=>btn[b.dataset.tool]=b);const fg=$('.fg',dock);$$('.sep',dock).forEach(x=>x.remove());
  TOOLS.forEach(t=>{if(!t){const s=document.createElement('div');s.className='sep';s.setAttribute('role','separator');dock.insertBefore(s,fg)}else if(btn[t[0]])dock.insertBefore(btn[t[0]],fg)});
  const s=document.createElement('div');s.className='sep';dock.insertBefore(s,fg)})();
/* quick actions: one-click versions of the everyday edits, customisable */
const QA_ALL=[
  ['auto','Auto','auto',()=>pick('image','Réglages automatiques').fn(),'Réglages automatiques de lumière et couleur'],
  ['crop','Recadrer','crop',()=>setTool('crop'),'Recadrer, redresser, changer le format (C)'],
  ['rotR','Pivoter','rotate',()=>pick('image','Rotation 90° horaire').fn(),'Pivoter de 90° dans le sens horaire'],
  ['rotL','Pivoter ←','rotate',()=>pick('image','Rotation 90° antihoraire').fn(),'Pivoter de 90° dans le sens antihoraire'],
  ['flipH','Miroir','flip',()=>pick('image','Symétrie horizontale').fn(),'Symétrie horizontale'],
  ['remove','Effacer','remove',()=>setTool('remove'),'Gomme magique (IA) : peignez sur ce qui doit disparaître (R)'],
  ['heal','Correcteur','heal',()=>setTool('heal'),'Corrige une tache ou une poussière (J)'],
  ['subject','Sujet','subject',()=>pick('select','Sélectionner le sujet').fn(),'Sélectionner le sujet (IA)'],
  ['adjSubject','Régler le sujet','subject',()=>addSubjectAdjust(false),'Nouveau réglage limité au sujet (IA)'],
  ['adjBg','Régler le fond','subject',()=>addSubjectAdjust(true),'Nouveau réglage limité à l’arrière-plan (IA)'],
  ['adjBrush','Pinceau de réglage','brush',()=>addAdjust('brush'),'Nouveau réglage que vous peignez où vous voulez'],
  ['adjLinear','Dégradé','grad',()=>addAdjust('linear'),'Nouveau réglage en dégradé linéaire (ciel, premier plan)'],
  ['compare','Avant / après','compare',()=>toggleCompare(),'Comparer avec l’original (Y)'],
  ['copyLook','Copier réglages','copy',()=>pick('edit','Copier les réglages').fn(),'Copier les réglages pour une autre photo'],
  ['pasteLook','Coller réglages','paste',()=>pick('edit','Coller les réglages').fn(),'Appliquer les réglages copiés'],
  ['resize','Taille','resize',()=>pick('image','Taille de l’image').fn(),'Changer la taille de l’image'],
  ['upscale','Agrandir ×2','zoomin',()=>pick('image','Agrandir ×2').fn(),'Agrandir ×2 avec l’IA'],
  ['reset','Tout annuler','reset',()=>{const b=$('#btnResetAll');if(b)b.click()},'Remettre le réglage actif à zéro'],
  ['jpeg','JPEG rapide','export',()=>quickExport('jpeg'),'Exporter tout de suite en JPEG haute qualité'],
  ['export','Exporter','export',()=>exportDialog(),'Choisir le format et la taille d’export'],
  ['share','Partager','share',()=>pick('file','Partager pour avis').fn(),'Partager pour avis'],
  ['library','Photothèque','lib',()=>openLibrary(),'Toutes vos photos']];
const QA_DEF=['auto','crop','rotR','remove','subject','adjBg','compare','export'];
const QA={list:(PREF.get('qaList',null)||QA_DEF).filter(k=>QA_ALL.some(a=>a[0]===k)),open:PREF.get('uiQA',true)};
const qaGet=k=>QA_ALL.find(a=>a[0]===k);
const qi=n=>IC2[n]?ico(n):(typeof IC!=='undefined'&&IC[n])?`<svg viewBox="0 0 20 20" aria-hidden="true">${IC[n]}</svg>`:ico(n);
function qaNeedsDoc(k){return!['library'].includes(k)}
function renderQA(){const el=$('#qa');if(!el)return;const has=!!S.doc;
  el.innerHTML=QA.list.map(k=>{const a=qaGet(k);const dis=qaNeedsDoc(k)&&!has;return`<button class="qa-b" data-qa="${k}" ${dis?'aria-disabled="true"':''} data-tip="${esc(a[4].replace(/\s*\(IA\)/,' avec l’IA'))}${dis?' · ouvrez d’abord une photo':''}">${qi(a[2])}<span>${esc(a[1])}</span></button>`}).join('')+`<button class="qa-b qa-add" data-qa-add aria-label="Ajouter une action rapide" data-tip="Ajouter une action rapide">${ico('new')}<span>Ajouter</span></button>`;
  $('#qaPanel').classList.toggle('closed',!QA.open);$('#qaHead').setAttribute('aria-expanded',QA.open)}
function qaSave(){PREF.set('qaList',QA.list);renderQA()}
$('#qa').addEventListener('click',e=>{if(e.target.closest('[data-qa-add]')){qaCustomize();return}const b=e.target.closest('[data-qa]');if(!b)return;if(b.getAttribute('aria-disabled')){toast('Ouvrez d’abord une photo');return}const a=qaGet(b.dataset.qa);try{a[3]()}catch(err){console.warn(err);toast('Action indisponible pour le moment')}});
$('#qaHead').onclick=()=>{QA.open=!QA.open;PREF.set('uiQA',QA.open);renderQA()};
$('#qaEdit').onclick=()=>qaCustomize();
function qaCustomize(){const rows=()=>QA_ALL.map(a=>`<label class="qa-row"><input type="checkbox" value="${a[0]}" ${QA.list.includes(a[0])?'checked':''}><span class="qa-ri">${qi(a[2])}</span><span><b>${esc(a[1])}</b><small>${esc(a[4])}</small></span></label>`).join('');
  const dl=dialog({title:'Actions rapides',body:`<p class="muted">Cochez les actions à garder sous la main. Clic droit sur une action pour la déplacer ou la retirer.</p><div class="qa-pick">${rows()}</div><p><button class="lnk" data-qa-def>Revenir aux actions par défaut</button></p>`,buttons:[{label:'Terminé',primary:true}],onOpen:d=>{d.querySelector('[data-qa-def]').onclick=()=>{QA.list=QA_DEF.slice();qaSave();$$('.qa-pick input',d).forEach(c=>c.checked=QA.list.includes(c.value))};d.addEventListener('change',e=>{const c=e.target.closest('input[type=checkbox]');if(!c)return;const k=c.value;if(c.checked){if(!QA.list.includes(k))QA.list.push(k)}else QA.list=QA.list.filter(x=>x!==k);qaSave()})}});
  if(dl&&dl.classList)dl.classList.add('wide')}
function qaCtx(k){const i=QA.list.indexOf(k),a=qaGet(k);return[MI(a[1],{icon:a[2],fn:()=>a[3](),dis:qaNeedsDoc(k)&&!S.doc?NODOC:false}),SEP,
  MI('Déplacer vers la gauche',{icon:'up',fn:()=>{QA.list.splice(i,1);QA.list.splice(i-1,0,k);qaSave()},dis:i>0?false:'Déjà en premier'}),
  MI('Déplacer vers la droite',{icon:'down',fn:()=>{QA.list.splice(i,1);QA.list.splice(i+1,0,k);qaSave()},dis:i<QA.list.length-1?false:'Déjà en dernier'}),
  MI('Retirer des actions rapides',{icon:'trash',danger:true,fn:()=>{QA.list.splice(i,1);qaSave()}}),SEP,MI('Personnaliser…',{icon:'sliders',fn:qaCustomize})]}
/* zoom readout gets its own menu */
function zoomCtx(){return[fromPick('view','Ajuster à l’écran',null,'fit'),fromPick('view','Taille réelle','Taille réelle (100 %)'),fromPick('view','Zoom avant',null,'zoomin'),fromPick('view','Zoom arrière',null,'zoomout')]}
const _ctxFor9=ctxFor;ctxFor=function(t){const q=t.closest&&t.closest('[data-qa]');if(q)return qaCtx(q.dataset.qa);if(t.closest&&t.closest('#qaPanel,.qa'))return[MI('Personnaliser les actions rapides…',{icon:'sliders',fn:qaCustomize})];if(t.closest&&t.closest('.zoom'))return zoomCtx();return _ctxFor9(t)};
/* keep the quick actions current */
const _udn9=updateDocName;updateDocName=function(){_udn9();renderQA()};
/* phones: quick actions as a scrolling strip at the top of the sheet; the sheet's resting height shows it */
renderQA();decorateTools();
/* Delete / Backspace: with a selection, erase what is inside it; without one, delete the active layer (undoable) */
document.addEventListener('keydown',e=>{if(e.key!=='Delete'&&e.key!=='Backspace')return;if(e.shiftKey||e.metaKey||e.ctrlKey||e.altKey)return;
  const tg=e.target;if(tg.matches&&tg.matches('input:not([type=range]):not([type=checkbox]):not([type=color]):not([type=radio]),textarea,select,[contenteditable]'))return;
  if(LIB.open||MEN.levels.length||$('#msheet')||$('#cmdk')||($('#scrim')&&!$('#scrim').classList.contains('light')))return;
  const d=S.doc;if(!d||S.stroke||S.drag)return;if(S.tool==='pen'&&d.path&&d.path.pts&&d.path.pts.length)return;if(S.tool==='crop')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(d.sel){clearSel();return}
  if(d.layers.length<2){toast('Impossible de supprimer le seul calque');return}
  const nm=AL().name,n0=d.layers.length;delLayer();if(d.layers.length<n0&&nm)toast(`Calque « ${nm} » supprimé · ${MOD}Z pour annuler`)},true);

/* in-app confirmation: window.confirm() is blocked inside the published page, so it always answered "no" */
function askConfirm(msg,{ok='Confirmer',danger=false,title='Confirmer'}={}){return new Promise(res=>{let done=false;const fin=v=>{if(!done){done=true;res(v)}};
  const dl=dialog({title,body:`<p class="muted" style="font-size:13px;color:var(--fg)">${esc(msg)}</p>`,buttons:[{label:'Annuler',onClick:()=>fin(false)},{label:ok,primary:true,onClick:()=>fin(true)}]});
  const b=dl.querySelector('.foot .btn.primary');if(danger&&b){b.classList.remove('primary');b.classList.add('danger-solid')}
  const sc=$('#scrim');new MutationObserver((m,o)=>{if(!document.body.contains(sc)){o.disconnect();fin(false)}}).observe(document.body,{childList:true});
  setTimeout(()=>{const f=dl.querySelector('.foot .btn:last-child');f&&f.focus()},30)})}
/* deleting photos: nothing may write them back afterwards (pending autosave of the open photo, a cloud push in flight, a stale cloud list) */
const GONE={get(){const a=PREF.get('libGone',[]);return Array.isArray(a)?a:[]},add(ids){const now=Date.now(),a=this.get().filter(x=>!ids.includes(x.id)&&now-x.t<30*864e5);ids.forEach(id=>a.push({id,t:now}));PREF.set('libGone',a.slice(-500))},has(id){return this.get().some(x=>x.id===id)}};
const waitFor=async(f,ms=15000)=>{const t=Date.now();while(f()&&Date.now()-t<ms)await new Promise(r=>setTimeout(r,60))};
function closeDoc(){clearTimeout(SAVE.timer);SAVE.timer=null;S.doc=null;S.history=[];S.hi=-1;S.sample=false;S.crop=null;S.compare=null;PREF.set('last',null);
  try{updateDocName()}catch(e){}try{updateUndo()}catch(e){}try{renderHistory()}catch(e){}try{renderQA()}catch(e){}try{updateStDoc()}catch(e){}setSaveState('idle');
  const v=$('#view');if(v){const g=v.getContext('2d');g&&g.clearRect(0,0,v.width,v.height)}if(!LIB.open)$('#empty').hidden=false;requestRender()}
async function libDelete(ids){const items=LIB.items.filter(i=>ids.includes(i.id));if(!items.length)return;const cl=items.some(i=>i.cloud);
  if(!await askConfirm(items.length===1?`Supprimer « ${items[0].name} »${cl?' de cet appareil et de votre compte':''} ? Cette action est définitive.`:`Supprimer ${items.length} photos${cl?' de cet appareil et de votre compte':''} ? Cette action est définitive.`,{title:items.length>1?'Supprimer des photos':'Supprimer la photo',ok:items.length>1?`Supprimer ${items.length} photos`:'Supprimer',danger:true}))return;
  const del=new Set(items.map(i=>i.id));GONE.add([...del]);
  const openDel=!!(S.doc&&del.has(S.doc.pid));
  if(openDel){clearTimeout(SAVE.timer);SAVE.timer=null;S.doc.nosave=true;S.doc.sync=false;await waitFor(()=>SAVE.running);SAVE.again=false}
  if(Cloud.pushAgain&&del.has(Cloud.pushAgain.id))Cloud.pushAgain=null;await waitFor(()=>Cloud.pushing);
  for(const p of items){await IDB.del('projects',p.id).catch(()=>{});if(p.cloud||(p.local&&p.local.sync&&Cloud.ok))await Cloud.remove(p.id).catch(e=>toast('Suppression du compte impossible : '+(e.code||e.message)));LIB.sel.delete(p.id)}
  Cloud.list=Cloud.list.filter(c=>!del.has(c.id));
  if(openDel)closeDoc();
  gcBlobs().catch(()=>{});await libLoad();renderLibrary();toast(items.length>1?items.length+' photos supprimées':'Photo supprimée')}
/* the library never shows a deleted photo again, and cleans up any copy written back by a late save */
const _libLoadG=libLoad;libLoad=async function(){await _libLoadG();const gone=new Set(GONE.get().map(x=>x.id));if(!gone.size)return;
  const back=LIB.items.filter(it=>gone.has(it.id)&&!(S.doc&&S.doc.pid===it.id&&!S.doc.nosave));LIB.items=LIB.items.filter(it=>!back.includes(it));
  for(const it of back){if(it.local)IDB.del('projects',it.id).catch(()=>{});if(it.cloud&&Cloud.ok&&!Cloud.pushing)Cloud.remove(it.id).catch(()=>{})}
  for(const id of [...LIB.sel])if(gone.has(id))LIB.sel.delete(id)};
/* Delete / Backspace in the photothèque deletes the selected photos, wherever the focus is */
document.addEventListener('keydown',e=>{if(!LIB.open||(e.key!=='Delete'&&e.key!=='Backspace'))return;if(e.metaKey&&e.key==='Backspace'){}else if(e.ctrlKey||e.altKey||e.shiftKey)return;
  const tg=e.target;if(tg.matches&&tg.matches('input,textarea,select,[contenteditable]'))return;if($('#scrim')||MEN.levels.length)return;
  e.preventDefault();e.stopImmediatePropagation();if(!LIB.sel.size){toast('Sélectionnez d’abord une photo');return}libDelete([...LIB.sel])},true);

/* camera names: one clean, commercial name per body, whatever the source (JPEG EXIF, RAW, old projects) */
const CAM_BRANDS={nikon:'Nikon',sony:'Sony',canon:'Canon',fujifilm:'Fujifilm',fuji:'Fujifilm',olympus:'Olympus',om:'OM System',panasonic:'Panasonic',leica:'Leica',ricoh:'Ricoh',pentax:'Pentax',samsung:'Samsung',hasselblad:'Hasselblad',google:'Google',apple:'Apple',dji:'DJI',huawei:'Huawei',xiaomi:'Xiaomi',oneplus:'OnePlus',sigma:'Sigma',gopro:'GoPro',kodak:'Kodak',phase:'Phase One',insta360:'Insta360',motorola:'Motorola',oppo:'OPPO',vivo:'vivo',nothing:'Nothing'};
const ROMAN=['','','II','III','IV','V','VI','VII','VIII'];
const CAM_NOISE=/\b(corporation|corp\.?|imaging|company|co\.?|ltd\.?|camera|ag|inc\.?|digital solutions|optical|electric|ltd|gmbh|,)\b/gi;
const FMT_WORDS=/^(ISO|f\/|1\/|\d+([.,]\d+)? ?(s|mm)$|PNG|PSD|TIFF|TIF|PDF|HEIC|HEIF|GIF|BMP|TGA|SVG|ICO|AVIF|WEBP|JPEG|JPG|RAW|DNG\b|\d+ ?[×x] ?\d+|Display P3|sRGB|\d+ bits|page )/i;
function camModel(brand,m){m=m.replace(/_/g,' ').replace(/\s+/g,' ').trim();
  if(brand==='Sony'){let x=m.match(/^ILCE-(\d)(R|S|C|CR)?M(\d)A?$/i);if(x)return'α'+x[1]+(x[2]||'').toUpperCase()+' '+ROMAN[+x[3]];x=m.match(/^ILCE-(\d+)(R|S|C|CR)?A?$/i);if(x)return'α'+x[1]+(x[2]||'').toUpperCase();x=m.match(/^ILCA-(\d+)(R|S)?M(\d)$/i);if(x)return'α'+x[1]+(x[2]||'')+' '+ROMAN[+x[3]];x=m.match(/^ILCA-(\d+)$/i);if(x)return'α'+x[1];
    x=m.match(/^DSC-RX(\d+)(\w*?)M(\d)$/i);if(x)return'RX'+x[1]+x[2]+' '+ROMAN[+x[3]];x=m.match(/^DSC-(.+)$/i);if(x)return x[1];return m}
  if(brand==='Nikon'){let x=m.match(/^Z ?(\d+)\s?(\d)$/i);if(x)return'Z'+x[1]+' '+ROMAN[+x[2]];x=m.match(/^Z ?(\d+)$/i);if(x)return'Z'+x[1];x=m.match(/^Z ?f(c)?$/i);if(x)return'Zf'+(x[1]||'');return m.replace(/^(Z|D|COOLPIX) ?/i,(a,b)=>b.toUpperCase()==='COOLPIX'?'Coolpix ':b.toUpperCase())}
  if(brand==='Canon'){m=m.replace(/m(\d)$/i,(a,n)=>' Mark '+ROMAN[+n]);return m.replace(/\bMark (\d)\b/,(a,n)=>'Mark '+ROMAN[+n])}
  if(brand==='Panasonic'){const x=m.match(/^(DC|DMC)-(.+)$/i);if(x)return'Lumix '+x[2].replace(/M(\d)$/,(a,n)=>' '+ROMAN[+n]);return m}
  if(brand==='Olympus'||brand==='OM System'){return m.replace(/Mark ?(I{1,3}V?|IV)$/i,' Mark $1').replace(/MarkII/i,' Mark II').replace(/\s+/g,' ').trim()}
  if(brand==='Fujifilm'){return m.replace(/^FinePix /i,'FinePix ')}
  return m}
function camNorm(raw){let s=String(raw||'').replace(CAM_NOISE,' ').replace(/\s+/g,' ').trim();if(!s||FMT_WORDS.test(s))return'';
  const words=s.split(' ');let brand=CAM_BRANDS[words[0].toLowerCase()];let rest=brand?words.slice(1):words;
  if(!brand){/* model only: guess the brand from the model */const m=s;if(/^ILCE|^ILCA|^DSC-|^ZV-/i.test(m))brand='Sony';else if(/^EOS|^PowerShot/i.test(m))brand='Canon';else if(/^X-|^GFX/i.test(m))brand='Fujifilm';else if(/^iPhone|^iPad/i.test(m))brand='Apple';else if(/^Pixel/i.test(m))brand='Google';else if(/^DC-|^DMC-/i.test(m))brand='Panasonic';if(!brand)return s}
  while(rest.length&&CAM_BRANDS[rest[0].toLowerCase()]===brand)rest=rest.slice(1);/* "Canon Canon EOS R5", "NIKON NIKON Z 6_2" */
  if(brand==='OM System'&&rest[0]&&/^system$/i.test(rest[0]))rest=rest.slice(1);
  const model=camModel(brand,rest.join(' '));return model?brand+' '+model:brand}
function camFromMeta(meta){const seg=String(meta||'').split(' · ')[0]||'';return camNorm(seg)}
/* the info line under the histogram uses the same clean name */
const _uel=updateExifLine;updateExifLine=function(){_uel();const e=$('#hexif');if(!e||e.hidden)return;const f=e.querySelector('span');if(f){const n=camNorm(f.textContent);if(n)f.textContent=n;else if(FMT_WORDS.test(f.textContent)){}}}

