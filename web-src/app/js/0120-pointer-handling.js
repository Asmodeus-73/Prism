/* ================= pointer handling ================= */
const pointers=new Map();let pinch=null;
function evPos(e){const r=view.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,p=toDoc(x,y);return{cx:x,cy:y,x:p.x,y:p.y}}
view.addEventListener('pointerdown',e=>{if(!S.doc)return;view.setPointerCapture(e.pointerId);pointers.set(e.pointerId,evPos(e));
  if(pointers.size===2){cancelStroke();cancelDrag();const[a,b]=[...pointers.values()];pinch={d:Math.hypot(a.cx-b.cx,a.cy-b.cy),z:S.zoom,mx:(a.cx+b.cx)/2,my:(a.cy+b.cy)/2,px:S.panX,py:S.panY};return}if(pointers.size>2)return;onDown(e,evPos(e))});
view.addEventListener('pointermove',e=>{const p=evPos(e);S.pointer={cx:p.cx,cy:p.cy,dx:p.x,dy:p.y,inside:true};if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
  if(pinch&&pointers.size===2){const[a,b]=[...pointers.values()],dd=Math.hypot(a.cx-b.cx,a.cy-b.cy),mx=(a.cx+b.cx)/2,my=(a.cy+b.cy)/2,z=clamp(pinch.z*dd/pinch.d,0.02,32),ddx=(pinch.mx-pinch.px)/pinch.z,ddy=(pinch.my-pinch.py)/pinch.z;S.fitted=false;S.zoom=z;S.panX=mx-ddx*z;S.panY=my-ddy*z;markContent();return}
  onMove(e,p);requestRender()});
view.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(pinch){if(pointers.size<2)pinch=null;return}onUp(e)});
view.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);pinch=null;cancelStroke();cancelDrag();requestRender()});
view.addEventListener('pointerleave',()=>{if(S.pointer)S.pointer.inside=false;requestRender()});
stage.addEventListener('wheel',e=>{if(!S.doc)return;e.preventDefault();const p=evPos(e);if(e.ctrlKey||e.metaKey||e.altKey)zoomAt(S.zoom*Math.exp(-e.deltaY*(e.deltaMode?0.05:0.0022)),p.cx,p.cy);else{S.fitted=false;S.panX-=e.deltaX;S.panY-=e.deltaY;markContent()}},{passive:false});
view.addEventListener('dblclick',()=>{if(S.tool==='hand')fit()});
function onDown(e,p){const t=S.tool,alt=e.altKey;
  if(S.wbPick){S.wbPick=false;$('#btnWB')?.classList.remove('on');wbFromPoint(p);return}
  if(e.button===1||S.spaceDown||t==='hand'){S.drag={type:'pan',sx:p.cx,sy:p.cy,px:S.panX,py:S.panY};return}
  if(t==='zoom'){zoomStep(alt?-1:1,p.cx,p.cy);return}
  if(t==='eyedropper'||(alt&&t==='brush')){pickColor(p);S.drag={type:'pick'};return}
  if(t==='move'){const L=AL();if(!L||L.kind!=='pixel'){toast('Sélectionnez un calque de pixels à déplacer');return}S.drag={type:'move',sx:p.x,sy:p.y,L};return}
  if(t==='marquee'){S.drag={type:'marquee',shape:S.opts.marquee.shape,x0:p.x,y0:p.y,x1:p.x,y1:p.y,mode:modeFrom(e)};return}
  if(t==='lasso'){S.drag={type:'lasso',pts:[{x:p.x,y:p.y}],mode:modeFrom(e)};return}
  if(t==='wand'){wandAt(p.x,p.y,modeFrom(e));return}
  if(t==='crop'){cropDown(p);return}
  if(t==='text'){textAt(p);return}
  if(t==='gradient'){S.drag={type:'gradient',shape:S.opts.gradient.shape,x0:p.x,y0:p.y,x1:p.x,y1:p.y,target:AL()};return}
  if(t==='clone'||(t==='heal'&&S.opts.heal.mode==='source')){if(alt||S.pickSource){S.cloneSrc={x:p.x,y:p.y};S.cloneOff=null;S.pickSource=false;renderPill();toast('Source définie');return}}
  if(['brush','eraser','clone','heal','dodge','remove'].includes(t)){beginStroke({x:p.x,y:p.y},e);S.drag={type:'stroke'}}}
