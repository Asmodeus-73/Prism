/* ================= AI (runs locally in the browser) ================= */
const AI={state:{seg:'idle',up:'idle'},subjectCache:null,_ort:null,_seg:null,_tf:null,_up:{}};
/* tf.js assigns this global; without it, it falls back to Function(), which the desktop app's CSP blocks */
if(!('regeneratorRuntime' in window))window.regeneratorRuntime=void 0;
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('script '+src));document.head.appendChild(s)})}
AI.setState=(k,v,p)=>{AI.state[k]=v;AI.state[k+'P']=p;renderAIState()};
/* ONNX Runtime: graphics card (WebGPU) when the device has one, else the processor (WASM, several threads when the page is isolated) */
const ORTX={_g:null,gpuP:()=>ORTX._g||(ORTX._g=(async()=>{try{if(PREF.get('aiGPU',true)===false||!navigator.gpu)return false;const a=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});return !!a}catch(e){return false}})()),
  threads:()=>self.crossOriginIsolated?Math.max(1,Math.min(8,(navigator.hardwareConcurrency||2)-1)):1};
ORTX.bundle=async()=>asset((await ORTX.gpuP())?'ai/ort.webgpu.min.js':'ai/ort.wasm.min.js');
// the WebGPU build of the runtime is 24 MB: stored in two pieces (hosting limit) and handed to ONNX Runtime as wasmBinary
ORTX.binURLs=()=>[0,1].map(i=>new URL(asset(`ai/ortgpu/${i}.wasm`),location.href).href);
ORTX.binary=async()=>{if(await NAI.ok())return null;return ORTX.binaryForce()};
ORTX.binaryForce=async()=>{if(!(await ORTX.gpuP()))return null;if(!ORTX._bin)ORTX._bin=Promise.all(ORTX.binURLs().map(u=>fetch(u).then(r=>{if(!r.ok)throw new Error('moteur IA '+r.status);return r.arrayBuffer()}))).then(a=>{const n=a.reduce((t,b)=>t+b.byteLength,0),o=new Uint8Array(n);let k=0;for(const b of a){o.set(new Uint8Array(b),k);k+=b.byteLength}return o.buffer}).catch(e=>{ORTX._bin=null;throw e});return ORTX._bin};
ORTX.eps=async()=>(await ORTX.gpuP())?['webgpu','wasm']:['wasm'];
ORTX.create=async(ort,buf,o)=>{if(!(o&&o.cpuOnly)&&await NAI.ok()){try{return await NAI.session(buf)}catch(e){console.warn('IA native indisponible pour ce modèle, moteur du navigateur',e)}if(!ort.env.wasm.wasmBinary){const b=await ORTX.binaryForce();if(b)ort.env.wasm.wasmBinary=b}}
  const {cpuOnly,...opt}=o||{},eps=cpuOnly?['wasm']:await ORTX.eps(),cpu=()=>ort.InferenceSession.create(buf,{...opt,executionProviders:['wasm']});
  if(eps[0]==='wasm'){const s=await cpu();s.__ep='wasm';return s}
  let s;try{s=await ort.InferenceSession.create(buf,{...opt,executionProviders:eps})}catch(e){console.warn('WebGPU indisponible pour ce modèle, retour au processeur',e);s=await cpu();s.__ep='wasm';return s}
  // some operators only fail when they run: the first failure moves this model to the processor for good
  const W={__ep:'webgpu',inputNames:s.inputNames,outputNames:s.outputNames,run:async(feeds,o)=>{if(W.__ep==='webgpu'){try{return await s.run(feeds,o)}catch(e){console.warn('WebGPU : échec à l’exécution, retour au processeur',e);W.__ep='wasm';try{s.release&&s.release()}catch(_){}s=await cpu()}}return s.run(feeds,o)}};
  return W};
window.PrismORT=ORTX;
/* native AI (desktop app): ONNX Runtime inside the app, on the graphics card (DirectML / Core ML) or every processor core.
   Same shape as an ONNX Runtime web session: inputNames, outputNames, run(feeds) -> {name: {data, dims, type}}. */
