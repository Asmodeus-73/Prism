/* ================= export dialog: every format ================= */
const EXF=[
  {id:'jpeg',name:'JPEG',ext:'jpg',d:'Photos et partage, compatible partout',q:92,meta:1},
  {id:'heic',name:'HEIC',ext:'heic',d:'Format des iPhone (Safari seulement)',q:90,mime:'image/heic'},
  {id:'png',name:'PNG',ext:'png',d:'Sans perte, garde la transparence',depth:[8,16],meta:1},
  {id:'tiff',name:'TIFF',ext:'tif',d:'Impression et archivage, sans perte',depth:[8,16]},
  {id:'webp',name:'WebP',ext:'webp',d:'Web, plus léger que JPEG',q:90,mime:'image/webp'},
  {id:'avif',name:'AVIF',ext:'avif',d:'Le plus léger, lu par iPhone, iPad, Mac et le web (remplace HEIC)',q:70,depth:[8,10]},
  {id:'psd',name:'PSD',ext:'psd',d:'Photoshop, avec les calques',depth:[8,16]},
  {id:'pdf',name:'PDF',ext:'pdf',d:'Document à imprimer ou à envoyer',q:92},
  {id:'gif',name:'GIF',ext:'gif',d:'256 couleurs, animations et vieux logiciels'},
  {id:'bmp',name:'BMP',ext:'bmp',d:'Image Windows non compressée'},
  {id:'tga',name:'TGA',ext:'tga',d:'Jeux vidéo et 3D'},
  {id:'ico',name:'ICO',ext:'ico',d:'Icône Windows ou favicon de site'}];
