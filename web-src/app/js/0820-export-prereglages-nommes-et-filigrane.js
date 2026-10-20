/* ===== wave36: export : préréglages nommés et filigrane ===== */
(()=>{
const WMK='exWM',PK='exPresets';
const wm0={on:false,text:'© Mon nom',pos:'br',size:4,op:70};
const WM={active:false,cur:{...wm0,...PREF.get(WMK,{})}};
const POS=[['tl','Haut gauche'],['tc','Haut centre'],['tr','Haut droite'],['ml','Milieu gauche'],['mc','Centre'],['mr','Milieu droite'],['bl','Bas gauche'],['bc','Bas centre'],['br','Bas droite']];
function stamp(c){
  const w=WM.cur,o=cloneC(c),g=cx(o),m=Math.min(o.width,o.height),fs=Math.max(10,m*w.size/100),pad=fs*.9;
  g.font=`700 ${fs}px Geist, "Helvetica Neue", Arial, sans-serif`;g.textBaseline='alphabetic';
  const tw=g.measureText(w.text).width,a=w.pos[0],b=w.pos[1];
  const x=b==='l'?pad:b==='c'?(o.width-tw)/2:o.width-pad-tw,y=a==='t'?pad+fs*.8:a==='m'?(o.height+fs*.7)/2:o.height-pad;
  g.globalAlpha=w.op/100;g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=fs*.18;g.shadowOffsetY=fs*.04;g.fillStyle='#fff';g.fillText(w.text,x,y);return o}
const _rd=renderDoc;
renderDoc=async function(sc,o){const c=await _rd.apply(this,arguments);if(!WM.active||!(o&&o.progress)||!WM.cur.on||!(WM.cur.text||'').trim())return c;try{return stamp(c)}catch(e){console.warn('filigrane',e);return c}};
const _de=doExport;
doExport=async function(){WM.active=true;try{return await _de.apply(this,arguments)}finally{WM.active=false}};
const presets=()=>PREF.get(PK,[]);
function extras(root){
  if(!root||root.querySelector('.exp-x'))return;const exp=root.querySelector('.exp');if(!exp)return;
  const w=WM.cur;
  const box=document.createElement('div');box.className='exp-x';
  box.innerHTML=`<div class="exx"><b>Préréglages</b><select id="exPs" aria-label="Préréglage"></select><input id="exPsN" placeholder="Nom du préréglage" aria-label="Nom du préréglage"><button class="btn sm" id="exPsSave" type="button">Enregistrer</button><button class="btn sm" id="exPsDel" type="button">Supprimer</button></div>
   <div class="exx"><label class="exw"><input type="checkbox" id="exWm" ${w.on?'checked':''}> <b>Filigrane</b></label><input id="exWmT" value="${esc(w.text)}" maxlength="80" aria-label="Texte du filigrane"><select id="exWmP" aria-label="Position">${POS.map(([v,n])=>`<option value="${v}" ${w.pos===v?'selected':''}>${n}</option>`).join('')}</select>
   <label class="exr">Taille <input type="range" id="exWmS" min="1" max="12" step="0.5" value="${w.size}"></label><label class="exr">Opacité <input type="range" id="exWmO" min="10" max="100" step="5" value="${w.op}"></label></div>
   <p class="muted exn">Le filigrane s’applique aux formats JPEG, PNG 8 bits, WebP et AVIF, pas aux exports 16 bits.</p>
   <style>.exp-x{margin-top:12px;padding-top:10px;border-top:1px solid var(--line);display:grid;gap:8px}.exx{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.exx select,.exx input[type=text],.exx input:not([type]){height:30px;border:1px solid var(--line-2);border-radius:8px;background:var(--field);color:var(--fg);padding:0 8px;min-width:0}.exx input#exWmT{flex:1;min-width:140px}.exw{display:flex;gap:6px;align-items:center}.exr{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--fg-2)}.exr input{width:90px}.exn{margin:0;font-size:11.5px}</style>`;
  exp.after(box);
  const sel=box.querySelector('#exPs'),fill=()=>{const p=presets();sel.innerHTML='<option value="">Choisir…</option>'+p.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join('')};fill();
  const readWM=()=>{WM.cur={on:box.querySelector('#exWm').checked,text:box.querySelector('#exWmT').value||'',pos:box.querySelector('#exWmP').value,size:+box.querySelector('#exWmS').value,op:+box.querySelector('#exWmO').value};PREF.set(WMK,WM.cur)};
  ['exWm','exWmT','exWmP','exWmS','exWmO'].forEach(id=>{const e=box.querySelector('#'+id);e.addEventListener('input',readWM);e.addEventListener('change',readWM)});
  const host=root.classList.contains('dlg-exp')?root:(root.querySelector('.dlg-exp')||root),st=()=>host._st||root._st||{},sc=()=>(root.querySelector('#exS')||{}).value||'full';
  box.querySelector('#exPsSave').onclick=()=>{const n=box.querySelector('#exPsN').value.trim();if(!n){toast('Donnez un nom au préréglage');return}
    const s=st();readWM();const p=presets().filter(x=>x.name!==n);p.push({name:n,fmt:s.fmt,q:{...s.q},depth:{...s.depth},chroma:s.chroma,meta:s.meta,scale:sc(),wm:{...WM.cur}});PREF.set(PK,p);fill();sel.value=String(p.length-1);toast('Préréglage enregistré : '+n)};
  box.querySelector('#exPsDel').onclick=()=>{const i=sel.value;if(i==='')return;const p=presets();const x=p[+i];p.splice(+i,1);PREF.set(PK,p);fill();toast('Préréglage supprimé : '+(x?x.name:''))};
  sel.onchange=()=>{const i=sel.value;if(i==='')return;const x=presets()[+i];if(!x)return;const s=st();
    Object.assign(s.q,x.q||{});Object.assign(s.depth,x.depth||{});if(x.chroma)s.chroma=x.chroma;if(x.meta!=null)s.meta=x.meta;
    const b=root.querySelector(`.exf[data-f="${x.fmt}"]`);if(b)b.click();
    setTimeout(()=>{const e=root.querySelector('#exS');if(e&&[...e.options].some(o=>o.value===x.scale))e.value=x.scale;
      if(x.wm){WM.cur={...wm0,...x.wm};box.querySelector('#exWm').checked=WM.cur.on;box.querySelector('#exWmT').value=WM.cur.text;box.querySelector('#exWmP').value=WM.cur.pos;box.querySelector('#exWmS').value=WM.cur.size;box.querySelector('#exWmO').value=WM.cur.op;PREF.set(WMK,WM.cur)}
      box.querySelector('#exPsN').value=x.name},30)}}
const _ed=exportDialog;
exportDialog=async function(){const r=await _ed.apply(this,arguments);try{extras(document.querySelector('#scrim'))}catch(e){console.warn('presets',e)}return r};
window.PrismExport={WM,stamp,presets};
})();

/* wave37: library backup/restore in one archive + tabs reopened at launch */
(()=>{
const NAMEOF=m=>(m.name||'projet');
async function backupLibrary(){
  busy(true,'Préparation de la sauvegarde…',null);
  try{
    if(S.doc){S.doc.nosave=false;await flushSave();await saveNow()}
    const ms=(await IDB.all('projects')).filter(m=>m&&m.layers);
    if(!ms.length){busy(false);toast('Aucun projet à sauvegarder');return}
    const files=[],seen=new Set();
    files.push({name:'prism-library.json',data:new TextEncoder().encode(JSON.stringify({v:1,count:ms.length,date:Date.now()})),compress:true});
    for(const m of ms){
      files.push({name:'p/'+m.id+'/revelateur.json',data:new TextEncoder().encode(JSON.stringify({...m,sync:false})),compress:true});
      for(const k of manifestKeys(m)){const fk=m.id+'/'+k;if(seen.has(fk))continue;seen.add(fk);const b=await IDB.get('blobs',k);if(b)files.push({name:'p/'+m.id+'/tiles/'+k+(k===m.thumb?'.jpg':'.png'),data:b})}
      await tick()}
    const z=await makeZip(files);busy(false);
    await saveFile(z,'photothèque-prism-'+new Date().toISOString().slice(0,10)+'.prism-lib.zip');
    toast(ms.length+' projet'+(ms.length>1?'s':'')+' sauvegardé'+(ms.length>1?'s':''))
  }catch(e){busy(false);console.error(e);toast('Sauvegarde impossible : '+(e.message||e),5000)}}
async function restoreLibrary(file){
  busy(true,'Restauration…',0);
  try{
    const z=await readZip(file);
    if(!z.names.includes('prism-library.json'))throw new Error('ce fichier n’est pas une sauvegarde de photothèque');
    const ids=[...new Set(z.names.map(n=>(n.match(/^p\/([^/]+)\/revelateur\.json$/)||[])[1]).filter(Boolean))];
    const have=new Set((await IDB.keys('projects')).map(String));let added=0,skipped=0,i=0;
    for(const id of ids){
      busy(true,'Restauration… '+(++i)+' / '+ids.length,i/ids.length);
      if(have.has(id)){skipped++;continue}
      const m=JSON.parse(new TextDecoder().decode(await z.get('p/'+id+'/revelateur.json')));
      const take=async t=>{const ext=t.key===m.thumb?'.jpg':'.png';const data=await z.get('p/'+id+'/tiles/'+t.key+ext);if(!data)throw new Error('tuile manquante');await IDB.put('blobs',t.key,new Blob([data],{type:ext==='.jpg'?'image/jpeg':'image/png'}));return t};
      for(const L of m.layers){for(const f of ['canvas','mask','hi','fbase']){if(L[f])try{await Promise.all(L[f].map(take))}catch(e){if(f==='hi'||f==='fbase')L[f]=null;else throw e}}}
      if(m.raw&&m.raw.key){try{await take({key:m.raw.key})}catch(e){m.raw=null}}
      if(m.thumb)await take({key:m.thumb});
      m.sync=false;await IDB.put('projects',id,m);added++;await tick()}
    busy(false);
    toast(added+' projet'+(added>1?'s':'')+' restauré'+(added>1?'s':'')+(skipped?' ('+skipped+' déjà présent'+(skipped>1?'s':'')+')':''));
    try{if(typeof libLoad==='function'&&document.getElementById('library'))libLoad()}catch(e){}
  }catch(e){busy(false);console.error(e);toast('Restauration impossible : '+(e.message||e),5000)}}
function pickRestore(){const i=document.createElement('input');i.type='file';i.accept='.zip';i.onchange=()=>{if(i.files[0])restoreLibrary(i.files[0])};i.click()}

const _fi=MENU2.file.items;
MENU2.file.items=()=>{const a=_fi();a.push(SEP,MI('Sauvegarder la photothèque…',{icon:'save',fn:backupLibrary}),MI('Restaurer une sauvegarde…',{icon:'open',fn:pickRestore}));return a};

/* tabs: remember open projects, reopen them at launch */
const T=window.PrismTabs;
if(T){
  const save=()=>{try{const p=T.tabs.map(t=>t.doc&&t.doc.pid).filter(Boolean);PREF.set('tabs',p)}catch(e){}};
  let last='',ready=false;const tick2=()=>{if(!ready)return;try{const p=T.tabs.map(t=>t.doc&&t.doc.pid).filter(Boolean),j=JSON.stringify(p);if(j!==last&&p.length){last=j;PREF.set('tabs',p)}}catch(e){}};setInterval(tick2,1500);addEventListener('pagehide',tick2);document.addEventListener('visibilitychange',tick2);
  setTimeout(async()=>{
    try{
      const want=PREF.get('tabs',[])||[];const last=PREF.get('last',null);
      if(want.length<2||T.tabs.length!==1){ready=true;return}
      for(const pid of want){
        if(T.tabs.some(t=>t.doc&&t.doc.pid===pid))continue;
        if(!await IDB.get('projects',pid))continue;
        await openLocalProject(pid)}
      T.tabs.sort((a,b)=>want.indexOf(a.doc.pid)-want.indexOf(b.doc.pid));try{T.draw()}catch(e){}const t=T.tabs.find(t=>t.doc&&t.doc.pid===last);if(t&&S.doc!==t.doc)await T.activate(t);
      PREF.set('tabs',want.filter(p=>T.tabs.some(t=>t.doc&&t.doc.pid===p)))
    }catch(e){console.warn(e)}finally{ready=true}},2500);
}
window.PrismBackup={backup:backupLibrary,restore:restoreLibrary};
})();

