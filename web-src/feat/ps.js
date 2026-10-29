/* ===== Algorithmes repris de Photo Studio (ps.puter.com, licence MIT : web/ps/LICENSE-photo-studio.txt).
   web/ps/ps.js (compilé depuis web-src/ps/) définit window.PSI ; les calculs longs tournent dans web/ps/worker.js, hors de l'interface.
   Ce fichier : chargement, travaux en arrière-plan annulables, conversions canvas <-> pixels, et une fenêtre de réglages commune
   (aperçu sur une copie réduite ou sur la zone visible, application en pleine résolution avec la barre de progression). ===== */
const PSX={jobs:0};
let psMainP=null;
/* le module sur la page : pour les actions enregistrées et les effets modifiables, qui appellent les filtres sans attendre */
PSX.load=()=>window.PSI?Promise.resolve(window.PSI):(psMainP||(psMainP=loadScript(asset('ps/ps.js')).then(()=>window.PSI,e=>{psMainP=null;throw e})));
PSX.sync=(op,args)=>{if(!window.PSI)throw new Error('le module de calcul se charge encore : réessayez dans un instant');return PSI.run(op,args)};
{const pre=()=>PSX.load().catch(e=>console.warn('ps.js',e));if(window.requestIdleCallback)requestIdleCallback(pre,{timeout:4000});else setTimeout(pre,1500)}

/* travaux : un worker par calcul (2 gardés au repos) ; annuler = arrêter le worker, l'interface ne se fige jamais */
const PSW={idle:[],url:null,ok:true};
function psWorker(){const w=PSW.idle.pop();if(w)return w;const n=new Worker(asset('ps/worker.js'));
  // an error of a worker kept at rest (its script failed to load) is not the page's: it leaves the pool quietly; a running job still gets it through onerror
  n.addEventListener('error',e=>{e.preventDefault();const i=PSW.idle.indexOf(n);if(i>=0){PSW.idle.splice(i,1);try{n.terminate()}catch(x){}}});return n}
function psTransfer(v,out=[]){if(!v||typeof v!=='object')return out;if(ArrayBuffer.isView(v)){if(!out.includes(v.buffer))out.push(v.buffer);return out}for(const k in v)psTransfer(v[k],out);return out}
/* run(op, args, {onProgress, copy}) -> {promise, cancel}. Les tableaux passés sont transférés (inutilisables ensuite) sauf copy:true. */
PSX.run=(op,args,o={})=>{let w=null,done=false,rej=null;const id=++PSX.jobs;
  const promise=new Promise(async(res,rj)=>{rej=rj;
    if(PSW.ok){try{w=psWorker()}catch(e){console.warn('worker ps',e);PSW.ok=false}}
    if(!w){/* sans worker (navigateur ancien, fichier local) : sur la page, en laissant d'abord l'écran se mettre à jour */
      try{await PSX.load();await tick();if(done)return;const r=await PSI.run(op,args,o.onProgress||(()=>{}));done=true;res(r)}catch(e){done=true;rj(e)}return}
    w.onmessage=e=>{const m=e.data||{};if(m.id!==id)return;if(m.progress!=null){o.onProgress&&o.onProgress(m.progress);return}
      done=true;w.onmessage=w.onerror=null;if(PSW.idle.length<2)PSW.idle.push(w);else w.terminate();
      if(m.err)rj(Object.assign(new Error(m.err==='cancelled'?'annulé':m.err),m.err==='cancelled'?{code:'cancelled'}:{}));else res(m.out)};
    w.onerror=e=>{if(done)return;done=true;try{w.terminate()}catch(x){}rj(new Error(e.message||'calcul impossible'))};
    try{w.postMessage({id,op,args},o.copy?[]:psTransfer(args))}catch(e){done=true;try{w.terminate()}catch(x){}rj(e)}});
  return{promise,cancel(){if(done)return;done=true;if(w){try{w.terminate()}catch(e){}}if(rej)rej(Object.assign(new Error('annulé'),{code:'cancelled'}))}}};
