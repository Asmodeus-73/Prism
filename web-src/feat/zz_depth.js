/* ===== Profondeur et visages (IA) : rééclairage 3D, brume selon la distance, sélection selon la distance, anonymiser les visages ===== */
/* Profondeur : Depth Anything V2 Small (Apache 2.0). Visages : YuNet, OpenCV zoo (MIT). Les deux tournent sur l'appareil.
   La carte de profondeur est calculée une fois par état de la photo, recalée sur les bords de la photo (filtre guidé),
   puis gardée à une définition de travail (1536 px au plus) ; les effets la suivent à pleine définition. */
const DP={sess:{},P:{},cache:null,faces:null};
async function ortReady(){if(!window.ort)await loadScript(await ORTX.bundle());const ort=window.ort;ort.env.wasm.wasmPaths=asset('ai/');{const bin=await ORTX.binary();if(bin)ort.env.wasm.wasmBinary=bin}
  ort.env.wasm.numThreads=ORTX.threads();ort.env.wasm.proxy=false;return ort}
function session(dir,label,mb){if(DP.sess[dir])return Promise.resolve(DP.sess[dir]);if(DP.P[dir])return DP.P[dir];
  return DP.P[dir]=(async()=>{let off=false;try{const ort=await ortReady();
      const {buf}=await AI.fetchModel(dir,label,p=>off||busy(true,`Téléchargement du modèle ${label} (${mb}, une seule fois)…`,p*0.95));
      busy(true,'Préparation du modèle…',0.97);const s=await ORTX.create(ort,buf.buffer,{graphOptimizationLevel:'all'});DP.sess[dir]=s;return s}
    catch(e){console.error(e);toast(`Le modèle ${label} n’a pas pu se charger : `+(e.message||e),5000);return null}
    finally{off=true;DP.P[dir]=null;busy(false)}})()}