/* wave38: snapshots, virtual copy, gradient masks, channels */
(()=>{
const SN=new WeakMap();
const snaps=d=>{let a=SN.get(d);if(!a){a=[];SN.set(d,a)}return a};
function takeSnap(name){const d=S.doc;if(!d)return;const s=snap(name);snaps(d).push({name,t:Date.now(),s});try{PrismHist.schedule()}catch(e){}toast('Instantané « '+name+' » enregistré')}
async function useSnap(i){const d=S.doc,e=snaps(d)[i];if(!e)return;if(!e.s&&e.lazy){try{busy(true,'Chargement de l’instantané…',null);e.s=await PrismHist.decode(e.lazy)}catch(err){busy(false);toast('Instantané illisible');return}busy(false)}
  const s={...snap('Instantané « '+e.name+' »')};
  const src=e.s;s.w=src.w;s.h=src.h;s.active=src.active;s.sel=src.sel;s.layers=src.layers.map(snapLayer);
  const h=S.history.slice(0,S.hi+1);h.push(s);while(h.length>S.maxHist)h.shift();S.history=h;restore(h.length-1);updateUndo&&updateUndo()}
function snapDialog(){const d=S.doc;if(!d)return;
  const draw=()=>{const a=snaps(d),el=document.getElementById('snList');if(!el)return;
    el.innerHTML=a.length?a.map((e,i)=>`<div class="sn-row"><b>${esc(e.name)}</b><span class="muted">${new Date(e.t).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span><button class="btn sm" data-r="${i}">Revenir</button><button class="btn sm" data-x="${i}">Supprimer</button></div>`).join(''):'<p class="muted">Aucun instantané. Enregistrez un état pour pouvoir y revenir plus tard.</p>'};
  dialog({title:'Instantanés',light:true,body:`<div class="sn-new"><input id="snN" placeholder="Nom de l’instantané" value="État ${snaps(d).length+1}"><button class="btn primary" id="snAdd">Enregistrer l’état actuel</button></div><div id="snList"></div><p class="muted" style="margin:8px 0 0;font-size:12px">Les instantanés sont conservés avec le projet, sauf pour les photos 16 bits ou de plus de 24 Mpx.</p>
  <style>.sn-new{display:flex;gap:8px;margin-bottom:10px}.sn-new input{flex:1}.sn-row{display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--line);border-radius:8px;margin-bottom:4px}.sn-row b{flex:1}</style>`,
    buttons:[{label:'Fermer',primary:true}],
    onOpen:el=>{draw();el.querySelector('#snAdd').onclick=()=>{takeSnap(el.querySelector('#snN').value.trim()||'Instantané');el.querySelector('#snN').value='État '+(snaps(d).length+1);draw()};
      el.querySelector('#snList').onclick=ev=>{const r=ev.target.dataset.r,x=ev.target.dataset.x;if(r!=null){closeDialog();useSnap(+r)}else if(x!=null){snaps(d).splice(+x,1);draw()}}}})}

async function virtualCopy(){const d=S.doc;if(!d)return;busy(true,'Création de la copie…',null);
  try{d.nosave=false;await flushSave();await saveNow();const m=await IDB.get('projects',d.pid);if(!m)throw new Error('projet non enregistré');
    const id=uid8(),c={...m,id,name:(m.name||d.name||'Projet')+' (copie)',updatedAt:Date.now(),sync:false};
    await IDB.put('projects',id,c);busy(false);await openLocalProject(id);toast('Copie virtuelle créée : les deux versions évoluent séparément')}
  catch(e){busy(false);toast('Copie impossible : '+(e.message||e),5000)}}

/* gradient (local) mask on the active layer */
function gradMask(o){const d=S.doc,L=AL();if(!L)return;
  const m=mk(d.w,d.h),g=cx(m),W=d.w,H=d.h,cxp=W*o.x/100,cyp=H*o.y/100,a=o.angle*Math.PI/180;
  const f=Math.max(.02,o.feather/100);let gr;
  if(o.type==='radial'){const R=Math.hypot(W,H)*o.size/200;gr=g.createRadialGradient(cxp,cyp,R*(1-f),cxp,cyp,R);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)')}
  else{const R=Math.hypot(W,H)*o.size/200,dx=Math.cos(a)*R,dy=Math.sin(a)*R;gr=g.createLinearGradient(cxp-dx*f,cyp-dy*f,cxp+dx*f,cyp+dy*f);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)')}
  g.fillStyle=gr;g.fillRect(0,0,W,H);
  if(o.invert){const t=mk(W,H),tg=cx(t);tg.fillStyle='#fff';tg.fillRect(0,0,W,H);tg.globalCompositeOperation='destination-out';tg.drawImage(m,0,0);g.clearRect(0,0,W,H);g.drawImage(t,0,0)}
  if(L.mask){const old=cloneC(L.mask),og=cx(m);og.globalCompositeOperation='destination-in';og.drawImage(old,0,0)}
  delete L.moff;L.mask=m;markComp();pushHistory('Masque '+(o.type==='radial'?'radial':'dégradé'));syncAll()}
function gradDialog(){const d=S.doc;if(!d||!AL()){toast('Ouvrez une photo');return}
  dialog({title:'Masque dégradé',light:true,body:`<p class="muted" style="margin:0 0 8px">Limite l’effet d’un calque ou d’un réglage à une zone : un dégradé linéaire (ciel) ou radial (vignettage inversé, sujet).</p>
  <div class="gm"><label>Type<select id="gmT"><option value="linear">Linéaire</option><option value="radial">Radial</option></select></label>
  <label>Position horizontale<input type="range" id="gmX" min="0" max="100" value="50"></label>
  <label>Position verticale<input type="range" id="gmY" min="0" max="100" value="40"></label>
  <label>Angle<input type="range" id="gmA" min="0" max="360" value="90"></label>
  <label>Taille<input type="range" id="gmS" min="10" max="200" value="60"></label>
  <label>Douceur<input type="range" id="gmF" min="2" max="100" value="100"></label>
  <label class="row"><input type="checkbox" id="gmI"> Inverser</label></div>
  <style>.gm{display:grid;gap:8px}.gm label{display:grid;gap:3px;font-size:12px}.gm .row{display:flex;gap:8px;align-items:center}</style>`,
  buttons:[{label:'Annuler'},{label:'Appliquer',primary:true,onClick:el=>{const v=i=>el.querySelector(i);gradMask({type:v('#gmT').value,x:+v('#gmX').value,y:+v('#gmY').value,angle:+v('#gmA').value,size:+v('#gmS').value,feather:+v('#gmF').value,invert:v('#gmI').checked})}}]})}

/* channels */
function chanCanvas(ch){const d=S.doc,src=flatSync(),W=d.w,H=d.h,c=mk(W,H),g=cx(c);g.drawImage(src,0,0);const id=g.getImageData(0,0,W,H),p=id.data;
  for(let i=0;i<p.length;i+=4){const v=ch==='r'?p[i]:ch==='g'?p[i+1]:ch==='b'?p[i+2]:Math.round(.2126*p[i]+.7152*p[i+1]+.0722*p[i+2]);p[i]=p[i+1]=p[i+2]=v;p[i+3]=255}
  g.putImageData(id,0,0);return c}
function chanToLayer(ch,nm){const L=newPixel('Canal '+nm,chanCanvas(ch));insertLayer(L,'Canal '+nm,true)}
function chanToMask(ch,nm){const d=S.doc,L=AL();if(!L)return;const c=chanCanvas(ch),W=d.w,H=d.h,g=cx(c),id=g.getImageData(0,0,W,H),p=id.data;
  for(let i=0;i<p.length;i+=4){p[i+3]=p[i];p[i]=p[i+1]=p[i+2]=255}g.putImageData(id,0,0);
  if(L.mask){const og=cx(c);og.globalCompositeOperation='destination-in';og.drawImage(L.mask,0,0)}
  delete L.moff;L.mask=c;markComp();pushHistory('Masque depuis le canal '+nm);syncAll()}
const CH=[['r','Rouge'],['g','Vert'],['b','Bleu'],['l','Luminosité']];
function chanDialog(){if(!S.doc){toast('Ouvrez une photo');return}
  dialog({title:'Canaux',light:true,body:`<p class="muted" style="margin:0 0 8px">Sépare l’image en canaux de couleur. Un canal peut devenir un calque en niveaux de gris ou un masque pour le calque actif, par exemple le canal bleu pour isoler un ciel.</p>
  <div class="ch-list">${CH.map(([k,n])=>`<div class="ch-row"><b>${n}</b><button class="btn sm" data-l="${k}">En calque</button><button class="btn sm" data-m="${k}">En masque du calque actif</button></div>`).join('')}</div>
  <style>.ch-row{display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--line);border-radius:8px;margin-bottom:4px}.ch-row b{flex:1}</style>`,
  buttons:[{label:'Fermer',primary:true}],
  onOpen:el=>{el.querySelector('.ch-list').onclick=ev=>{const l=ev.target.dataset.l,m=ev.target.dataset.m,k=l||m;if(!k)return;const n=CH.find(x=>x[0]===k)[1];closeDialog();l?chanToLayer(k,n):chanToMask(k,n)}}})}

const _ei=MENU2.edit.items;MENU2.edit.items=()=>{const a=_ei();a.push(SEP,MI('Instantanés…',{icon:'history',dis:S.doc?false:NODOC,fn:snapDialog}),MI('Enregistrer un instantané',{dis:S.doc?false:NODOC,fn:()=>takeSnap('Instantané '+(snaps(S.doc).length+1))}));return a};
const _fi=MENU2.file.items;MENU2.file.items=()=>{const a=_fi();const k=a.findIndex(x=>x&&x.label==='Sauvegarder la photothèque…');const it=MI('Créer une copie virtuelle',{dis:S.doc?false:NODOC,fn:virtualCopy});if(k>0)a.splice(k-1,0,it);else a.push(it);return a};
const _li=MENU2.layer.items;MENU2.layer.items=()=>{const a=_li();a.push(SEP,MI('Masque dégradé…',{icon:'mask',dis:S.doc?false:NODOC,fn:gradDialog}));return a};
const _ii=MENU2.image.items;MENU2.image.items=()=>{const a=_ii();a.push(SEP,MI('Canaux…',{icon:'layer',dis:S.doc?false:NODOC,fn:chanDialog}));return a};
window.PrismB={SN,takeSnap,useSnap,snaps,virtualCopy,gradMask,chanToLayer,chanToMask};
})();