PSX.cancelled=e=>e&&e.code==='cancelled';
/* calcul long en cours : bouton Annuler sous la barre de progression, et Échap */
PSX.cur=null;
PSX.track=j=>{PSX.cur=j;const box=document.querySelector('#busy>div');if(!box)return j;let e=box.querySelector('.ps-cancel');
  if(!e){e=document.createElement('button');e.className='btn sm ps-cancel';e.textContent='Annuler';e.style.marginTop='10px';box.appendChild(e)}
  e.disabled=false;e.textContent='Annuler';e.onclick=()=>{e.disabled=true;e.textContent='Annulation…';j.cancel()};return j};
PSX.untrack=j=>{if(j&&PSX.cur!==j)return;PSX.cur=null;const e=document.querySelector('#busy .ps-cancel');if(e)e.remove()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&PSX.cur){e.preventDefault();e.stopPropagation();PSX.cur.cancel()}},true);

/* ---------- conversions ---------- */
PSX.img=(c,x=0,y=0,w=c.width,h=c.height)=>{const id=rx(c).getImageData(x,y,w,h);return{width:w,height:h,data:id.data}};
PSX.canvas=im=>{const c=mk(im.width,im.height);rx(c).putImageData(new ImageData(im.data instanceof Uint8ClampedArray?im.data:new Uint8ClampedArray(im.data.buffer,im.data.byteOffset,im.data.length),im.width,im.height),0,0);return c};
/* masque Prism (canvas, couverture = alpha) -> Mask8 à la taille voulue (les masques de l'IA sont parfois plus petits que la photo) */
PSX.mask=(c,w=c.width,h=c.height,x=0,y=0)=>{let s=c;if(c.width!==w+x||c.height!==h+y||x||y){s=mk(w,h);const g=rx(s);g.imageSmoothingQuality='high';if(x||y)g.drawImage(c,-x,-y);else g.drawImage(c,0,0,w,h)}
  const a=rx(s).getImageData(0,0,w,h).data,m=new Uint8Array(w*h);for(let i=0;i<m.length;i++)m[i]=a[i*4+3];return{width:w,height:h,data:m}};
PSX.maskCanvas=m=>{const c=mk(m.width,m.height),g=rx(c),im=g.createImageData(m.width,m.height),a=im.data;for(let i=0;i<m.data.length;i++){a[i*4]=a[i*4+1]=a[i*4+2]=255;a[i*4+3]=m.data[i]}g.putImageData(im,0,0);return c};
PSX.small=(c,max)=>{const k=max/Math.max(c.width,c.height);if(k>=1)return{c,k:1};const s=resample(c,Math.max(8,Math.round(c.width*k)),Math.max(8,Math.round(c.height*k)));return{c:s,k:s.width/c.width}};
PSX.up=(c,w,h)=>{if(c.width===w&&c.height===h)return c;const o=mk(w,h),g=cx(o);g.imageSmoothingQuality='high';g.drawImage(c,0,0,w,h);return o};
/* zone de la photo au centre de l'écran (pour un aperçu à 100 % d'un réglage fin : netteté, bruit) */
PSX.visibleRect=(w,h,side=900)=>{const cw=Math.min(w,side),ch=Math.min(h,side);const cxp=(view.width/S.pr/2-S.panX)/S.zoom,cyp=(view.height/S.pr/2-S.panY)/S.zoom;
  return{x:Math.round(Math.max(0,Math.min(w-cw,cxp-cw/2))),y:Math.round(Math.max(0,Math.min(h-ch,cyp-ch/2))),w:cw,h:ch}};
PSX.rec=(id,p)=>{const F=FILTERS[id];if(F)F._lp={...p};const R=(window.PrismC&&window.PrismC.REC)||null;if(R)R.last={id,p:{...p}}};
PSX.alive=(d,L)=>S.doc===d&&d.layers.includes(L);
PSX.mixSel=(o,r,sel)=>window.PrismFX&&PrismFX.mixSel?PrismFX.mixSel(o,r,sel):r;

