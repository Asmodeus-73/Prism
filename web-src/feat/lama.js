/* ================= Suppression d'objet par réseau neuronal (LaMa "big-lama", ONNX Runtime web) ================= */
/* Disponible seulement si ai/lama/meta.json existe (application de bureau). Sinon : l'ancien remplissage par patchs est utilisé, sans message. */
/* Modèle : LaMa (Suvorov et al., Samsung AI), FFT remplacée par produit matriciel DFT, poids int8 par canal + fp16, découpé en morceaux ai/lama/N.wasm, taille H x W dynamique (multiples de 8). */
const LM={meta:null,availP:null,w:null,loadP:null,loadRes:null,pend:new Map(),rid:0,abort:false,busyNow:false,MAXS:512,MINS:256,tpp:null,last:null,
  /* limite de la zone : fraction de l'image couverte par le cadre de l'objet */
  GUARD:0.45};
LM.WSRC=`let sess=null;
self.onmessage=async e=>{const m=e.data;
 if(m.t==='init'){try{
   importScripts(m.ort);const ort=self.ort;ort.env.wasm.wasmPaths=m.wasm;if(m.bin){const bs=await Promise.all(m.bin.map(u=>fetch(u).then(r=>{if(!r.ok)throw new Error('moteur IA '+r.status);return r.arrayBuffer()})));const tot=bs.reduce((x,b)=>x+b.byteLength,0),wb=new Uint8Array(tot);let k=0;for(const b of bs){wb.set(new Uint8Array(b),k);k+=b.byteLength}ort.env.wasm.wasmBinary=wb.buffer}ort.env.wasm.numThreads=m.threads;ort.env.wasm.proxy=false;
   const n=m.chunks.length,parts=new Array(n);let done=0;
   await Promise.all(m.chunks.map(async(u,i)=>{const r=await fetch(u);if(!r.ok)throw new Error('modèle '+r.status);parts[i]=new Uint8Array(await r.arrayBuffer());done++;postMessage({t:'prog',v:done/n*0.8})}));
   const tot=parts.reduce((a,p)=>a+p.length,0),buf=new Uint8Array(tot);let o=0;for(let i=0;i<n;i++){buf.set(parts[i],o);o+=parts[i].length;parts[i]=null}
   postMessage({t:'prog',v:0.9,prep:1});
   let eps=(m.eps||['wasm']).filter(x=>x!=='webgpu'||self.navigator.gpu),ep=eps[0];self.CPU=()=>ort.InferenceSession.create(buf.buffer,{executionProviders:['wasm'],graphOptimizationLevel:'all'});self.EP=ep;self.RUN=async f=>{try{return await sess.run(f)}catch(e){if(self.EP!=='webgpu')throw e;self.EP='wasm';sess=await self.CPU();return sess.run(f)}};try{sess=await ort.InferenceSession.create(buf.buffer,{executionProviders:eps,graphOptimizationLevel:'all'})}catch(er){if(ep==='wasm')throw er;ep=self.EP='wasm';sess=await self.CPU()}postMessage({t:'ready',threads:ort.env.wasm.numThreads,ep})}
  catch(err){postMessage({t:'err',msg:String(err&&err.message||err)})}}
 else if(m.t==='run'){try{const ort=self.ort;const out=await self.RUN({img:new ort.Tensor('float32',new Float32Array(m.img),m.dims),mask:new ort.Tensor('float32',new Float32Array(m.mask),[1,1,m.dims[2],m.dims[3]])});const d=out[sess.outputNames[0]].data;const c=new Float32Array(d);postMessage({t:'res',id:m.id,buf:c.buffer},[c.buffer])}
  catch(err){postMessage({t:'err',id:m.id,msg:String(err&&err.message||err)})}}};`;
LM.abs=u=>new URL(u,location.href).href;
/* le modèle est-il livré avec cette version ? (réponse mémorisée) */
LM.avail=()=>{if(window.LAMA_DISABLE)return Promise.resolve(false);return LM.availP||(LM.availP=(async()=>{try{
    const u=asset('ai/lama/meta.json');let r=await fetch(u,{method:'HEAD',cache:'no-store'});if(!r.ok)return false;
    r=await fetch(u,{cache:'no-store'});if(!r.ok)return false;const m=JSON.parse(await r.text());if(!(m&&m.chunks>0))return false;LM.meta=m;return true}catch(e){return false}})())};
