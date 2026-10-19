/* ================= stack rendering ================= */
function markComp(){S.docVer++;S.contentDirty=true;requestRender();scheduleThumbs()}
function markContent(){S.contentDirty=true;requestRender()}
// panning: when a full redraw is slow, the last frame slides with the pointer and the photo is redrawn at a steady pace (and once the pointer stops)
function panTo(nx,ny){const dx=nx-S.panX,dy=ny-S.panY;S.panX=nx;S.panY=ny;const now=performance.now();
  if(S.workPos&&(S.contentMs||0)>24&&now-(S.panRedraw||0)<160){S.workPos.x+=Math.round(dx*S.pr);S.workPos.y+=Math.round(dy*S.pr);requestRender();clearTimeout(S.panT);S.panT=setTimeout(markContent,90);return}
  S.panRedraw=now;markContent()}
function layerSrc(L){if(L.preview)return L.preview;const st=S.stroke;if(st&&st.layer===L&&st.live&&st.target==='pixel')return st.liveCanvas();return L.canvas}
function maskSrc(L){if(L.maskPreview)return L.maskPreview;const st=S.stroke;if(st&&st.layer===L&&st.live&&st.target==='mask')return st.liveCanvas();return L.mask}
const scratch={};function scr(name,w,h){let c=scratch[name];if(!c||c.width!==w||c.height!==h){c=scratch[name]=mk(w,h)}return c}
const stackCache={key:'',c:null};
/* draws the layer stack into target ctx tc (W×H) with doc->target matrix T */
function renderStack(tc,W,H,T,o){const d=S.doc;tc.setTransform(1,0,0,1,0,0);tc.globalAlpha=1;tc.globalCompositeOperation='source-over';tc.clearRect(0,0,W,H);
  tc.imageSmoothingEnabled=o.scale<2;tc.imageSmoothingQuality='high';
  const upto=o.upto==null?d.layers.length:o.upto;let i0=0;
  if(o.cacheIdx!=null&&o.cacheKey){if(stackCache.key===o.cacheKey&&stackCache.c&&stackCache.c.width===W&&stackCache.c.height===H){tc.drawImage(stackCache.c,0,0);i0=o.cacheIdx}}
  for(let i=i0;i<upto;i++){
    if(o.cacheIdx!=null&&o.cacheKey&&i===o.cacheIdx&&i0!==o.cacheIdx){const c=stackCache.c&&stackCache.c.width===W&&stackCache.c.height===H?stackCache.c:mk(W,H);const g=cx(c);g.globalCompositeOperation='copy';g.drawImage(tc.canvas,0,0);g.globalCompositeOperation='source-over';stackCache.c=c;stackCache.key=o.cacheKey}
    const L=d.layers[i];if(!L.visible)continue;
    if(L.kind==='adjust'){if(o.before||devIsId(L.dev))continue;const ms=maskSrc(L);let mc=null;if(ms){mc=scr('am',W,H);const g=cx(mc);g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);g.imageSmoothingEnabled=true;g.setTransform(...T);drawMip(g,ms,0,0,o.scale,ms===L.mask);g.setTransform(1,0,0,1,0,0)}
      applyAdjust(tc,W,H,L,mc,o);continue}
    const src=layerSrc(L),ms=L.mask?maskSrc(L):null;tc.setTransform(...T);
    if(ms){const t=scr('lm',W,H),g=cx(t);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.imageSmoothingEnabled=o.scale<2;g.setTransform(...T);drawMip(g,src,L.dx||0,L.dy||0,o.scale,src===L.canvas||src.__fx);g.globalCompositeOperation='destination-in';g.imageSmoothingEnabled=true;drawMip(g,ms,L.dx||0,L.dy||0,o.scale,ms===L.mask);g.globalCompositeOperation='source-over';g.setTransform(1,0,0,1,0,0);
      tc.setTransform(1,0,0,1,0,0);tc.globalAlpha=L.opacity;tc.globalCompositeOperation=L.blend;tc.drawImage(t,0,0)}
    else{tc.globalAlpha=L.opacity;tc.globalCompositeOperation=L.blend;drawMip(tc,src,L.dx||0,L.dy||0,o.scale,src===L.canvas||src.__fx)}
    tc.globalAlpha=1;tc.globalCompositeOperation='source-over';tc.setTransform(1,0,0,1,0,0)}}
function applyAdjust(tc,W,H,L,mc,o){const po={scale:o.scale,ox:o.ox,oy:o.oy,docW:S.doc.w,docH:S.doc.h};
  if(GPU.ok&&W<=GPU.max&&H<=GPU.max&&W*H<=(GPU.area||Infinity)){try{const out=GPU.develop(tc.canvas,L.dev,mc,L.opacity,po);tc.setTransform(1,0,0,1,0,0);tc.globalCompositeOperation='copy';tc.drawImage(out,0,0);tc.globalCompositeOperation='source-over';return}catch(e){console.warn(e);GPU.ok=false}}
  const img=tc.getImageData(0,0,W,H);developCPU(img,L.dev,po,mc?rx(mc).getImageData(0,0,W,H).data:null,L.opacity);tc.putImageData(img,0,0)}
/* full-resolution render, tiled so blur radii stay correct */
async function renderDoc(scale,o={}){const d=S.doc,W=Math.max(1,Math.round(d.w*scale)),H=Math.max(1,Math.round(d.h*scale)),out=mk(W,H),og=cx(out);
  let pad=0;if(!o.before)d.layers.forEach(L=>{if(L.kind==='adjust'&&L.visible)pad=Math.max(pad,maxSigma(L.dev,d.w,d.h,scale))});pad=Math.ceil(pad*3)+(pad?4:0);
  const T0=Math.min(2048,(GPU.ok?GPU.max:4096)-2*pad-8);const nT=Math.ceil(W/T0)*Math.ceil(H/T0);let k=0;
  for(let y=0;y<H;y+=T0)for(let x=0;x<W;x+=T0){const tw=Math.min(T0,W-x),th=Math.min(T0,H-y),x0=Math.max(0,x-pad),y0=Math.max(0,y-pad),x1=Math.min(W,x+tw+pad),y1=Math.min(H,y+th+pad);
    const t=scr('tile',x1-x0,y1-y0),g=cx(t);renderStack(g,t.width,t.height,[scale,0,0,scale,-x0,-y0],{scale,ox:-x0,oy:-y0,before:o.before,upto:o.upto});
    og.drawImage(t,x-x0,y-y0,tw,th,x,y,tw,th);if(nT>1){k++;o.progress&&o.progress(k/nT);await tick()}}
  return out}
let flatCache={key:'',c:null};
async function flat(withAdjust){const key=S.docVer+'|'+withAdjust;if(flatCache.key===key)return flatCache.c;const c=await renderDoc(1,{before:!withAdjust});flatCache={key,c};return c}
function flatSync(){const d=S.doc;const key=S.docVer+'|px';if(flatCache.key===key)return flatCache.c;const c=mk(d.w,d.h);renderStack(cx(c),d.w,d.h,[1,0,0,1,0,0],{scale:1,ox:0,oy:0,before:true});flatCache={key,c};return c}

