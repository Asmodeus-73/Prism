/* ===== 0.6: object selection in one click (Segment Anything ViT-B, Meta AI, Apache 2.0).
   The photo is analysed once (image encoder, 1024 px on the long side); each click then asks the small decoder for the object
   under that point, and the mask is snapped to the photo's own edges. The magic wand's "Objet entier (IA)" option turns it on;
   Shift adds, Alt removes, as with every selection tool. ===== */

const SAM={sess:{},P:{},emb:null};
SAM.ENC='ai/sam-b-enc/';SAM.DEC='ai/sam-b-dec/';SAM.N=1024;
SAM.MEAN=[123.675,116.28,103.53];SAM.STD=[58.395,57.12,57.375];

async function samOrt(){if(!window.ort)await loadScript(await ORTX.bundle());const ort=window.ort;ort.env.wasm.wasmPaths=asset('ai/');{const bin=await ORTX.binary();if(bin)ort.env.wasm.wasmBinary=bin}
  ort.env.wasm.numThreads=ORTX.threads();ort.env.wasm.proxy=false;return ort}
function samSession(dir,label,mb){if(SAM.sess[dir])return Promise.resolve(SAM.sess[dir]);if(SAM.P[dir])return SAM.P[dir];
  return SAM.P[dir]=(async()=>{try{const ort=await samOrt();
      const {buf}=await AI.fetchModel(dir,label,p=>busy(true,`Téléchargement du modèle de sélection d’objet (${mb} Mo, une seule fois)…`,p*0.95));
      busy(true,'Préparation du modèle…',0.97);const s=await ORTX.create(ort,buf.buffer,{graphOptimizationLevel:'all'});SAM.sess[dir]=s;return s}
    catch(e){console.error(e);toast('Le modèle de sélection d’objet n’a pas pu se charger : '+(e.message||e),5000);return null}
    finally{SAM.P[dir]=null;busy(false)}})()}
const samT=(s,data,dims)=>s.native?{data,dims,type:'float32'}:new window.ort.Tensor('float32',data,dims);

/* the photo as the encoder sees it: long side 1024, normalised, zeros below and to the right; kept until the photo changes */
async function samEmbed(){const d=S.doc;if(!d)return null;const key=S.docVer,E=SAM.emb;if(E&&E.d.deref()===d&&E.key===key)return E;
  const enc=await samSession(SAM.ENC,'encoder',96);if(!enc||S.doc!==d)return null;
  busy(true,'Analyse de la photo (une fois par photo)…',null);await tick();
  try{const N=SAM.N,k=N/Math.max(d.w,d.h),w=Math.max(1,Math.round(d.w*k)),h=Math.max(1,Math.round(d.h*k)),c=mk(w,h),g=rx(c);g.fillStyle='#fff';g.fillRect(0,0,w,h);g.imageSmoothingQuality='high';g.drawImage(flatSync(),0,0,w,h);
    const a=g.getImageData(0,0,w,h).data,x=new Float32Array(3*N*N);
    for(let y=0;y<h;y++)for(let i=0;i<w;i++){const p=(y*w+i)*4,q=y*N+i;for(let ch=0;ch<3;ch++)x[ch*N*N+q]=(a[p+ch]-SAM.MEAN[ch])/SAM.STD[ch]}
    const out=await enc.run({[enc.inputNames[0]]:samT(enc,x,[1,3,N,N])}),t=out[enc.outputNames[0]];
    if(S.doc!==d)return null;return SAM.emb={d:new WeakRef(d)/* a closed photo is not kept in memory */,key,k,w,h,data:new Float32Array(t.data),dims:t.dims.map(Number)}}
  catch(e){console.error(e);toast('Analyse de la photo impossible : '+(e.message||e),5000);return null}finally{busy(false)}}