LM.load=()=>LM.w?Promise.resolve(LM.w):(LM.loadP||(LM.loadP=LM._load().finally(()=>{LM.loadP=null})));
LM._load=()=>new Promise(async res=>{LM.loadRes=res;
  busy(true,'Chargement du moteur IA…',0.02);LM.busyCancel(true);
  let w;try{w=new Worker(URL.createObjectURL(new Blob([LM.WSRC],{type:'text/javascript'})))}catch(e){console.warn('lama',e);res(null);return}
  LM.loadW=w;const thr=self.crossOriginIsolated?Math.max(1,Math.min(4,navigator.hardwareConcurrency||1)):1;
  const fail=msg=>{console.warn('lama',msg);try{w.terminate()}catch(e){}LM.loadRes=null;res(null)};
  w.onmessage=e=>{const m=e.data;
    if(m.t==='prog'){busy(true,m.prep?'Préparation du modèle…':'Chargement du modèle de suppression…',m.v);LM.busyCancel(true)}
    else if(m.t==='ready'){LM.threads=m.threads;LM.ep=m.ep||'wasm';LM.loadRes=null;LM.loadW=null;LM.w=w;w.onmessage=LM._onmsg;res(w)}
    else if(m.t==='err')fail(m.msg)};
  w.onerror=e=>fail(e.message||'worker');
  w.postMessage({t:'init',ort:LM.abs(await PrismORT.bundle()),eps:await PrismORT.eps(),bin:(await PrismORT.gpuP())?PrismORT.binURLs():null,wasm:LM.abs(asset('ai/')),chunks:[...Array(LM.meta.chunks).keys()].map(i=>LM.abs(asset(`ai/lama/${i}.wasm`))),threads:thr})});
LM._onmsg=e=>{const m=e.data,p=LM.pend.get(m.id);if(!p)return;LM.pend.delete(m.id);m.t==='res'?p.res(new Float32Array(m.buf)):p.rej(new Error(m.msg))};
LM.infer=(img,mask,h,w)=>new Promise((res,rej)=>{const id=++LM.rid;LM.pend.set(id,{res,rej});LM.w.postMessage({t:'run',id,img:img.buffer,mask:mask.buffer,dims:[1,3,h,w]},[img.buffer,mask.buffer])});
/* annulation : pendant le chargement on arrête le worker ; pendant le calcul on abandonne le résultat (le modèle reste en mémoire pour la prochaine fois) */
LM.cancel=()=>{LM.abort=true;if(LM.loadRes){const r=LM.loadRes;LM.loadRes=null;try{LM.loadW&&LM.loadW.terminate()}catch(e){}LM.loadW=null;r(null)}};
LM.busyCancel=on=>{const b=document.querySelector('#busy>div');if(!b)return;let e=b.querySelector('.lm-cancel');if(on&&!e){e=document.createElement('button');e.className='btn sm lm-cancel';e.textContent='Annuler';e.style.marginTop='10px';e.onclick=()=>{e.disabled=true;e.textContent='Annulation…';LM.cancel()};b.appendChild(e)}else if(!on&&e)e.remove()};
LM.onKey=e=>{if(e.key==='Escape'&&LM.busyNow){LM.cancel();e.stopPropagation()}};
/* fenêtre de contexte autour de l'objet : marge, au moins 256 px, multiple de 8 ; échelle <= 1 pour tenir dans 512 px */
LM.plan=(bx,W,H)=>{const hw=bx.x1-bx.x0,hh=bx.y1-bx.y0,m=Math.max(hw,hh),mg=Math.max(48,Math.round(m*0.75));
  const axis=(a,b,N)=>{a=Math.max(0,Math.floor(a-mg));b=Math.min(N,Math.ceil(b+mg));const need=Math.min(LM.MINS,N);
    if(b-a<need){const c=(a+b)/2;a=Math.round(c-need/2);b=a+need;if(a<0){b-=a;a=0}if(b>N){a-=b-N;b=N}}
    return[a,b]};
  let[x0,x1]=axis(bx.x0,bx.x1,W),[y0,y1]=axis(bx.y0,bx.y1,H);
  const w=x1-x0,h=y1-y0,f=Math.min(1,LM.MAXS/Math.max(w,h));
  let rw,rh;
  if(f>=1){rw=Math.ceil(w/8)*8;rh=Math.ceil(h/8)*8;
    /* on agrandit la fenêtre vers l'intérieur de l'image quand c'est possible, le reste (hors image) sera traité comme une zone à remplir puis jeté */
    const ext=(a,b,t,N)=>{let d=t-(b-a);const e=Math.min(d,N-b);b+=e;d-=e;const s=Math.min(d,a);a-=s;d-=s;return[a,b+d]};
    [x0,x1]=ext(x0,x1,rw,W);[y0,y1]=ext(y0,y1,rh,H)}
  else{rw=Math.max(8,Math.round(w*f/8)*8);rh=Math.max(8,Math.round(h*f/8)*8)}
  return{x0,y0,x1,y1,rw,rh,f,fx:rw/(x1-x0),fy:rh/(y1-y0)}};