const EXF_OK={};async function probeEnc(mime){if(mime in EXF_OK)return EXF_OK[mime];const c=document.createElement('canvas');c.width=c.height=2;let ok=false;try{const b=await new Promise(r=>c.toBlob(r,mime,0.8));ok=!!b&&b.type===mime}catch(e){}return EXF_OK[mime]=ok}
function docHasAlpha(){const d=S.doc;try{if(d.layers.some(l=>l.mask&&l.kind==='pixel'))return true;const f=flatSync(),t=mk(Math.min(256,d.w),Math.min(256,d.h));cx(t).drawImage(f,0,0,t.width,t.height);const a=rx(t).getImageData(0,0,t.width,t.height).data;for(let i=3;i<a.length;i+=4)if(a[i]<250)return true}catch(e){}return false}
exportDialog=async function(){const d=S.doc;if(!d)return;await Promise.all(['image/webp','image/heic'].map(probeEnc));const alpha=docHasAlpha(),hi=typeof docHasHi==='function'&&docHasHi();
  const st={fmt:PREF.get('exFmt',alpha?'png':'jpeg'),q:{},depth:{png:hi?16:8,tiff:hi?16:8,avif:8,psd:hi?16:8},chroma:PREF.get('exChroma','444'),meta:PREF.get('exMeta',true),colors:256,dither:true};if(!EXF.some(f=>f.id===st.fmt))st.fmt='jpeg';EXF.forEach(f=>{if(f.q)st.q[f.id]=PREF.get('exQ_'+f.id,f.q)});
  const avail=f=>!f.mime||EXF_OK[f.mime];if(!avail(EXF.find(f=>f.id===st.fmt)))st.fmt='jpeg';
  const base=(d.name||'photo').replace(/\.[a-z0-9]+$/i,'');
  const list=[...EXF.filter(avail),...EXF.filter(f=>!avail(f))].map(f=>`<button class="exf${avail(f)?'':' off'}" data-f="${f.id}" role="option"><b>${f.name}</b><span>${avail(f)?f.d:(f.id==='heic'?'Impossible dans un navigateur. Choisissez AVIF : lu par iPhone, iPad et Mac récents':'Pas disponible dans ce navigateur')}</span></button>`).join('');
  const dl=dialog({title:'Exporter',body:`<div class="exp"><div class="exp-l" role="listbox" aria-label="Format">${list}</div><select class="exp-sel" id="exFs" aria-label="Format">${EXF.map(f=>`<option value="${f.id}" ${avail(f)?'':'disabled'}>${f.name} · ${f.d}</option>`).join('')}</select><div class="exp-r" id="exR"></div></div>`,
    onOpen:el=>{el.classList.add('dlg-exp');const R=$('#exR',el);const sf=()=>{const v=($('#exS',el)||{}).value||'full';return v==='full'?1:v==='50'?0.5:v==='25'?0.25:Math.min(1,+v/Math.max(d.w,d.h))};el._st=st;el._scale=sf;
      const draw=()=>{const f=EXF.find(x=>x.id===st.fmt);$$('.exf',el).forEach(b=>{b.classList.toggle('on',b.dataset.f===st.fmt);b.setAttribute('aria-selected',b.dataset.f===st.fmt)});$('#exFs',el).value=st.fmt;const keep={s:($('#exS',el)||{}).value||'full',n:($('#exN',el)||{}).value||base};
        const seg=(id,opts,val)=>`<div class="seg" id="${id}">${opts.map(([v,l])=>`<button data-v="${v}" class="${String(val)===String(v)?'on':''}">${l}</button>`).join('')}</div>`;
        let h=`<h4>${f.name}</h4>`;
        if(f.q)h+=rangeRow('exQr','Qualité',30,100,1,st.q[f.id],'');
        if(f.id==='jpeg')h+=`<label class="field">Couleurs${seg('exC',[['444','Pleine résolution 4:4:4'],['420','Standard 4:2:0']],st.chroma)}</label>`;
        if(f.depth)h+=`<label class="field">Profondeur${seg('exD',f.depth.map(b=>[b,b+' bits']),st.depth[f.id])}</label>`;
        if(f.id==='gif')h+=`<label class="field">Nombre de couleurs${seg('exG',[[256,'256'],[128,'128'],[64,'64'],[32,'32']],st.colors)}</label><label class="chk"><input type="checkbox" id="exDi" ${st.dither?'checked':''}> Tramage (dégradés plus doux)</label>`;
        if(f.id!=='psd'&&f.id!=='ico')h+=`<label class="field">Taille<select id="exS"><option value="full">Taille d’origine (${d.w} × ${d.h})</option><option value="6000">Grand côté 6000 px</option><option value="4096">Grand côté 4096 px</option><option value="2048">Grand côté 2048 px (web)</option><option value="1080">Grand côté 1080 px (Instagram)</option><option value="50">50 %</option><option value="25">25 %</option></select></label>`;
        if(f.meta)h+=`<label class="chk"><input type="checkbox" id="exM" ${st.meta&&d.exif?'checked':''} ${d.exif?'':'disabled'}> Garder les infos de prise de vue (EXIF)${d.exif?'':' · aucune dans cette photo'}</label>`;
        h+=`<label class="field">Nom du fichier<div class="exn"><input type="text" id="exN" value="${esc(keep.n)}"><span>.${f.ext}</span></div></label><p class="muted" id="exInfo"></p>`;R.innerHTML=h;
        const sEl=$('#exS',R);if(sEl){sEl.value=keep.s;sEl.onchange=info}
        $('#exQr',R)&&($('#exQr',R).oninput=e=>{st.q[f.id]=+e.target.value;$('#exQr-o',R).textContent=st.q[f.id];info()});
        $$('#exC button',R).forEach(b=>b.onclick=()=>{st.chroma=b.dataset.v;draw()});$$('#exD button',R).forEach(b=>b.onclick=()=>{st.depth[f.id]=+b.dataset.v;draw()});$$('#exG button',R).forEach(b=>b.onclick=()=>{st.colors=+b.dataset.v;draw()});
        $('#exDi',R)&&($('#exDi',R).onchange=e=>st.dither=e.target.checked);$('#exM',R)&&($('#exM',R).onchange=e=>st.meta=e.target.checked);info()};
      const info=()=>{const f=EXF.find(x=>x.id===st.fmt),s=f.id==='psd'?1:sf(),W=Math.round(d.w*s),H=Math.round(d.h*s),mp=(W*H/1e6).toFixed(1).replace('.',',');const sp=d.space==='display-p3'?'Display P3':'sRGB';
        const notes={jpeg:st.chroma==='444'?'couleurs nettes, aucune perte de résolution des couleurs':'fichier plus léger',png:st.depth.png===16?'16 bits par couche, sans perte':'sans perte'+(alpha?', transparence conservée':''),tiff:(st.depth.tiff===16?'16':'8')+' bits par couche, sans perte',
          webp:alpha?'transparence conservée':'',avif:st.depth.avif===10?'10 bits, dégradés plus fins':'',psd:'taille d’origine, calques et masques conservés',pdf:'page au format de l’image à 300 ppp',gif:'palette '+st.colors+' couleurs',bmp:alpha?'avec transparence':'',tga:'avec transparence',ico:'tailles 16 à 256 px',heic:''};
        const pr=['jpeg','png','tiff','webp','pdf','psd','heic'].includes(f.id)||(f.id==='avif'&&d.space!=='display-p3')?'profil '+sp+' inclus':f.id==='avif'?'converti en sRGB':'';
        $('#exInfo',el).textContent=(f.id==='ico'?'':`${W} × ${H} px (${mp} Mpx) · `)+[notes[f.id],pr].filter(Boolean).join(' · ')};
      $$('.exf',el).forEach(b=>b.onclick=()=>{if(b.classList.contains('off'))return;st.fmt=b.dataset.f;draw()});$('#exFs',el).onchange=e=>{st.fmt=e.target.value;draw()};draw()},
    buttons:[{label:'Annuler'},{label:'Exporter',primary:true,onClick:el=>{const f=EXF.find(x=>x.id===st.fmt);PREF.set('exFmt',st.fmt);PREF.set('exChroma',st.chroma);PREF.set('exMeta',st.meta);if(f.q)PREF.set('exQ_'+f.id,st.q[f.id]);
      exportAs({...st,q:f.q?st.q[f.id]/100:1},el._scale(),($('#exN',el).value||'photo').replace(/[\\/:*?"<>|]+/g,'-'))}}]})};
async function saveOut(blob,fname){await dlReady;if(dlNS){try{await dlNS.save({filename:fname,data:blob});toast('Enregistré : '+fname+' · '+fmtMo(blob.size));return}catch(e){if(e&&e.code==='declined'){toast('Enregistrement annulé');return}console.warn('save',e)}
    try{const z=await makeZip([{name:fname,data:new Uint8Array(await blob.arrayBuffer())}]);await dlNS.save({filename:fname+'.zip',data:z});toast('Enregistré dans un .zip : '+fname);return}catch(e){if(e&&e.code==='declined'){toast('Enregistrement annulé');return}}}
  await saveFile(blob,fname)}
async function exportAs(st,scale,name){const d=S.doc,f=EXF.find(x=>x.id===st.fmt),fname=name+'.'+f.ext;
  if(f.id==='psd')return exportPSD(st.depth.psd);if((f.id==='png'&&st.depth.png===16)||(f.id==='tiff'&&st.depth.tiff===16))return doExport16(f.id==='png'?'png16':'tiff',scale,name);
  const P=(m,p)=>busy(true,m,p);P('Export '+f.name+'…',0);await tick();let blob;
  try{if(f.id==='avif'&&st.depth.avif===10&&d.space!=='display-p3'){const im=await renderDoc16(scale,{progress:p=>P('Rendu 16 bits…',p*0.4)});const a=new Uint16Array(im.data.length);for(let i=0;i<a.length;i++)a[i]=im.data[i]>>6;P('Encodage AVIF 10 bits…',null);await tick();
      blob=new Blob([await encodeAVIF(a,im.w,im.h,{quality:Math.round(st.q*100),bitDepth:10,subsample:st.q>=0.9?3:1,speed:im.w*im.h>4e6?8:7})],{type:'image/avif'})}
    else{let c=await renderDoc(scale,{progress:p=>P('Rendu…',p*0.5)});const W=c.width,H=c.height,sp=d.space||'srgb';
      const flatW=()=>{const w=mk(W,H),g=cx(w);g.fillStyle='#fff';g.fillRect(0,0,W,H);g.drawImage(c,0,0);return w};const id=(cv,srgb)=>srgb?rx(cv).getImageData(0,0,W,H,{colorSpace:'srgb'}):rx(cv).getImageData(0,0,W,H);
      const ex=st.meta&&f.meta&&d.exif?exifForExport(d.exif,W,H):null,icc=sp==='display-p3'?ICC.p3():ICC.srgb();
      switch(f.id){
        case'jpeg':{const w=flatW();if(st.chroma==='444'&&st.q<1){P('Encodage JPEG 4:4:4…',0.5);blob=await JPG.encode(id(w),st.q,{progress:p=>P('Encodage JPEG 4:4:4…',0.5+p*0.5)})}else blob=await toBlob(w,'image/jpeg',st.q);blob=await jpegWithMeta(blob,ex,icc);break}
        case'png':blob=await pngWithExif(await toBlob(c,'image/png'),ex);break;
        case'webp':case'heic':blob=await toBlob(c,f.mime,st.q);if(blob.type!==f.mime)throw new Error('format non pris en charge par ce navigateur');break;
        case'tiff':{P('Compression…',0.6);const im=id(c);let a=false;for(let i=3;i<im.data.length;i+=4)if(im.data[i]<255){a=true;break}blob=await encodeTIFF8(im,sp,a);break}
        case'avif':{P('Encodage AVIF…',null);await tick();const im=id(c,true);blob=new Blob([await encodeAVIF(im.data,W,H,{quality:Math.round(st.q*100),subsample:st.q>=0.9?3:1,speed:W*H>4e6?8:7})],{type:'image/avif'});break}
        case'pdf':{const w=flatW();P('Création du PDF…',0.6);const j=new Uint8Array(await(await toBlob(w,'image/jpeg',st.q)).arrayBuffer());blob=await encodePDF(j,W,H,sp);break}
        case'gif':blob=await encodeGIF(id(c,true),st.colors,st.dither,{progress:p=>P('Encodage GIF…',0.5+p*0.5)});break;
        case'bmp':{const im=id(c,true);let a=false;for(let i=3;i<im.data.length;i+=4)if(im.data[i]<255){a=true;break}blob=encodeBMP(im,a);break}
        case'tga':blob=encodeTGA(id(c,true));break;
        case'ico':blob=await encodeICO(c);break}}}
  catch(e){console.error(e);busy(false);toast('Export impossible : '+(e.message||e),6000);return}busy(false);
  await saveOut(blob,fname)}
doExport=async function(fmt,q,scale,name){return exportAs({fmt:fmt==='png16'?'png':fmt,q,depth:{png:fmt==='png16'?16:8,tiff:16,avif:8},chroma:'420',meta:true,colors:256,dither:true},scale,name)};

function assistCard(){const ok=!!sampleNS;return`<div class="card"><h4><svg viewBox="0 0 20 20"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/><path d="M15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>Retoucher en parlant</h4>
  ${ok?`<p>Décrivez ce que vous voulez : Claude regarde la photo et crée de vrais calques de réglage, que vous pouvez ensuite ajuster ou supprimer. La photo est envoyée à Claude en version réduite.</p>
  <textarea id="aiAsk" rows="2" placeholder="Ex. : rends le ciel plus dramatique et éclaircis son visage"></textarea><div class="acts"><button class="btn sm primary" data-ai="ask">Retoucher</button></div>
  <div class="examples">${['Rends le ciel plus dramatique','Éclaircis le sujet','Ambiance chaude de fin de journée','Look film argentique','Fais ressortir les couleurs, sans exagérer','Un peu moins'].map(t=>`<button data-ex="${esc(t)}">${esc(t)}</button>`).join('')}</div>`
  :`<p>Disponible quand Prism est ouvert depuis claude.ai : la retouche en parlant passe par votre compte Claude.</p>`}</div>`}
function toggleDocSync(){const d=S.doc;if(!d||!Cloud.ok)return;d.sync=!d.sync;if(d.sync){toast('Projet synchronisé sur votre compte : retrouvez-le sur vos autres appareils');saveNow()}else{toast('Synchronisation arrêtée : le projet reste sur cet appareil');Cloud.remove(d.pid).catch(()=>{});setSaveState('saved')}}

/* wiring */
$('#bMenu').onclick=e=>{const b=e.currentTarget;b.classList.contains('open')?closeMenu():openMenuSheet(b)};
$('#bSync').onclick=projectsDialog;$('#docname').onclick=projectsDialog;
$('#bAssist').onclick=()=>{const c=$('#composer');c.hidden=!c.hidden;PREF.set('composerHidden',c.hidden);if(!c.hidden)$('#cmpIn').focus()};
$('#composer').onsubmit=e=>{e.preventDefault();assist($('#cmpIn').value)};
$('#cmpStop').onclick=()=>ASSIST.ctl&&ASSIST.ctl.abort();
$('#cmpX').onclick=()=>{$('#composer').hidden=true;PREF.set('composerHidden',true)};
$('#pane-ai').addEventListener('click',e=>{const x=e.target.closest('[data-ex]');if(x){const t=$('#aiAsk');if(t)t.value=x.dataset.ex;assist(x.dataset.ex);return}const b=e.target.closest('[data-ai="ask"]');if(b){e.stopImmediatePropagation();assist($('#aiAsk').value)}},true);
sampleReady.then(v=>{$('#bAssist').hidden=!v;$('#composer').hidden=!v||PREF.get('composerHidden',false)});
/* bottom sheet: tap the handle to cycle, drag it to resize, opening a tab lifts it */
(()=>{const g=$('#sheetGrab'),ins=$('.insp');const order=['peek','half','full'];let st=null;
  g.addEventListener('click',()=>{if(st&&st.moved)return;const i=order.indexOf(ins.dataset.sheet);setSheet(order[(i+1)%order.length])});
  g.addEventListener('pointerdown',e=>{st={y:e.clientY,h:ins.getBoundingClientRect().height,moved:false};g.setPointerCapture(e.pointerId)});
  g.addEventListener('pointermove',e=>{if(!st)return;const dy=st.y-e.clientY;if(Math.abs(dy)>6)st.moved=true;if(st.moved){ins.style.transition='none';ins.style.height=clamp(st.h+dy,80,innerHeight*0.9)+'px'}});
  g.addEventListener('pointerup',()=>{if(!st)return;if(st.moved){const h=ins.getBoundingClientRect().height,H=innerHeight;ins.style.height='';ins.style.transition='';setSheet(h<H*0.25?'peek':h<H*0.66?'half':'full')}setTimeout(()=>st=null,0)});
  $('.tabs').addEventListener('click',()=>{if(ins.dataset.sheet==='peek')setSheet('half')})})();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&SAVE.state==='pending')saveNow()});
window.addEventListener('pagehide',()=>{if(SAVE.state==='pending')saveNow()});
updateDocName=function(){const d=S.doc;$('#docname').innerHTML=d?`<b>${esc(d.name)}</b><span class="dim"> · ${d.w|0} × ${d.h|0}${d.space==='display-p3'?' · Display P3':''}${precLabel()?' · '+precLabel():''}${S.meta?' · '+esc(S.meta):''}</span>`:'Mes projets'};