const docKey=d=>d.layers.filter(L=>L.kind==='pixel'&&L.visible!==false).map(L=>[L.canvas,L.x|0,L.y|0,L.opacity]).flat();
const sameKey=(a,b)=>a.length===b.length&&a.every((v,i)=>(v instanceof WeakRef?v.deref():v)===b[i]);
const weakKey=k=>k.map(v=>v&&typeof v==='object'?new WeakRef(v):v);
const sstep=(a,b,x)=>{if(b<=a)return x<a?0:1;const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const hex=c=>{const n=parseInt(c.slice(1),16);return[n>>16&255,n>>8&255,n&255]};
const toHex=a=>'#'+a.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
const COL='style="width:44px;height:26px;padding:0;border:0;background:none"';

/* ---------- carte de profondeur : 0 = loin, 1 = proche ---------- */
async function depthMap(){const d=S.doc;if(!d)return null;const key=docKey(d),C=DP.cache;if(C&&C.d.deref()===d&&sameKey(C.key,key))return C;
  const sess=await session('ai/depth1/','de profondeur','50 Mo');if(!sess||S.doc!==d)return null;
  busy(true,'Calcul de la profondeur…',null);await tick();
  try{const R=518,src=flatSync(),t=mk(R,R),g=rx(t);g.imageSmoothingQuality='high';g.fillStyle='#000';g.fillRect(0,0,R,R);g.drawImage(src,0,0,R,R);
    const a=g.getImageData(0,0,R,R).data,N=R*R,f=new Float32Array(3*N),M=[0.485,0.456,0.406],SD=[0.229,0.224,0.225];
    for(let i=0;i<N;i++)for(let c=0;c<3;c++)f[c*N+i]=(a[i*4+c]/255-M[c])/SD[c];
    const ort=window.ort,out=await sess.run({[sess.inputNames[0]]:new ort.Tensor('float32',f,[1,3,R,R])}),o=out[sess.outputNames[0]].data;
    if(S.doc!==d)return null;
    // relative depth: stretched between the 1st and 99th percentiles (a few extreme pixels do not flatten the rest)
    const s=Float32Array.from(o).sort(),lo=s[Math.floor(N*0.01)],hi=s[Math.floor(N*0.99)],k=hi>lo?1/(hi-lo):1;
    const sc=Math.min(1,1536/Math.max(d.w,d.h)),W=Math.max(1,Math.round(d.w*sc)),H=Math.max(1,Math.round(d.h*sc));
    const small=new Float32Array(N);for(let i=0;i<N;i++)small[i]=clamp((o[i]-lo)*k,0,1);
    // bilinear 518 × 518 -> W × H, then snapped to the photo's edges
    const D=new Float32Array(W*H);for(let y=0;y<H;y++){const fy=clamp((y+0.5)*R/H-0.5,0,R-1),y0=fy|0,y1=Math.min(R-1,y0+1),ty=fy-y0;
      for(let x=0;x<W;x++){const fx=clamp((x+0.5)*R/W-0.5,0,R-1),x0=fx|0,x1=Math.min(R-1,x0+1),tx=fx-x0;
        D[y*W+x]=(small[y0*R+x0]*(1-tx)+small[y0*R+x1]*tx)*(1-ty)+(small[y1*R+x0]*(1-tx)+small[y1*R+x1]*tx)*ty}}
    busy(true,'Affinage des contours…',null);await tick();
    const gc=mk(W,H),gg=rx(gc);gg.imageSmoothingQuality='high';gg.drawImage(src,0,0,W,H);const G=gg.getImageData(0,0,W,H).data,n=W*H,Ir=new Float32Array(n),Ig=new Float32Array(n),Ib=new Float32Array(n);
    for(let i=0;i<n;i++){Ir[i]=G[i*4]/255;Ig[i]=G[i*4+1]/255;Ib[i]=G[i*4+2]/255}
    const q=guidedFilter(Ir,Ig,Ib,D,W,H,Math.max(2,Math.round(Math.max(W,H)/220)),0.0008);for(let i=0;i<n;i++)q[i]=clamp(q[i],0,1);
    if(S.doc!==d)return null;return DP.cache={d:new WeakRef(d),key:weakKey(key),D:q,W,H}}
  catch(e){console.error(e);toast('Calcul de la profondeur impossible : '+(e.message||e),5000);return null}finally{busy(false)}}
/* a working-resolution map (Float32 0..1) at the layer's full size, read back through a canvas (bilinear) */
function mapTo(M,W,H,L,enc){const c=mk(W,H),g=rx(c),im=g.createImageData(W,H),a=im.data;for(let i=0;i<W*H;i++){const v=enc(M,i);a[i*4]=v[0];a[i*4+1]=v[1];a[i*4+2]=v[2];a[i*4+3]=255}g.putImageData(im,0,0);
  const d=S.doc,o=mk(L.canvas.width,L.canvas.height),og=rx(o);og.imageSmoothingQuality='high';og.drawImage(c,-(L.x|0),-(L.y|0),d.w,d.h);return og.getImageData(0,0,o.width,o.height).data}
const layerPx=L=>rx(L.canvas).getImageData(0,0,L.canvas.width,L.canvas.height);

/* ---------- brume selon la distance ---------- */
function farColor(dm,L){const {D,W,H}=dm,s=Float32Array.from(D).sort(),cut=s[Math.floor(s.length*0.06)],d=S.doc,c=mk(W,H),g=rx(c);g.drawImage(flatSync(),0,0,W,H);const a=g.getImageData(0,0,W,H).data;
  let r=0,gg=0,b=0,n=0;for(let i=0;i<W*H;i++)if(D[i]<=cut){r+=a[i*4];gg+=a[i*4+1];b+=a[i*4+2];n++}if(!n)return[200,205,212];
  // the far tones, lifted toward a pale grey: haze is lighter than what it covers
  return[r/n*0.5+110,gg/n*0.5+112,b/n*0.5+116]}
function fogRun(L,dm,p){const im=layerPx(L),a=im.data,{D,W,H}=dm,k=3,norm=1-Math.exp(-k),st=p.start/100,den=p.density/100,c=p.color;
  const F=new Float32Array(W*H);for(let i=0;i<W*H;i++){const far=1-D[i],t=clamp((far-st)/Math.max(0.02,1-st),0,1);F[i]=den*(1-Math.exp(-k*t))/norm}
  const m=mapTo(F,W,H,L,(M,i)=>{const v=Math.round(M[i]*255);return[v,v,v]});
  for(let i=0;i<a.length;i+=4){const f=m[i]/255;if(!f)continue;a[i]+=(c[0]-a[i])*f;a[i+1]+=(c[1]-a[i+1])*f;a[i+2]+=(c[2]-a[i+2])*f}
  const o=mk(im.width,im.height);rx(o).putImageData(im,0,0);return o}

/* ---------- rééclairage 3D : normales tirées de la profondeur, lumière ponctuelle placée sur la photo ---------- */
function normals(dm,relief){const {D,W,H}=dm,b=new Float32Array(W*H),b2=new Float32Array(W*H),T=new Float32Array(W*H),r=Math.max(2,Math.round(Math.max(W,H)/90));
  // smoothed well first (two box passes): the normals follow the shapes, not the texture, and a cut-out edge does not draw a line
  boxMean(D,W,H,r,b,T);boxMean(b,W,H,r,b2,T);const N=new Float32Array(W*H*3),s=relief*Math.max(W,H)/6,lim=v=>v/(1+Math.abs(v)/1.2);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,dx=(b2[y*W+Math.min(W-1,x+1)]-b2[y*W+Math.max(0,x-1)])*0.5,dy=(b2[Math.min(H-1,y+1)*W+x]-b2[Math.max(0,y-1)*W+x])*0.5;
    const nx=-lim(dx*s),ny=-lim(dy*s),l=Math.hypot(nx,ny,1);N[i*3]=nx/l;N[i*3+1]=ny/l;N[i*3+2]=1/l}return N}
