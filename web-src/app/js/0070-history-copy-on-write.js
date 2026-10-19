/* ================= history (copy-on-write) ================= */
function snapLayer(L){return{...L,dev:L.dev?JSON.parse(JSON.stringify(L.dev)):undefined,preview:undefined,maskPreview:undefined,dx:0,dy:0}}
function snap(label){const d=S.doc;return{label,w:d.w,h:d.h,active:d.active,sel:d.sel,layers:d.layers.map(snapLayer)}}
function pushHistory(label){const h=S.history.slice(0,S.hi+1);h.push(snap(label));while(h.length>S.maxHist)h.shift();S.history=h;S.hi=h.length-1;renderHistory();updateUndo();scheduleSave()}
function restore(i){if(i<0||i>=S.history.length)return;const s=S.history[i],d=S.doc;S.hi=i;scheduleSave();const sz=d.w!==s.w||d.h!==s.h;d.w=s.w;d.h=s.h;d.layers=s.layers.map(snapLayer);d.active=Math.min(s.active,d.layers.length-1);d.sel=s.sel;
  selChanged();markComp();if(sz){fit();if(S.tool==='crop')initCrop();updateDocName()}syncAll()}
function undo(){if(S.stroke||S.drag||!S.doc)return;if(S.hi>0){const l=S.history[S.hi].label;restore(S.hi-1);toast('Annulé : '+l)}}
function redo(){if(S.stroke||S.drag||!S.doc)return;if(S.hi<S.history.length-1){restore(S.hi+1);toast('Rétabli : '+S.history[S.hi].label)}}
function updateUndo(){$('#bUndo').disabled=!(S.hi>0);$('#bRedo').disabled=!(S.hi<S.history.length-1)}
function editCanvas(L){L.canvas=cloneC(L.canvas);return cx(L.canvas)}
function editMask(L){L.mask=L.mask?cloneC(L.mask):(()=>{const m=mk(S.doc.w,S.doc.h),g=cx(m);g.fillStyle='#fff';g.fillRect(0,0,m.width,m.height);return m})();return cx(L.mask)}
function fullMask(){const m=mk(S.doc.w,S.doc.h),g=cx(m);g.fillStyle='#fff';g.fillRect(0,0,m.width,m.height);return m}

