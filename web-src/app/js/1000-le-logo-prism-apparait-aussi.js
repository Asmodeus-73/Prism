/* ===== wave53: le logo Prism apparaît aussi en haut à gauche de la photothèque et permet d'en sortir (vers la photo ouverte ou l'accueil) ===== */
(()=>{
const st=document.createElement('style');st.textContent='.lb-top .lb-mark{cursor:pointer;flex:none}.lb-top .lb-mark:focus{outline:none}.lb-top .lb-mark:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:8px}';document.head.appendChild(st);
const _o=openLibrary;openLibrary=async function(...a){const r=await _o.apply(this,a);
  const top=$('#library .lb-top'),src=$('header.bar .mark');
  if(top&&src&&!top.querySelector('.lb-mark')){const m=src.cloneNode(true);m.removeAttribute('id');m.classList.add('lb-mark');m.tabIndex=0;m.setAttribute('role','button');
    const t=S.doc?'Quitter la photothèque et revenir à la photo':'Quitter la photothèque';m.title=t;m.setAttribute('aria-label',t);
    const go=e=>{e.stopPropagation();closeLibrary()};m.addEventListener('click',go);m.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go(e)}});
    top.insertBefore(m,top.firstChild)}
  return r};
})();

/* ---------- AI upscale: Real-ESRGAN general x4 v3 (compact) in tf.js; x2 = x4 result brought down; old ESRGAN stays as fallback ---------- */
{
const RG={m:null};
const loadRG=async()=>{
  if(RG.m)return RG.m;
  if(!window.tf)await loadScript(asset('ai/tf.min.js'));const tf=window.tf;
  try{await tf.setBackend('webgl')}catch(e){}await tf.ready();
  const [meta,buf]=await Promise.all([fetch(asset('ai/realesr/meta.json')).then(r=>r.json()),fetch(asset('ai/realesr/weights.wasm')).then(r=>r.arrayBuffer())]);
  const f=new Float32Array(buf);let off=0;const W={};
  for(const [k,sh] of meta){const n=sh.reduce((a,b)=>a*b,1);W[k]=[f.subarray(off,off+n),sh];off+=n}
  const conv=i=>{const [d,sh]=W[`body.${i}.weight`],[b]=W[`body.${i}.bias`],[O,I,kh,kw]=sh;
    const w=new Float32Array(kh*kw*I*O);
    for(let o=0;o<O;o++)for(let ii=0;ii<I;ii++)for(let y=0;y<kh;y++)for(let x=0;x<kw;x++)w[((y*kw+x)*I+ii)*O+o]=d[((o*I+ii)*kh+y)*kw+x];
    let bb=b,ww=w;
    if(O===48){/* torch pixel_shuffle order (c,i,j) -> tf depthToSpace order (i,j,c) */
      const w2=new Float32Array(w.length),b2=new Float32Array(48);
      for(let c=0;c<3;c++)for(let k=0;k<16;k++){const to=k*3+c,from=c*16+k;b2[to]=b[from];for(let r=0;r<kh*kw*I;r++)w2[r*48+to]=w[r*48+from]}
      ww=w2;bb=b2}
    return{w:tf.tensor4d(ww,[kh,kw,I,O]),b:tf.tensor1d(bb)}};
  const L=[];for(let i=0;i<=66;i+=2)L.push({c:conv(i),a:i<66?tf.tensor1d(W[`body.${i+1}.weight`][0]):null});
  const prelu=(x,a)=>tf.add(tf.relu(x),tf.mul(a,tf.neg(tf.relu(tf.neg(x)))));
  RG.m={native:4,predict(x){
    return tf.tidy(()=>{const inp=tf.div(x,255);let t=inp;
      for(const l of L){t=tf.add(tf.conv2d(t,l.c.w,1,'same'),l.c.b);if(l.a)t=prelu(t,l.a)}
      const up=tf.depthToSpace(t,4),base=tf.image.resizeNearestNeighbor(inp,[inp.shape[1]*4,inp.shape[2]*4]);
      return tf.mul(tf.add(up,base),255)})}};
  return RG.m};
const _ens=AI.ensureUp;
AI.ensureUp=async scale=>{
  if(AI._rgFail)return _ens.call(AI,scale);
  AI.setState('up','load',0);
  for(let a=0;a<2;a++){
    try{busy(true,'Chargement du modèle Real-ESRGAN…',0.5);const m=await loadRG();AI.setState('up','ready');return m}
    catch(e){console.error(e);RG.m=null}}
  AI._rgFail=true;toast('Real-ESRGAN indisponible : ancien modèle utilisé',4000);return _ens.call(AI,scale)};
upscaleCanvas=async function(src,scale,model,onP){
  const tf=window.tf,W=src.width,H=src.height,N=model.native||scale,T=N===4?64:96,P=N===4?10:8,out=mk(W*scale,H*scale),og=cx(out);
  og.imageSmoothingEnabled=true;og.imageSmoothingQuality='high';
  const nx=Math.ceil(W/T),ny=Math.ceil(H/T);let k=0;
  for(let ty=0;ty<ny;ty++)for(let tx=0;tx<nx;tx++){
    const x0=tx*T,y0=ty*T,tw=Math.min(T,W-x0),th=Math.min(T,H-y0),px0=Math.max(0,x0-P),py0=Math.max(0,y0-P),px1=Math.min(W,x0+tw+P),py1=Math.min(H,y0+th+P),pw=px1-px0,ph=py1-py0;
    const tc=scr('upin',pw,ph),tg=cx(tc);tg.clearRect(0,0,pw,ph);tg.drawImage(src,px0,py0,pw,ph,0,0,pw,ph);
    const res=tf.tidy(()=>model.predict(tf.browser.fromPixels(tc).toFloat().expandDims(0)).clipByValue(0,255).squeeze().round().toInt());
    const oc=scr('upout',pw*N,ph*N);await tf.browser.toPixels(res,oc);res.dispose();
    og.drawImage(oc,(x0-px0)*N,(y0-py0)*N,tw*N,th*N,x0*scale,y0*scale,tw*scale,th*scale);
    k++;if(k%2===0){onP&&onP(k/(nx*ny));await tick()}}
  const a=resample(src,W*scale,H*scale);og.globalCompositeOperation='destination-in';og.drawImage(a,0,0);return out};
}

