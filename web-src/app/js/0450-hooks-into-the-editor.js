/* ================= hooks into the editor ================= */
const _onDown=onDown;onDown=function(e,p){if(S.tool==='pen'&&e.button!==1&&!S.spaceDown){penDown(e,p);return}_onDown(e,p)};
const _onMove=onMove;onMove=function(e,p){const dr=S.drag;if(dr&&dr.type==='pen'){penMove(e,p);requestRender();return}_onMove(e,p)};
const _onUp=onUp;onUp=function(e){const dr=S.drag;if(dr&&dr.type==='pen'){S.drag=null;requestRender();scheduleSave();return}_onUp(e)};
const _dov=drawOverlays;drawOverlays=function(c,pr){qmOverlay(c);_dov(c,pr);penOverlay(c,pr)};
const _markComp=markComp;markComp=function(){mipForget();_markComp()};
function PILL_EXTRA(t,o){if(t==='pen'){const P=S.doc&&S.doc.path,has=P&&P.pts.length>1;
    const hint=!P||!P.pts.length?'Cliquez pour poser des points, cliquez-glissez pour une courbe. Cliquez sur le premier point pour fermer.':(P.closed?'':'Entrée : sélection');return (hint?`<span class="hint">${hint}</span>`:'')+
      `<button class="btn sm${has?' primary':''}" data-act="penSel" ${has?'':'disabled'}>Sélection</button><button class="btn sm" data-act="penMask" ${has?'':'disabled'}>Masque</button><button class="btn sm" data-act="penFill" ${has?'':'disabled'}>Remplir</button><button class="btn sm" data-act="penStroke" ${has?'':'disabled'}>Contour</button>`+
      optRange('pen.width','Épaisseur',1,100,1,' px')+optRange('pen.feather','Progressif',0,100,1,' px')+`<button class="btn sm" data-act="penClear" ${P&&P.pts.length?'':'disabled'}>Effacer</button>`}
  if(['marquee','lasso','wand'].includes(t)&&S.doc&&S.doc.sel)return `<button class="btn sm" data-act="refine">Affiner le contour…</button>`;return''}
const PILL_ACT={penSel:penToSel,penMask:penToMask,penFill:penFill,penStroke:penStroke,penClear:penClear,refine:refineDialog};
const _selChanged=selChanged;selChanged=function(){_selChanged();if(['marquee','lasso','wand'].includes(S.tool)){clearTimeout(selChanged.t);selChanged.t=setTimeout(renderPill,50)}};
document.addEventListener('keydown',e=>{if(S.tool!=='pen'||!S.doc||$('#library'))return;const tg=e.target;if(tg.closest&&tg.closest('input,textarea,select,[contenteditable]'))return;if($('#scrim')&&!$('#scrim').classList.contains('light'))return;
  const P=S.doc.path;if(e.key==='Enter'&&P&&P.pts.length>1){e.preventDefault();e.stopPropagation();penToSel();return}
  if((e.key==='Backspace'||e.key==='Delete')&&P&&P.pts.length&&!e.metaKey&&!e.ctrlKey){e.preventDefault();e.stopImmediatePropagation();if(P.closed)P.closed=false;else P.pts.pop();if(!P.pts.length)S.doc.path=null;requestRender();renderPill()}},true);
document.addEventListener('keydown',e=>{const tg=e.target;if($('#library')||(tg.closest&&tg.closest('input,textarea,select,[contenteditable]')))return;const mod=(e.metaKey||e.ctrlKey)&&!(e.getModifierState&&e.getModifierState('AltGraph'));
  if(mod&&e.code==='KeyY'&&e.shiftKey&&S.doc){e.preventDefault();e.stopPropagation();proofToggle();return}
  if(mod&&e.altKey&&e.code==='KeyR'&&S.doc){e.preventDefault();e.stopPropagation();refineDialog()}},true);
const _restore=restore;restore=function(i){_restore(i);const d=S.doc;if(!d)return;const L=d.layers.find(l=>l.canvas);const cs=(L&&L.canvas._cs)||'srgb';if(cs!==(d.space||'srgb')||cs!==CS){d.space=cs;setCS(cs);markComp();updateDocName()}};

