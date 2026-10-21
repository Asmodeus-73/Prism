/* ================= sparse layers (calques épars) ================= */
/* A pixel layer that is mostly empty (text, shape, a few strokes, a small paste) keeps only the area that has content once edits settle:
   a canvas cropped to its non-transparent box (+2 px), placed at an offset. L.canvas stays the public contract: on a compacted layer it is an accessor
   that rebuilds the full-size canvas the first time code that does not know about sparse layers reads it, and the layer is an ordinary one again.
   Sparse-aware code (rendering, thumbnails, history, saving) reads lcv(L) and never triggers a rebuild.
   The store is immutable and shared by the live layer and its history snapshots (same copy-on-write rule as full canvases).
   While the original full canvas is still referenced elsewhere (a tool or a dialog that kept it), a rebuild returns that very canvas, so identity checks keep working. */
const SPM=new WeakMap(),SPCHK=new WeakMap();
const SPARSE={on:true,ratio:.5,pad:2,delay:1500,t:null,act:0,down:false,stats:{compact:0,expand:0,scan:0,slice:0},log:null};
function lcv(L){const s=SPM.get(L);return s?s.c:L.canvas}
const spOf=L=>SPM.get(L)||null;
function spPlain(o,v){SPM.delete(o);Object.defineProperty(o,'canvas',{value:v,writable:true,enumerable:true,configurable:true})}
function spExpand(s){const c=mk(s.w,s.h);if(s.c._cs)c._cs=s.c._cs;else delete c._cs;cx(c).drawImage(s.c,s.x,s.y);return c}
function spFull(s,fresh){const r=!fresh&&s.ref&&s.ref.deref();if(r&&r.width===s.w&&r.height===s.h)return r;SPARSE.stats.expand++;if(SPARSE.log)SPARSE.log.push(new Error('expand').stack);return spExpand(s)}
function spAttach(o,s){SPM.set(o,s);Object.defineProperty(o,'canvas',{configurable:true,enumerable:true,get(){const t=SPM.get(o);if(!t)return undefined;const c=spFull(t);spPlain(o,c);return c},set(v){spPlain(o,v)}})}
/* a copy of a layer object that keeps it sparse ({...L} would read the accessor and rebuild the canvas) */
function spCopy(L){const s=SPM.get(L);if(!s)return{...L};const o={};for(const k of Object.keys(L))if(k!=='canvas')o[k]=L[k];spAttach(o,s);return o}
/* a canvas of this layer the caller may draw into (copy-on-write) */
function spEditable(L){const s=SPM.get(L);if(!s)return cloneC(L.canvas);const c=spFull(s,true);spPlain(L,c);return c}
/* exact box of the pixels with alpha > 0, read in strips: rows from the top, rows from the bottom, then only the side columns still unknown */
/* (a generator: the idle compactor reads one strip at a time and never blocks the page for long) */
function* spBoxGen(c){const W=c.width,H=c.height,g=rx(c),B=128;SPARSE.stats.scan++;
  const scan=(x,y,w,h)=>{if(w<=0||h<=0)return null;const a=new Uint32Array(g.getImageData(x,y,w,h).data.buffer);let X0=w,X1=-1,Y0=-1,Y1=-1;
    for(let j=0;j<h;j++){const o=j*w;let i=0;while(i<w&&!(a[o+i]>>>24))i++;if(i===w)continue;if(Y0<0)Y0=j;Y1=j;if(i<X0)X0=i;let k=w-1;while(k>X1&&!(a[o+k]>>>24))k--;if(k>X1)X1=k}
    return Y0<0?null:{x0:x+X0,x1:x+X1,y0:y+Y0,y1:y+Y1}};
  let b=null,ty=0;for(;ty<H;ty+=B){b=scan(0,ty,W,Math.min(B,H-ty));if(b)break;yield}if(!b)return null;
  let by=Math.floor((H-1)/B)*B;for(;by>ty;by-=B){yield;const r=scan(0,by,W,Math.min(B,H-by));if(r){b.y1=r.y1;b.x0=Math.min(b.x0,r.x0);b.x1=Math.max(b.x1,r.x1);break}}
  const ys=ty+B,ye=by>ty?by:ty+B;if(ye>ys){for(let x=0;x<b.x0;x+=B){yield;const r=scan(x,ys,Math.min(B,b.x0-x),ye-ys);if(r){b.x0=r.x0;break}}
    for(let x=W;x>b.x1+1;x-=B){yield;const x0=Math.max(b.x1+1,x-B),r=scan(x0,ys,x-x0,ye-ys);if(r){b.x1=r.x1;break}}}
  return b}