/* wave39: advanced text, brush scatter/grain, blend-if (this layer), shape masks, actions */
(()=>{
XKEYS.push('bif');
/* ---------- advanced text ---------- */
const _dt=drawTextTo;
drawTextTo=function(c,t){
  const a=t.adv;if(!a||(!a.grad&&!a.ul&&!a.st&&!a.caps&&!a.curve))return _dt.call(this,c,t);
  const t1=a.caps?{...t,text:t.text.toUpperCase()}:t;
  const bb=_dt.call(this,c,t1);
  const g=cx(c),W=c.width,H=c.height;
  if(a.grad){
    const f=mk(W,H),fg=cx(f);_dt.call(this,f,{...t1,sw:0,adv:null,color:'#000'});
    const [x,y,w,h]=bb,ang=(a.grad.angle||0)*Math.PI/180,cxp=x+w/2,cyp=y+h/2,R=Math.max(w,h)/2,dx=Math.cos(ang)*R,dy=Math.sin(ang)*R;
    const gr=fg.createLinearGradient(cxp-dx,cyp-dy,cxp+dx,cyp+dy);gr.addColorStop(0,a.grad.c1);gr.addColorStop(1,a.grad.c2);
    fg.globalCompositeOperation='source-in';fg.fillStyle=gr;fg.fillRect(0,0,W,H);
    g.globalCompositeOperation='source-over';g.drawImage(f,0,0)}
  if(a.ul||a.st){
    g.save();g.font=fontOf(t1);const lines=textLines(g,t1),lh=t1.size*t1.lh,ws=lines.map(l=>tMeas(g,l,t1)),bw=t1.boxW||Math.max(1,...ws);
    g.fillStyle=a.grad?a.grad.c1:t1.color;const th=Math.max(1,t1.size/16);
    lines.forEach((ln,i)=>{const off=t1.align==='center'?(bw-ws[i])/2:t1.align==='right'?bw-ws[i]:0,x=t1.x+off,y=t1.y+i*lh;
      if(a.ul)g.fillRect(x,y+t1.size*1.02,ws[i],th);if(a.st)g.fillRect(x,y+t1.size*.55,ws[i],th)});g.restore()}
  if(a.curve){
    const [x,y,w,h]=bb,x0=Math.max(0,Math.floor(x-4)),x1=Math.min(W,Math.ceil(x+w+4)),amp=h*a.curve/100;
    if(x1>x0){const y0=Math.max(0,Math.floor(y-Math.abs(amp)-8)),y1=Math.min(H,Math.ceil(y+h+Math.abs(amp)+8));
      const src=mk(x1-x0,y1-y0);cx(src).drawImage(c,x0,y0,x1-x0,y1-y0,0,0,x1-x0,y1-y0);g.clearRect(x0,y0,x1-x0,y1-y0);
      for(let X=0;X<x1-x0;X++){const u=w>0?(X+x0-x)/w:0,off=-amp*(1-Math.pow(2*Math.min(1,Math.max(0,u))-1,2));g.drawImage(src,X,0,1,src.height,X+x0,y0+off,1,src.height)}}
    return[x,y-Math.abs(amp)-2,w,h+Math.abs(amp)*2+4]}
  return bb};
const ADV=new WeakMap();
const _fm=finalizeMeta;finalizeMeta=function(L){if(L.txt&&ADV.has(L)){L.txt={...L.txt,adv:ADV.get(L)};ADV.delete(L)}return _fm.apply(this,arguments)};
const _te=textEdit;
textEdit=function(L,isNew){const r=_te.apply(this,arguments);
  setTimeout(()=>{const ta=document.getElementById('tTxt');if(!ta||document.getElementById('tAdv'))return;
    const host=ta.closest('.dlg,.modal,.dialog')||ta.closest('#scrim')||ta.parentElement,anchor=document.getElementById('tSc').closest('.dlg-grid');
    const a=(L.txt&&L.txt.adv)||{};ADV.set(L,L.txt&&L.txt.adv||null);if(!a.grad&&!a.ul&&!a.st&&!a.caps&&!a.curve)ADV.delete(L);
    const box=document.createElement('div');box.id='tAdv';box.className='t-adv';
    box.innerHTML=`<div class="row" style="justify-content:space-between"><label class="row"><input type="checkbox" id="taG" ${a.grad?'checked':''}> Dégradé de couleur</label><span class="row"><input type="color" class="swatch" id="taC1" value="${esc(a.grad?a.grad.c1:'#ffd166')}"><input type="color" class="swatch" id="taC2" value="${esc(a.grad?a.grad.c2:'#ef476f')}"><input type="range" id="taA" min="0" max="360" value="${esc(a.grad?a.grad.angle:90)}" aria-label="Angle du dégradé" style="width:90px"></span></div>
    <div class="row" style="gap:14px;flex-wrap:wrap;margin:6px 0"><label class="row"><input type="checkbox" id="taU" ${a.ul?'checked':''}> Souligné</label><label class="row"><input type="checkbox" id="taS" ${a.st?'checked':''}> Barré</label><label class="row"><input type="checkbox" id="taK" ${a.caps?'checked':''}> Majuscules</label></div>
    <label class="field" style="display:grid;gap:3px">Courbure du texte<input type="range" id="taR" min="-100" max="100" value="${esc(a.curve||0)}"></label>
    <style>.t-adv{border-top:1px solid var(--line);margin-top:8px;padding-top:8px;font-size:12px}.t-adv .row{display:flex;gap:6px;align-items:center}</style>`;
    (anchor||ta.parentElement).after(box);const iv=setInterval(()=>{if(!document.getElementById('tAdv')){clearInterval(iv);setTimeout(()=>ADV.delete(L),1500)}},300);
    const go=()=>{const v=id=>document.getElementById(id);const adv={grad:v('taG').checked?{c1:v('taC1').value,c2:v('taC2').value,angle:+v('taA').value}:null,ul:v('taU').checked,st:v('taS').checked,caps:v('taK').checked,curve:+v('taR').value};
      ADV.set(L,adv);if(L.txt){L.txt={...L.txt,adv};livePreview(L)}};
    box.addEventListener('input',e=>{e.stopPropagation();go()});box.addEventListener('change',e=>{e.stopPropagation();go()})},120);
  return r};

/* ---------- brush scatter and grain ---------- */
const grains=[];
function grainOf(stamp,k){let a=grains[k];if(!a||a.w!==stamp.width||a.s!==stamp){const c=mk(stamp.width,stamp.height),g=cx(c);g.drawImage(stamp,0,0);const id=g.getImageData(0,0,c.width,c.height),p=id.data;for(let i=0;i<p.length;i+=4)p[i+3]*= (Math.random()<.5?.15:1)*(.4+Math.random()*.6);g.putImageData(id,0,0);a={c,w:stamp.width,s:stamp};grains[k]=a}return a.c}
const _dab=dab;
dab=function(st,p){const o=S.opts[st.tool];
  if((st.tool!=='brush'&&st.tool!=='eraser')||!o||(!o.scatter&&!o.grain))return _dab.apply(this,arguments);
  const n=1+Math.round((o.scatterN||1)*(o.scatter?1:0)*2),sp=(o.scatter||0)/100*o.size,orig=st.stamp;
  for(let i=0;i<n;i++){const q=o.scatter?{x:p.x+(Math.random()-.5)*2*sp,y:p.y+(Math.random()-.5)*2*sp}:p;
    if(o.grain){st.stamp=grainOf(orig,Math.floor(Math.random()*6))}
    _dab.call(this,st,q)}
  st.stamp=orig};
const bx=()=>({scatter:0,scatterN:2,grain:0});
function brushxDialog(){const t=S.tool==='eraser'?'eraser':'brush',o=S.opts[t];
  dialog({title:(t==='eraser'?'Gomme':'Pinceau')+' : dispersion et texture',light:true,body:`<p class="muted" style="margin:0 0 8px">Disperse l’encre autour du tracé et lui donne un grain, comme une brosse sèche ou un spray.</p>
  ${rangeRow('bxS','Dispersion',0,300,1,o.scatter||0,' %')}${rangeRow('bxN','Densité de la dispersion',1,6,1,o.scatterN||2,'')}<label class="row" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="bxG" ${o.grain?'checked':''}> Texture granuleuse</label>`,
  buttons:[{label:'Fermer',primary:true,onClick:el=>{o.scatter=+$('#bxS',el).value;o.scatterN=+$('#bxN',el).value;o.grain=$('#bxG',el).checked?1:0}}]})}
PILL_ACT.brushx=brushxDialog;
const _pe4=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe4.apply(this,arguments)||'';if(t==='brush'||t==='eraser')h+=`<button class="btn sm" data-act="brushx" title="Dispersion et texture du trait">Spray…</button>`;return h};

/* ---------- blend-if (this layer) ---------- */
const BC=new WeakMap();
const _ls=layerSrc;
layerSrc=function(L){const s=_ls.apply(this,arguments);const b=L.bif;if(!b||s!==L.canvas||L.kind!=='pixel')return s;
  const key=b.lo[0]+','+b.lo[1]+','+b.hi[0]+','+b.hi[1];const hit=BC.get(s);if(hit&&hit.key===key)return hit.c;
  const c=mk(s.width,s.height),g=cx(c);g.drawImage(s,0,0);const id=g.getImageData(0,0,c.width,c.height),p=id.data;
  const [a0,a1]=b.lo,[c0,c1]=b.hi;
  for(let i=0;i<p.length;i+=4){const l=.2126*p[i]+.7152*p[i+1]+.0722*p[i+2];let k=1;
    if(l<a1)k*=a1>a0?Math.max(0,(l-a0)/(a1-a0)):(l<a0?0:1);
    if(l>c0)k*=c1>c0?Math.max(0,(c1-l)/(c1-c0)):(l>c0?0:1);
    p[i+3]=p[i+3]*k}
  g.putImageData(id,0,0);c.__fx=true;BC.set(s,{key,c});return c};
function blendIfDialog(){const d=S.doc,L=AL();if(!L||L.kind!=='pixel'){toast('Choisissez un calque de pixels');return}
  const b=L.bif||{lo:[0,0],hi:[255,255]},old=L.bif?{lo:[...b.lo],hi:[...b.hi]}:null;
  dialog({title:'Fusion selon la luminosité',light:true,body:`<p class="muted" style="margin:0 0 8px">Rend transparentes les zones sombres ou claires de ce calque. Utile pour une texture ou un ciel superposé. Ne tient pas compte des calques du dessous.</p>
  ${rangeRow('biB','Ombres masquées sous',0,255,1,b.lo[0],'')}${rangeRow('biA','Ombres visibles dès',0,255,1,b.lo[1],'')}${rangeRow('biC','Hautes lumières visibles jusqu’à',0,255,1,b.hi[0],'')}${rangeRow('biD','Hautes lumières masquées au-dessus de',0,255,1,b.hi[1],'')}`,
  onOpen:el=>{const f=()=>{const v=i=>+$(i,el).value;let a1=v('#biA'),a0=Math.min(v('#biB'),a1),c0=v('#biC'),c1=Math.max(v('#biD'),c0);L.bif={lo:[a0,a1],hi:[c0,c1]};markComp()};el.addEventListener('input',f)},
  buttons:[{label:'Annuler',onClick:()=>{L.bif=old;markComp()}},{label:'Réinitialiser',onClick:()=>{L.bif=null;markComp();pushHistory('Fusion selon la luminosité');syncAll()}},{label:'Appliquer',primary:true,onClick:()=>{const z=L.bif&&L.bif.lo[1]<=0&&L.bif.hi[0]>=255;if(z)L.bif=null;markComp();pushHistory('Fusion selon la luminosité');syncAll()}}]})}

/* ---------- shape mask ---------- */
function shapeMask(o){const d=S.doc,L=AL();if(!L)return;const W=d.w,H=d.h,m=mk(W,H),g=cx(m);
  const w=W*o.w/100,h=H*o.h/100,x=W*o.x/100-w/2,y=H*o.y/100-h/2;
  g.fillStyle='#fff';if(o.feather>0)g.filter='blur('+(Math.max(W,H)*o.feather/400)+'px)';
  g.beginPath();if(o.shape==='ellipse')g.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);else if(o.shape==='round'){const r=Math.min(w,h)*.22;g.roundRect(x,y,w,h,r)}else g.rect(x,y,w,h);g.fill();g.filter='none';
  if(o.invert){const t=mk(W,H),tg=cx(t);tg.fillStyle='#fff';tg.fillRect(0,0,W,H);tg.globalCompositeOperation='destination-out';tg.drawImage(m,0,0);g.clearRect(0,0,W,H);g.drawImage(t,0,0)}
  if(L.mask){g.globalCompositeOperation='destination-in';g.drawImage(L.mask,0,0)}
  delete L.moff;L.mask=m;markComp();pushHistory('Masque de forme');syncAll()}
function shapeMaskDialog(){if(!S.doc||!AL()){toast('Ouvrez une photo');return}
  dialog({title:'Masque de forme',light:true,body:`<p class="muted" style="margin:0 0 8px">Limite le calque actif à une forme (rectangle, ellipse, rectangle arrondi), avec bord doux. Le masque est ensuite modifiable au pinceau.</p>
  <label class="field">Forme<select id="smS"><option value="ellipse">Ellipse</option><option value="rect">Rectangle</option><option value="round">Rectangle arrondi</option></select></label>
  ${rangeRow('smX','Centre horizontal',0,100,1,50,' %')}${rangeRow('smY','Centre vertical',0,100,1,50,' %')}${rangeRow('smW','Largeur',5,100,1,60,' %')}${rangeRow('smH','Hauteur',5,100,1,60,' %')}${rangeRow('smF','Bord doux',0,100,1,20,'')}<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="smI"> Inverser</label>`,
  buttons:[{label:'Annuler'},{label:'Appliquer',primary:true,onClick:el=>{const v=i=>$(i,el);shapeMask({shape:v('#smS').value,x:+v('#smX').value,y:+v('#smY').value,w:+v('#smW').value,h:+v('#smH').value,feather:+v('#smF').value,invert:v('#smI').checked})}}]})}

/* ---------- actions (recorded filter sequences) ---------- */
const REC={on:false,steps:[],last:null};
const acts=()=>PREF.get('actions',[])||[];
Object.keys(FILTERS).forEach(id=>{const F=FILTERS[id],run=F.run;F.run=function(s,p){REC.last={id,p:{...p}};return run.call(F,s,p)}});
const _am2=applyMasked;
applyMasked=function(L,result,label){const r=_am2.apply(this,arguments);if(REC.on&&REC.last){REC.steps.push(REC.last);REC.last=null;toast('Étape '+REC.steps.length+' enregistrée')}return r};
async function playAction(a){const L=AL();if(!L||L.kind!=='pixel'||L.txt||L.shp){toast('Choisissez un calque de pixels');return}
  const was=REC.on;REC.on=false;busy(true,'Action « '+a.name+' »…',0);
  try{let r=L.canvas;let i=0;for(const s of a.steps){const F=FILTERS[s.id];if(F)r=F.run(r,s.p);busy(true,'Action « '+a.name+' »…',++i/a.steps.length);await tick()}
    applyMasked(L,r,'Action : '+a.name)}catch(e){toast('Action impossible : '+(e.message||e),4000)}
  busy(false);REC.on=was}
