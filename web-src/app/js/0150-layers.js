/* ================= layers ================= */
function insertLayer(L,label,top){const d=S.doc;if(top){d.layers.push(L);d.active=d.layers.length-1}else{d.layers.splice(d.active+1,0,L);d.active++}markComp();pushHistory(label);syncAll()}
var addLayer; /* défini dans 0860-layers-area.js */
function addAdjust(kind){const d=S.doc;if(!d)return;const n=d.layers.filter(l=>l.kind==='adjust'&&l.mask).length+1;
  if(kind==='global'){insertLayer(newAdjust('Réglages '+(d.layers.filter(l=>l.kind==='adjust').length+1)),'Calque de réglage',true);return}
  let mask=null,name='Local '+n;
  if(kind==='brush'){mask=mk(d.w,d.h);name='Pinceau '+n}
  if(kind==='linear'||kind==='radial'){mask=mk(d.w,d.h);name=(kind==='linear'?'Dégradé ':'Radial ')+n}
  if(kind==='selection'){if(!d.sel){toast('Faites d’abord une sélection');return}mask=cloneC(d.sel);name='Sélection '+n}
  const L=newAdjust(name,mask);insertLayer(L,'Réglage local',true);S.showMask=false;
  if(kind==='brush'){setTool('brush');toast('Peignez la zone à modifier, puis réglez les curseurs')}
  if(kind==='linear'||kind==='radial'){S.opts.gradient.shape=kind;setTool('gradient');toast(kind==='linear'?'Tirez un trait : l’effet est total au départ et s’estompe vers l’arrivée':'Tirez depuis le centre de la zone à modifier')}
  switchTab('develop')}
async function addSubjectAdjust(inverse){const d=S.doc;if(!d)return;const m=await AI.subjectMask();if(!m||S.doc!==d)return;let mask=m;if(inverse){mask=fullMask();const g=cx(mask);g.globalCompositeOperation='destination-out';g.drawImage(m,0,0)}
  insertLayer(newAdjust(inverse?'Arrière-plan':'Sujet',mask),inverse?'Réglage de l’arrière-plan':'Réglage du sujet',true);switchTab('develop');toast('Réglage local créé : ajustez les curseurs')}
function dupLayer(){const d=S.doc,L=AL();if(!L)return;if(L.kind==='adjust'){const N={...newAdjust(L.name+' copie',L.mask),dev:JSON.parse(JSON.stringify(L.dev)),opacity:L.opacity};insertLayer(N,'Dupliquer le réglage');return}
  let c=L.canvas,nm=L.name+' copie';if(d.sel){c=mk(d.w,d.h);const g=cx(c);g.drawImage(L.canvas,0,0);g.globalCompositeOperation='destination-in';g.drawImage(d.sel,0,0);nm='Calque par copier'}insertLayer({...newPixel(nm,c),mask:d.sel?null:L.mask,opacity:L.opacity,blend:L.blend},d.sel?'Calque par copier':'Dupliquer le calque')}
function delLayer(){const d=S.doc;if(!d)return;if(d.layers.filter(l=>l.kind==='pixel').length<2&&AL().kind==='pixel'){toast('Impossible de supprimer le dernier calque de pixels');return}d.layers.splice(d.active,1);d.active=Math.max(0,d.active-1);markComp();pushHistory('Supprimer le calque');syncAll()}
function moveLayer(dir){const d=S.doc,i=d.active,j=i+dir;if(j<0||j>=d.layers.length)return;[d.layers[i],d.layers[j]]=[d.layers[j],d.layers[i]];d.active=j;markComp();pushHistory(dir>0?'Monter le calque':'Descendre le calque');syncLayers()}
function mergeDown(){const d=S.doc,i=d.active;if(i<1){toast('Aucun calque en dessous');return}const top=d.layers[i],bot=d.layers[i-1];if(top.kind!=='pixel'||bot.kind!=='pixel'){toast('Fusion possible entre deux calques de pixels. Pour figer des réglages : Calque > Fusionner les calques visibles.');return}
  const c=cloneC(bot.canvas),g=cx(c);if(bot.mask){g.globalCompositeOperation='destination-in';g.drawImage(bot.mask,0,0)}g.globalCompositeOperation='source-over';if(top.visible){let s=top.canvas;if(top.mask){s=cloneC(top.canvas);const sg=cx(s);sg.globalCompositeOperation='destination-in';sg.drawImage(top.mask,0,0)}g.globalAlpha=top.opacity;g.globalCompositeOperation=top.blend;g.drawImage(s,0,0)}
  bot.canvas=c;bot.mask=null;d.layers.splice(i,1);d.active=i-1;markComp();pushHistory('Fusionner');syncAll()}