LM.fmtT=ms=>{const s=Math.round(ms/1000);return s<90?s+' s':Math.round(s/60)+' min'};
/* Cœur : remplit la zone de masque (alpha de maskC, repère de L.canvas) ; renvoie {res,soft,plan,hole} ou null si annulé/échec. */
LM.fill=async(L,maskC,bx)=>{const d=S.doc,W=L.canvas.width,H=L.canvas.height,P=LM.plan(bx,W,H),{x0,y0,x1,y1,rw,rh,fx,fy}=P,n=rw*rh;
  const src=mk(rw,rh),sg=rx(src);sg.imageSmoothingQuality='high';sg.drawImage(L.canvas,x0,y0,x1-x0,y1-y0,0,0,(x1-x0)*fx,(y1-y0)*fy);
  const mc=mk(rw,rh),mg=rx(mc);mg.imageSmoothingQuality='high';mg.drawImage(maskC,x0,y0,x1-x0,y1-y0,0,0,(x1-x0)*fx,(y1-y0)*fy);
  const sd=sg.getImageData(0,0,rw,rh).data,md=mg.getImageData(0,0,rw,rh).data;let hole=new Uint8Array(n),hc=0;
  for(let y=0;y<rh;y++){const gy=y0+(y+.5)/fy,iy=gy>=0&&gy<H;for(let x=0;x<rw;x++){const gx=x0+(x+.5)/fx,i=y*rw+x;if(md[i*4+3]>10){hole[i]=1;hc++}else if(!iy||gx<0||gx>=W)hole[i]=2}}
  if(!hc)return null;
  /* le masque est légèrement agrandi pour emporter les bords de l'objet ; les zones hors image restent à remplir (2) */
  const grow=3;for(let pass=0;pass<grow;pass++){const h2=hole.slice();for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=y*rw+x;if(hole[i])continue;if((x>0&&hole[i-1]===1)||(x<rw-1&&hole[i+1]===1)||(y>0&&hole[i-rw]===1)||(y<rh-1&&hole[i+rw]===1))h2[i]=1}hole=h2}
  const fi=new Float32Array(3*n),fm=new Float32Array(n);
  for(let i=0;i<n;i++){const hv=hole[i]>0;fm[i]=hv?1:0;if(!hv){fi[i]=sd[i*4]/255;fi[i+n]=sd[i*4+1]/255;fi[i+2*n]=sd[i*4+2]/255}}
  const sess=await LM.load();if(!sess||LM.abort){return null}
  const pl=LM.tpp,est=pl?pl*n:null,t0=performance.now();let tm=null;
  busy(true,'Suppression de l’objet…',est?0:null);LM.busyCancel(true);
  if(est)tm=setInterval(()=>{busy(true,'Suppression de l’objet… (Échap pour annuler)',Math.min(0.95,(performance.now()-t0)/est));LM.busyCancel(true)},250);
  let o;const ip=LM.infer(fi,fm,rh,rw);
  const ab=new Promise(r=>{const chk=setInterval(()=>{if(LM.abort){clearInterval(chk);r(null)}},120);ip.finally(()=>clearInterval(chk)).catch(()=>{})});
  try{o=await Promise.race([ip,ab])}catch(e){clearInterval(tm);throw e}finally{clearInterval(tm)}
  if(!o||LM.abort)return null;
  const dt=performance.now()-t0;LM.tpp=LM.tpp==null?dt/n:LM.tpp*.5+dt/n*.5;LM.last={ms:Math.round(dt),w:rw,h:rh,f:P.f};
  const res=mk(rw,rh),rg=cx(res),ri=rg.createImageData(rw,rh);
  for(let i=0;i<n;i++){const k=i*4;if(hole[i]===1){ri.data[k]=Math.max(0,Math.min(255,o[i]*255+.5));ri.data[k+1]=Math.max(0,Math.min(255,o[i+n]*255+.5));ri.data[k+2]=Math.max(0,Math.min(255,o[i+2*n]*255+.5));ri.data[k+3]=255}}
  rg.putImageData(ri,0,0);return{res,plan:P}};