function spBox(c){const it=spBoxGen(c);let r;while(!(r=it.next()).done);return r.value}
/* builds the sparse store of a full canvas (b: its content box), or null when the content covers too much of it */
function spMake(C,b){if(b===undefined)b=spBox(C);const W=C.width,H=C.height;let x=0,y=0,w=1,h=1;
  if(b){const p=SPARSE.pad;x=Math.max(0,b.x0-p);y=Math.max(0,b.y0-p);w=Math.min(W,b.x1+1+p)-x;h=Math.min(H,b.y1+1+p)-y;if(w*h>W*H*SPARSE.ratio)return null}
  const c=document.createElement('canvas');c.width=w;c.height=h;if(C._cs)c._cs=C._cs;if(b)cx(c).drawImage(C,-x,-y);c.__sp=1;c.__sx=x;c.__sy=y;
  return{c,x,y,w:W,h:H,ref:typeof WeakRef==='function'?new WeakRef(C):null}}
/* a store built from saved tiles that only cover part of the photo (a sparse layer saved by this version) */
async function spDecode(tiles,W,H,getBlob){let x0=W,y0=H,x1=0,y1=0;for(const t of tiles){x0=Math.min(x0,t.x);y0=Math.min(y0,t.y);x1=Math.max(x1,t.x+t.w);y1=Math.max(y1,t.y+t.h)}
  x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(W,x1);y1=Math.min(H,y1);if(!(x1>x0&&y1>y0)||(x1-x0)*(y1-y0)>W*H*SPARSE.ratio)return null;
  const c=mk(x1-x0,y1-y0),g=cx(c);for(const t of tiles){const b=await getBlob(t);if(!b)throw new Error('tuile manquante');const bm=await createImageBitmap(b);g.drawImage(bm,t.x-x0,t.y-y0);bm.close&&bm.close()}
  c.__sp=1;c.__sx=x0;c.__sy=y0;return{c,x:x0,y:y0,w:W,h:H,ref:null}}
/* loading a layer's pixels: sparse when the saved tiles allow it (and nothing ties other data to the canvas identity) */
async function loadLayerCanvas(L,e,W,H,getBlob){const tiles=e.canvas,s=!(e.so||e.fbase||e.hi||e.bif||e.qmask)&&e.kind==='pixel'?await spDecode(tiles,W,H,getBlob):null;
  if(s){spAttach(L,s);encCache.set(s.c,tiles);return}L.canvas=await decodeTiles(tiles,W,H,getBlob);encCache.set(L.canvas,tiles)}
/* every layer object of the open document: the live stack, undo history, snapshots */
function spAllLayers(){const d=S.doc,out=[];if(!d)return out;const add=(ls,w,h)=>{if(ls)for(const o of ls)out.push([o,w,h])};add(d.layers,d.w,d.h);
  for(const h of S.history||[])if(h&&h.layers)add(h.layers,h.w,h.h);try{if(window.PrismB)PrismB.snaps(d).forEach(e=>e.s&&e.s.layers&&add(e.s.layers,e.s.w,e.s.h))}catch(e){}return out}
function spOK(o,w,h){if(o.kind!=='pixel'||SPM.has(o)||o.hi||o.hiP||o.so||o.fbase||o.bif||o.qmask||o.preview||o.dx||o.dy)return false;const c=Object.getOwnPropertyDescriptor(o,'canvas');
  return !!(c&&'value' in c&&c.value&&c.value.getContext&&!c.value.__sp&&c.value.width===w&&c.value.height===h)}