function actionsDialog(){
  const draw=el=>{const list=acts();el.querySelector('#acL').innerHTML=list.length?list.map((a,i)=>`<div class="ac-row"><b>${esc(a.name)}</b><span class="muted">${a.steps.length} étape${a.steps.length>1?'s':''}</span><button class="btn sm" data-p="${i}">Lancer</button><button class="btn sm" data-x="${i}">Supprimer</button></div>`).join(''):'<p class="muted">Aucune action enregistrée.</p>';
    el.querySelector('#acRec').textContent=REC.on?'Arrêter et enregistrer':'Enregistrer une action';el.querySelector('#acSt').textContent=REC.on?'Enregistrement en cours : appliquez des filtres, puis rouvrez cette fenêtre.':''};
  dialog({title:'Actions',light:true,body:`<p class="muted" style="margin:0 0 8px">Enregistre une suite de filtres et rejoue-la sur un autre calque ou une autre photo. Seuls les filtres du menu Filtre sont enregistrés.</p>
  <div class="ac-new"><input id="acN" placeholder="Nom de l’action" value="Action ${acts().length+1}"><button class="btn primary" id="acRec"></button></div><p class="muted" id="acSt" style="font-size:12px"></p><div id="acL"></div>
  <style>.ac-new{display:flex;gap:8px;margin-bottom:6px}.ac-new input{flex:1}.ac-row{display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--line);border-radius:8px;margin-bottom:4px}.ac-row b{flex:1}</style>`,
  buttons:[{label:'Fermer',primary:true}],
  onOpen:el=>{draw(el);
    el.querySelector('#acRec').onclick=()=>{if(!REC.on){REC.on=true;REC.steps=[];REC.last=null;REC.name=el.querySelector('#acN').value.trim()||'Action';closeDialog();toast('Enregistrement : appliquez vos filtres, puis Filtre > Actions pour terminer',4500)}
      else{REC.on=false;if(REC.steps.length){const l=acts();l.push({name:REC.name||'Action',steps:REC.steps});PREF.set('actions',l);toast('Action enregistrée : '+REC.steps.length+' étape(s)')}else toast('Aucune étape enregistrée');REC.steps=[];draw(el)}};
    el.querySelector('#acL').onclick=ev=>{const pI=ev.target.dataset.p,xI=ev.target.dataset.x;if(pI!=null){const a=acts()[+pI];closeDialog();playAction(a)}else if(xI!=null){const l=acts();l.splice(+xI,1);PREF.set('actions',l);draw(el)}}}})}

const _fl=MENU2.filter.items;MENU2.filter.items=()=>{const a=_fl();a.push(SEP,MI(REC.on?'Actions : terminer l’enregistrement…':'Actions…',{dis:S.doc?false:NODOC,fn:actionsDialog}));return a};
const _ly=MENU2.layer.items;MENU2.layer.items=()=>{const a=_ly();a.push(MI('Masque de forme…',{icon:'mask',dis:S.doc?false:NODOC,fn:shapeMaskDialog}),MI('Fusion selon la luminosité…',{icon:'layer',dis:S.doc?false:NODOC,fn:blendIfDialog}));return a};
window.PrismC={shapeMask,playAction,REC,acts,blendIfDialog,shapeMaskDialog,brushxDialog};
})();

/* wave40: grayscale/indexed modes, ICC export, exposure fusion, panorama, puppet warp */
(()=>{
const pixLayers=()=>S.doc.layers.filter(L=>L.kind==='pixel'&&L.canvas);
function mapPix(fn,label){const d=S.doc;for(const L of pixLayers()){if(L.txt||L.shp){L.txt=null;L.shp=null}if(L.fbase){L.fbase=null;L.filters=null;L.fout=null}const c=cloneC(L.canvas),g=cx(c),id=g.getImageData(0,0,c.width,c.height);fn(id.data);g.putImageData(id,0,0);L.canvas=c}
  markComp();pushHistory(label);syncAll()}
function toGray(){if(!S.doc)return;if(S.doc.layers.some(L=>L.hi)){toast('Les calques 16 bits passent aussi en niveaux de gris, calculés en 8 bits')}
  mapPix(p=>{for(let i=0;i<p.length;i+=4){const l=Math.round(.2126*p[i]+.7152*p[i+1]+.0722*p[i+2]);p[i]=p[i+1]=p[i+2]=l}},'Mode niveaux de gris')}
/* median cut palette from the flattened picture */
function palette(data,n){const px=[];const step=Math.max(1,Math.floor(data.length/4/60000));for(let i=0;i<data.length;i+=4*step)if(data[i+3]>8)px.push([data[i],data[i+1],data[i+2]]);
  if(!px.length)return[[0,0,0]];let boxes=[px];
  while(boxes.length<n){let bi=-1,br=-1,ch=0;boxes.forEach((b,i)=>{if(b.length<2)return;for(let c=0;c<3;c++){let lo=255,hi=0;for(const q of b){if(q[c]<lo)lo=q[c];if(q[c]>hi)hi=q[c]}const r=(hi-lo)*Math.sqrt(b.length);if(r>br){br=r;bi=i;ch=c}}});if(bi<0)break;
    const b=boxes[bi];b.sort((a,c)=>a[ch]-c[ch]);const m=b.length>>1;boxes.splice(bi,1,b.slice(0,m),b.slice(m))}
  return boxes.map(b=>{let r=0,g=0,bl=0;for(const q of b){r+=q[0];g+=q[1];bl+=q[2]}const k=b.length||1;return[Math.round(r/k),Math.round(g/k),Math.round(bl/k)]})}
function indexed(n,dither){const d=S.doc;const flat=flatSync(),fd=cx(flat).getImageData(0,0,flat.width,flat.height).data;const pal=palette(fd,n);
  const near=(r,g,b)=>{let bi=0,bd=1e9;for(let i=0;i<pal.length;i++){const q=pal[i],dr=r-q[0],dg=g-q[1],db=b-q[2],dd=dr*dr*.3+dg*dg*.59+db*db*.11;if(dd<bd){bd=dd;bi=i}}return pal[bi]};
  const W=d.w;
  mapPix(p=>{const w=W,h=p.length/4/w;const e=dither?new Float32Array(w*3*2):null;let cur=0,nxt=w*3;
    for(let y=0;y<h;y++){if(dither)e.fill(0,nxt,nxt+w*3);
      for(let x=0;x<w;x++){const i=(y*w+x)*4;if(p[i+3]===0)continue;let r=p[i],g=p[i+1],b=p[i+2];if(dither){r+=e[cur+x*3];g+=e[cur+x*3+1];b+=e[cur+x*3+2]}
        const q=near(Math.max(0,Math.min(255,r)),Math.max(0,Math.min(255,g)),Math.max(0,Math.min(255,b)));
        if(dither){const er=r-q[0],eg=g-q[1],eb=b-q[2];const add=(xx,o,k)=>{if(xx<0||xx>=w)return;e[o+xx*3]+=er*k;e[o+xx*3+1]+=eg*k;e[o+xx*3+2]+=eb*k};add(x+1,cur,7/16);add(x-1,nxt,3/16);add(x,nxt,5/16);add(x+1,nxt,1/16)}
        p[i]=q[0];p[i+1]=q[1];p[i+2]=q[2]}
      if(dither){const t=cur;cur=nxt;nxt=t}}},'Couleurs indexées ('+pal.length+')');}
function indexedDialog(){if(!S.doc)return;
  dialog({title:'Couleurs indexées',light:true,body:`<p class="muted" style="margin:0 0 8px">Réduit l’image à une palette limitée, pour un rendu rétro, GIF ou pixel art. Les calques sont aplatis dans le calcul de la palette puis recolorés.</p>${rangeRow('ixN','Nombre de couleurs',2,256,1,16,'')}<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="ixD" checked> Tramage (Floyd-Steinberg)</label>`,
  buttons:[{label:'Annuler'},{label:'Appliquer',primary:true,onClick:el=>{const n=+$('#ixN',el).value,dt=$('#ixD',el).checked;busy(true,'Quantification…',null);setTimeout(()=>{try{indexed(n,dt)}finally{busy(false)}},30)}}]})}

/* ---------- ICC export ---------- */
async function iccExport(o){busy(true,'Conversion de couleurs…',null);await tick();
  try{const m=await CMS.load();const hp=CMS.open(o.bytes);if(!hp)throw new Error('profil ICC illisible');
    const cs=String.fromCharCode(...o.bytes.subarray(16,20));if(cs==='CMYK')return await iccExportCMYK(o,m,hp);if(cs!=='RGB ')throw new Error('profil '+cs.trim()+' : seuls les profils RVB et CMJN sont pris en charge');
    const T=CMS.ns.TYPE_RGBA_8,io=CS==='display-p3'?CMS.p3:CMS.srgb,fl=o.bpc?0x2000:0;
    const xf=m.cmsCreateTransform(io,T,hp,T,o.intent,fl);if(!xf)throw new Error('transformation impossible avec ce profil');
    let c,g,id;try{c=await renderDoc(1);if(o.fmt==='jpeg'){const w=mk(c.width,c.height),g=cx(w);g.fillStyle='#fff';g.fillRect(0,0,w.width,w.height);g.drawImage(c,0,0);c=w}
    g=cx(c);id=g.getImageData(0,0,c.width,c.height);const n=c.width*c.height,CH=1<<20;
    for(let s=0;s<n;s+=CH){const k=Math.min(CH,n-s),part=id.data.subarray(s*4,(s+k)*4),out=m.cmsDoTransform(xf,part,k);for(let i=3;i<out.length;i+=4)out[i]=part[i];id.data.set(out,s*4);await tick()}
    }finally{m.cmsDeleteTransform(xf)}g.putImageData(id,0,0);
    let blob=await new Promise(r=>c.toBlob(r,'image/'+o.fmt,o.q));
    let ex=null;try{ex=S.doc.exif?exifForExport(S.doc.exif,c.width,c.height):null}catch(e){}if(o.fmt==='jpeg')blob=await window.PrismFx.jpegMetaICC(blob,ex,o.bytes);
    else{const u=new Uint8Array(await blob.arrayBuffer()),v=new DataView(u.buffer),ih=8+12+v.getUint32(8),nm=new TextEncoder().encode((o.name||'profil').slice(0,40)),z=await zlib(o.bytes),ch=new Uint8Array(nm.length+2+z.length);ch.set(nm);ch.set(z,nm.length+2);
      const parts=[u.subarray(0,ih)];let p=ih;/* drop any sRGB/iCCP chunk the browser wrote */
      parts.push(pngChunk('iCCP',ch));while(p<u.length){const L=v.getUint32(p),ty=String.fromCharCode(u[p+4],u[p+5],u[p+6],u[p+7]);if(ty!=='sRGB'&&ty!=='iCCP'&&ty!=='gAMA'&&ty!=='cHRM')parts.push(u.subarray(p,p+12+L));p+=12+L}
      blob=await pngWithExif(new Blob(parts,{type:'image/png'}),ex)}
    busy(false);await saveFile(blob,(S.doc.name||'image').replace(/\.[a-z0-9]+$/i,'')+'-'+(o.name||'icc').replace(/[^\w-]+/g,'_')+'.'+(o.fmt==='jpeg'?'jpg':'png'))
  }catch(e){busy(false);console.error(e);toast('Export impossible : '+(e.message||e),5000)}}
/* CMYK (CMJN) for print: the photo is flattened on white, converted with the printer's profile and written as a CMYK TIFF carrying that profile */
async function iccExportCMYK(o,m,hp){const io=CS==='display-p3'?CMS.p3:CMS.srgb,xf=m.cmsCreateTransform(io,CMS.ns.TYPE_RGB_8,hp,CMS.ns.TYPE_CMYK_8,o.intent,o.bpc?0x2000:0);if(!xf)throw new Error('transformation impossible avec ce profil');
  let cmyk,W,H;try{const c0=await renderDoc(1);W=c0.width;H=c0.height;const c=mk(W,H),g=cx(c);g.fillStyle='#fff';g.fillRect(0,0,W,H);g.drawImage(c0,0,0);
  const a=g.getImageData(0,0,W,H).data,n=W*H,CH=1<<20,rgb=new Uint8Array(Math.min(CH,n)*3);cmyk=new Uint8Array(n*4);
  for(let s=0;s<n;s+=CH){const k=Math.min(CH,n-s);for(let i=0;i<k;i++){const j=(s+i)*4;rgb[i*3]=a[j];rgb[i*3+1]=a[j+1];rgb[i*3+2]=a[j+2]}
    const out=m.cmsDoTransform(xf,rgb.subarray(0,k*3),k);cmyk.set(out.subarray(0,k*4),s*4);busy(true,'Conversion en CMJN…',s/n);await tick()}
  }finally{m.cmsDeleteTransform(xf)}const blob=await encodeTIFFCMYK(cmyk,W,H,o.bytes);busy(false);
  await saveFile(blob,(S.doc.name||'image').replace(/\.[a-z0-9]+$/i,'')+'-'+(o.name||'cmjn').replace(/[^\w-]+/g,'_')+'.tif')}
async function encodeTIFFCMYK(pix,w,h,icc){const comp=await zlib(pix),tags=[],T=(id,type,count,val)=>tags.push({id,type,count,val});
  const nT=12,ifd=8,ifdLen=2+nT*12+4,bpsOff=ifd+ifdLen,iccOff=bpsOff+8,dataOff=iccOff+icc.length+(icc.length&1);
  T(256,4,1,w);T(257,4,1,h);T(258,3,4,bpsOff);T(259,3,1,8);T(262,3,1,5);T(273,4,1,dataOff);T(277,3,1,4);T(278,4,1,h);T(279,4,1,comp.length);T(284,3,1,1);T(332,3,1,1);T(34675,7,icc.length,iccOff);
  const head=new Uint8Array(dataOff),v=new DataView(head.buffer);head[0]=73;head[1]=73;v.setUint16(2,42,true);v.setUint32(4,ifd,true);v.setUint16(ifd,nT,true);
  tags.forEach((t,i)=>{const o=ifd+2+i*12;v.setUint16(o,t.id,true);v.setUint16(o+2,t.type,true);v.setUint32(o+4,t.count,true);if(t.type===3&&t.count===1)v.setUint16(o+8,t.val,true);else v.setUint32(o+8,t.val,true)});v.setUint32(ifd+2+nT*12,0,true);
  for(let c=0;c<4;c++)v.setUint16(bpsOff+c*2,8,true);head.set(icc,iccOff);return new Blob([head,comp],{type:'image/tiff'})}
async function iccDialog(){if(!S.doc)return;let bytes=null,name='';if(await proofLoadSaved()){bytes=PROOF.bytes;name=PROOF.name}
  dialog({title:'Exporter avec un profil ICC',light:true,body:`<p class="muted" style="margin:0 0 8px">Convertit les couleurs vers un profil RVB (écran, labo photo) ou CMJN (imprimeur) et l’intègre au fichier. Avec un profil CMJN, le fichier est un TIFF CMJN prêt pour l’impression. Le profil reste sur cet appareil.</p>
  <div class="inline"><button class="btn sm" id="icPick">Choisir un profil ICC…</button><span id="icName" class="muted">${name?esc(name):'Aucun profil'}</span></div>
  <label class="field">Format<select id="icF"><option value="jpeg">JPEG</option><option value="png">PNG</option></select></label>
  <label class="field">Intention<select id="icI"><option value="0">Perceptuelle</option><option value="1" selected>Colorimétrie relative</option><option value="2">Saturation</option><option value="3">Colorimétrie absolue</option></select></label>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="icB" checked> Compensation du point noir</label>`,
  buttons:[{label:'Annuler'},{label:'Exporter',primary:true,onClick:el=>{if(!bytes){toast('Choisissez d’abord un profil ICC');return false}iccExport({bytes,name,fmt:$('#icF',el).value,intent:+$('#icI',el).value,bpc:$('#icB',el).checked,q:.92})}}],
  onOpen:el=>{$('#icPick',el).onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='.icc,.icm';i.onchange=async()=>{const f=i.files[0];if(!f)return;bytes=new Uint8Array(await f.arrayBuffer());name=f.name.replace(/\.[^.]+$/,'');$('#icName',el).textContent=name};i.click()}}})}

/* ---------- helpers for multi-photo tools ---------- */
function pickMany(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='image/*,.heic,.heif,.tif,.tiff,'+RAW_ACCEPT;i.onchange=()=>res([...i.files]);i.oncancel=()=>res([]);i.click()})}
async function loadScaled(f,maxPx){let bm=null;if(!RAW_EXT.test(f.name||'')&&!/\.(heic|heif|avif|tiff?)$/i.test(f.name||'')){try{bm=await createImageBitmap(f)}catch(e){}}
  if(!bm){const src=await styleFromFile(f);const s=Math.min(1,maxPx/Math.max(src.width,src.height)),c=mk(Math.round(src.width*s),Math.round(src.height*s));cx(c).drawImage(src,0,0,c.width,c.height);return c}
  const s=Math.min(1,maxPx/Math.max(bm.width,bm.height)),c=mk(Math.round(bm.width*s),Math.round(bm.height*s));cx(c).drawImage(bm,0,0,c.width,c.height);bm.close&&bm.close();return c}