function relightRun(L,dm,p){const {D,W,H}=dm,d=S.doc;if(!p.N||p.N.relief!==p.relief){p.N=normals(dm,p.relief/100);p.N.relief=p.relief}const N=p.N;
  const sx=W/d.w,lx=p.lx*sx,ly=p.ly*sx,big=Math.max(W,H),hz=p.height/100*big,reach=p.reach/100*big*1.5,amb=1-p.darken/100,int=p.power/100*1.6,c=p.color.map(v=>v/255);
  const Sh=new Float32Array(W*H*3);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,z=(D[i]-0.5)*big*0.25*p.relief/100,vx=lx-x,vy=ly-y,vz=hz-z,l=Math.hypot(vx,vy,vz)||1;
    const lam=Math.max(0,(N[i*3]*vx+N[i*3+1]*vy+N[i*3+2]*vz)/l),dist=Math.hypot(vx,vy),att=1/(1+(dist/reach)*(dist/reach)),e=int*lam*att;
    Sh[i*3]=amb+e*c[0];Sh[i*3+1]=amb+e*c[1];Sh[i*3+2]=amb+e*c[2]}
  // multipliers 0..2 carried in 8 bits (×127.5)
  const m=mapTo(Sh,W,H,L,(M,i)=>[Math.min(255,Math.round(M[i*3]*127.5)),Math.min(255,Math.round(M[i*3+1]*127.5)),Math.min(255,Math.round(M[i*3+2]*127.5))]);
  const im=layerPx(L),a=im.data;for(let i=0;i<a.length;i+=4){a[i]=a[i]*m[i]/127.5;a[i+1]=a[i+1]*m[i+1]/127.5;a[i+2]=a[i+2]*m[i+2]/127.5}
  const o=mk(im.width,im.height);rx(o).putImageData(im,0,0);return o}