/* the canvases worth looking at, each with every layer object that holds it */
function spCandidates(){const m=new Map(),bad=new Set();const d=S.doc,keep=new Set([d&&d.sel]);
  for(const [o,w,h] of spAllLayers()){const c=Object.getOwnPropertyDescriptor(o,'canvas');const C=c&&c.value;if(o.mask)keep.add(o.mask);if(!C||SPM.has(o))continue;if(!spOK(o,w,h)){bad.add(C);continue}let a=m.get(C);if(!a)m.set(C,a=[]);a.push(o)}
  const out=[];for(const [C,a] of m){if(bad.has(C)||keep.has(C))continue;const k=SPCHK.get(C);if(k!=null&&k===(C._v|0))continue;out.push([C,a])}return out}
function spCompact(C,refs,b){const s=spMake(C,b);if(!s){SPCHK.set(C,C._v|0);return false}for(const o of refs)spAttach(o,s);SPARSE.stats.compact++;return true}
/* the editor is idle: nothing is being drawn, dragged, transformed, saved, computed or edited in a dialog */
function spIdle(){if(!S.doc||S.stroke||S.drag||S.tf||S.sliding||SPARSE.down||(typeof SAVE!=='undefined'&&SAVE.running))return false;if($('#scrim'))return false;const b=$('#busy');if(b&&!b.hidden)return false;return true}
function spSchedule(ms,act){if(act)SPARSE.act=performance.now();if(!SPARSE.on)return;clearTimeout(SPARSE.t);SPARSE.t=setTimeout(spRun,ms==null?SPARSE.delay:ms)}
function spRun(){SPARSE.t=null;if(!SPARSE.on||!S.doc)return;if(!spIdle()||performance.now()-SPARSE.act<SPARSE.delay){SPARSE.job=null;spSchedule(500);return}
  const t0=performance.now();while(performance.now()-t0<12){let j=SPARSE.job;
    if(!j){const c=spCandidates();if(!c.length)return;const C=c[0][0];j=SPARSE.job={C,v:C._v|0,doc:S.doc,it:spBoxGen(C)}}
    if(j.doc!==S.doc||(j.C._v|0)!==j.v){SPARSE.job=null;continue}
    const r=j.it.next();if(!r.done)continue;SPARSE.job=null;const e=spCandidates().find(x=>x[0]===j.C);if(e)spCompact(j.C,e[1],r.value)}
  SPARSE.stats.slice=Math.max(SPARSE.stats.slice,performance.now()-t0);spSchedule(16)}
/* new pixels for content that a sparse store holds (a text redrawn once its font arrives): every layer object sharing the store follows, as they shared the canvas before */
function spReplace(s,C){const ns=spMake(C);for(const [o] of spAllLayers())if(SPM.get(o)===s){if(ns)spAttach(o,ns);else spPlain(o,C)}}
SPARSE.compactAll=async()=>{SPARSE.job=null;let n=0;for(const [C,refs] of spCandidates())if(spCompact(C,refs))n++;return n};
SPARSE.run=spRun;SPARSE.schedule=spSchedule;
/* alpha of one pixel of a layer, without rebuilding a sparse one */
function lAlpha(L,x,y){const c=lcv(L);if(!c)return 0;if(c.__sp){x-=c.__sx;y-=c.__sy;if(x<0||y<0||x>=c.width||y>=c.height)return 0}return rx(c).getImageData(x,y,1,1).data[3]}
/* memory held by a layer's pixels (cropped canvas when sparse) */
function layerBytes(L){const c=lcv(L);let b=c&&c.width?c.width*c.height*4:0;if(L.mask)b+=L.mask.width*L.mask.height*4;if(L.hi)b+=L.hi.byteLength||0;return b}
SPARSE.bytes=(d=S.doc)=>{if(!d)return 0;const seen=new Set();let b=0;const add=c=>{if(c&&!seen.has(c)){seen.add(c);b+=(c.width*c.height*4)||0}};
  for(const L of d.layers){add(lcv(L));add(L.mask);if(L.hi&&!seen.has(L.hi)){seen.add(L.hi);b+=L.hi.byteLength}}return b};
addEventListener('pointerdown',()=>{SPARSE.down=true;SPARSE.act=performance.now()},true);
addEventListener('pointerup',()=>{SPARSE.down=false;SPARSE.act=performance.now();spSchedule()},true);
addEventListener('pointercancel',()=>{SPARSE.down=false},true);addEventListener('blur',()=>{SPARSE.down=false});
addEventListener('keydown',()=>{SPARSE.act=performance.now()},true);