/* brique commune : applique le résultat à L (même historique et même gestion de sélection que l'ancienne gomme) */
LM.removeObject=async function(L,maskC,bx,clip,prev){const d=S.doc,doc0=d,h0=S.history[S.hi];
  if(LM.busyNow)return;LM.busyNow=true;LM.abort=false;document.addEventListener('keydown',LM.onKey,true);
  let r;try{r=await LM.fill(L,maskC,bx)}catch(e){console.warn('lama',e);r=null;LM.failed=String(e&&e.message||e)}
  finally{LM.busyNow=false;document.removeEventListener('keydown',LM.onKey,true);busy(false);LM.busyCancel(false)}
  if(LM.abort){toast('Suppression annulée');return true}
  if(!r)return false;                      /* échec du réseau : l'appelant bascule sur l'ancienne méthode */
  if(S.doc!==doc0||S.history[S.hi]!==h0||!doc0.layers.includes(L)){toast('Opération annulée : le document a changé');return true}
  const{res,plan:P}=r,{x0,y0,x1,y1,rw,rh}=P;const soft=blurCanvas(res,1.2);
  if(clip&&clip===d.sel){const full=mk(x1-x0,y1-y0),fg=cx(full);fg.imageSmoothingQuality='high';fg.drawImage(soft,0,0,rw,rh,0,0,x1-x0,y1-y0);fg.globalCompositeOperation='destination-in';fg.drawImage(clip,-x0,-y0);const g=editCanvas(L);g.drawImage(full,x0,y0)}
  else{const g=editCanvas(L);g.imageSmoothingQuality='high';g.drawImage(soft,0,0,rw,rh,x0,y0,x1-x0,y1-y0)}
  markComp();pushHistory('Gomme magique');return true};
/* clipSel (sélection active pendant un coup de pinceau "gomme magique") est privé au moteur : on le déduit en enveloppant endStroke */
{const _es=endStroke;endStroke=function(){const st=S.stroke,d=S.doc;LM.strokeSel=st&&d&&st.tool==='remove'&&d.sel?d.sel:null;
  const r=_es.apply(this,arguments);Promise.resolve(r).then(()=>{LM.strokeSel=null},()=>{LM.strokeSel=null});return r}}
/* on enveloppe la gomme existante : réseau si le modèle est livré, sinon (ou en cas d'échec) l'ancien remplissage */
{const _ro=removeObject,E0={x0:0,y0:0,x1:0,y1:0};
 removeObject=async function(L,maskC,bx){const d=S.doc,args=arguments,self=this;
  if(!d||!(await LM.avail())||S.doc!==d)return _ro.apply(self,args);
  const clip=LM.strokeSel;
  const hw=bx.x1-bx.x0,hh=bx.y1-bx.y0;if(hw<2||hh<2)return _ro.apply(self,args);
  if(hw*hh>d.w*d.h*LM.GUARD){_ro.call(self,L,maskC,E0);toast('Zone trop grande : peignez seulement l’objet à effacer');return}
  const ok=await LM.removeObject(L,maskC,bx,clip);
  if(ok===false){console.warn('lama: repli sur l’ancienne méthode');return _ro.apply(self,args)}
  _ro.call(self,L,maskC,E0)}}               /* remet clipSel à zéro, comme l'ancienne version */
window.LM=LM;