/* ---------- menus : ajouter des entrées dans un sous-menu existant (ou en créer un) ---------- */
PSX.addToMenu=(menu,subLabel,make,before)=>{const M=MENU2[menu];if(!M)return;const _i=M.items;
  M.items=()=>{const a=_i(),add=make();if(!subLabel){const k=before?a.findIndex(x=>x&&before.test(x.label||'')):-1;if(k<0)return a.concat([SEP],add);a.splice(k,0,...add);return a}
    const it=a.find(x=>x&&x.label===subLabel&&x.sub);if(it){const s=it.sub;return a.map(x=>x===it?{...x,sub:()=>s().concat(add)}:x)}
    const k=before?a.findIndex(x=>x&&before.test(x.label||'')):-1,ni=MI(subLabel,{icon:'filter',dis:S.doc?false:NODOC,sub:()=>add});if(k<0)return a.concat([ni]);a.splice(k,0,ni);return a}};

/* ---------- fenêtre de réglages commune ----------
   def : {name, params:[[clé,libellé,min,max,pas,défaut,unité]], choices:{clé:[libellés]}, checks:[clés], note, preview:'crop'|'scale',
          job:(img,p,scale,sel)=>[op,args] (args sans l'image ; img est ajoutée), extraBody, onOpen(el,p,refresh)} */
function psRow(def,q,v){const[k,label,min,max,step,,unit]=q;
  if(def.choices&&def.choices[k])return`<div class="row"><label for="ps-${k}">${label}</label><select id="ps-${k}">${def.choices[k].map((t,i)=>`<option value="${i}" ${+v===i?'selected':''}>${esc(t)}</option>`).join('')}</select><output></output></div>`;
  if(def.checks&&def.checks.includes(k))return`<div class="row"><label for="ps-${k}">${label}</label><input type="checkbox" id="ps-${k}" ${v?'checked':''} style="justify-self:start"><output></output></div>`;
  return rangeRow('ps-'+k,label,min,max,step,v,unit)}
PSX.read=(def,el,p)=>{def.params.forEach(q=>{const k=q[0],i=$('#ps-'+k,el);if(!i)return;p[k]=i.type==='checkbox'?(i.checked?1:0):+i.value})};
PSX.target=()=>{const d=S.doc;if(!d)return null;if(maskTarget()){toast('Ce réglage s’applique à la photo, pas au masque : choisissez le calque de photo');return null}
  const L=pixelTarget();if(!L){toast('Aucun calque de pixels à modifier');return null}if(L.visible===false){toast('Ce calque est masqué : affichez-le d’abord');return null}return L};
/* calcule le filtre id sur un canvas, en arrière-plan ; résultat : canvas (null si annulé) */
PSX.compute=(id,src,p,o={})=>{const F=FILTERS[id],sc=o.scale||1,sel=o.sel||null,jb=F.job(PSX.img(src),p,sc,sel);if(!jb)return Promise.reject(new Error(F.needs||'rien à calculer'));const[op,args]=jb;
  const j=PSX.run(op,args,{onProgress:o.onProgress});o.onJob&&o.onJob(j);return j.promise.then(r=>PSX.canvas(r&&r.image?r.image:r))};