/* the object under (px, py) in photo pixels, as a full-size mask (white = selected) */
async function samObjectAt(px,py){const d=S.doc,E=await samEmbed();if(!E||S.doc!==d)return null;
  const dec=await samSession(SAM.DEC,'decoder',8);if(!dec||S.doc!==d)return null;
  busy(true,'Sélection de l’objet…',null);await tick();
  try{const pc=new Float32Array([px*E.k,py*E.k,0,0]),pl=new Float32Array([1,-1]);
    const out=await dec.run({image_embeddings:samT(dec,E.data,E.dims),point_coords:samT(dec,pc,[1,2,2]),point_labels:samT(dec,pl,[1,2]),
      mask_input:samT(dec,new Float32Array(256*256),[1,1,256,256]),has_mask_input:samT(dec,new Float32Array(1),[1]),orig_im_size:samT(dec,new Float32Array([E.h,E.w]),[2])});
    const m=out.masks||out[dec.outputNames[0]],v=m.data,n=E.w*E.h,prob=new Float32Array(n);let on=0;
    for(let i=0;i<n;i++){const p=1/(1+Math.exp(-v[i]));prob[i]=p;if(p>0.5)on++}
    if(!on||S.doc!==d)return null;
    const small=mk(E.w,E.h),sg=cx(small),im=sg.createImageData(E.w,E.h),b=im.data;for(let i=0;i<n;i++){b[i*4]=b[i*4+1]=b[i*4+2]=255;b[i*4+3]=prob[i]*255}sg.putImageData(im,0,0);
    const up=mk(d.w,d.h),ug=cx(up);ug.imageSmoothingQuality='high';ug.drawImage(small,0,0,d.w,d.h);
    const long=Math.max(d.w,d.h),ps=Math.min(1,2048/long);busy(true,'Affinage du contour…',null);await tick();
    try{return await refineMask(up,{radius:clamp(Math.round(long*ps/700),2,12),eps:0.0006,contrast:15,shift:0},ps)}catch(e){console.warn(e);return up}}
  catch(e){console.error(e);toast('Sélection de l’objet impossible : '+(e.message||e),5000);return null}finally{busy(false)}}

let samBusy=false;
async function samClick(px,py,mode){const d=S.doc;if(!d||samBusy)return;if(px<0||py<0||px>=d.w||py>=d.h)return;samBusy=true;
  try{const m=await samObjectAt(px,py);if(!m||S.doc!==d){if(S.doc===d)toast('Aucun objet trouvé à cet endroit');return}
    combineSel(m,mode,'Sélectionner un objet')}finally{samBusy=false}}

/* the wand in object mode: a click picks the object instead of the colour (the live wand's drag does not apply) */
const _odSam=onDown;onDown=function(e,p){if(S.tool==='wand'&&S.opts.wand.obj&&e.button===0&&!S.spaceDown&&!S.wbPick&&!S.rangePick&&S.doc){samClick(p.x,p.y,modeFrom(e));return}return _odSam.apply(this,arguments)};

/* Sélection > Sélectionner un objet (IA) : the wand, in object mode */
function samTool(){S.opts.wand.obj=true;try{PREF.set('wandObj',true)}catch(e){}setTool('wand');try{renderPill()}catch(e){}toast('Cliquez sur un objet de la photo. Maj ajoute un objet, Alt en retire un.',4500)}
S.opts.wand.obj=PREF.get('wandObj',false);
document.addEventListener('change',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.chk==='wand.obj')PREF.set('wandObj',t.checked)},true);
const _sel6=MENU2.select.items;
MENU2.select.items=function(){const a=_sel6.apply(this,arguments),k=a.findIndex(x=>x&&/^Sélectionner le sujet/.test(x.label||''));
  a.splice(k<0?a.length:k+1,0,MI('Sélectionner un objet (IA)',{icon:'wand',fn:samTool,dis:S.doc?false:NODOC}));return a};
window.PrismSAM={embed:samEmbed,objectAt:samObjectAt,click:samClick,tool:samTool};