const NAI={st:null,seq:0};
NAI.ok=async()=>{if(NAI.st)return NAI.st.ok;const D=window.PRISM_DESKTOP;if(!D||!D.invoke||PREF.get('aiNative',true)===false){NAI.st={ok:false};return false}
  try{NAI.st=await D.invoke('ai_status')}catch(e){NAI.st={ok:false,error:String(e)}}if(!NAI.st.ok&&NAI.st.error)console.info('IA native :',NAI.st.error);return !!NAI.st.ok};
NAI.load=async(buf,key,cpu)=>window.PRISM_DESKTOP.invoke('ai_load',buf instanceof Uint8Array?buf:new Uint8Array(buf),{headers:{'x-key':key,'x-cpu':cpu?'1':'0'}});
NAI.TYPES={float32:Float32Array,uint8:Uint8Array,int32:Int32Array,int64:BigInt64Array};
NAI.session=async(buf)=>{const key='m'+(++NAI.seq)+'-'+(buf.byteLength||buf.length);let info=await NAI.load(buf,key,false);if(info.ep==='CPU')buf=null;// the bytes are only kept for a move from the card to the processor
  const W={native:true,__ep:info.ep,inputNames:info.inputs,outputNames:info.outputs,
    run:async(feeds)=>{const names=Object.keys(feeds),specs=[],parts=[];let n=0;
      for(const k of names){const t=feeds[k],d=t.data;specs.push({name:k,dtype:t.type,dims:t.dims.map(Number)});const u=new Uint8Array(d.buffer,d.byteOffset,d.byteLength);parts.push(u);n+=u.length}
      const body=new Uint8Array(n);let o=0;for(const u of parts){body.set(u,o);o+=u.length}
      const call=()=>window.PRISM_DESKTOP.invoke('ai_run',body,{headers:{'x-key':key,'x-inputs':JSON.stringify(specs)}});
      let ab;try{ab=await call()}catch(e){if(W.__ep==='CPU')throw e;// the card failed on this model: the processor takes over for good
        console.warn('IA native : carte graphique en échec, processeur',e);info=await NAI.load(buf,key,true);W.__ep=info.ep;buf=null;ab=await call()}
      const b=ab instanceof ArrayBuffer?ab:new Uint8Array(ab).buffer,dv=new DataView(b),hl=dv.getUint32(0,true),head=JSON.parse(new TextDecoder().decode(new Uint8Array(b,4,hl)));let at=4+hl;const out={};
      for(const h of head){const T=NAI.TYPES[h.dtype]||Float32Array;out[h.name]={data:new T(b.slice(at,at+h.bytes)),dims:h.dims,type:h.dtype};at+=h.bytes}return out},
    release:()=>window.PRISM_DESKTOP.invoke('ai_unload',{key}).catch(()=>{})};
  console.info('IA native :',info.ep);return W};
NAI.fromChunks=async(urls,onP)=>{let got=0;const parts=await Promise.all(urls.map(async u=>{const r=await fetch(u);if(!r.ok)throw new Error('modèle '+r.status);const b=new Uint8Array(await r.arrayBuffer());got++;onP&&onP(got/urls.length);return b}));
  const n=parts.reduce((a,p)=>a+p.length,0),buf=new Uint8Array(n);let o=0;for(const p of parts){buf.set(p,o);o+=p.length}return NAI.session(buf)};
window.PrismNAI=NAI;
AI.ensureSeg=()=>AI._seg?Promise.resolve(AI._seg):(AI._segP||(AI._segP=AI._ensureSeg().finally(()=>{AI._segP=null})));
/* chunked model files: ai/<dir>/meta.json lists the chunk sizes; the chunks are fetched in parallel and joined */
AI.fetchModel=async(dir,label,onP)=>{const r0=await fetch(asset(dir+'meta.json'));if(!r0.ok)throw new Error('modèle '+r0.status);const meta=await r0.json(),sizes=meta.chunks,total=meta.total;
  const buf=new Uint8Array(total),offs=sizes.map((_,i)=>sizes.slice(0,i).reduce((a,b)=>a+b,0));let got=0;
  await Promise.all(sizes.map(async(n,i)=>{const r=await fetch(asset(`${dir}${i}.wasm`));if(!r.ok)throw new Error('modèle '+r.status);const rd=r.body&&r.body.getReader?r.body.getReader():null;
    if(!rd){const b=new Uint8Array(await r.arrayBuffer());buf.set(b,offs[i]);got+=b.length;onP&&onP(got/total);return}
    let o=offs[i];for(;;){const {done,value}=await rd.read();if(done)break;buf.set(value,o);o+=value.length;got+=value.length;onP&&onP(got/total)}
    if(o-offs[i]!==n)throw new Error('modèle incomplet')}));
  return{buf,meta}};