PSX.dialog=id=>{const F=FILTERS[id],d=S.doc;if(!d||!F)return;const L=PSX.target();if(!L)return;
  const p={...(F.last||{})};F.params.forEach(q=>{if(p[q[0]]==null)p[q[0]]=q[5]});
  const orig=L.canvas;let tmr=null,job=null,seq=0,closed=false,small=null;
  const stop=()=>{clearTimeout(tmr);seq++;if(job){job.cancel();job=null}};
  const clear=()=>{closed=true;stop();delete L.preview};
  const refresh=()=>{stop();const my=seq;tmr=setTimeout(async()=>{if(closed||!PSX.alive(d,L))return;const st=$('#ps-state');if(st)st.textContent='Calcul de l’aperçu…';
    try{let r;
      if(F.preview==='crop'){const R=PSX.visibleRect(orig.width,orig.height,F.cropSide||900),piece=mk(R.w,R.h);cx(piece).drawImage(orig,-R.x,-R.y);
        const out=await PSX.compute(id,piece,p,{onJob:j=>job=j});if(my!==seq||closed)return;r=cloneC(orig);const g=cx(r);g.clearRect(R.x,R.y,R.w,R.h);g.drawImage(out,R.x,R.y)}
      else{if(!small)small=PSX.small(orig,F.previewSide||1400);const out=await PSX.compute(id,small.c,p,{scale:small.k,onJob:j=>job=j});if(my!==seq||closed)return;r=PSX.up(out,orig.width,orig.height)}
      job=null;if(d.sel)r=PSX.mixSel(orig,r,d.sel);L.preview=r;markComp();const st2=$('#ps-state');if(st2)st2.textContent=F.preview==='crop'&&(orig.width>(F.cropSide||900)||orig.height>(F.cropSide||900))?'Aperçu à 100 % sur la zone au centre de l’écran.':''}
    catch(e){if(PSX.cancelled(e))return;console.error(e);const st2=$('#ps-state');if(st2)st2.textContent='';toast('Aperçu impossible : '+(e.message||e),3000)}},F.delay||160)};
  dialog({title:F.name,light:true,
    body:(F.note?`<p class="muted" style="margin:0 0 8px">${F.note}</p>`:'')+F.params.map(q=>psRow(F,q,p[q[0]])).join('')+(F.extraBody?F.extraBody(p):'')+(d.sel?'<p class="muted">Appliqué uniquement à la sélection.</p>':'')+'<p class="muted" id="ps-state" aria-live="polite" style="min-height:1.2em;margin:6px 0 0"></p>',
    onOpen:el=>{F.params.forEach(q=>{const i=$('#ps-'+q[0],el);if(!i)return;const ev=i.tagName==='SELECT'||i.type==='checkbox'?'onchange':'oninput';
        i[ev]=()=>{PSX.read(F,el,p);if(F.onInput)F.onInput(q[0],p,el);const o=$('#ps-'+q[0]+'-o',el);if(o)o.textContent=fmtN(+i.value,q[4])+(q[6]||'');refresh()}});
      if(F.onOpen)F.onOpen(el,p,refresh);refresh()},
    buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
      {label:'Appliquer',primary:true,onClick:()=>{clear();PSX.apply(id,d,L,orig,{...p})}}]})};
PSX.apply=async(id,d,L,orig,p)=>{const F=FILTERS[id];F.last={...p};busy(true,F.name+'…',0);let j=null;
  try{const r=await PSX.compute(id,orig,p,{onProgress:f=>busy(true,F.name+'…',f),onJob:x=>PSX.track(j=x)});
    if(!PSX.alive(d,L)||L.canvas!==orig){toast('Le calque a changé pendant le calcul : rien n’a été modifié');markComp();return}
    PSX.rec(id,p);applyMasked(L,r,F.name)}
  catch(e){if(!PSX.cancelled(e)){console.error(e);toast(F.name+' impossible : '+(e.message||e),4000)}markComp()}
  finally{PSX.untrack(j);busy(false)}};
/* un filtre de plus : utilisable dans les actions et les effets modifiables (calcul direct), avec la fenêtre ci-dessus */
PSX.filter=(id,def)=>{const F=Object.assign({preview:'scale'},def);
  F.run=(s,p)=>{const q={...p};F.params.forEach(x=>{if(q[x[0]]==null)q[x[0]]=x[5]});PSX.rec(id,q);const jb=F.job(PSX.img(s),q,1,null);if(!jb)return cloneC(s);/* ce qu'il faut n'existe plus (masque retiré…) : effet sans action */const[op,args]=jb;const r=PSX.sync(op,args);
    if(r&&typeof r.then==='function')throw new Error(F.name+' : calcul asynchrone, utilisez le menu');return PSX.canvas(r&&r.image?r.image:r)};
  FILTERS[id]=F;return F};
{const _fd=filterDialog;filterDialog=function(id){const F=FILTERS[id];if(F&&F.job)return PSX.dialog(id);return _fd.apply(this,arguments)}}
window.PSX=PSX;