/* ---------- boîte commune : aperçu en direct sur le calque, la photo reste cliquable ---------- */
const mixSel=(o,r,sel)=>{const out=cloneC(o),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(sel,0,0);const t=cloneC(r),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(sel,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};
function onPhoto(fn){/* pointer on the photo while a light dialog is open: fn('down'|'move'|'up', doc point) */let on=false;
  const dn=e=>{if(e.target!==view||e.button>0)return;e.preventDefault();e.stopImmediatePropagation();on=true;fn('down',evPos(e))},
    mv=e=>{if(!on)return;e.preventDefault();e.stopImmediatePropagation();fn('move',evPos(e))},up=e=>{if(!on)return;on=false;e.stopImmediatePropagation();fn('up',evPos(e))};
  addEventListener('pointerdown',dn,true);addEventListener('pointermove',mv,true);addEventListener('pointerup',up,true);document.body.classList.add('dp-on');
  return()=>{removeEventListener('pointerdown',dn,true);removeEventListener('pointermove',mv,true);removeEventListener('pointerup',up,true);document.body.classList.remove('dp-on')}}
async function fxDialog(o){const d=S.doc;if(!d)return;const L=pixelTarget();if(!L){toast('Aucun calque de pixels');return}
  if(L.visible===false){toast('Ce calque est masqué : affichez-le d’abord');return}
  const dm=o.depth?await depthMap():null;if(o.depth&&!dm)return;if(S.doc!==d||!d.layers.includes(L))return;
  const p={...o.init(L,dm)};let tmr=null,off=null;const alive=()=>S.doc===d&&d.layers.includes(L);
  const clear=()=>{clearTimeout(tmr);delete L.preview;off&&off();off=null};
  const run=()=>{let r=o.run(L,dm,p);if(d.sel)r=mixSel(L.canvas,r,d.sel);return r};
  const prev=(ms=120)=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(!alive())return;try{L.preview=run();o.mark&&o.mark(L.preview,p,L);markComp()}catch(e){console.error(e);toast('Aperçu impossible : '+(e.message||e),3000)}},ms)};
  dialog({title:o.title,light:true,
    body:(o.note?`<p class="muted" style="margin:0 0 8px">${o.note}</p>`:'')+(o.colors||[]).map(c=>`<div class="row"><label for="dp-${c[0]}">${c[1]}</label><input type="color" id="dp-${c[0]}" value="${toHex(p[c[0]])}" ${COL}></div>`).join('')
      +o.params.map(q=>rangeRow('dp-'+q[0],q[1],q[2],q[3],q[4],p[q[0]],q[6])).join('')+(o.extra||'')+(d.sel?'<p class="muted">Appliqué à la sélection.</p>':''),
    onOpen:el=>{o.params.forEach(q=>{const i=$('#dp-'+q[0],el);i.oninput=()=>{p[q[0]]=+i.value;$('#dp-'+q[0]+'-o',el).textContent=fmtN(+i.value,q[4])+q[6];prev()}});
      (o.colors||[]).forEach(c=>{const i=$('#dp-'+c[0],el);i.oninput=()=>{p[c[0]]=hex(i.value);prev()}});
      if(o.onPhoto)off=onPhoto((k,pt)=>{o.onPhoto(k,pt,p,el);prev(k==='move'?60:0)});o.onOpen&&o.onOpen(el,p,prev);prev(0)},
    buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
      {label:'Appliquer',primary:true,onClick:()=>{clear();if(!alive()){toast('Le calque n’existe plus');return}
        try{applyMasked(L,run(),o.title);syncAll()}catch(e){console.error(e);markComp();toast(o.title+' impossible : '+(e.message||e),4000);return false}}}]})}

function fogDialog(){fxDialog({title:'Brume selon la distance',depth:true,
  note:'Ajoute de la brume qui s’épaissit avec l’éloignement, d’après la profondeur estimée par l’IA. La couleur vient du lointain de la photo.',
  colors:[['color','Couleur de la brume']],
  params:[['density','Densité',0,100,1,0,' %'],['start','Début',0,95,1,0,' %']],
  init:(L,dm)=>({density:60,start:20,color:farColor(dm,L)}),run:fogRun})}
function relightDialog(){const d=S.doc;if(!d)return;fxDialog({title:'Rééclairage 3D',depth:true,
  note:'Cliquez ou glissez sur la photo pour placer la lumière. Le relief vient de la profondeur estimée par l’IA.',
  colors:[['color','Couleur de la lumière']],
  params:[['power','Intensité',0,100,1,0,' %'],['darken','Assombrir le reste',0,90,1,0,' %'],['reach','Portée',5,100,1,0,' %'],['height','Hauteur de la lumière',2,100,1,0,' %'],['relief','Relief',0,100,1,0,' %']],
  init:()=>({power:80,darken:55,reach:40,height:25,relief:60,color:[255,236,210],lx:d.w*0.3,ly:d.h*0.3}),
  onPhoto:(k,pt,p)=>{p.lx=pt.x;p.ly=pt.y},run:relightRun,
  // where the light is: a ring on the preview only, never in the result
  mark:(c,p,L)=>{const g=cx(c),r=Math.max(8,Math.max(d.w,d.h)/90),x=p.lx-(L.x|0),y=p.ly-(L.y|0);g.save();g.lineWidth=r/4;g.strokeStyle='rgba(0,0,0,.55)';g.beginPath();g.arc(x,y,r,0,7);g.stroke();g.lineWidth=r/8;g.strokeStyle='#fff';g.beginPath();g.arc(x,y,r,0,7);g.stroke();g.restore()}})}