async function flatten(){const d=S.doc,h0=S.history[S.hi];busy(true,'Aplatissement…');await tick();try{const c=await renderDoc(1);if(S.doc!==d||S.history[S.hi]!==h0)return;d.layers=[newPixel('Arrière-plan',c),newAdjust('Réglages')];d.active=1;markComp();pushHistory('Aplatir');syncAll()}finally{busy(false)}}
async function stampVisible(){const d=S.doc,h0=S.history[S.hi];busy(true,'Fusion des calques visibles…');await tick();try{const c=await renderDoc(1);if(S.doc!==d||S.history[S.hi]!==h0)return;insertLayer(newPixel('Calques fusionnés',c),'Fusionner les calques visibles',true)}finally{busy(false)}}
var addMask; /* défini dans 0860-layers-area.js */
var deleteMask; /* défini dans 0860-layers-area.js */
function invertMask(){const L=AL();if(!L||!L.mask)return;const m=fullMask(),g=cx(m);g.globalCompositeOperation='destination-out';g.drawImage(L.mask,0,0);L.mask=m;markComp();pushHistory('Inverser le masque');syncAll()}
function clearSel(){const d=S.doc,L=pixelTarget();if(!d||!L)return;if(!d.sel){toast('Aucune sélection : rien n’est effacé');return}const g=editCanvas(L);g.globalCompositeOperation='destination-out';g.drawImage(d.sel,0,0);markComp();pushHistory('Effacer la sélection')}
function fillSel(){const d=S.doc,L=pixelTarget();if(!d||!L)return;const g=editCanvas(L);if(d.sel){const t=mk(d.w,d.h),tg=cx(t);tg.fillStyle=S.color;tg.fillRect(0,0,d.w,d.h);tg.globalCompositeOperation='destination-in';tg.drawImage(d.sel,0,0);g.drawImage(t,0,0)}else{g.fillStyle=S.color;g.fillRect(0,0,d.w,d.h)}markComp();pushHistory('Remplir')}
let clip=null;
function copySel(){const d=S.doc,L=pixelTarget();if(!L)return;const b=d.sel?maskBBox(d.sel):{x0:0,y0:0,x1:d.w,y1:d.h};if(!b)return;const t=mk(d.w,d.h),g=cx(t);g.drawImage(L.canvas,0,0);if(d.sel){g.globalCompositeOperation='destination-in';g.drawImage(d.sel,0,0)}clip=mk(b.x1-b.x0,b.y1-b.y0);cx(clip).drawImage(t,-b.x0,-b.y0);clip.pos={x:b.x0,y:b.y0};toast('Copié')}
function pasteClip(c,name){const d=S.doc;if(!c)return;const L=newPixel(name||'Collage',mk(d.w,d.h)),g=cx(L.canvas);let w=c.width,h=c.height;const f=Math.min(1,d.w/w,d.h/h);w*=f;h*=f;const pos=c.pos||{x:(d.w-w)/2,y:(d.h-h)/2};g.imageSmoothingQuality='high';g.drawImage(c,pos.x,pos.y,w,h);insertLayer(L,'Coller')}