function onMove(e,p){const dr=S.drag;if(!dr)return;
  if(dr.type==='pan'){S.fitted=false;const nx=dr.px+p.cx-dr.sx,ny=dr.py+p.cy-dr.sy;panTo(nx,ny);return}
  if(dr.type==='pick'){pickColor(p);return}
  if(dr.type==='move'){dr.L.dx=Math.round(p.x-dr.sx);dr.L.dy=Math.round(p.y-dr.sy);markComp();return}
  if(dr.type==='marquee'){let x1=p.x,y1=p.y;const rt=S.opts.marquee.ratio;if(rt!=='free'){const[rw,rh]=rt.split(':').map(Number),w=Math.abs(x1-dr.x0),h=Math.abs(y1-dr.y0),s=Math.max(w/rw,h/rh);x1=dr.x0+Math.sign(x1-dr.x0||1)*s*rw;y1=dr.y0+Math.sign(y1-dr.y0||1)*s*rh}dr.x1=x1;dr.y1=y1;return}
  if(dr.type==='lasso'){const l=dr.pts[dr.pts.length-1];if(Math.hypot(p.x-l.x,p.y-l.y)*S.zoom>2)dr.pts.push({x:p.x,y:p.y});return}
  if(dr.type==='crop'){cropMove(p);return}
  if(dr.type==='gradient'){dr.x1=p.x;dr.y1=p.y;gradientPreview(dr);return}
  if(dr.type==='stroke')moveStroke({x:p.x,y:p.y},e)}
function onUp(){const dr=S.drag;S.drag=null;if(!dr)return;const d=S.doc;
  if(dr.type==='move'){const L=dr.L,dx=L.dx||0,dy=L.dy||0;L.dx=0;L.dy=0;if(dx||dy){const c=mk(d.w,d.h);cx(c).drawImage(L.canvas,dx,dy);const e=effHi(L);L.canvas=c;if(L.hi)hiXform(L,e,d.w,d.h,d.w,d.h,new DOMMatrix().translate(dx,dy));if(L.mask){const m=mk(d.w,d.h);cx(m).drawImage(L.mask,dx,dy);L.mask=m}markComp();pushHistory('Déplacement')}else markComp();return}
  if(dr.type==='marquee'){const w=Math.abs(dr.x1-dr.x0),h=Math.abs(dr.y1-dr.y0);if(w*S.zoom<3||h*S.zoom<3){if(dr.mode==='new')deselect();requestRender();return}const m=mk(d.w,d.h),g=cx(m);g.fillStyle='#fff';g.beginPath();const x=Math.min(dr.x0,dr.x1),y=Math.min(dr.y0,dr.y1);if(dr.shape==='ellipse')g.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,7);else g.rect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));g.fill();combineSel(featherMask(m,S.opts.marquee.feather),dr.mode);return}
  if(dr.type==='lasso'){if(dr.pts.length<3){if(dr.mode==='new')deselect();return}const m=mk(d.w,d.h),g=cx(m);g.fillStyle='#fff';g.beginPath();dr.pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();combineSel(featherMask(m,S.opts.lasso.feather),dr.mode);return}
  if(dr.type==='gradient'){gradientCommit(dr);return}
  if(dr.type==='crop'){requestRender();return}
  if(dr.type==='stroke')endStroke()}
function modeFrom(e){if(e.shiftKey&&e.altKey)return'int';if(e.shiftKey)return'add';if(e.altKey)return'sub';return S.opts.selMode}
var pickColor; /* défini dans 0870-brush-eraser-gradient-bucket-eyedropper.js */
var wbFromPoint; /* défini dans 0830-reglages-developper-panel.js */

/* gradients (masks of local adjustments, or colour on pixel layers) */
function gradientCanvas(dr,color){const d=S.doc,m=mk(d.w,d.h),g=cx(m);let gr;const col=color||'#ffffff';
  if(dr.shape==='radial'){const r=Math.max(1,Math.hypot(dr.x1-dr.x0,dr.y1-dr.y0));gr=g.createRadialGradient(dr.x0,dr.y0,0,dr.x0,dr.y0,r);gr.addColorStop(0,hexA(col,1));gr.addColorStop(0.45,hexA(col,1));gr.addColorStop(1,hexA(col,0))}
  else{gr=g.createLinearGradient(dr.x0,dr.y0,dr.x1,dr.y1);gr.addColorStop(0,hexA(col,1));gr.addColorStop(1,hexA(col,0))}g.fillStyle=gr;g.fillRect(0,0,d.w,d.h);return m}
var gradientPreview; /* défini dans 0870-brush-eraser-gradient-bucket-eyedropper.js */
var gradientCommit; /* défini dans 0870-brush-eraser-gradient-bucket-eyedropper.js */