/* ---------- sélection selon la distance ---------- */
async function depthSelDialog(){const d=S.doc;if(!d)return;const dm=await depthMap();if(!dm||S.doc!==d)return;const old=d.sel,p={near:100,far:55,soft:8};let tmr=null;
  const build=()=>{const {D,W,H}=dm,lo=p.far/100,hi=p.near/100,s=p.soft/100,F=new Float32Array(W*H);for(let i=0;i<W*H;i++){const v=D[i];F[i]=sstep(lo-s,lo+s,v)*(hi>=1?1:1-sstep(hi-s,hi+s,v))}
    const c=mk(W,H),g=rx(c),im=g.createImageData(W,H),a=im.data;for(let i=0;i<W*H;i++){a[i*4]=a[i*4+1]=a[i*4+2]=255;a[i*4+3]=Math.round(F[i]*255)}g.putImageData(im,0,0);
    const m=mk(d.w,d.h),mg=cx(m);mg.imageSmoothingQuality='high';mg.drawImage(c,0,0,d.w,d.h);return m};
  const show=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(S.doc!==d)return;d.sel=build();selChanged()},100)};
  dialog({title:'Sélectionner selon la distance',light:true,
    body:'<p class="muted" style="margin:0 0 8px">Sélectionne ce qui se trouve entre deux distances, d’après la profondeur estimée par l’IA (100 % = le plus proche).</p>'+rangeRow('ds-near','Jusqu’à (proche)',0,100,1,p.near,' %')+rangeRow('ds-far','À partir de (loin)',0,100,1,p.far,' %')+rangeRow('ds-soft','Douceur',0,30,1,p.soft,' %'),
    onOpen:el=>{[['near','ds-near'],['far','ds-far'],['soft','ds-soft']].forEach(([k,id])=>{const i=$('#'+id,el);i.oninput=()=>{p[k]=+i.value;$('#'+id+'-o',el).textContent=i.value+' %';show()}});show()},
    buttons:[{label:'Annuler',onClick:()=>{clearTimeout(tmr);if(S.doc===d){d.sel=old;selChanged()}}},
      {label:'Sélectionner',primary:true,onClick:()=>{clearTimeout(tmr);if(S.doc!==d)return;const m=build();d.sel=old;combineSel(m,'new','Sélectionner selon la distance')}}]})}

/* ---------- visages : YuNet (640 × 640, BGR 0..255), sorties par pas 8, 16, 32 ---------- */
function decodeYu(out,k,ox,oy,th){const F=[];for(const s of [8,16,32]){const cls=out['cls_'+s].data,obj=out['obj_'+s].data,bb=out['bbox_'+s].data,cols=640/s;
    for(let i=0;i<cls.length;i++){const sc=Math.sqrt(clamp(cls[i],0,1)*clamp(obj[i],0,1));if(sc<th)continue;const c=i%cols,r=(i/cols)|0;
      const cxp=(c+bb[i*4])*s,cyp=(r+bb[i*4+1])*s,w=Math.exp(bb[i*4+2])*s,h=Math.exp(bb[i*4+3])*s;F.push({x:ox+(cxp-w/2)/k,y:oy+(cyp-h/2)/k,w:w/k,h:h/k,s:sc})}}return F}
const iou=(a,b)=>{const x0=Math.max(a.x,b.x),y0=Math.max(a.y,b.y),x1=Math.min(a.x+a.w,b.x+b.w),y1=Math.min(a.y+a.h,b.y+b.h),i=Math.max(0,x1-x0)*Math.max(0,y1-y0);return i/(a.w*a.h+b.w*b.h-i||1)};
function nms(F){F.sort((a,b)=>b.s-a.s);const k=[];for(const f of F)if(!k.some(g=>iou(f,g)>0.3||(f.x>=g.x&&f.y>=g.y&&f.x+f.w<=g.x+g.w&&f.y+f.h<=g.y+g.h)))k.push(f);return k}
async function detectFaces(){const d=S.doc;if(!d)return null;const key=docKey(d),C=DP.faces;if(C&&C.d.deref()===d&&sameKey(C.key,key))return C.F;
  const sess=await session('ai/face1/','des visages','0,2 Mo');if(!sess||S.doc!==d)return null;busy(true,'Recherche des visages…',null);await tick();
  try{const src=flatSync(),ort=window.ort,R=640,F=[];
    const pass=async(x0,y0,w,h)=>{const k=R/Math.max(w,h),t=mk(R,R),g=rx(t);g.fillStyle='#000';g.fillRect(0,0,R,R);g.imageSmoothingQuality='high';g.drawImage(src,x0,y0,w,h,0,0,w*k,h*k);
      const a=g.getImageData(0,0,R,R).data,N=R*R,f=new Float32Array(3*N);for(let i=0;i<N;i++){f[i]=a[i*4+2];f[N+i]=a[i*4+1];f[2*N+i]=a[i*4]}
      const out=await sess.run({[sess.inputNames[0]]:new ort.Tensor('float32',f,[1,3,R,R])});F.push(...decodeYu(out,k,x0,y0,0.6))};
    await pass(0,0,d.w,d.h);
    // large photos: also in overlapping tiles, so that small faces in a group are found
    const long=Math.max(d.w,d.h);if(long>1000){const T=Math.round(long/2),step=Math.round(T*0.75);
      for(let y=0;y<d.h;y+=step){for(let x=0;x<d.w;x+=step){await pass(x,y,Math.min(T,d.w-x),Math.min(T,d.h-y));if(x+T>=d.w)break}if(y+T>=d.h)break}}
    const K=nms(F).filter(f=>f.w>6&&f.h>6);if(S.doc!==d)return null;DP.faces={d:new WeakRef(d),key:weakKey(key),F:K};return K}
  catch(e){console.error(e);toast('Recherche des visages impossible : '+(e.message||e),5000);return null}finally{busy(false)}}