/* translation that best aligns B onto A (normalised grey levels, so different exposures still match) */
function alignShift(A,B){const w=200,h=Math.max(8,Math.round(A.height*200/A.width));const g=c=>{const t=mk(w,h);cx(t).drawImage(c,0,0,w,h);const a=grayOf(t);let m=0,v=0;for(const x of a)m+=x;m/=a.length;for(const x of a)v+=(x-m)*(x-m);const sd=Math.sqrt(v/a.length)||1;for(let i=0;i<a.length;i++)a[i]=(a[i]-m)/sd;return a};
  const ga=g(A),gb=g(B),R=Math.round(w*.06);let best=1e9,bx=0,by=0;
  for(let sy=-R;sy<=R;sy++)for(let sx=-R;sx<=R;sx++){let e=0,n=0;for(let y=Math.max(0,sy);y<Math.min(h,h+sy);y++)for(let x=Math.max(0,sx);x<Math.min(w,w+sx);x++){e+=Math.abs(ga[y*w+x]-gb[(y-sy)*w+(x-sx)]);n++}e/=n||1;if(e<best){best=e;bx=sx;by=sy}}
  return{x:bx*A.width/w,y:by*A.height/h}}
function boxBlur(a,w,h,r){const t=new Float32Array(a.length),o=new Float32Array(a.length),k=2*r+1;
  for(let y=0;y<h;y++){let s=0;const b=y*w;for(let x=-r;x<=r;x++)s+=a[b+Math.max(0,Math.min(w-1,x))];for(let x=0;x<w;x++){t[b+x]=s/k;s+=a[b+Math.min(w-1,x+r+1)]-a[b+Math.max(0,x-r)]}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[Math.max(0,Math.min(h-1,y))*w+x];for(let y=0;y<h;y++){o[y*w+x]=s/k;s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}
  return o}
/* ---------- exposure fusion ---------- */
async function fuseExposures(files){busy(true,'Fusion des expositions…',0);await tick();
  try{const imgs=[];for(const f of files)imgs.push(await loadScaled(f,3200));const W=imgs[0].width,H=imgs[0].height;let moved=0;for(let k=1;k<imgs.length;k++){const sh=alignShift(imgs[0],imgs[k]);if(Math.abs(sh.x)>=1||Math.abs(sh.y)>=1){const t2=mk(W,H);cx(t2).drawImage(imgs[k],sh.x,sh.y);imgs[k]=t2;moved++}}
    const datas=imgs.map(c=>{if(c.width===W&&c.height===H)return cx(c).getImageData(0,0,W,H).data;const t=mk(W,H);cx(t).drawImage(c,0,0,W,H);return cx(t).getImageData(0,0,W,H).data});
    const n=W*H,ws=[];let k=0;
    for(const d of datas){const w=new Float32Array(n),gray=new Float32Array(n);
      for(let i=0;i<n;i++){const r=d[i*4]/255,g=d[i*4+1]/255,b=d[i*4+2]/255;gray[i]=.299*r+.587*g+.114*b;const mean=(r+g+b)/3,sat=Math.sqrt(((r-mean)**2+(g-mean)**2+(b-mean)**2)/3);
        const ex=Math.exp(-((r-.5)**2+(g-.5)**2+(b-.5)**2)/(2*.2*.2*3/3));w[i]=(sat+.02)*ex+1e-6}
      for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,lap=Math.abs(4*gray[i]-gray[i-1]-gray[i+1]-gray[i-W]-gray[i+W]);w[i]*=(lap+.01)}
      ws.push(boxBlur(w,W,H,Math.max(3,Math.round(Math.min(W,H)/80))));busy(true,'Fusion des expositions…',++k/(datas.length*2));await tick()}
    const out=mk(W,H),og=cx(out),oi=og.createImageData(W,H),od=oi.data;
    for(let i=0;i<n;i++){let s=0;for(let j=0;j<ws.length;j++)s+=ws[j][i];let r=0,g=0,b=0;for(let j=0;j<ws.length;j++){const a=ws[j][i]/s;r+=datas[j][i*4]*a;g+=datas[j][i*4+1]*a;b+=datas[j][i*4+2]*a}od[i*4]=r;od[i*4+1]=g;od[i*4+2]=b;od[i*4+3]=255}
    og.putImageData(oi,0,0);busy(false);setDoc(out,'fusion-expositions.jpg',{});toast('Expositions fusionnées'+(moved?' (alignement corrigé sur '+moved+' photo'+(moved>1?'s':'')+')':'')+'. Un petit décalage est corrigé, pas une rotation.',6000)
  }catch(e){busy(false);console.error(e);toast('Fusion impossible : '+(e.message||e),5000)}}
async function fusionDialog(){const fs=await pickMany();if(fs.length<2){if(fs.length)toast('Choisissez au moins deux photos');return}fuseExposures(fs)}

/* ---------- panorama (translation only) ---------- */
function grayOf(c){const d=cx(c).getImageData(0,0,c.width,c.height).data,g=new Float32Array(c.width*c.height);for(let i=0;i<g.length;i++)g[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];return g}
function shiftErr(A,B,w,h,sx,sy){let s=0,n=0;const x0=Math.max(0,sx),x1=Math.min(w,sx+w);if(x1-x0<w*.12)return 1e9;
  for(let y=Math.max(0,sy);y<Math.min(h,h+sy);y+=2)for(let x=x0;x<x1;x+=2){const a=A[y*w+x],b=B[(y-sy)*w+(x-sx)];s+=Math.abs(a-b);n++}return n?s/n:1e9}
async function stitch(files){busy(true,'Assemblage du panorama…',0);await tick();
  try{const fulls=[];for(const f of files)fulls.push(await loadScaled(f,4000));
    const SC=200/fulls[0].width,sm=fulls.map(c=>{const t=mk(Math.round(c.width*SC),Math.round(c.height*SC));cx(t).drawImage(c,0,0,t.width,t.height);return t});
    const pos=[{x:0,y:0}];
    for(let k=1;k<fulls.length;k++){const A=sm[k-1],B=sm[k];if(A.width!==B.width||A.height!==B.height){const t=mk(A.width,A.height);cx(t).drawImage(B,0,0,A.width,A.height);sm[k]=t}
      const w=A.width,h=A.height,ga=grayOf(A),gb=grayOf(sm[k]);let best=1e9,bx=0,by=0;const my=Math.round(h*.12);
      for(let sx=Math.round(w*.15);sx<=w*.9;sx++)for(let sy=-my;sy<=my;sy++){const e=shiftErr(ga,gb,w,h,sx,sy);if(e<best){best=e;bx=sx;by=sy}}
      const f=fulls[k-1].width/w;const prev=pos[k-1];pos.push({x:prev.x+bx*f,y:prev.y+by*f});busy(true,'Assemblage du panorama…',k/fulls.length);await tick()}
    let minX=0,minY=0,maxX=0,maxY=0;pos.forEach((p,i)=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x+fulls[i].width);maxY=Math.max(maxY,p.y+fulls[i].height)});
    const W=Math.round(maxX-minX),H=Math.round(maxY-minY);if(W*H>MAX_PX)throw new Error('panorama trop grand');
    const out=mk(W,H),g=cx(out);
    for(let i=0;i<fulls.length;i++){const c=fulls[i],x=Math.round(pos[i].x-minX),y=Math.round(pos[i].y-minY);
      if(i===0){g.drawImage(c,x,y);continue}
      const prevEnd=Math.round(pos[i-1].x-minX)+fulls[i-1].width,ov=Math.max(1,prevEnd-x),t=mk(c.width,c.height),tg=cx(t);tg.drawImage(c,0,0);
      tg.globalCompositeOperation='destination-in';const gr=tg.createLinearGradient(0,0,Math.min(ov,c.width),0);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,1)');tg.fillStyle=gr;tg.fillRect(0,0,c.width,c.height);
      g.drawImage(t,x,y)}
    busy(false);setDoc(out,'panorama.jpg',{});toast('Panorama assemblé (translation seule). Recadrez ensuite les bords.',6000)
  }catch(e){busy(false);console.error(e);toast('Panorama impossible : '+(e.message||e),5000)}}