AI.SEG_DIR='ai/isnet2/';
AI._ensureSeg=async()=>{AI.setState('seg','load',0);try{
    if(!window.ort)await loadScript(await ORTX.bundle());const ort=window.ort;ort.env.wasm.wasmPaths=asset('ai/');{const bin=await ORTX.binary();if(bin)ort.env.wasm.wasmBinary=bin}ort.env.wasm.numThreads=ORTX.threads();ort.env.wasm.proxy=false;
    const {buf}=await AI.fetchModel(AI.SEG_DIR,'détourage',p=>{AI.setState('seg','load',p*0.9);busy(true,'Téléchargement du modèle de détourage (90 Mo, une seule fois)…',p*0.9)});
    busy(true,'Préparation du modèle…',0.95);AI._seg=await ORTX.create(ort,buf.buffer,{graphOptimizationLevel:'all'});AI.setState('seg','ready');return AI._seg}
  catch(e){console.error(e);AI.setState('seg','error');busy(false);toast('Le modèle de détourage n’a pas pu se charger : '+(e.message||e),5000);return null}};
/* the subject as the model sees it (1024 × 1024 probabilities), or null when nothing stands out */
AI.segRaw=async(src)=>{const sess=await AI.ensureSeg();if(!sess)return null;const R=1024,t=mk(R,R),g=rx(t);g.imageSmoothingQuality='high';g.drawImage(src,0,0,R,R);const a=g.getImageData(0,0,R,R).data,N=R*R,f=new Float32Array(3*N);
  for(let i=0;i<N;i++){f[i]=a[i*4]/255-0.5;f[i+N]=a[i*4+1]/255-0.5;f[i+2*N]=a[i*4+2]/255-0.5}
  const ort=window.ort,out=await sess.run({[sess.inputNames[0]]:new ort.Tensor('float32',f,[1,3,R,R])}),o=out[sess.outputNames[0]].data;
  let mx=0;for(let i=0;i<N;i++)if(o[i]>mx)mx=o[i];if(mx<0.25)return null;
  // probabilities: stretched only when the model is unsure everywhere (a faint subject), never from the minimum (that turns background noise into mask)
  const k=mx<0.9?1/mx:1,m8=new Uint8ClampedArray(N);for(let i=0;i<N;i++)m8[i]=o[i]*k*255;return{m8,R}};
AI.subjectMask=async()=>{const d=S.doc;if(!d)return null;const key=d.layers.filter(L=>L.kind==='pixel'&&L.visible!==false).map(L=>[L.canvas,L.x|0,L.y|0,L.opacity]).flat();const C=AI.subjectCache;if(C&&C.w===d.w&&C.h===d.h&&C.key.length===key.length&&C.key.every((v,i)=>v===key[i])){if(!C.m)toast('Aucun sujet net dans cette photo',3500);return C.m}
  if(!(await AI.ensureSeg()))return null;busy(true,'Détection du sujet…',null);await tick();try{const raw=await AI.segRaw(flatSync());if(S.doc!==d)return null;
    let m=null;if(!raw)toast('Aucun sujet net dans cette photo',3500);
    else{const small=maskFromU8(raw.m8,raw.R,raw.R,true),up=mk(d.w,d.h),ug=cx(up);ug.imageSmoothingQuality='high';ug.drawImage(small,0,0,d.w,d.h);m=up;
      // the model works at 1024 px: its edge is snapped to the photo's own edges (guided filter) at up to 2048 px
      const long=Math.max(d.w,d.h),ps=Math.min(1,2048/long);if(long>1100){try{busy(true,'Affinage du contour…',null);await tick();m=await refineMask(up,{radius:clamp(Math.round(long*ps/256),3,12),eps:0.0004,contrast:8,shift:0},ps)}catch(e){console.warn(e)}}}
    AI.subjectCache={key,w:d.w,h:d.h,m};return m}
  catch(e){console.error(e);toast('Détection du sujet impossible : '+(e.message||e),5000);return null}finally{busy(false)}};