function hideFaces(L,faces,p){const d=S.doc,out=cloneC(L.canvas),g=cx(out),src=L.canvas,ox=L.x|0,oy=L.y|0,m=p.margin/100;
  for(const f of faces){if(f.off)continue;const w=f.w*(1+m),h=f.h*(1+m)*1.15,x=f.x+f.w/2-w/2-ox,y=f.y+f.h/2-h/2-oy-f.h*0.05,pad=Math.ceil(Math.max(w,h)*0.3);
    const X=Math.max(0,Math.floor(x-pad)),Y=Math.max(0,Math.floor(y-pad)),X1=Math.min(src.width,Math.ceil(x+w+pad)),Y1=Math.min(src.height,Math.ceil(y+h+pad)),cw=X1-X,ch=Y1-Y;if(cw<2||ch<2)continue;
    const piece=mk(cw,ch),pg=cx(piece);pg.drawImage(src,X,Y,cw,ch,0,0,cw,ch);let fx;
    if(p.style==='pixel'){const n=Math.max(2,Math.round(12-p.strength/10)),bs=Math.max(2,Math.round(Math.max(w,h)/n)),sw=Math.max(1,Math.round(cw/bs)),sh=Math.max(1,Math.round(ch/bs)),t=mk(sw,sh),tg=cx(t);tg.imageSmoothingQuality='high';tg.drawImage(piece,0,0,sw,sh);
      fx=mk(cw,ch);const fg=cx(fx);fg.imageSmoothingEnabled=false;fg.drawImage(t,0,0,cw,ch)}
    else if(p.style==='fill'){fx=mk(cw,ch);const fg=cx(fx);fg.fillStyle=p.fill;fg.fillRect(0,0,cw,ch)}
    else{let b=piece;const r=Math.max(2,Math.max(w,h)*p.strength/100*0.25);b=blurCanvas(b,r);b=blurCanvas(b,r*0.6);fx=b}
    // soft ellipse: the edge fades over a tenth of the face
    const mask=mk(cw,ch),mg=cx(mask),fe=p.style==='fill'?1:Math.max(1,Math.max(w,h)*0.08);mg.filter=`blur(${fe}px)`;mg.fillStyle='#fff';mg.beginPath();mg.ellipse(x-X+w/2,y-Y+h/2,w/2,h/2,0,0,Math.PI*2);mg.fill();mg.filter='none';
    const fg=cx(fx);fg.globalCompositeOperation='destination-in';fg.drawImage(mask,0,0);g.drawImage(fx,X,Y)}
  return out}