async function panoDialog(){const fs=await pickMany();if(fs.length<2){if(fs.length)toast('Choisissez au moins deux photos');return}fs.sort((a,b)=>(a.name||'').localeCompare(b.name||''));stitch(fs)}

/* ---------- puppet warp ---------- */
function mls(pins,x,y,a){let sw=0,px=0,py=0,qx=0,qy=0;const ws=[];
  for(const p of pins){const dx=p.sx-x,dy=p.sy-y,d2=dx*dx+dy*dy;if(d2<1e-6)return[p.dx,p.dy];const w=1/Math.pow(d2,a);ws.push(w);sw+=w;px+=w*p.sx;py+=w*p.sy;qx+=w*p.dx;qy+=w*p.dy}
  px/=sw;py/=sw;qx/=sw;qy/=sw;let zr=0,zi=0,den=0;
  pins.forEach((p,i)=>{const w=ws[i],ar=p.sx-px,ai=p.sy-py,br=p.dx-qx,bi=p.dy-qy;zr+=w*(ar*br+ai*bi);zi+=w*(ar*bi-ai*br);den+=w*(ar*ar+ai*ai)});
  const m=Math.hypot(zr,zi);if(m<1e-9||den<1e-9)return[x+(qx-px),y+(qy-py)];zr/=m;zi/=m;
  const vx=x-px,vy=y-py;return[vx*zr-vy*zi+qx,vx*zi+vy*zr+qy]}
function drawTri(g,img,s0,s1,s2,d0,d1,d2){const den=(s1[0]-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(s1[1]-s0[1]);if(Math.abs(den)<1e-9)return;
  const a=((d1[0]-d0[0])*(s2[1]-s0[1])-(d2[0]-d0[0])*(s1[1]-s0[1]))/den,c=((d2[0]-d0[0])*(s1[0]-s0[0])-(d1[0]-d0[0])*(s2[0]-s0[0]))/den,b=((d1[1]-d0[1])*(s2[1]-s0[1])-(d2[1]-d0[1])*(s1[1]-s0[1]))/den,d=((d2[1]-d0[1])*(s1[0]-s0[0])-(d1[1]-d0[1])*(s2[0]-s0[0]))/den;
  const e=d0[0]-a*s0[0]-c*s0[1],f=d0[1]-b*s0[0]-d*s0[1];
  const cxm=(d0[0]+d1[0]+d2[0])/3,cym=(d0[1]+d1[1]+d2[1])/3,ex=(p)=>{const dx=p[0]-cxm,dy=p[1]-cym,l=Math.hypot(dx,dy)||1;return[p[0]+dx/l*1.2,p[1]+dy/l*1.2]};
  g.save();g.beginPath();const E0=ex(d0),E1=ex(d1),E2=ex(d2);g.moveTo(E0[0],E0[1]);g.lineTo(E1[0],E1[1]);g.lineTo(E2[0],E2[1]);g.closePath();g.clip();g.transform(a,b,c,d,e,f);g.drawImage(img,0,0);g.restore()}
function warpMesh(img,pins,cell,out,scale){const W=img.width,H=img.height,g=cx(out);g.clearRect(0,0,out.width,out.height);
  const nx=Math.ceil(W/cell),ny=Math.ceil(H/cell),V=[];for(let j=0;j<=ny;j++){V[j]=[];for(let i=0;i<=nx;i++){const x=Math.min(W,i*cell),y=Math.min(H,j*cell);V[j][i]=[x,y,mls(pins,x,y,1.6)]}}
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=V[j][i],b=V[j][i+1],c=V[j+1][i+1],d=V[j+1][i];
    const S_=(v)=>[v[0],v[1]],D_=(v)=>[v[2][0]*scale,v[2][1]*scale];
    const sa=[a[0],a[1]],sb=[b[0],b[1]],sc=[c[0],c[1]],sd=[d[0],d[1]];
    drawTri(g,img,sa,sb,sc,D_(a),D_(b),D_(c));drawTri(g,img,sa,sc,sd,D_(a),D_(c),D_(d))}}
function puppetDialog(){const d=S.doc,L=AL();if(!d||!L||L.kind!=='pixel'||L.editMask){toast('Choisissez un calque de pixels');return}
  const ov=document.createElement('div');ov.id='puppet';ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(10,10,14,.92);display:grid;grid-template-rows:auto 1fr;color:#eee;font:13px Geist,system-ui,sans-serif';
  ov.innerHTML=`<div style="display:flex;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid #333"><b>Déformation marionnette</b><span style="opacity:.7;flex:1">Cliquez pour poser une épingle, glissez-la pour déformer. Clic droit ou Alt+clic pour la retirer. Posez aussi des épingles sur les zones à garder fixes.</span><button class="btn sm" id="pwReset">Réinitialiser</button><button class="btn sm" id="pwCancel">Annuler</button><button class="btn primary sm" id="pwOk">Appliquer</button></div><div style="position:relative;overflow:hidden"><canvas id="pwC" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas></div>`;
  document.body.appendChild(ov);const cv=ov.querySelector('#pwC'),area=cv.parentElement;
  const pins=[];let drag=null,view={s:1,ox:0,oy:0};const W=d.w,H=d.h,selM=(d.sel&&maskBBox(d.sel))?d.sel:null,base=selM?(()=>{const c=cloneC(L.canvas),g=cx(c);g.globalCompositeOperation='destination-out';g.drawImage(selM,0,0);return c})():null,src=selM?(()=>{const c=cloneC(L.canvas),g=cx(c);g.globalCompositeOperation='destination-in';g.drawImage(selM,0,0);return c})():L.canvas;
  const pv=mk(Math.min(W,1200),Math.round(H*Math.min(W,1200)/W)),ps=pv.width/W;const small=mk(pv.width,pv.height);cx(small).drawImage(src,0,0,pv.width,pv.height);
  const out=mk(pv.width,pv.height);
  const fit=()=>{const r=area.getBoundingClientRect();cv.width=r.width;cv.height=r.height;const s=Math.min((r.width-40)/W,(r.height-40)/H);view={s,ox:(r.width-W*s)/2,oy:(r.height-H*s)/2}};
  const toDoc=e=>{const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left-view.ox)/view.s,y:(e.clientY-r.top-view.oy)/view.s}};
  const draw=()=>{const g=cv.getContext('2d');g.clearRect(0,0,cv.width,cv.height);g.save();g.translate(view.ox,view.oy);g.scale(view.s,view.s);
    g.fillStyle='#2a2a30';g.fillRect(0,0,W,H);if(base)g.drawImage(base,0,0);const act=pins.filter(p=>p.sx!==p.dx||p.sy!==p.dy).length;
    if(act&&pins.length>1){const m=pins.map(p=>({sx:p.sx*ps,sy:p.sy*ps,dx:p.dx*ps,dy:p.dy*ps}));warpMesh(small,m,24,out,1);g.drawImage(out,0,0,W,H)}else g.drawImage(src,0,0);
    g.restore();pins.forEach(p=>{const x=view.ox+p.dx*view.s,y=view.oy+p.dy*view.s;g.beginPath();g.arc(x,y,7,0,7);g.fillStyle=(p.sx!==p.dx||p.sy!==p.dy)?'#6d7cff':'#fff';g.fill();g.strokeStyle='#000';g.lineWidth=2;g.stroke()})};
  const near=p=>pins.find(q=>Math.hypot((q.dx-p.x)*view.s,(q.dy-p.y)*view.s)<=10);
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{const p=toDoc(e),h=near(p);if(e.button===2||e.altKey){if(h){pins.splice(pins.indexOf(h),1);draw()}return}
    if(h)drag=h;else{if(p.x<0||p.y<0||p.x>W||p.y>H)return;const n={sx:p.x,sy:p.y,dx:p.x,dy:p.y};pins.push(n);drag=n}cv.setPointerCapture(e.pointerId);draw()});
  cv.addEventListener('pointermove',e=>{if(!drag)return;const p=toDoc(e);drag.dx=Math.max(0,Math.min(W,p.x));drag.dy=Math.max(0,Math.min(H,p.y));draw()});
  cv.addEventListener('pointerup',()=>{drag=null});
  const close=()=>{ov.remove();window.removeEventListener('resize',rs);window.removeEventListener('keydown',kd,true)};
  const rs=()=>{fit();draw()};window.addEventListener('resize',rs);
  const kd=e=>{if(e.key==='Escape'){e.stopPropagation();close()}else if(e.key==='Enter'&&!(e.target&&e.target.closest&&e.target.closest('input,textarea,select'))){e.preventDefault();e.stopPropagation();ov.querySelector('#pwOk').click()}};window.addEventListener('keydown',kd,true);
  ov.querySelector('#pwCancel').onclick=close;ov.querySelector('#pwReset').onclick=()=>{pins.length=0;draw()};
  ov.querySelector('#pwOk').onclick=()=>{const act=pins.filter(p=>p.sx!==p.dx||p.sy!==p.dy).length;if(!act||pins.length<2){toast(pins.length<2?'Posez au moins deux épingles : une à déplacer, une à garder fixe':'Déplacez une épingle pour déformer');return}
    busy(true,'Déformation…',null);setTimeout(()=>{try{const o=mk(W,H);warpMesh(src,pins,Math.max(8,Math.round(Math.max(W,H)/160)),o,1);L.txt=null;L.shp=null;if(L.fbase){L.fbase=null;L.filters=null;L.fout=null}const CL=Math.max(8,Math.round(Math.max(W,H)/160));if(selM){const ns=mk(W,H);warpMesh(selM,pins,CL,ns,1);const fin=cloneC(base);cx(fin).drawImage(o,0,0);L.canvas=fin;d.sel=maskBBox(ns)?ns:null;selChanged()}else{if(L.mask){const mo=mk(W,H);warpMesh(L.mask,pins,CL,mo,1);L.mask=mo}L.canvas=o}markComp();pushHistory('Déformation marionnette');syncAll()}finally{busy(false);close()}},30)};
  fit();draw();window.PrismPuppet={pins,draw}}

/* ---------- menus ---------- */
const _ii=MENU2.image.items;MENU2.image.items=()=>{const a=_ii();a.push(SEP,MI('Mode : niveaux de gris',{dis:S.doc?false:NODOC,fn:toGray}),MI('Mode : couleurs indexées…',{dis:S.doc?false:NODOC,fn:indexedDialog}));return a};
const _ly=MENU2.layer.items;MENU2.layer.items=()=>{const a=_ly();a.push(MI('Déformation marionnette…',{icon:'layer',dis:S.doc?false:NODOC,fn:puppetDialog}));return a};
const _fi=MENU2.file.items;MENU2.file.items=()=>{const a=_fi();const k=a.findIndex(x=>x&&x.label==='Sauvegarder la photothèque…');const items=[MI('Exporter avec un profil ICC…',{dis:S.doc?false:NODOC,fn:iccDialog}),MI('Fusion d’expositions (HDR)…',{fn:fusionDialog}),MI('Panorama…',{fn:panoDialog})];
  if(k>0)a.splice(k-1,0,...items);else a.push(SEP,...items);return a};
window.PrismD={toGray,indexed,iccExport,fuseExposures,stitch,puppetDialog,warpMesh,mls};
})();

