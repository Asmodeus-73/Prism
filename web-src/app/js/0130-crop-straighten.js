/* ================= crop & straighten ================= */
function initCrop(){const d=S.doc;if(!d)return;S.crop={x:0,y:0,w:d.w,h:d.h,angle:0};applyRatio();requestRender()}
function cropHandles(c){return[[c.x,c.y],[c.x+c.w/2,c.y],[c.x+c.w,c.y],[c.x+c.w,c.y+c.h/2],[c.x+c.w,c.y+c.h],[c.x+c.w/2,c.y+c.h],[c.x,c.y+c.h],[c.x,c.y+c.h/2]]}
function ratioVal(){const r=S.opts.crop.ratio,d=S.doc;if(r==='free')return 0;if(r==='orig')return d.w/d.h;const[a,b]=r.split(':').map(Number);return a/b}
function applyRatio(){const c=S.crop,d=S.doc,R=ratioVal();if(!c)return;const a=c.angle*Math.PI/180,co=Math.abs(Math.cos(a)),si=Math.abs(Math.sin(a)),r=R||(c.w/c.h);if(R||a){const w=Math.min(d.w/(co+si/r),d.h/(si+co/r));c.w=w;c.h=w/r;c.x=(d.w-c.w)/2;c.y=(d.h-c.h)/2}requestRender()}
function cropDown(p){const c=S.crop;if(!c)return;const tol=10/S.zoom,h=cropHandles(c).findIndex(([x,y])=>Math.abs(p.x-x)<tol&&Math.abs(p.y-y)<tol);if(h>=0){S.drag={type:'crop',mode:'h',h,start:{...c}};return}
  if(p.x>c.x&&p.x<c.x+c.w&&p.y>c.y&&p.y<c.y+c.h){S.drag={type:'crop',mode:'move',sx:p.x,sy:p.y,start:{...c}};return}S.drag={type:'crop',mode:'new',sx:p.x,sy:p.y,start:{...c}}}
function cropMove(p){const dr=S.drag,c=S.crop,s=dr.start,d=S.doc,R=ratioVal();if(dr.mode==='move'){c.x=s.x+p.x-dr.sx;c.y=s.y+p.y-dr.sy;if(!c.angle){c.x=clamp(c.x,0,d.w-c.w);c.y=clamp(c.y,0,d.h-c.h)}requestRender();return}
  let x0=s.x,y0=s.y,x1=s.x+s.w,y1=s.y+s.h;const px=c.angle?p.x:clamp(p.x,0,d.w),py=c.angle?p.y:clamp(p.y,0,d.h);if(dr.mode==='new'){x0=dr.sx;y0=dr.sy;x1=px;y1=py}else{const h=dr.h;if([0,6,7].includes(h))x0=px;if([2,3,4].includes(h))x1=px;if([0,1,2].includes(h))y0=py;if([4,5,6].includes(h))y1=py}
  let nx=Math.min(x0,x1),ny=Math.min(y0,y1),nw=Math.max(4,Math.abs(x1-x0)),nh=Math.max(4,Math.abs(y1-y0));
  if(R){if(dr.mode==='h'&&(dr.h===1||dr.h===5))nw=nh*R;else nh=nw/R;if(dr.mode==='new'){nx=x1<x0?x0-nw:x0;ny=y1<y0?y0-nh:y0}else{ny=[0,1,2].includes(dr.h)?s.y+s.h-nh:s.y;nx=[0,6,7].includes(dr.h)?s.x+s.w-nw:[1,5].includes(dr.h)?s.x+(s.w-nw)/2:s.x}}
  Object.assign(c,{x:nx,y:ny,w:nw,h:nh});requestRender()}
function applyCrop(){const c=S.crop,d=S.doc;if(!c)return;const a=c.angle*Math.PI/180,w=Math.round(c.w),h=Math.round(c.h);if(w<2||h<2)return;if(!a&&Math.round(c.x)===0&&Math.round(c.y)===0&&w===d.w&&h===d.h){toast('Rien à recadrer');return}
  const tf=src=>{const n=mk(w,h),g=cx(n);g.imageSmoothingQuality='high';g.translate(-Math.round(c.x),-Math.round(c.y));if(a){g.translate(d.w/2,d.h/2);g.rotate(a);g.translate(-d.w/2,-d.h/2)}TFM=g.getTransform();g.drawImage(src,0,0);return n};
  d.layers.forEach(L=>{if(L.canvas){const e=effHi(L),ow=L.canvas.width,oh=L.canvas.height;L.canvas=tf(L.canvas);if(L.hi)hiXform(L,e,ow,oh,w,h,TFM)}if(L.mask)L.mask=tf(L.mask)});d.sel=null;d.w=w;d.h=h;S.crop=null;S.cloneSrc=null;S.cloneOff=null;selChanged();markComp();pushHistory(a?'Recadrage et redressement':'Recadrage');initCrop();fit();syncAll();updateDocName()}
function cancelCrop(){initCrop();renderPill()}

