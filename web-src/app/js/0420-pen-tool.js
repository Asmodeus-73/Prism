/* ================= pen tool ================= */
S.opts.pen={width:4,feather:0};
IC.pen='<path d="M10 2.5l4.5 7L10 17l-4.5-7.5z"/><circle cx="10" cy="10.2" r="1.3"/><path d="M10 2.5v6.4"/>';
TOOLS.splice(TOOLS.findIndex(x=>x&&x[0]==='wand')+1,0,['pen','Plume (tracés vectoriels)','P']);KEYTOOLS.p='pen';
function penPath(P){const p=new Path2D(),a=P.pts;if(!a.length)return p;p.moveTo(a[0].x,a[0].y);for(let i=1;i<a.length;i++){const s=a[i-1],t=a[i];p.bezierCurveTo(s.ox,s.oy,t.ix,t.iy,t.x,t.y)}
  if(P.closed&&a.length>2){const s=a[a.length-1],t=a[0];p.bezierCurveTo(s.ox,s.oy,t.ix,t.iy,t.x,t.y);p.closePath()}return p}
function penDown(e,p){const d=S.doc;if(!d)return;const r=8/S.zoom;let P=d.path;const near=(x,y)=>Math.hypot(p.x-x,p.y-y)<=r;
  if(P&&P.pts.length){for(let i=P.pts.length-1;i>=0;i--){const a=P.pts[i];
      if((a.ox!==a.x||a.oy!==a.y)&&near(a.ox,a.oy)){S.drag={type:'pen',kind:'out',i};return}
      if((a.ix!==a.x||a.iy!==a.y)&&near(a.ix,a.iy)){S.drag={type:'pen',kind:'in',i};return}}
    for(let i=0;i<P.pts.length;i++){const a=P.pts[i];if(!near(a.x,a.y))continue;
      if(i===0&&!P.closed&&!P.ended&&P.pts.length>2&&!e.altKey){P.closed=true;S.drag={type:'pen',kind:'close',i:0,moved:false};requestRender();renderPill();return}
      if(e.altKey){a.ix=a.ox=a.x;a.iy=a.oy=a.y;S.drag={type:'pen',kind:'new',i,moved:false};requestRender();return}
      S.drag={type:'pen',kind:'anchor',i,sx:p.x,sy:p.y,a0:{...a}};return}}
  if(!P||P.closed||P.ended){P=d.path={pts:[],closed:false}}
  P.pts.push({x:p.x,y:p.y,ix:p.x,iy:p.y,ox:p.x,oy:p.y});S.drag={type:'pen',kind:'new',i:P.pts.length-1,moved:false};requestRender();if(P.pts.length<=2)renderPill()}
function penMove(e,p){const dr=S.drag,P=S.doc&&S.doc.path;if(!P)return;const a=P.pts[dr.i];if(!a)return;
  if(dr.kind==='anchor'){const dx=p.x-dr.sx,dy=p.y-dr.sy,o=dr.a0;Object.assign(a,{x:o.x+dx,y:o.y+dy,ix:o.ix+dx,iy:o.iy+dy,ox:o.ox+dx,oy:o.oy+dy});return}
  if(dr.kind==='new'||dr.kind==='close'){if(Math.hypot(p.x-a.x,p.y-a.y)*S.zoom<3&&!dr.moved)return;dr.moved=true;
    if(dr.kind==='close'){a.ix=p.x;a.iy=p.y;a.ox=2*a.x-p.x;a.oy=2*a.y-p.y}else{a.ox=p.x;a.oy=p.y;a.ix=2*a.x-p.x;a.iy=2*a.y-p.y}return}
  const mine=dr.kind==='out'?['ox','oy']:['ix','iy'],other=dr.kind==='out'?['ix','iy']:['ox','oy'];a[mine[0]]=p.x;a[mine[1]]=p.y;
  if(!e.altKey){const L=Math.hypot(a[other[0]]-a.x,a[other[1]]-a.y),dx=p.x-a.x,dy=p.y-a.y,m=Math.hypot(dx,dy)||1;if(L>0.01){a[other[0]]=a.x-dx/m*L;a[other[1]]=a.y-dy/m*L}}}
