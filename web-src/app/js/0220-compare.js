/* ================= compare ================= */
function toggleCompare(){if(!S.doc)return;S.compare=S.compare==='split'?'off':'split';markContent()}
function toggleMask(){S.showMask=!S.showMask;renderTarget();requestRender()}
(()=>{const sp=$('#split');let drag=false;sp.addEventListener('pointerdown',e=>{drag=true;sp.setPointerCapture(e.pointerId);e.stopPropagation()});sp.addEventListener('pointermove',e=>{if(!drag)return;const r=stage.getBoundingClientRect();S.splitX=clamp((e.clientX-r.left)/r.width,0.02,0.98);requestRender()});sp.addEventListener('pointerup',()=>drag=false);sp.addEventListener('pointercancel',()=>drag=false);sp.tabIndex=0;sp.setAttribute('role','slider');sp.setAttribute('aria-label','Séparation avant / après');sp.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();S.splitX=clamp(S.splitX+(e.key==='ArrowLeft'?-0.02:0.02),0.02,0.98);requestRender()}})})();

