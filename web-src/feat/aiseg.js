/* ===== 0.5: AI masks by category.
   A scene model (DeepLabv3+ Xception trained on ADE20K: 150 kinds of things) gives the sky, people, vegetation, water, mountains,
   buildings and ground; a people model (MediaPipe selfie multiclass) splits the people it finds into face, skin, hair and clothes.
   Both run on a small copy of the photo; the masks are then snapped to the photo's own edges (guided filter). ===== */

const SEG={sess:{},P:{},scene:null,parts:null};
SEG.GROUPS={sky:[3],people:[13],vegetation:[5,10,18,30,67,73],water:[22,27,61,105,110,114,129],mountains:[17,35,69],
  buildings:[1,2,9,15,26,43,49,52,62,79,80,85,87,107],ground:[4,7,12,14,47,53,54,55,92,95,122]};
SEG.PARTS={hair:[1],skin:[2,3],face:[3],clothes:[4,5]};
SEG.LABEL={subj:'Sujet',sky:'Ciel',people:'Personnes',bg:'Arrière-plan',vegetation:'Végétation',water:'Eau',mountains:'Montagnes',buildings:'Bâtiments',ground:'Sol',face:'Visage',skin:'Peau',hair:'Cheveux',clothes:'Vêtements'};

async function ortReady(){if(!window.ort)await loadScript(await ORTX.bundle());const ort=window.ort;ort.env.wasm.wasmPaths=asset('ai/');{const bin=await ORTX.binary();if(bin)ort.env.wasm.wasmBinary=bin}
  ort.env.wasm.numThreads=ORTX.threads();ort.env.wasm.proxy=false;return ort}
function session(dir,label,mb){if(SEG.sess[dir])return Promise.resolve(SEG.sess[dir]);if(SEG.P[dir])return SEG.P[dir];
  return SEG.P[dir]=(async()=>{try{const ort=await ortReady();
      const {buf}=await AI.fetchModel(dir,label,p=>busy(true,`Téléchargement du modèle ${label} (${mb} Mo, une seule fois)…`,p*0.95));
      busy(true,'Préparation du modèle…',0.97);const s=await ORTX.create(ort,buf.buffer,{graphOptimizationLevel:'all'});SEG.sess[dir]=s;return s}
    catch(e){console.error(e);toast(`Le modèle ${label} n’a pas pu se charger : `+(e.message||e),5000);return null}
    finally{SEG.P[dir]=null}})()}
const docKey=d=>d.layers.filter(L=>L.kind==='pixel'&&L.visible!==false).map(L=>[L.canvas,L.x|0,L.y|0,L.opacity]).flat();
const sameKey=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

// scene probabilities on a 129 × 129 grid (the photo letterboxed into 513 × 513, as the model was trained)
async function scene(){const d=S.doc;if(!d)return null;const key=docKey(d),C=SEG.scene;if(C&&C.d===d&&sameKey(C.key,key))return C;
  const sess=await session('ai/ade1/','des scènes',82);if(!sess||S.doc!==d)return null;
  busy(true,'Analyse de la scène…',null);await tick();
  try{const R=513,k=R/Math.max(d.w,d.h),w=Math.max(1,Math.round(d.w*k)),h=Math.max(1,Math.round(d.h*k)),t=mk(R,R),g=rx(t);g.fillStyle='rgb(128,128,128)';g.fillRect(0,0,R,R);g.imageSmoothingQuality='high';g.drawImage(flatSync(),0,0,w,h);
    const a=g.getImageData(0,0,R,R).data,x=new Uint8Array(R*R*3);for(let i=0,j=0;i<a.length;i+=4){x[j++]=a[i];x[j++]=a[i+1];x[j++]=a[i+2]}
    const ort=window.ort,out=await sess.run({[sess.inputNames[0]]:new ort.Tensor('uint8',x,[1,R,R,3])}),L=out[sess.outputNames[0]].data,G=129,K=151;
    const gw=Math.min(G,Math.ceil(w*(G-1)/(R-1))+1),gh=Math.min(G,Math.ceil(h*(G-1)/(R-1))+1),P=new Float32Array(gw*gh*K);
    for(let y=0;y<gh;y++)for(let x0=0;x0<gw;x0++){const o=(y*G+x0)*K,q=(y*gw+x0)*K;let mx=-1e9;for(let c=0;c<K;c++)if(L[o+c]>mx)mx=L[o+c];let s=0;for(let c=0;c<K;c++){const e=Math.exp(L[o+c]-mx);P[q+c]=e;s+=e}for(let c=0;c<K;c++)P[q+c]/=s}
    if(S.doc!==d)return null;return SEG.scene={d,key,P,gw,gh,K}}
  catch(e){console.error(e);toast('Analyse de la scène impossible : '+(e.message||e),5000);return null}finally{busy(false)}}