function penCancelDrag(){}
function penEscape(){const P=S.doc&&S.doc.path;if(!P||!P.pts.length)return;if(!P.ended&&!P.closed){P.ended=true;toast('Tracé terminé. Échap à nouveau pour l’effacer.');requestRender();return}penClear()}
function penClear(){if(!S.doc)return;S.doc.path=null;requestRender();renderPill();scheduleSave()}
function penOverlay(c,pr){const d=S.doc;if(!d||!d.path||!d.path.pts.length||(S.tool!=='pen'&&!d.path.closed))return;const P=d.path,show=S.tool==='pen';
  c.save();c.setTransform(pr*S.zoom,0,0,pr*S.zoom,pr*S.panX,pr*S.panY);const path=penPath(P);c.lineWidth=2.5/S.zoom;c.strokeStyle='rgba(0,0,0,.55)';c.stroke(path);c.lineWidth=1.2/S.zoom;c.strokeStyle='#3d8bff';c.stroke(path);
  const pt=S.pointer;if(show&&pt&&pt.inside&&!P.closed&&!P.ended&&!S.drag){const l=P.pts[P.pts.length-1];c.beginPath();c.moveTo(l.x,l.y);c.bezierCurveTo(l.ox,l.oy,pt.dx,pt.dy,pt.dx,pt.dy);c.setLineDash([4/S.zoom,4/S.zoom]);c.strokeStyle='#3d8bff';c.stroke();c.setLineDash([])}
  c.restore();if(!show)return;c.save();c.setTransform(pr,0,0,pr,0,0);const Pp=(x,y)=>[S.panX+x*S.zoom,S.panY+y*S.zoom];
  P.pts.forEach((a,i)=>{const[x,y]=Pp(a.x,a.y);for(const[hx,hy]of[[a.ix,a.iy],[a.ox,a.oy]]){if(hx===a.x&&hy===a.y)continue;const[u,v]=Pp(hx,hy);c.strokeStyle='#3d8bff';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(u,v);c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(u,v,3.2,0,7);c.fill();c.stroke()}
    c.fillStyle=i===P.pts.length-1&&!P.closed?'#3d8bff':'#fff';c.strokeStyle='#3d8bff';c.lineWidth=1.2;c.fillRect(x-3.5,y-3.5,7,7);c.strokeRect(x-3.5,y-3.5,7,7)});c.restore()}
function penMask(){const d=S.doc,P=d&&d.path;if(!P||P.pts.length<2){toast('Tracez d’abord une forme avec la plume');return null}const m=mk(d.w,d.h),g=cx(m);g.fillStyle='#fff';g.fill(penPath({...P,closed:true}));return m}
function penToSel(){const m=penMask();if(!m)return;combineSel(featherMask(m,S.opts.pen.feather),S.opts.selMode,'Tracé → sélection')}
function penToMask(){const d=S.doc,L=AL(),m=penMask();if(!m||!L)return;const fm=featherMask(m,S.opts.pen.feather);L.mask=cloneC(fm);if(L.kind==='pixel')L.editMask=true;markComp();pushHistory('Tracé → masque');syncAll();toast('Masque créé à partir du tracé sur « '+L.name+' »')}
function penFill(){const d=S.doc,P=d&&d.path;if(!P||P.pts.length<2){toast('Tracez d’abord une forme avec la plume');return}const c=mk(d.w,d.h),g=cx(c);g.fillStyle=S.color;g.fill(penPath({...P,closed:true}));insertLayer(newPixel('Forme',c),'Remplir le tracé')}
function penStroke(){const d=S.doc,P=d&&d.path;if(!P||P.pts.length<2){toast('Tracez d’abord une forme avec la plume');return}const c=mk(d.w,d.h),g=cx(c);g.strokeStyle=S.color;g.lineWidth=S.opts.pen.width;g.lineJoin='round';g.lineCap='round';g.stroke(penPath(P));insertLayer(newPixel('Contour',c),'Contour du tracé')}
function selToPath(){const d=S.doc;if(!d||!d.sel){toast('Faites d’abord une sélection');return}const pts=traceMask(d.sel);if(!pts){toast('Sélection trop complexe à convertir');return}d.path={pts,closed:true};setTool('pen');requestRender();toast('Sélection convertie en tracé : ajustez les points avec la plume')}
var traceMask; /* défini dans 0890-selection-quick-mask-pen-paths.js */