/* wave41: smart objects (non-destructive layer transforms from the original pixels) */
(()=>{
const valid=L=>L&&L.so&&L.so.out===L.canvas;
function render(so,m){const d=S.doc,W=d.w,H=d.h,c=mk(W,H),g=cx(c);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.translate(W/2+m.dx*W/100,H/2+m.dy*H/100);g.rotate(m.rot*Math.PI/180);g.scale((m.fx?-1:1)*m.s/100,(m.fy?-1:1)*m.s/100);g.drawImage(so.src,-W/2,-H/2);return c}
function convert(){const d=S.doc,L=AL();if(!d||!L||L.kind!=='pixel'||L.editMask){toast('Choisissez un calque de pixels');return}
  if(L.hi){toast('Les calques 16 bits ne peuvent pas devenir objets dynamiques');return}
  if(valid(L)){toast('Ce calque est déjà un objet dynamique');return}
  L.txt=null;L.shp=null;const src=cloneC(L.canvas);L.so={src,m:{s:100,rot:0,dx:0,dy:0,fx:false,fy:false},out:L.canvas};
  if(!/objet dynamique/.test(L.name))L.name=(L.name||'Calque')+' · objet dynamique';
  pushHistory('Convertir en objet dynamique');syncAll();toast('Objet dynamique : les transformations repartent toujours des pixels d’origine')}
function raster(){const L=AL();if(!L||!L.so){toast('Ce calque n’est pas un objet dynamique');return}L.so=null;L.name=(L.name||'').replace(/ · objet dynamique$/,'');pushHistory('Rastériser l’objet dynamique');syncAll()}
function dialog_(){const d=S.doc,L=AL();if(!d||!L||L.kind!=='pixel'){toast('Choisissez un calque de pixels');return}
  if(L.so&&!valid(L)){L.so=null;toast('Le calque a été retouché depuis sa conversion : il repart des pixels actuels')}
  if(!L.so)convert();if(!L.so)return;
  const so=L.so,m0={...so.m},orig=L.canvas;let m={...so.m};
  const prev=()=>{L.preview=render(so,m);markComp()};
  dialog({title:'Objet dynamique',light:true,body:`<p class="muted" style="margin:0 0 8px">Chaque réglage repart des pixels d’origine : vous pouvez réduire puis agrandir sans perte de qualité.</p>
  ${rangeRow('soS','Échelle',5,400,1,m.s,' %')}${rangeRow('soR','Rotation',-180,180,1,m.rot,'°')}${rangeRow('soX','Décalage horizontal',-100,100,1,m.dx,' %')}${rangeRow('soY','Décalage vertical',-100,100,1,m.dy,' %')}
  <div style="display:flex;gap:14px;margin-top:8px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="soFx" ${m.fx?'checked':''}> Miroir horizontal</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="soFy" ${m.fy?'checked':''}> Miroir vertical</label></div>`,
  onOpen:el=>{const f=()=>{m={s:+$('#soS',el).value,rot:+$('#soR',el).value,dx:+$('#soX',el).value,dy:+$('#soY',el).value,fx:$('#soFx',el).checked,fy:$('#soFy',el).checked};prev()};el.addEventListener('input',f);el.addEventListener('change',f)},
  buttons:[{label:'Annuler',onClick:()=>{delete L.preview;markComp()}},{label:'Réinitialiser',onClick:()=>{delete L.preview;so.m={s:100,rot:0,dx:0,dy:0,fx:false,fy:false};L.canvas=render(so,so.m);so.out=L.canvas;markComp();pushHistory('Objet dynamique : réinitialiser');syncAll()}},
   {label:'Appliquer',primary:true,onClick:()=>{delete L.preview;so.m=m;L.canvas=render(so,m);so.out=L.canvas;if(L.fbase){L.fbase=null;L.filters=null;L.fout=null}markComp();pushHistory('Objet dynamique');syncAll()}}]})}
const _dl=dupLayer;dupLayer=function(){const L=AL(),so=L&&valid(L)?L.so:null;_dl.apply(this,arguments);const N=AL();if(so&&N&&N!==L&&N.canvas&&!N.so){N.so={src:so.src,m:{...so.m},out:N.canvas}}};
const _ly=MENU2.layer.items;MENU2.layer.items=()=>{const a=_ly();const L=S.doc&&AL(),dy=L&&valid(L);a.push(SEP,dy?MI('Transformer l’objet dynamique…',{fn:dialog_}):MI('Convertir en objet dynamique',{dis:S.doc?false:NODOC,fn:convert}),...(dy?[MI('Rastériser l’objet dynamique',{fn:raster})]:[]));return a};
window.PrismSO={convert,raster,dialog:dialog_,render,valid};
})();

/* wave42: tidy the menus added by waves 37-41 into submenus */
(()=>{
function group(a,labels,title,icon,pos){const found=[];for(const l of labels){const k=a.findIndex(x=>x&&(typeof l==='string'?x.label===l:l.test(x.label||'')));if(k>=0)found.push(a.splice(k,1)[0])}
  if(!found.length)return;const first=a.findIndex(x=>x&&x.label===pos);a.splice(first>=0?first+1:a.length,0,MI(title,{icon,sub:()=>found}))}
function clean(a){for(let i=a.length-1;i>0;i--)if(!a[i]&&!a[i-1])a.splice(i,1);while(a.length&&!a[a.length-1])a.pop();return a}
const L0=MENU2.layer.items;MENU2.layer.items=()=>{const a=L0();
  group(a,['Masque dégradé…','Masque de forme…','Fusion selon la luminosité…'],'Masques et fusion','mask','Combiner les formes…');
  group(a,[/objet dynamique/i],'Objet dynamique','layer','Masques et fusion');
  return clean(a)};
const I0=MENU2.image.items;MENU2.image.items=()=>{const a=I0();group(a,['Mode : niveaux de gris','Mode : couleurs indexées…'],'Mode de l’image','layer','Canaux…');return clean(a)};
const F0=MENU2.file.items;MENU2.file.items=()=>{const a=F0();group(a,['Fusion d’expositions (HDR)…','Panorama…'],'Photos multiples','layer','Exporter avec un profil ICC…');
  group(a,['Sauvegarder la photothèque…','Restaurer une sauvegarde…'],'Sauvegarde de la photothèque','save','Photos multiples');return clean(a)};
})();
/* wave42b: panels give the photo more room on smaller screens (no new mode: it only changes defaults and widths) */
(()=>{const st=document.createElement('style');st.textContent='@media (max-width:1500px){:root{--side:288px}}@media (max-width:1280px){:root{--side:268px}}';document.head.appendChild(st)})();
/* wave42c: on short windows the quick actions keep their four main buttons */
(()=>{const st=document.createElement('style');st.textContent='@media (max-height:999px){.qa>*:nth-child(n+5){display:none}}';document.head.appendChild(st)})();

/* wave43: data-safety fixes + persistent undo history and snapshots */
(()=>{
/* a cached encoding is only valid while every tile blob still exists (garbage collection could have removed it) */
const tileOK=async t=>{const n=await IDB.tx('blobs','readonly',s=>s.count(t.key));return n>0};
const _enc=encodeCanvas;
encodeCanvas=async function(c){const hit=encCache.get(c);if(hit){try{let ok=true;for(const t of hit)if(!await tileOK(t)){ok=false;break}if(!ok)encCache.delete(c)}catch(e){encCache.delete(c)}}return _enc.call(this,c)};

const HK=id=>'hist_'+id;
const canv=L=>[lcv(L),L.mask,L.fbase,L.so&&L.so.src];
/* keys that must survive garbage collection: tiles of every canvas still reachable from undo history or snapshots, plus saved history records */
async function keep(keepSet,projects){
  const add=s=>{if(!s||!s.layers)return;for(const L of s.layers)for(const c of canv(L)){const t=c&&encCache.get(c);t&&t.forEach(x=>keepSet.add(x.key))}};
  (S.history||[]).forEach(add);
  try{const d=S.doc;if(d&&window.PrismB)PrismB.snaps(d).forEach(e=>add(e.s))}catch(e){}
  const ids=new Set((projects||[]).map(m=>m.id)),hk=[];
  for(const k of await IDB.keys('blobs')){const ks=String(k);if(!ks.startsWith('hist_'))continue;
    if(!ids.has(ks.slice(5)))continue;hk.push(k);
    try{const b=await IDB.get('blobs',k),r=JSON.parse(await b.text());(r.entries||[]).forEach(e=>manifestKeys(e.m).forEach(x=>keepSet.add(x)));(r.snaps||[]).forEach(e=>manifestKeys(e.m).forEach(x=>keepSet.add(x)))}catch(e){}}
  return hk}

async function decode(m){const get=t=>IDB.get('blobs',t.key),layers=[];
  for(const e of m.layers){const L={id:S.nextId++,kind:e.kind,name:e.name,visible:e.visible!==false,opacity:e.opacity??1,blend:e.blend||'source-over',editMask:!!e.editMask,mask:null,...xtra(e)};
    if(e.kind==='adjust')L.dev=Object.assign(DEV0(),e.dev||{});
    if(e.canvas)await loadLayerCanvas(L,e,m.w,m.h,get);
    if(e.mask){L.mask=await decodeTiles(e.mask,m.w,m.h,get);encCache.set(L.mask,e.mask)}
    if(e.so&&L.canvas){try{const sc=await decodeTiles(e.so.t,m.w,m.h,get);encCache.set(sc,e.so.t);L.so={src:sc,m:e.so.m,out:L.canvas}}catch(err){}}
    if(e.fbase&&e.filters&&L.canvas){try{L.fbase=await decodeTiles(e.fbase,m.w,m.h,get);encCache.set(L.fbase,e.fbase);L.filters=e.filters;L.fout=L.canvas}catch(err){}}
    layers.push(L);await tick()}
  return{w:m.w,h:m.h,active:Math.min(Math.max(0,m.active??layers.length-1),layers.length-1),sel:null,layers}}

let tiny=null,noThumb=false;
const _pt=projectThumb;projectThumb=async function(){if(!noThumb)return _pt.apply(this,arguments);if(!tiny)tiny=await toBlob(mk(2,2),'image/jpeg',.5);return tiny};
async function encodeState(s,d){const pseudo={...d,layers:s.layers,w:s.w,h:s.h,active:s.active};noThumb=true;try{const m=await buildManifest(pseudo);return m}finally{noThumb=false}}
const sig=m=>(m.layers||[]).map(L=>L.kind+':'+(L.canvas||[]).map(t=>t.key).join(',')+'/'+(L.mask||[]).map(t=>t.key).join(',')).join('|');

let busyHist=false;
async function saveHist(){const d=S.doc;if(!d||!d.pid||d.nosave||!d.saved||busyHist)return;if(SAVE.running||SAVE.timer||SAVE.again){schedule(3000);return}
  if(d.layers.some(L=>L.hi)||d.w*d.h>24e6)return;
  const hs=S.history,hi=S.hi;if(!hs||hs.length<2&&!(window.PrismB&&PrismB.snaps(d).length)){try{await IDB.del('blobs',HK(d.pid))}catch(e){}return}
  busyHist=true;
  try{const from=Math.max(0,hi-5),to=Math.min(hs.length-1,hi+2),entries=[];let idx=0;
    for(let i=from;i<=to;i++){const s=hs[i];if(i===hi)idx=entries.length;
      if(s.layers){if(!s._m)s._m=await encodeState(s,d);entries.push({label:s.label,m:s._m})}else if(s.lazy)entries.push({label:s.label,m:s.lazy});
      if(S.doc!==d||S.history!==hs||S.hi!==hi)throw new Error('changed')}
    const snaps=[];for(const e of window.PrismB?PrismB.snaps(d):[]){if(e.s&&!e.m)e.m=await encodeState(e.s,d);if(e.m)snaps.push({name:e.name,t:e.t,m:e.m});else if(e.lazy)snaps.push({name:e.name,t:e.t,m:e.lazy})}
    if(S.doc!==d||S.history!==hs||S.hi!==hi)throw new Error('changed');
    const rec={v:1,hi:idx,entries,snaps};await IDB.put('blobs',HK(d.pid),new Blob([JSON.stringify(rec)],{type:'application/json'}));
    entries.forEach(e=>manifestKeys(e.m).forEach(k=>PIN.delete(k)));snaps.forEach(e=>manifestKeys(e.m).forEach(k=>PIN.delete(k)))
  }catch(e){if(e.message!=='changed')console.warn('historique',e)}finally{busyHist=false}}
let ht=null;function schedule(ms=5000){clearTimeout(ht);ht=setTimeout(()=>{const run=()=>saveHist();window.requestIdleCallback?requestIdleCallback(run,{timeout:8000}):run()},ms)}
const _sn=saveNow;saveNow=async function(){while(noThumb)await new Promise(r=>setTimeout(r,40));const r=await _sn.apply(this,arguments);schedule();return r};

async function restoreHist(id){
  try{const d=S.doc;if(!d||d.pid!==id||S.history.length!==1)return;const b=await IDB.get('blobs',HK(id));if(!b)return;const rec=JSON.parse(await b.text());
    const cur=await IDB.get('projects',id);if(!cur||!rec.entries||!rec.entries[rec.hi])return;
    if(sig(rec.entries[rec.hi].m)!==sig(cur))return;
    const nowSnap=S.history[0],list=rec.entries.map((e,i)=>i===rec.hi?Object.assign(nowSnap,{label:e.label,_m:e.m}):{label:e.label,lazy:e.m,w:e.m.w,h:e.m.h,active:e.m.active,sel:null,layers:null});
    S.history=list;S.hi=rec.hi;
    if(window.PrismB){const a=PrismB.snaps(d);if(!a.length)(rec.snaps||[]).forEach(e=>a.push({name:e.name,t:e.t,s:null,lazy:e.m,m:e.m}))}
    renderHistory();updateUndo()}catch(e){console.warn('historique',e)}}
const _olp=openLocalProject;openLocalProject=async function(id){const r=await _olp.apply(this,arguments);if(r!==false)restoreHist(id);return r};

let DEC=false;const _r=restore;
restore=function(i){const s=S.history[i];if(s&&s.lazy&&!s.layers){if(DEC)return;DEC=true;busy(true,'Chargement de l’étape…',null);const hs=S.history;
    decode(s.lazy).then(x=>{Object.assign(s,x);delete s.lazy;DEC=false;busy(false);if(S.history===hs)_r.call(window,i)}).catch(e=>{DEC=false;busy(false);console.warn(e);toast('Cette étape n’est plus disponible')});return}
  return _r.apply(this,arguments)};
window.PrismHist={keep,decode,saveHist,schedule,restoreHist};
})();