function groupGrid(sc,classes){const n=sc.gw*sc.gh,o=new Float32Array(n);for(let i=0;i<n;i++){let s=0;for(const c of classes)s+=sc.P[i*sc.K+c];o[i]=s>1?1:s}return o}
// probability grid -> W × H values (bilinear), grid point (gw-1, gh-1) on the far edge of the letterboxed photo
function gridTo(grid,gw,gh,W,H){const o=new Float32Array(W*H);for(let y=0;y<H;y++){const fy=Math.min(gh-1,y/(H-1||1)*(gh-1)),y0=Math.floor(fy),y1=Math.min(gh-1,y0+1),ty=fy-y0;
    for(let x=0;x<W;x++){const fx=Math.min(gw-1,x/(W-1||1)*(gw-1)),x0=Math.floor(fx),x1=Math.min(gw-1,x0+1),tx=fx-x0;
      o[y*W+x]=(grid[y0*gw+x0]*(1-tx)+grid[y0*gw+x1]*tx)*(1-ty)+(grid[y1*gw+x0]*(1-tx)+grid[y1*gw+x1]*tx)*ty}}return o}
function u8Mask(v,W,H){const c=mk(W,H),g=cx(c),im=g.createImageData(W,H),a=im.data;for(let i=0;i<W*H;i++){a[i*4]=a[i*4+1]=a[i*4+2]=255;a[i*4+3]=v[i]*255}g.putImageData(im,0,0);return c}
// coarse probabilities -> full-size mask snapped to the photo's edges
async function snap(prob,W,H,coarse){const d=S.doc,long=Math.max(d.w,d.h),ps=Math.min(1,2048/long),small=u8Mask(prob,W,H),up=mk(d.w,d.h),ug=cx(up);ug.imageSmoothingQuality='high';ug.drawImage(small,0,0,d.w,d.h);
  try{busy(true,'Affinage du contour…',null);await tick();return await refineMask(up,{radius:clamp(Math.round(long*ps/coarse),3,24),eps:0.0006,contrast:15,shift:0},ps)}catch(e){console.warn(e);return up}finally{busy(false)}}
const covered=m=>{if(!m)return false;const b=maskBBox(m);return !!b};

async function sceneMask(kind){const d=S.doc,sc=await scene();if(!sc||S.doc!==d)return null;const gr=groupGrid(sc,SEG.GROUPS[kind]);let mx=0;for(const v of gr)if(v>mx)mx=v;if(mx<0.4)return null;
  return snap(gr,sc.gw,sc.gh,160)}
