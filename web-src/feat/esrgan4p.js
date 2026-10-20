/* ---------- AI upscale "Qualité maximale": Real-ESRGAN x4plus (RRDBNet, 23 blocs) in tf.js, fp16 weights in 3 chunks ---------- */
{
const X4={m:null,rate:0};
const half2f=h=>{const s=(h&0x8000)<<16,e=(h>>10)&31,m=h&1023;let b;if(e===0){if(m===0)b=s;else{let ee=113,mm=m;while(!(mm&1024)){mm<<=1;ee--}b=s|(ee<<23)|((mm&1023)<<13)}}else if(e===31)b=s|0x7f800000|(m<<13);else b=s|((e+112)<<23)|(m<<13);return b};
const loadX4=async(onP)=>{
  if(X4.m)return X4.m;
  if(!window.tf)await loadScript(asset('ai/tf.min.js'));const tf=window.tf;
  try{await tf.setBackend('webgl')}catch(e){}await tf.ready();
  const meta=await fetch(asset('ai/esrgan4p/meta.json')).then(r=>r.json());
  const all=new Uint8Array(meta.chunks.reduce((a,b)=>a+b,0));let off=0;
  for(let i=0;i<meta.chunks.length;i++){const r=await fetch(asset(`ai/esrgan4p/${i}.wasm`));if(!r.ok)throw new Error('modèle introuvable');const b=new Uint8Array(await r.arrayBuffer());all.set(b,off);off+=b.length;onP&&onP((i+1)/meta.chunks.length)}
  const u16=new Uint16Array(all.buffer,0,all.length>>1),f=new Float32Array(u16.length),fb=new Uint32Array(f.buffer);
  for(let i=0;i<u16.length;i++)fb[i]=half2f(u16[i]);
  let W={};off=0;for(const [k,sh] of meta.tensors){const n=sh.reduce((a,b)=>a*b,1);W[k]=[f.subarray(off,off+n),sh];off+=n}
  const conv=name=>{const [d,sh]=W[name+'.weight'],[b]=W[name+'.bias'],[O,I,kh,kw]=sh,w=new Float32Array(kh*kw*I*O);
    for(let o=0;o<O;o++)for(let i=0;i<I;i++)for(let y=0;y<kh;y++)for(let x=0;x<kw;x++)w[((y*kw+x)*I+i)*O+o]=d[((o*I+i)*kh+y)*kw+x];
    return{w:tf.tensor4d(w,[kh,kw,I,O]),b:tf.tensor1d(b)}};
  const C={first:conv('conv_first'),body:conv('conv_body'),up1:conv('conv_up1'),up2:conv('conv_up2'),hr:conv('conv_hr'),last:conv('conv_last'),rrdb:[]};
  for(let i=0;i<meta.nb;i++){const r=[];for(let j=1;j<=3;j++){const d=[];for(let k=1;k<=5;k++)d.push(conv(`body.${i}.rdb${j}.conv${k}`));r.push(d)}C.rrdb.push(r)}
  W=null;/* the fp32 weights now live in the GPU tensors: the closures below would otherwise keep the whole array */
  const cv=(x,c)=>tf.add(tf.conv2d(x,c.w,1,'same'),c.b),lr=x=>tf.leakyRelu(x,0.2);
  const rdb=(x,d)=>{let cat=x;for(let k=0;k<4;k++){const y=lr(cv(cat,d[k]));cat=tf.concat([cat,y],3)}return tf.add(tf.mul(cv(cat,d[4]),0.2),x)};
  X4.m={native:4,x4p:true,
    /* x: [1,h,w,3] in 0..255 -> [1,4h,4w,3] in 0..255 */
    predict(x){return tf.tidy(()=>{const inp=tf.div(x,255),fea=cv(inp,C.first);let t=fea;
      for(const r of C.rrdb){let y=t;for(const d of r)y=rdb(y,d);t=tf.add(tf.mul(y,0.2),t)}
      t=tf.add(cv(t,C.body),fea);
      const up=y=>tf.image.resizeNearestNeighbor(y,[y.shape[1]*2,y.shape[2]*2]);
      t=lr(cv(up(t),C.up1));t=lr(cv(up(t),C.up2));
      return tf.mul(cv(lr(cv(t,C.hr)),C.last),255)})},
    dispose(){}};
  return X4.m};
window.__x4p={load:loadX4,model:()=>X4.m};

/* tiles: 64 px (48 on small-memory devices) with 10 px overlap; one tile at a time, nothing kept between tiles */
const tileSize=()=>(navigator.deviceMemory||8)>=8?64:48;
let CANCEL=false;
const fmtT=s=>s<90?Math.max(1,Math.round(s))+' s':s<5400?Math.round(s/60)+' min':(s/3600).toFixed(1).replace('.',',')+' h';
async function benchRate(model){
  if(model.onnx)return UPX.rate(model);
  if(X4.rate)return X4.rate;const tf=window.tf;
  const run=async n=>{const x=tf.randomUniform([1,n,n,3],0,255),t0=performance.now(),y=model.predict(x);await y.data();y.dispose();x.dispose();return performance.now()-t0};
  await run(8);const t=await run(16);X4.rate=t/256;return X4.rate}
async function x4pCanvas(src,scale,model,onP,tileOpt){
  const tf=window.tf,W=src.width,H=src.height,N=4,T=(tileOpt&&tileOpt.T)||tileSize(),P=(tileOpt&&tileOpt.P)||10,out=mk(W*scale,H*scale),og=cx(out);
  og.imageSmoothingEnabled=true;og.imageSmoothingQuality='high';
  const nx=Math.ceil(W/T),ny=Math.ceil(H/T),tot=nx*ny;let k=0;const t0=performance.now();
  for(let ty=0;ty<ny;ty++)for(let tx=0;tx<nx;tx++){
    if(CANCEL)throw new Error('annulé');
    const x0=tx*T,y0=ty*T,tw=Math.min(T,W-x0),th=Math.min(T,H-y0),px0=Math.max(0,x0-P),py0=Math.max(0,y0-P),px1=Math.min(W,x0+tw+P),py1=Math.min(H,y0+th+P),pw=px1-px0,ph=py1-py0;
    const tc=scr('upin',pw,ph),tg=cx(tc);tg.clearRect(0,0,pw,ph);tg.drawImage(src,px0,py0,pw,ph,0,0,pw,ph);
    const res=tf.tidy(()=>model.predict(tf.browser.fromPixels(tc).toFloat().expandDims(0)).clipByValue(0,255).squeeze().round().toInt());
    const oc=scr('upout',pw*N,ph*N);await tf.browser.toPixels(res,oc);res.dispose();
    og.drawImage(oc,(x0-px0)*N,(y0-py0)*N,tw*N,th*N,x0*scale,y0*scale,tw*scale,th*scale);
    if(CANCEL)throw new Error('annulé');
    k++;const el=(performance.now()-t0)/1000,eta=el/k*(tot-k);onP&&onP(k/tot,eta,k,tot);await tick()}
  const a=resample(src,W*scale,H*scale);og.globalCompositeOperation='destination-in';og.drawImage(a,0,0);return out}
window.__x4p.canvas=x4pCanvas;window.__x4p.cancel=()=>{CANCEL=true};

/* hook into the existing pipeline: AI.upscale(scale) untouched (Rapide); AI.upscale(scale,'max') = this model */
const _upCanvas=upscaleCanvas;
upscaleCanvas=async function(src,scale,model,onP){
  if(model&&model.x4p)return x4pCanvas(src,scale,model,(p,eta)=>{AI._eta=eta;onP&&onP(p)});
  return _upCanvas.apply(this,arguments)};
const _ensM=AI.ensureUp;
AI.ensureUp=function(scale){if(AI._max)return AI._max();return _ensM.apply(this,arguments)};
const _up=AI.upscale;
AI.upscale=async function(scale,quality){
  if(quality!=='max')return _up.apply(this,arguments);
  const d=S.doc;if(!d)return;if(AI._xBusy)return;
  if(d.w*scale*d.h*scale>MAX_PX){toast(`Résultat trop grand (${d.w*scale} × ${d.h*scale}). Recadrez ou réduisez d’abord la photo.`,4500);return}
  AI._xBusy=true;CANCEL=false;
  const onKey=e=>{if(e.key==='Escape'){CANCEL=true;e.stopPropagation()}};
  addEventListener('keydown',onKey,true);
  try{
    let m;
    AI.setState('up','load',0);busy(true,'Chargement du modèle haute qualité…',0.05);
    try{m=(await UPX.load('x4p'))||await loadX4(p=>busy(true,'Chargement du modèle haute qualité…',p))}catch(e){console.error(e);AI.setState('up','error');busy(false);toast('Le modèle haute qualité n’a pas pu se charger : '+(e.message||e),5000);return}
    AI.setState('up','ready');
    busy(true,'Estimation de la durée…',null);await tick();
    const rate=await benchRate(m),px=d.layers.filter(l=>l.kind==='pixel').length*d.w*d.h,est=rate*px/1000;
    busy(false);if(CANCEL)return;
    if(est>45){const ok=await new Promise(res=>dialog({title:'Qualité maximale',body:`<p style="margin:0 0 8px">Ce traitement prendra environ <b>${fmtT(est)}</b> sur cet appareil${px>d.w*d.h?' (plusieurs calques à traiter)':''}.</p><p class="muted" style="margin:0">Vous pourrez l’annuler à tout moment avec Échap. Le mode Rapide est bien plus court.</p>`,buttons:[{label:'Annuler',onClick:()=>res(false)},{label:'Continuer',primary:true,onClick:()=>res(true)}]}));if(!ok)return}
    if(CANCEL)return;
    AI._max=()=>Promise.resolve(m);
    let cb=null;AI._eta=null;
    busy(true,'Qualité maximale…',0);
    const bx=document.querySelector('#busy>div');if(bx&&!bx.querySelector('.x4cancel')){cb=document.createElement('button');cb.className='btn sm x4cancel';cb.textContent='Annuler';cb.onclick=()=>{CANCEL=true;cb.disabled=true;cb.textContent='Annulation…'};bx.appendChild(cb)}
    try{await _up.call(AI,scale)}finally{AI._max=null;if(cb)cb.remove()}
    if(CANCEL)toast('Agrandissement annulé');
  }finally{AI._xBusy=false;AI._max=null;CANCEL=false;removeEventListener('keydown',onKey,true);busy(false)}};

/* the progress callback of the shared pipeline only passes a fraction: add the remaining time to the message */
const _busy0=busy;
busy=function(on,msg,p){if(on&&AI._max&&/^Agrandissement ×/.test(msg||'')){msg=msg.replace('Agrandissement','Qualité maximale')+(AI._eta!=null?' · reste '+fmtT(AI._eta):'')}return _busy0.call(this,on,msg,p)};

/* one entry: Image > Agrandir ×2 avec l'IA… opens a small choice */
function upDialog(){
  const d=S.doc;if(!d)return;
  const f=PREF.get('upQ','fast'),sc=PREF.get('upS',2);
  const fits=s=>d.w*s*d.h*s<=MAX_PX;
  const row=(n,v,t,sub,chk,dis)=>`<label style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;${dis?'opacity:.5':''}"><input type="radio" name="${n}" value="${v}" ${chk?'checked':''} ${dis?'disabled':''} style="margin-top:3px"><span><b style="font-weight:600">${t}</b><br><span class="muted" style="font-size:12px">${sub}</span></span></label>`;
  dialog({title:'Agrandir avec l’IA',body:`<p class="muted" style="margin:0 0 6px">Actuellement ${d.w} × ${d.h} px.</p>
    ${row('upq','fast','Rapide','Quelques secondes. Bords et textes nets.',f!=='max')}
    ${row('upq','max','Qualité maximale','Plus de détails dans les textures, mais bien plus lent. Premier usage : modèle de 33 Mo à télécharger.',f==='max')}
    <hr style="border:0;border-top:1px solid var(--line-2);margin:6px 0">
    <div style="display:flex;gap:20px">${row('ups',2,'×2',`${d.w*2} × ${d.h*2}`,sc!==4||!fits(4),!fits(2))}${row('ups',4,'×4',`${d.w*4} × ${d.h*4}`,sc===4&&fits(4),!fits(4))}</div>`,
    buttons:[{label:'Annuler'},{label:'Agrandir',primary:true,onClick:dl=>{const q=dl.querySelector('input[name=upq]:checked').value,s=+dl.querySelector('input[name=ups]:checked').value;PREF.set('upQ',q);PREF.set('upS',s);setTimeout(()=>AI.upscale(s,q==='max'?'max':undefined),30)}}]});
}
window.__x4p.dialog=upDialog;
const _mi=MENU2.image.items;
MENU2.image.items=()=>{const a=_mi();const it=a.find(x=>x&&x.label&&/^Agrandir ×2 avec l’IA/.test(x.label));if(it)it.fn=upDialog;return a};

/* ONNX engine: the same two Real-ESRGAN networks as ONNX graphs (ai/up-compact1, ai/up-x4p1), run by the app's native engine
   (graphics card through DirectML / Core ML) or by WebGPU in the browser. Without either, TensorFlow.js (WebGL) above stays in use. */
const UPX={m:{},P:{},DIR:{fast:['ai/up-compact1/','d’agrandissement',3],x4p:['ai/up-x4p1/','haute qualité',34]}};
UPX.ok=async()=>{if(PREF.get('upOnnx',true)===false)return false;const N=window.PrismNAI;return !!((N&&await N.ok())||await PrismORT.gpuP())};
UPX.load=async kind=>{if(!(await UPX.ok()))return null;if(UPX.m[kind])return UPX.m[kind];
  const [dir,label,mb]=UPX.DIR[kind],s=await AI.ortSession(dir,label,mb);busy(false);if(!s)return null;
  return UPX.m[kind]={onnx:true,native:4,x4p:kind==='x4p',sess:s,T:kind==='x4p'?128:256,P:16}};
UPX.tile=async(m,c)=>{const w=c.width,h=c.height,a=cx(c).getImageData(0,0,w,h).data,n=w*h,f=new Float32Array(3*n);
  for(let i=0;i<n;i++){f[i]=a[i*4]/255;f[i+n]=a[i*4+1]/255;f[i+2*n]=a[i*4+2]/255}
  const s=m.sess,ort=window.ort,x=ort?new ort.Tensor('float32',f,[1,3,h,w]):{data:f,dims:[1,3,h,w],type:'float32'};
  const y=(await s.run({[s.inputNames[0]]:x}))[s.outputNames[0]].data,W=w*4,H=h*4,N=W*H,im=new ImageData(W,H),o=im.data;
  for(let i=0;i<N;i++){o[i*4]=y[i]*255;o[i*4+1]=y[i+N]*255;o[i*4+2]=y[i+2*N]*255;o[i*4+3]=255}return im};
/* time per source pixel, from one tile (warms the engine up too) */
UPX.rate=async m=>{if(m.rate)return m.rate;const c=mk(m.T,m.T);cx(c).fillStyle='#888';cx(c).fillRect(0,0,m.T,m.T);await UPX.tile(m,c);const t0=performance.now();await UPX.tile(m,c);return m.rate=(performance.now()-t0)/(m.T*m.T)};
UPX.canvas=async(src,scale,m,onP)=>{const W=src.width,H=src.height,N=4,T=m.T,P=m.P,out=mk(W*scale,H*scale),og=cx(out);og.imageSmoothingEnabled=true;og.imageSmoothingQuality='high';
  const nx=Math.ceil(W/T),ny=Math.ceil(H/T),tot=nx*ny,t0=performance.now();let k=0;
  for(let ty=0;ty<ny;ty++)for(let tx=0;tx<nx;tx++){if(CANCEL)throw new Error('annulé');
    const x0=tx*T,y0=ty*T,tw=Math.min(T,W-x0),th=Math.min(T,H-y0),px0=Math.max(0,x0-P),py0=Math.max(0,y0-P),px1=Math.min(W,x0+tw+P),py1=Math.min(H,y0+th+P),pw=px1-px0,ph=py1-py0;
    const tc=scr('upin',pw,ph),tg=cx(tc);tg.clearRect(0,0,pw,ph);tg.drawImage(src,px0,py0,pw,ph,0,0,pw,ph);
    const im=await UPX.tile(m,tc),oc=scr('upout',pw*N,ph*N);cx(oc).putImageData(im,0,0);
    og.drawImage(oc,(x0-px0)*N,(y0-py0)*N,tw*N,th*N,x0*scale,y0*scale,tw*scale,th*scale);
    k++;const el=(performance.now()-t0)/1000;onP&&onP(k/tot,el/k*(tot-k));await tick()}
  const a=resample(src,W*scale,H*scale);og.globalCompositeOperation='destination-in';og.drawImage(a,0,0);return out};
{const _uc=upscaleCanvas;upscaleCanvas=async function(src,scale,model,onP){if(model&&model.onnx)return UPX.canvas(src,scale,model,(p,eta)=>{AI._eta=eta;onP&&onP(p)});return _uc.apply(this,arguments)}}
/* "Rapide" goes to the ONNX engine too, and can be cancelled with Échap like "Qualité maximale" */
{const _eu=AI.ensureUp;AI.ensureUp=async function(scale){if(!AI._max){const m=await UPX.load('fast');if(m)return m}return _eu.apply(this,arguments)}}
{const _u=AI.upscale;AI.upscale=async function(scale,quality){if(quality==='max')return _u.apply(this,arguments);if(AI._fBusy||AI._xBusy)return;AI._fBusy=true;CANCEL=false;
  const onKey=e=>{if(e.key==='Escape'){CANCEL=true;e.stopPropagation()}};addEventListener('keydown',onKey,true);
  try{await _u.apply(this,arguments);if(CANCEL)toast('Agrandissement annulé')}catch(e){if(!CANCEL)throw e;toast('Agrandissement annulé')}finally{AI._fBusy=false;CANCEL=false;removeEventListener('keydown',onKey,true);busy(false)}}}
window.__x4p.onnx=UPX;
}