async function facesDialog(){const d=S.doc;if(!d)return;const L=pixelTarget();if(!L){toast('Aucun calque de pixels');return}if(L.visible===false){toast('Ce calque est masqué : affichez-le d’abord');return}
  const F0=await detectFaces();if(!F0||S.doc!==d||!d.layers.includes(L))return;const faces=F0.map(f=>({...f,off:false})),p={style:'blur',strength:60,margin:20,fill:'#202020'};let tmr=null,off=null;
  const med=()=>{const s=faces.map(f=>f.w).sort((a,b)=>a-b);return s.length?s[s.length>>1]:Math.max(d.w,d.h)/10};
  const count=el=>{const n=faces.filter(f=>!f.off).length;$('#fa-n',el).textContent=n?`${n} visage${n>1?'s':''} masqué${n>1?'s':''}`+(faces.length>n?` (${faces.length-n} laissé${faces.length-n>1?'s':''} visible${faces.length-n>1?'s':''})`:''):'Aucun visage masqué : cliquez sur un visage pour l’ajouter'};
  const run=()=>{let r=hideFaces(L,faces,p);if(d.sel)r=mixSel(L.canvas,r,d.sel);return r};
  const prev=(ms=100)=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(S.doc!==d)return;L.preview=run();markComp()},ms)};
  const clear=()=>{clearTimeout(tmr);delete L.preview;off&&off();off=null};
  dialog({title:'Anonymiser les visages',light:true,
    body:`<p class="muted" style="margin:0 0 8px">Les visages trouvés par l’IA sont masqués. Cliquez sur un visage pour le laisser visible ou le masquer de nouveau, ou ailleurs pour masquer une zone oubliée.</p>
      <p id="fa-n" style="margin:0 0 8px;font-weight:600"></p>
      <div class="row"><label for="fa-style">Style</label><select id="fa-style"><option value="blur">Flou</option><option value="pixel">Pixellisation</option><option value="fill">Couleur unie</option></select><input type="color" id="fa-fill" value="${p.fill}" ${COL}></div>`
      +rangeRow('fa-strength','Force',10,100,1,p.strength,' %')+rangeRow('fa-margin','Marge autour',0,80,1,p.margin,' %'),
    onOpen:el=>{count(el);const st=$('#fa-style',el),fl=$('#fa-fill',el);fl.hidden=true;st.onchange=()=>{p.style=st.value;fl.hidden=p.style!=='fill';prev(0)};fl.oninput=()=>{p.fill=fl.value;prev()};
      [['strength','fa-strength'],['margin','fa-margin']].forEach(([k,id])=>{const i=$('#'+id,el);i.oninput=()=>{p[k]=+i.value;$('#'+id+'-o',el).textContent=i.value+' %';prev()}});
      off=onPhoto((k,pt)=>{if(k!=='down')return;const hit=faces.find(f=>pt.x>=f.x&&pt.x<=f.x+f.w&&pt.y>=f.y-f.h*0.1&&pt.y<=f.y+f.h*1.1);
        if(hit)hit.off=!hit.off;else{const w=med();faces.push({x:pt.x-w/2,y:pt.y-w*0.6,w,h:w*1.2,s:1,off:false,manual:true})}count(el);prev(0)});
      if(!faces.length)toast('Aucun visage trouvé : cliquez sur la photo pour masquer une zone',4500);prev(0)},
    buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
      {label:'Appliquer',primary:true,onClick:()=>{clear();if(S.doc!==d||!d.layers.includes(L)){toast('Le calque n’existe plus');return}if(!faces.some(f=>!f.off)){toast('Aucun visage à masquer');markComp();return}
        applyMasked(L,run(),'Anonymiser les visages');syncAll()}}]})}

/* ---------- menus ---------- */
{const st=document.createElement('style');st.textContent='body.dp-on #view{cursor:crosshair!important}';document.head.appendChild(st)}
const _fi=MENU2.filter.items;
MENU2.filter.items=function(){const a=_fi.apply(this,arguments),dis=S.doc?false:NODOC,it=MI('Profondeur et visages (IA)',{icon:'filter',dis,sub:()=>[MI('Rééclairage 3D…',{fn:relightDialog,dis}),MI('Brume selon la distance…',{fn:fogDialog,dis}),MI('Anonymiser les visages…',{fn:facesDialog,dis})]});
  const k=a.findIndex(x=>x&&x.label==='Portrait et restauration…');a.splice(k<0?a.length:k+1,0,it);return a};
const _si=MENU2.select.items;
MENU2.select.items=function(){const a=_si.apply(this,arguments),it=MI('Sélectionner selon la distance (IA)…',{fn:depthSelDialog,dis:S.doc?false:NODOC});
  const k=a.findIndex(x=>x&&x.label==='Sélectionner par catégorie (IA)');a.splice(k<0?a.length:k+1,0,it);return a};
window.PrismDepth={depthMap,detectFaces,hideFaces,fog:fogDialog,relight:relightDialog,faces:facesDialog,depthSel:depthSelDialog};