// people parts: the people model looks at a square crop around the people the scene model found (or the subject)
async function partsMask(kind){const d=S.doc;let box=null;const sc=await scene();if(S.doc!==d)return null;
  if(sc){const gr=groupGrid(sc,SEG.GROUPS.people);let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<sc.gh;y++)for(let x=0;x<sc.gw;x++)if(gr[y*sc.gw+x]>0.5){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    if(x1>=0){const sx=d.w/(sc.gw-1||1),sy=d.h/(sc.gh-1||1);box={x0:(x0-1)*sx,y0:(y0-1)*sy,x1:(x1+1)*sx,y1:(y1+1)*sy}}}
  if(!box){// the scene model saw no one: a portrait close-up often reads as a single subject
    const m=await AI.subjectMask(d);if(!m||S.doc!==d)return null;const W=m.width,H=m.height,a=rx(m).getImageData(0,0,W,H).data;let x0=W,y0=H,x1=-1,y1=-1;
    for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2)if(a[(y*W+x)*4+3]>128){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    if(x1<0)return null;const fx=d.w/W,fy=d.h/H;box={x0:x0*fx,y0:y0*fy,x1:(x1+2)*fx,y1:(y1+2)*fy}}
  const sess=await session('ai/people1/','des personnes',8);if(!sess||S.doc!==d)return null;
  busy(true,'Analyse des personnes…',null);await tick();
  try{const R=256,flat=flatSync();
    const run=async(bx,by,side)=>{const t=mk(R,R),g=rx(t);g.fillStyle='#000';g.fillRect(0,0,R,R);g.imageSmoothingQuality='high';g.drawImage(flat,bx,by,side,side,0,0,R,R);
      const a=g.getImageData(0,0,R,R).data,x=new Float32Array(R*R*3);for(let i=0,j=0;i<a.length;i+=4){x[j++]=a[i]/255;x[j++]=a[i+1]/255;x[j++]=a[i+2]/255}
      const ort=window.ort,out=await sess.run({[sess.inputNames[0]]:new ort.Tensor('float32',x,[1,R,R,3])});return out[sess.outputNames[0]].data};
    const cxm=(box.x0+box.x1)/2,cym=(box.y0+box.y1)/2;let side=Math.max(box.x1-box.x0,box.y1-box.y0)*1.08,bx=cxm-side/2,by=cym-side/2,o=await run(bx,by,side);
    // a small head in a full-length shot: a second look, closer, around the face
    if(kind==='face'||kind==='hair'){let x0=R,y0=R,x1=-1,y1=-1;for(let y=0;y<R;y++)for(let x=0;x<R;x++)if(o[(y*R+x)*6+3]+o[(y*R+x)*6+1]>0.5){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
      if(x1>=0&&Math.max(x1-x0,y1-y0)<R*0.3){const k=side/R,fc=bx+(x0+x1)/2*k,fy=by+(y0+y1)/2*k,s2=Math.max(x1-x0,y1-y0)*k*2.6;bx=fc-s2/2;by=fy-s2/2;side=s2;o=await run(bx,by,side)}}
    const cls=SEG.PARTS[kind],pr=new Float32Array(R*R);let mx=0;for(let i=0;i<R*R;i++){let s=0;for(const c of cls)s+=o[i*6+c];pr[i]=s;if(s>mx)mx=s}if(mx<0.4)return null;
    if(S.doc!==d)return null;
    // crop -> document
    const small=u8Mask(pr,R,R),full=mk(d.w,d.h),fg=cx(full);fg.imageSmoothingQuality='high';fg.drawImage(small,bx,by,side,side);
    const long=Math.max(d.w,d.h),ps=Math.min(1,2048/long);busy(true,'Affinage du contour…',null);await tick();
    try{return await refineMask(full,{radius:clamp(Math.round(side*ps/256),2,16),eps:0.0006,contrast:15,shift:0},ps)}catch(e){console.warn(e);return full}}
  catch(e){console.error(e);toast('Analyse des personnes impossible : '+(e.message||e),5000);return null}finally{busy(false)}}

// one entry point for every kind; null (with a message) when the photo has none
AI.categoryMask=async kind=>{let m=null;
  if(kind==='subj')m=await AI.subjectMask();
  else if(kind==='bg'){const s=await AI.subjectMask();if(s){m=fullMask();const g=cx(m);g.globalCompositeOperation='destination-out';g.drawImage(s,0,0)}}
  else if(kind==='sky')m=await AI.skyMask();
  else if(SEG.GROUPS[kind])m=await sceneMask(kind);
  else if(SEG.PARTS[kind])m=await partsMask(kind);
  if(m&&!covered(m))m=null;
  if(!m&&kind!=='subj')toast(`${SEG.LABEL[kind]||kind} : rien de net trouvé dans cette photo`,4000);
  return m};
AI.categories=()=>['subj','sky','people','bg','vegetation','water','mountains','buildings','ground','face','skin','hair','clothes'];
AI.categoryLabel=k=>SEG.LABEL[k]||k;
AI.scene=scene;AI.ortSession=session;

// the sky selection keeps its colour analysis for the fine detail and takes the scene model's word on what is sky
AI.skyPrior=async(W,H)=>{const sc=await scene();if(!sc)return null;return gridTo(groupGrid(sc,SEG.GROUPS.sky),sc.gw,sc.gh,W,H)};

// Sélection > Sélectionner (IA) : every kind
{const mi=MENU2.select.items;MENU2.select.items=()=>{const a=mi();if(a.some(x=>x&&x.label==='Sélectionner par catégorie (IA)'))return a;
  let i=a.findIndex(x=>x&&x.label==='Sélectionner le ciel');if(i<0)i=a.findIndex(x=>x&&x.label&&/Sélectionner le sujet/.test(x.label));
  const sub=()=>AI.categories().filter(k=>k!=='subj'&&k!=='sky').map(k=>MI(SEG.LABEL[k],{fn:async()=>{const d=S.doc;const m=await AI.categoryMask(k);if(!m||S.doc!==d)return;combineSel(m,'new','Sélectionner : '+SEG.LABEL[k]);toast('Sélection : '+SEG.LABEL[k])}}));
  a.splice(i<0?a.length:i+1,0,MI('Sélectionner par catégorie (IA)',{icon:'subject',sub,dis:docDis()}));return a}}