AI.selectSubject=async()=>{const d=S.doc;const m=await AI.subjectMask();if(!m||S.doc!==d)return;combineSel(m,'new','Sélectionner le sujet');toast('Sujet sélectionné')};
AI.removeBackground=async()=>{const L=pixelTarget();if(!L)return;const d0=S.doc;const m=await AI.subjectMask();if(!m||S.doc!==d0||!d0.layers.includes(L))return;L.mask=cloneC(m);L.editMask=true;S.doc.active=S.doc.layers.indexOf(L);markComp();pushHistory('Supprimer l’arrière-plan');syncAll();toast('Arrière-plan masqué. Peignez le masque pour corriger les bords. Exportez en PNG pour garder la transparence.',5000)};
AI._upP={};AI.ensureUp=scale=>AI._up[scale]?Promise.resolve(AI._up[scale]):(AI._upP[scale]||(AI._upP[scale]=AI._ensureUp(scale).finally(()=>{AI._upP[scale]=null})));
AI._ensureUp=async(scale)=>{AI.setState('up','load',0);try{busy(true,'Chargement du moteur d’agrandissement…',0.1);if(!window.tf)await loadScript(asset('ai/tf.min.js'));const tf=window.tf;try{await tf.setBackend('webgl')}catch(e){}await tf.ready();
    busy(true,'Chargement du modèle ×'+scale+'…',0.5);const m=await tf.loadLayersModel(asset(`ai/esrgan-x${scale}/model.json`));AI._up[scale]=m;AI.setState('up','ready');return m}catch(e){console.error(e);AI.setState('up','error');busy(false);toast('Le modèle d’agrandissement n’a pas pu se charger : '+(e.message||e),5000);return null}};
var upscaleCanvas; /* défini dans 1000-le-logo-prism-apparait-aussi.js */
AI.upscale=async(scale)=>{const d=S.doc;if(!d)return;const nw=d.w*scale,nh=d.h*scale;if(nw*nh>MAX_PX){toast(`Résultat trop grand (${nw} × ${nh}). Recadrez ou réduisez d’abord la photo.`,4500);return}
  try{const model=await AI.ensureUp(scale);if(!model||S.doc!==d)return;const h0=S.history[S.hi];const px=d.layers.filter(l=>l.kind==='pixel'),res=new Map();let i=0;for(const L of px){const r=await upscaleCanvas(L.canvas,scale,model,p=>busy(true,`Agrandissement ×${scale} : ${L.name}…`,(i+p)/px.length));res.set(L,r);i++}
    if(S.doc!==d||S.history[S.hi]!==h0){toast('Agrandissement annulé : le document a changé');return}resizeDoc(nw,nh,`Agrandissement IA ×${scale}`,L=>res.get(L)||resample(L.canvas,nw,nh));toast(`Image agrandie à ${nw} × ${nh} px`)}catch(e){if(e&&e.message==='annulé')return;/* the caller says « Agrandissement annulé » */console.error(e);toast('Agrandissement interrompu : '+(e.message||e),5000)}finally{busy(false)}};
