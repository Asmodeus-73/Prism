/* ================= compare ================= */
// the split stays over the photo, so both sides always show part of it
function splitClamp(x){const d=S.doc;let lo=0.02,hi=0.98;if(d&&S.vw>0){const a=S.panX/S.vw,b=(S.panX+d.w*S.zoom)/S.vw;if(b-a>0.04){lo=Math.max(lo,a+0.01);hi=Math.min(hi,b-0.01)}}return clamp(x,lo,Math.max(lo,hi))}
function toggleCompare(){if(!S.doc)return;S.compare=S.compare==='split'?'off':'split';if(S.compare==='split'&&S.vw>0)S.splitX=splitClamp((S.panX+S.doc.w*S.zoom/2)/S.vw);markContent()}
function toggleMask(){S.showMask=!S.showMask;renderTarget();requestRender()}
(()=>{const sp=$('#split');let drag=false;sp.addEventListener('pointerdown',e=>{e.preventDefault();try{getSelection().removeAllRanges()}catch(_){}drag=true;sp.setPointerCapture(e.pointerId);e.stopPropagation()});sp.addEventListener('pointermove',e=>{if(!drag)return;const r=stage.getBoundingClientRect();S.splitX=splitClamp((e.clientX-r.left)/r.width);requestRender()});sp.addEventListener('pointerup',()=>drag=false);sp.addEventListener('pointercancel',()=>drag=false);sp.tabIndex=0;sp.setAttribute('role','slider');sp.setAttribute('aria-label','Séparation avant / après');sp.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();S.splitX=splitClamp(S.splitX+(e.key==='ArrowLeft'?-0.02:0.02));requestRender()}})})();

