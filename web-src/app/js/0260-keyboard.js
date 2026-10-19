/* ================= keyboard ================= */
const KEYTOOLS={v:'move',m:'marquee',l:'lasso',w:'wand',c:'crop',i:'eyedropper',j:'heal',r:'remove',s:'clone',b:'brush',e:'eraser',g:'gradient',o:'dodge',t:'text',h:'hand',z:'zoom'};
document.addEventListener('keydown',e=>{const bz=$('#busy');if(bz&&!bz.hidden){e.preventDefault();return}const tg=e.target;if(tg.matches&&tg.matches('textarea,select,[contenteditable],input:not([type=range]):not([type=checkbox]):not([type=color]):not([type=radio]):not([type=button])')&&e.key!=='Escape')return;const mod=(e.metaKey||e.ctrlKey)&&!(e.getModifierState&&e.getModifierState('AltGraph')),k=/^Digit\d$/.test(e.code)&&mod?e.code.slice(5):(e.code==='KeyI'&&mod&&e.altKey?'i':(e.key||'').toLowerCase());
  if(e.key==='Escape'){if($('#pop')){closeMenu();return}const s=$('#scrim');if(s){s._cancel();return}if(S.tool==='crop'){cancelCrop();return}if(S.drag){cancelDrag();requestRender();return}if(S.tool==='pen'&&typeof penEscape==='function')penEscape();return}
  if($('#scrim')&&!$('#scrim').classList.contains('light'))return;
  if(mod){if(k==='i'&&e.shiftKey){e.preventDefault();invertSel();return}if(k==='i'&&e.altKey){e.preventDefault();resizeDialog();return}if(k==='l'&&e.shiftKey){e.preventDefault();autoTone();return}if(k==='n'&&e.shiftKey){e.preventDefault();addLayer();return}
    if(k==='c'&&e.shiftKey){e.preventDefault();copyLookCmd();return}if(k==='v'&&e.shiftKey){e.preventDefault();pasteLookCmd();return}if(k==='e'&&e.shiftKey){e.preventDefault();S.doc&&exportDialog();return}if(k==='o'&&e.shiftKey){e.preventDefault();projectsDialog();return}
    const map={z:()=>e.shiftKey?redo():undo(),y:redo,o:openFile,s:()=>e.shiftKey?exportDialog():saveNow(false),a:selectAll,d:deselect,j:dupLayer,e:mergeDown,c:copySel,'0':()=>fit(),'1':()=>zoomAt(1),'=':()=>zoomStep(1),'+':()=>zoomStep(1),'-':()=>zoomStep(-1),']':()=>moveLayer(1),'[':()=>moveLayer(-1)};if(k==='v')return;const f=map[k];if(f&&(S.doc||k==='o')){e.preventDefault();f()}return}
  if(!S.doc)return;
  if(e.code==='Space'&&!S.spaceDown){S.spaceDown=true;view.style.cursor='grab';e.preventDefault();return}
  if(e.key==='\\'){if(!S.holdBefore){S.holdBefore=true;markContent()}return}
  if(k==='y'){toggleCompare();return}
  if(k==='m'&&e.shiftKey){toggleMask();return}
  if(e.key==='Enter'&&S.tool==='crop'){applyCrop();return}
  if(e.key==='F5'&&e.shiftKey){e.preventDefault();removeSelected();return}
  if(e.key==='F6'&&e.shiftKey){e.preventDefault();featherDialog();return}
  if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();e.shiftKey?fillSel():clearSel();return}
  if(e.key==='['||e.key===']'){const o=S.opts[S.tool];if(o&&o.size){o.size=clamp(Math.round(o.size*(e.key===']'?1.15:1/1.15))+(e.key===']'?1:-1),1,600);renderPill();requestRender()}return}
  if(KEYTOOLS[k]&&!e.altKey)setTool(KEYTOOLS[k])});
document.addEventListener('keyup',e=>{if(e.code==='Space'&&S.spaceDown){S.spaceDown=false;setCursor()}if(e.key==='\\'){S.holdBefore=false;markContent()}});
window.addEventListener('blur',()=>{S.spaceDown=false;if(S.holdBefore){S.holdBefore=false;markContent()}});
$('#bUndo').onclick=undo;$('#bRedo').onclick=redo;$('#bCompare').onclick=toggleCompare;$('#bZoomIn').onclick=()=>zoomStep(1);$('#bZoomOut').onclick=()=>zoomStep(-1);$('#zoomLbl').onclick=()=>fit();$('#bExport').onclick=()=>S.doc?exportDialog():openFile();
new ResizeObserver(()=>{if(S.doc&&S.fitted)fit();S.contentDirty=true;requestRender()}).observe(stage);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{S.contentDirty=true;requestRender();drawCurve()});
new MutationObserver(()=>{S.contentDirty=true;requestRender();setTimeout(drawCurve,30)}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