function styleCard(){return`<div class="card"><h4><svg viewBox="0 0 20 20"><circle cx="7" cy="10" r="4.5"/><circle cx="13" cy="10" r="4.5"/></svg>Copier un style</h4><p>Choisissez une photo dont vous aimez le rendu : ses tons et ses couleurs sont reproduits sur la vôtre dans un calque de réglage modifiable. Le calcul se fait sur votre appareil.</p><div class="acts"><button class="btn sm primary" data-ai="style">Choisir la photo de référence…</button><button class="btn sm" data-ai="batch">Harmoniser une série…</button></div></div>`}
const AI_IC={subject:'<circle cx="10" cy="6.5" r="3"/><path d="M4 17c.8-3.3 3.1-5 6-5s5.2 1.7 6 5"/><rect x="1.5" y="1.5" width="17" height="17" rx="3" stroke-dasharray="2 2"/>',bg:'<rect x="2" y="3" width="16" height="14" rx="2"/><path d="M2 13l4.5-4 3.5 3 3-2.5 5 4.5"/><path d="M3 4l14 12"/>',remove:IC.remove,up:'<path d="M3 17V11M3 17h6M3 17l6-6"/><path d="M17 3v6M17 3h-6M17 3l-6 6"/>'};
function renderAI(){const p=$('#pane-ai');p.innerHTML=`${assistCard()}<p class="ai-intro">Les outils ci-dessous tournent entièrement sur votre appareil : vos photos ne sont pas envoyées. Le premier usage télécharge le modèle concerné, ensuite c’est immédiat.</p>
  ${styleCard()}<div class="card"><h4><svg viewBox="0 0 20 20">${AI_IC.subject}</svg>Détourage du sujet</h4><p>Repère automatiquement le sujet principal (personne, animal, objet).</p><div class="acts"><button class="btn sm primary" data-ai="select">Sélectionner le sujet</button><button class="btn sm" data-ai="adjS">Régler le sujet</button><button class="btn sm" data-ai="adjB">Régler l’arrière-plan</button></div><div class="state" id="stSeg"></div></div>
  <div class="card"><h4><svg viewBox="0 0 20 20">${AI_IC.bg}</svg>Supprimer l’arrière-plan</h4><p>Ajoute un masque au calque : l’arrière-plan devient transparent et reste récupérable.</p><div class="acts"><button class="btn sm primary" data-ai="bg">Supprimer l’arrière-plan</button></div></div>
  <div class="card"><h4><svg viewBox="0 0 20 20">${AI_IC.remove}</svg>Gomme magique</h4><p>Peignez sur un objet, un passant ou un fil électrique : il disparaît et la scène est reconstruite à partir de son environnement.</p><div class="acts"><button class="btn sm primary" data-ai="remove">Prendre la gomme magique</button>${S.doc&&S.doc.sel?'<button class="btn sm" data-ai="removeSel">Effacer la sélection</button>':''}</div></div>
  <div class="card"><h4><svg viewBox="0 0 20 20">${AI_IC.up}</svg>Agrandissement intelligent</h4><p>Augmente la définition en recréant les détails (super-résolution ESRGAN). ${S.doc?`Actuellement ${S.doc.w} × ${S.doc.h} px.`:''}</p><div class="acts"><button class="btn sm primary" data-ai="up2">Agrandir ×2</button><button class="btn sm" data-ai="up4">Agrandir ×4</button></div><div class="state" id="stUp"></div></div>`;renderAIState()}
function renderAIState(){const f=(k,el)=>{const e=$(el);if(!e)return;const s=AI.state[k];e.className='state'+(s==='ready'?' ok':s==='error'?' err':'');e.textContent=s==='ready'?'Modèle prêt':s==='load'?'Chargement… '+Math.round((AI.state[k+'P']||0)*100)+' %':s==='error'?'Échec du chargement : réessayez':'Modèle non chargé'};f('seg','#stSeg');f('up','#stUp')}
$('#pane-ai').addEventListener('click',e=>{const b=e.target.closest('[data-ai]');if(!b)return;if(!S.doc&&b.dataset.ai!=='batch'){toast('Ouvrez d’abord une photo');return}({style:copyStyleDialog,batch:()=>batchDialog(),select:AI.selectSubject,adjS:()=>addSubjectAdjust(false),adjB:()=>addSubjectAdjust(true),bg:AI.removeBackground,remove:()=>setTool('remove'),removeSel:removeSelected,up2:()=>AI.upscale(2),up4:()=>AI.upscale(4)})[b.dataset.ai]()});