/* wave44: the assistant does what was asked, no more */
(()=>{
const _prompt=assistPrompt;
const INTENSE=/beaucoup|tr[eè]s|fort(?:ement)?|vraiment|extr[eê]me|[àa] fond|maximum|\bmax\b|[ée]norm[ée]ment|nettement|radical|intense|bien plus|bien moins/i;
let lastText='';
assistPrompt=function(text){lastText=text||'';const d=S.doc;
  const layers=d.layers.map((L,i)=>L.kind==='adjust'?{index:i,name:L.name,kind:'adjust',masked:!!L.mask,visible:L.visible!==false,params:nonDefaultDev(L.dev)}:{index:i,name:L.name,kind:'pixel'});
  const act=d.layers[d.active];
  const sel=d.sel?'OUI : une sélection est active. Si la demande vise « la sélection », « cette zone » ou ne précise pas de zone, utilise {"type":"selection"}.':'non';
  const base=_prompt.apply(this,arguments);
  const i=base.indexOf('Demande de l\'utilisateur');
  const head=base.slice(0,i);
  const rules=`RÈGLES STRICTES (elles priment sur tout le reste) :
1. Fais EXACTEMENT ce que l'utilisateur demande, et rien d'autre. N'améliore pas la photo de ta propre initiative : pas de correction d'exposition, de contraste, de couleur ou de netteté non demandée.
2. Touche uniquement aux paramètres nécessaires à la demande (en général 1 à 4). Laisse tous les autres à leur valeur actuelle.
3. Sans indication d'intensité, reste modéré : environ 15 à 30 sur les curseurs, 0.3 à 0.5 IL pour l'exposition. N'utilise des valeurs fortes que si l'utilisateur dit « beaucoup », « très », « fort », etc.
4. La zone visée est celle que l'utilisateur nomme (ciel, visage, fond, sujet…). Sans zone, c'est toute l'image ({"type":"global"}).
5. Ne modifie, ne masque et ne supprime JAMAIS un calque que la demande ne concerne pas. Les calques de réglage créés par l'utilisateur ne sont pas à toi.
6. Pour une nouvelle demande, crée un nouveau calque ("add"). Utilise "edit" seulement si l'utilisateur prolonge clairement une retouche précédente de cette session (« encore plus », « un peu moins », « annule ça »).
7. « Annule » ou « enlève » une retouche précédente = "remove" ou "visible":false sur le calque correspondant, sans rien ajouter.
8. Si tu hésites sur le sens de la demande, choisis l'interprétation la plus simple et la plus modeste.

Contexte : calque actif = ${act?JSON.stringify({index:d.active,name:act.name,kind:act.kind}):'aucun'} ; sélection active : ${sel}.
`;
  const fmt=`Demande de l'utilisateur : « ${text} »

Réponds uniquement avec un objet JSON :
{"interpretation":"ta lecture de la demande en une phrase","message":"une phrase courte en français qui dit ce que tu as fait","ops":[...]}
Opérations possibles :
- {"op":"add","name":"nom court du calque","area":{...},"params":{...}}
- {"op":"edit","index":N,"params":{...}} : remplace ces paramètres d'un calque de réglage existant (les autres restent).
- {"op":"remove","index":N} : supprime un calque de réglage.
- {"op":"visible","index":N,"visible":true|false}
Zone supplémentaire : {"type":"selection"} (la sélection active).
Si la demande est impossible avec ces outils, renvoie "ops":[] et explique-le dans "message".`;
  return head+rules+'\n'+fmt};
const _am=areaMask;
areaMask=async function(a){if(a&&a.type==='selection'){const d=S.doc;if(!d.sel)throw new Error('aucune sélection active');return cloneC(d.sel)}return _am.apply(this,arguments)};
/* safety net on the numbers the model returns */
const _cp=cleanParams;
cleanParams=function(p){const out=_cp.apply(this,arguments);
  const keys=Object.keys(out).filter(k=>typeof out[k]==='number');
  if(!INTENSE.test(lastText)){for(const {k,min,max} of ASSIST_KEYS){if(typeof out[k]!=='number')continue;const lim=k==='exposure'?1:Math.max(Math.abs(min),Math.abs(max))*.4;out[k]=clamp(out[k],Math.max(min,-lim),Math.min(max,lim))}}
  if(keys.length>8){const rank=keys.map(k=>{const K=ASSIST_KEYS.find(x=>x.k===k);return[k,K?Math.abs(out[k])/Math.max(Math.abs(K.min),Math.abs(K.max)||1):0]}).sort((a,b)=>b[1]-a[1]);rank.slice(8).forEach(([k])=>delete out[k])}
  return out};
window.PrismAssist={prompt:()=>assistPrompt('test'),clean:cleanParams,setText:t=>{lastText=t}};
})();

/* wave45: new features reachable from the command palette and the quick actions */
(()=>{
const _ci=cmdItems;
cmdItems=function(){const a=_ci.apply(this,arguments);if(window.LIB&&LIB.open)return a;
  const names={file:'Fichier',edit:'Édition',image:'Image',layer:'Calque',select:'Sélection',filter:'Filtre',view:'Affichage',help:'Aide'};
  const have=new Set(a.map(i=>i.label.toLowerCase()));
  const walk=(g,items,pre)=>{for(const it of items||[]){if(!it||typeof it!=='object'||Array.isArray(it))continue;
    if(typeof it.sub==='function'){let ch=[];try{ch=it.sub()}catch(e){}if(Array.isArray(ch))walk(g,ch,(pre?pre+' › ':'')+String(it.label||'').replace(/…$/,''));continue}
    if(typeof it.fn!=='function'||!it.label)continue;
    const lab=String(it.label).replace(/^✓ /,'').replace(/…$/,'');if(have.has(lab.toLowerCase()))continue;have.add(lab.toLowerCase());
    a.push({g,label:lab,kbd:it.kbd||'',fn:it.fn,dis:!!it.dis})}};
  for(const k of Object.keys(MENU2)){let items=[];try{items=MENU2[k].items()}catch(e){}walk(names[k]||k,items,'')}
  return a};
/* quick actions: pick them in "Personnaliser" */
const add=(id,label,icon,fn,tip)=>{if(!QA_ALL.some(x=>x[0]===id))QA_ALL.push([id,label,icon,fn,tip])};
const m=(menu,label)=>{const it=MENU2[menu].items().flatMap(x=>x&&x.sub?(()=>{try{const s=x.sub();return Array.isArray(s)?s:[]}catch(e){return[]}})():[x]).find(x=>x&&x.label===label);return it};
const run=(menu,label)=>()=>{const it=m(menu,label);it&&it.fn&&it.fn()};
add('snap','Instantané','copy',run('edit','Enregistrer un instantané'),'Garder cet état pour y revenir plus tard');
add('gradMask','Masque dégradé','grad',run('layer','Masque dégradé…'),'Limiter le calque actif par un dégradé');
add('channels','Canaux','layer',run('image','Canaux…'),'Séparer en canaux rouge, vert, bleu');
add('puppet','Marionnette','flip',run('layer','Déformation marionnette…'),'Déformer par épingles');
add('vcopy','Copie virtuelle','copy',run('file','Créer une copie virtuelle'),'Dupliquer le projet dans la photothèque');
})();

/* wave46: sliders: larger, filled, label above the track in the develop panel, no histogram read-back while dragging */
(()=>{
const css=document.createElement('style');
css.textContent=`
input[type=range]{height:22px;--fill:var(--accent);--lo:0;--hi:0}
input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--track)}
input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:var(--track)}
input[type=range]:not([style*="--track"])::-webkit-slider-runnable-track{background:linear-gradient(90deg,var(--line-2) 0 calc(var(--lo)*1% + (7 - .14*var(--lo))*1px),var(--fill) calc(var(--lo)*1% + (7 - .14*var(--lo))*1px) calc(var(--hi)*1% + (7 - .14*var(--hi))*1px),var(--line-2) calc(var(--hi)*1% + (7 - .14*var(--hi))*1px) 100%)}
input[type=range]:not([style*="--track"])::-moz-range-track{background:linear-gradient(90deg,var(--line-2) 0 calc(var(--lo)*1% + (7 - .14*var(--lo))*1px),var(--fill) calc(var(--lo)*1% + (7 - .14*var(--lo))*1px) calc(var(--hi)*1% + (7 - .14*var(--hi))*1px),var(--line-2) calc(var(--hi)*1% + (7 - .14*var(--hi))*1px) 100%)}
input[type=range]::-webkit-slider-thumb{width:14px;height:14px;margin-top:-5px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.28);transition:box-shadow .12s,transform .12s}
input[type=range]::-moz-range-thumb{width:14px;height:14px;background:#fff;border:0;box-shadow:0 1px 4px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.28);transition:box-shadow .12s,transform .12s}
input[type=range]:hover::-webkit-slider-thumb{transform:scale(1.1);box-shadow:0 1px 4px rgba(0,0,0,.55),0 0 0 5px var(--accent-soft)}
input[type=range]:active::-webkit-slider-thumb{transform:scale(1.15);box-shadow:0 1px 5px rgba(0,0,0,.6),0 0 0 7px var(--accent-soft),0 0 0 1.5px var(--accent)}
input[type=range]:hover::-moz-range-thumb{transform:scale(1.1);box-shadow:0 1px 4px rgba(0,0,0,.55),0 0 0 5px var(--accent-soft)}
input[type=range]:active::-moz-range-thumb{transform:scale(1.15);box-shadow:0 1px 5px rgba(0,0,0,.6),0 0 0 7px var(--accent-soft)}
.pill input[type=range]{width:130px}
body.compact input[type=range]{height:30px}
body.compact input[type=range]::-webkit-slider-thumb{width:20px;height:20px;margin-top:-8px}
body.compact input[type=range]::-moz-range-thumb{width:20px;height:20px}
/* develop panel: name and value on one line, the slider full width below */
#pane-develop .row[data-k]{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"l o" "s s";column-gap:8px;row-gap:0;min-height:42px;align-content:center;padding:3px 0}
#pane-develop .row[data-k] label{grid-area:l;font-size:12.5px}
#pane-develop .row[data-k] output{grid-area:o;font-size:12.5px;padding:1px 6px;border-radius:5px;min-width:44px}
#pane-develop .row[data-k] output:hover{background:var(--hover)}
#pane-develop .row[data-k] input[type=range]{grid-area:s;width:100%}
.lyr-ctrl{grid-template-columns:minmax(0,1fr);gap:4px}.lyr-ctrl .op input{flex:1;min-width:0;width:auto}.lyr-ctrl .op{white-space:nowrap}
`;(document.body||document.head).appendChild(css);
const paint=el=>{if(!el||el.type!=='range')return;const mn=+el.min||0,mx=el.max===''?100:+el.max,v=+el.value;if(!(mx>mn))return;
  const p=(v-mn)/(mx-mn)*100,c=(mn<0&&mx>0)?(0-mn)/(mx-mn)*100:0;el.style.setProperty('--lo',Math.min(p,c).toFixed(2));el.style.setProperty('--hi',Math.max(p,c).toFixed(2))};
const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
Object.defineProperty(HTMLInputElement.prototype,'value',{get(){return d.get.call(this)},set(v){d.set.call(this,v);if(this.type==='range')paint(this)},configurable:true});
document.addEventListener('input',e=>paint(e.target),true);document.addEventListener('change',e=>paint(e.target),true);
const all=root=>{(root.querySelectorAll?root.querySelectorAll('input[type=range]'):[]).forEach(paint);if(root.matches&&root.matches('input[type=range]'))paint(root)};
new MutationObserver(ms=>{for(const m of ms){m.addedNodes.forEach(n=>{if(n.nodeType===1)all(n)});if(m.type==='attributes')paint(m.target)}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['min','max','value']});
all(document);
/* while a slider is being dragged the histogram is not read back (it stalls the graphics pipeline) */
document.addEventListener('pointerdown',e=>{if(e.target&&e.target.type==='range')S.sliding=true},true);
const up=()=>{if(S.sliding){S.sliding=false;try{markContent()}catch(e){}}};addEventListener('pointerup',up,true);addEventListener('pointercancel',up,true);
})();

