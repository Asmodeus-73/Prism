/* ================= fx geometry: move, crop, free transform, guides, canvas size, zoom (audit fixes) ================= */
(()=>{
const MODAL=()=>!!($('#scrim')||$('#puppet')||$('#library')||$('#pop'));
const isField=t=>!!(t&&t.closest&&t.closest('input,textarea,select,[contenteditable]'));
const KMOD=IS_MAC?'⌘':'Ctrl';

/* ---------- history hooks: work done just before the next snapshot, guides that follow geometry changes ---------- */
const PRE=[];let PGX=null;
const _ph=pushHistory;
pushHistory=function(){while(PRE.length){const f=PRE.shift();try{f()}catch(e){console.warn(e)}}const r=_ph.apply(this,arguments);if(PGX){const e=S.history[S.hi];if(e)e.gx=PGX;PGX=null}gMark();return r};
let GM={arr:null,i:-1};
function gMark(){GM={arr:S.history,i:S.hi}}
const r2=v=>Math.round(v*100)/100;
/* transformDoc / applyCrop leave their rotate/translate on the 2D context of every new canvas (the context is cached): reset it, any later in-place drawing would be shifted */
function cleanCtx(){const d=S.doc;if(!d)return;const t=c=>{try{if(c&&c.getContext)c.getContext('2d').setTransform(1,0,0,1,0,0)}catch(e){}};d.layers.forEach(L=>{t(L.canvas);t(L.mask)});t(d.sel)}
function mapG(g,M,W,H){const out={v:[],h:[]},drop={v:[],h:[]},al=Math.abs(M[1])<1e-9&&Math.abs(M[2])<1e-9;
  const put=(ax,val,orig,oax)=>{const lim=ax==='v'?W:H;if(val>=-0.05&&val<=lim+0.05)out[ax].push(r2(val));else drop[oax].push(orig)};
  (g.v||[]).forEach(x=>al?put('v',M[0]*x+M[4],x,'v'):put('h',M[1]*x+M[5],x,'v'));
  (g.h||[]).forEach(y=>al?put('h',M[3]*y+M[5],y,'h'):put('v',M[2]*y+M[4],y,'h'));return{out,drop}}
const axisAligned=M=>(Math.abs(M[1])<1e-9&&Math.abs(M[2])<1e-9)||(Math.abs(M[0])<1e-9&&Math.abs(M[3])<1e-9);
const invM=M=>{const m=new DOMMatrix(M).inverse();return[m.a,m.b,m.c,m.d,m.e,m.f]};
function gStep(rec,fwd){const d=S.doc;if(!d)return;const g=d.guides||{v:[],h:[]},M=fwd?rec.M:invM(rec.M),r=mapG(g,M,fwd?rec.nw:rec.ow,fwd?rec.nh:rec.oh),back=fwd?rec.dropB:rec.dropF;
  if(back){r.out.v.push(...back.v);r.out.h.push(...back.h)}if(fwd)rec.dropF=r.drop;else rec.dropB=r.drop;d.guides=r.out}
/* guides of the current doc follow a geometric change (matrix old doc -> new doc); recorded on the history step so undo/redo move them back */
function guidesFollow(M,ow,oh,nw,nh){const d=S.doc,g=d&&d.guides;if(!g||!((g.v&&g.v.length)||(g.h&&g.h.length))||!axisAligned(M))return;const rec={M,ow,oh,nw,nh,dropF:null,dropB:null};gStep(rec,true);PGX=rec}
function gSync(){if(S.tf&&S.doc&&!S.doc.layers.includes(S.tf.L)){try{PILL_ACT.tfCancel()}catch(e){S.tf=null}}if(!S.doc)return;if(GM.arr!==S.history){gMark();return}const from=GM.i,to=S.hi;if(from===to)return;
  try{if(to<from){for(let k=from;k>to;k--){const e=S.history[k];if(e&&e.gx)gStep(e.gx,false)}}else{for(let k=from+1;k<=to;k++){const e=S.history[k];if(e&&e.gx)gStep(e.gx,true)}}}catch(e){console.warn(e)}
  gMark();requestRender()}
/* pen path follows too */
function mapPath(M){const d=S.doc;if(!d||!d.path||!d.path.pts)return;const m=new DOMMatrix(M),T=(x,y)=>{const q=m.transformPoint(new DOMPoint(x,y));return[q.x,q.y]};
  d.path={...d.path,pts:d.path.pts.map(p=>{const o={...p};[o.x,o.y]=T(p.x,p.y);if(p.ix!=null)[o.ix,o.iy]=T(p.ix,p.iy);if(p.ox!=null)[o.ox,o.oy]=T(p.ox,p.oy);return o})}}
/* text and shape layers keep their editable data when the change is a plain shift */
function shiftShp(s,dx,dy){if(!s)return s;if(s.type==='compound')return{...s,parts:(s.parts||[]).map(p=>({...p,s:shiftShp(p.s,dx,dy)}))};return{...s,x:(s.x||0)+dx,y:(s.y||0)+dy}}
function shiftMeta(L,dx,dy){if(L.txt){const t=L.txt;L.txt={...t,x:t.x+dx,y:t.y+dy,bbox:Array.isArray(t.bbox)?[t.bbox[0]+dx,t.bbox[1]+dy,t.bbox[2],t.bbox[3]]:t.bbox}}if(L.shp)L.shp=shiftShp(L.shp,dx,dy)}

/* ---------- free transform must not survive a document change ---------- */
const tfOff=apply=>{if(!S.tf)return;try{(apply?PILL_ACT.tfApply:PILL_ACT.tfCancel)()}catch(e){console.warn(e);S.tf=null}};
const _undo=undo;undo=function(){if(S.tf){tfOff(false);return}return _undo.apply(this,arguments)};
const _redo=redo;redo=function(){if(S.tf){tfOff(false);return}return _redo.apply(this,arguments)};
const _rs=restore;restore=function(){if(S.tf)tfOff(false);const r=_rs.apply(this,arguments);gSync();return r};
const _sa=syncAll;syncAll=function(){gSync();return _sa.apply(this,arguments)};
$('#bUndo').onclick=()=>undo();$('#bRedo').onclick=()=>redo();

/* ---------- image ops: transformDoc / resizeDoc keep guides, paths and plain-shift texts in place ---------- */
const _td=transformDoc;
transformDoc=function(nw,nh,fn,label,dropSel){const d=S.doc;if(!d)return;tfOff(true);
  let M=null;try{const t=cx(mk(1,1));fn(t);const m=t.getTransform();M=[m.a,m.b,m.c,m.d,m.e,m.f]}catch(e){}
  const ow=d.w,oh=d.h,shift=M&&M[0]===1&&M[3]===1&&!M[1]&&!M[2],keep=shift?d.layers.filter(L=>L.txt||L.shp).map(L=>[L,L.txt,L.shp]):[];
  PRE.push(()=>{cleanCtx();if(M){guidesFollow(M,ow,oh,nw,nh);mapPath(M)}keep.forEach(([L,t,s])=>{if(!S.doc.layers.includes(L))return;L.txt=t;L.shp=s;shiftMeta(L,M[4],M[5])})});
  try{return _td.apply(this,arguments)}finally{PRE.length=0;PGX=null}};
const _rd=resizeDoc;
resizeDoc=function(w,h){const d=S.doc;if(!d)return;tfOff(true);const ow=d.w,oh=d.h,M=[w/ow,0,0,h/oh,0,0];
  PRE.push(()=>{guidesFollow(M,ow,oh,w,h);mapPath(M)});try{return _rd.apply(this,arguments)}finally{PRE.length=0;PGX=null;if(S.tool==='crop'&&S.doc)try{initCrop()}catch(e){}}};

/* ---------- crop: texts/shapes, guides and path follow; the frame never leaves the (straightened) photo ---------- */
const _ac=applyCrop;
applyCrop=function(){const c=S.crop,d=S.doc;if(!c||!d)return _ac.apply(this,arguments);
  if(!c.angle){const x=clamp(Math.round(c.x),0,d.w-2),y=clamp(Math.round(c.y),0,d.h-2);Object.assign(c,{x,y,w:Math.min(Math.round(c.w),d.w-x),h:Math.min(Math.round(c.h),d.h-y)})}
  const a=c.angle||0,ox=Math.round(c.x),oy=Math.round(c.y),w=Math.round(c.w),h=Math.round(c.h),ow=d.w,oh=d.h;
  PRE.push(()=>{cleanCtx();const T=[1,0,0,1,-ox,-oy];guidesFollow(T,ow,oh,w,h);
    const P=new DOMMatrix().translate(-ox,-oy).translate(ow/2,oh/2).rotate(a).translate(-ow/2,-oh/2);mapPath([P.a,P.b,P.c,P.d,P.e,P.f]);
    S.doc.layers.forEach(L=>{if(!(L.txt||L.shp))return;if(a){L.txt=null;L.shp=null}else shiftMeta(L,-ox,-oy)})});
  try{return _ac.apply(this,arguments)}finally{PRE.length=0;PGX=null}};
/* is the crop frame inside the photo? (the frame lives in the rotated view, the photo turns about its centre) */
function cropOK(c){const d=S.doc;if(!d||!c)return true;const a=(c.angle||0)*Math.PI/180,co=Math.cos(a),si=Math.sin(a),X=d.w/2,Y=d.h/2,e=a?-1:0.01;
  for(const[x,y]of[[c.x,c.y],[c.x+c.w,c.y],[c.x,c.y+c.h],[c.x+c.w,c.y+c.h]]){const vx=x-X,vy=y-Y,ix=X+vx*co+vy*si,iy=Y-vx*si+vy*co;if(ix<-e||iy<-e||ix>d.w+e||iy>d.h+e)return false}return true}
function clampPt(x,y,m){const d=S.doc,c=S.crop,a=(c&&c.angle||0)*Math.PI/180,co=Math.cos(a),si=Math.sin(a),X=d.w/2,Y=d.h/2;
  const vx=x-X,vy=y-Y;let ix=X+vx*co+vy*si,iy=Y-vx*si+vy*co;ix=clamp(ix,m,d.w-m);iy=clamp(iy,m,d.h-m);const ux=ix-X,uy=iy-Y;return{x:X+ux*co-uy*si,y:Y+ux*si+uy*co}}
const _cd0=cropDown;
cropDown=function(p){_cd0.apply(this,arguments);const dr=S.drag;if(!dr||dr.type!=='crop')return;
  if(dr.mode==='move')dr._lp={x:dr.sx,y:dr.sy};
  else if(dr.mode==='h'){const hp=cropHandles(dr.start)[dr.h];dr._lp={x:hp[0],y:hp[1]}}
  else if(dr.mode==='new'){const q=clampPt(dr.sx,dr.sy,4);dr.sx=q.x;dr.sy=q.y;dr._lp={x:q.x,y:q.y}}};
const _cm=cropMove;
cropMove=function(p){const dr=S.drag,c=S.crop;if(!dr||!c)return _cm.apply(this,arguments);const self=this;
  _cm.call(self,p);if(cropOK(c)){dr._lp={x:p.x,y:p.y};return}
  const q=dr._lp;if(!q)return;const at=(x,y)=>{_cm.call(self,{...p,x,y});return cropOK(c)};
  const search=f=>{let lo=0,hi=1;for(let i=0;i<20;i++){const m=(lo+hi)/2,pt=f(m);if(at(pt.x,pt.y))lo=m;else hi=m}return f(lo)};
  const rx_=search(t=>({x:q.x+(p.x-q.x)*t,y:q.y})),ry_=search(t=>({x:rx_.x,y:q.y+(p.y-q.y)*t}));
  _cm.call(self,{...p,x:ry_.x,y:ry_.y});if(!cropOK(c)){_cm.call(self,{...p,x:q.x,y:q.y});return}dr._lp=ry_};
/* a straightened frame is inset by a pixel so its corners never catch the transparent edge */
const _ar=applyRatio;
applyRatio=function(){const r=_ar.apply(this,arguments);const c=S.crop;if(c&&c.angle&&c.w>8&&c.h>8){const X=c.x+c.w/2,Y=c.y+c.h/2,k=1-Math.max(5/c.w,5/c.h);c.w*=k;c.h*=k;c.x=X-c.w/2;c.y=Y-c.h/2}return r};
/* format swap: works with Original and Libre too, and the menu shows the swapped format */
const _crs=cropRatios;
cropRatios=function(){const a=_crs.apply(this,arguments),r=S.opts.crop.ratio;if(r&&/^[\d.]+:[\d.]+$/.test(r)&&!a.some(x=>x[0]===r))a.splice(Math.max(0,a.length-1),0,[r,r.replace(':',' : ')]);return a};
{const r=PREF.get('cropRatio','free');if(typeof r==='string'&&/^[\d.]+:[\d.]+$/.test(r))S.opts.crop.ratio=r}
const gcd=(a,b)=>b?gcd(b,a%b):a;
cropSwapRatio=function(){const c=S.crop,d=S.doc;if(!c||!d)return;const r=S.opts.crop.ratio;
  if(/^[\d.]+:[\d.]+$/.test(r)){const[a,b]=r.split(':');S.opts.crop.ratio=b+':'+a;cropRemember(S.opts.crop.ratio);applyRatio()}
  else if(r==='orig'){const g=gcd(d.w,d.h)||1;S.opts.crop.ratio=(d.h/g)+':'+(d.w/g);cropRemember(S.opts.crop.ratio);applyRatio()}
  else{const X=c.x+c.w/2,Y=c.y+c.h/2;let w=c.h,h=c.w;for(let i=0;i<40;i++){const t={...c,x:X-w/2,y:Y-h/2,w,h};if(cropOK(t))break;w*=0.97;h*=0.97}
    Object.assign(c,{x:X-w/2,y:Y-h/2,w,h});if(!cropOK(c)){const k=Math.min(d.w/w,d.h/h,1);c.w=w*k*0.98;c.h=h*k*0.98;c.x=(d.w-c.w)/2;c.y=(d.h-c.h)/2}requestRender()}
  renderPill()};
/* straighten: Ctrl/⌘ + drag along the horizon (or a vertical) in the crop tool */
function straighten(dr){const c=S.crop,dx=dr.x1-dr.x0,dy=dr.y1-dr.y0;if(!c||Math.hypot(dx,dy)<12){requestRender();return}
  let t=Math.atan2(dy,dx)*180/Math.PI;if(t>90)t-=180;if(t<=-90)t+=180;if(Math.abs(t)>45)t-=90*Math.sign(t);
  c.angle=clamp(Math.round((c.angle-t)*10)/10,-45,45);applyRatio();renderPill();markContent()}

/* ---------- move tool ---------- */
/* exact bounding box (snapping used a 512 px thumbnail: up to several pixels off) */
function exactBB(c){return c?bbCalc(c):null}
function bbCalc(c){const W=c.width,H=c.height,k=Math.min(1,512/Math.max(W,H)),full=()=>{const b=maskBBox(c);return b?{l:b.x0,t:b.y0,r:b.x1,b:b.y1}:null};if(k>=1)return full();
  const w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k)),t=mk(w,h),tg=cx(t);tg.imageSmoothingEnabled=true;tg.imageSmoothingQuality='high';tg.drawImage(c,0,0,w,h);const a=rx(t).getImageData(0,0,w,h).data;
  let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(a[(y*w+x)*4+3]>0){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}if(x1<0)return null;
  const fx=W/w,fy=H/h,m=2,g=rx(c),X0=Math.max(0,Math.floor((x0-m)*fx)),X1=Math.min(W,Math.ceil((x1+1+m)*fx)),Y0=Math.max(0,Math.floor((y0-m)*fy)),Y1=Math.min(H,Math.ceil((y1+1+m)*fy));
  const sw=Math.min(X1-X0,Math.ceil((2*m+1)*fx)+1),sh=Math.min(Y1-Y0,Math.ceil((2*m+1)*fy)+1);
  const scan=(x,y,ww,hh,fn)=>{if(ww<=0||hh<=0)return;const dd=g.getImageData(x,y,ww,hh).data;for(let j=0;j<hh;j++)for(let i=0;i<ww;i++)if(dd[(j*ww+i)*4+3]>8)fn(x+i,y+j)};
  let L=W,R=-1,T=H,B=-1;scan(X0,Y0,sw,Y1-Y0,x=>{if(x<L)L=x});scan(X1-sw,Y0,sw,Y1-Y0,x=>{if(x>R)R=x});scan(X0,Y0,X1-X0,sh,(x,y)=>{if(y<T)T=y});scan(X0,Y1-sh,X1-X0,sh,(x,y)=>{if(y>B)B=y});
  if(R<0||B<0||L>=W||T>=H)return full();return{l:L,t:T,r:R+1,b:B+1}}
/* snapping of a box shifted by (dx,dy) to the photo edges/centre and the guides */
function snapBox(b,dx,dy,noX,noY){const d=S.doc,PG=window.PrismGuides;let sv=[],sh=[];if(!b||!PG||!PG.st.snap)return{dx,dy,lines:null};const g=PG.G(),tol=7/S.zoom;
  const best=(pts,lines,cur)=>{let r=null,bd=tol;pts.forEach(q=>lines.forEach(l=>{const dd=l-(q+cur);if(Math.abs(dd)<=bd){bd=Math.abs(dd);r={adj:dd,line:l}}}));return r};
  const fx=noX?null:best([b.l,(b.l+b.r)/2,b.r],[0,d.w/2,d.w,...g.v],dx),fy=noY?null:best([b.t,(b.t+b.b)/2,b.b],[0,d.h/2,d.h,...g.h],dy);
  if(fx){dx=Math.round(dx+fx.adj);sv=[fx.line]}if(fy){dy=Math.round(dy+fy.adj);sh=[fy.line]}return{dx,dy,lines:(sv.length||sh.length)?{v:sv,h:sh}:null}}
/* the content of the selection floats: cut from the layer, moved, dropped back */
function cutFloat(L,sel){const f=cloneC(L.canvas),fg=cx(f);fg.globalCompositeOperation='destination-in';fg.drawImage(sel,0,0);fg.globalCompositeOperation='source-over';
  const b=cloneC(L.canvas),bg=cx(b);bg.globalCompositeOperation='destination-out';bg.drawImage(sel,0,0);bg.globalCompositeOperation='source-over';return{f,b}}
function dropFloat(L,fl,dx,dy){const d=S.doc,c=cloneC(fl.b);cx(c).drawImage(fl.f,dx,dy);L.canvas=c;const ns=mk(d.w,d.h);cx(ns).drawImage(d.sel,dx,dy);d.sel=maskBBox(ns)?ns:null;selChanged();markComp()}
const canFloat=L=>!!(S.doc&&S.doc.sel&&L&&L.kind==='pixel'&&L.canvas&&!MEDIT(L));
/* moving a text, a shape (combined ones too) or a smart object keeps it editable; their mask moves along */
const _bm=bakeMove;
bakeMove=function(L,dx,dy){const d=S.doc;
  if(L&&(dx||dy)&&(L.txt||L.shp)){L.dx=0;L.dy=0;shiftMeta(L,dx,dy);finalizeMeta(L);if(L.mask){const m=mk(d.w,d.h);cx(m).drawImage(L.mask,dx,dy);L.mask=m}return}
  if(L&&(dx||dy)&&window.PrismSO&&PrismSO.valid(L)){L.dx=0;L.dy=0;const so=L.so,m={...so.m,dx:so.m.dx+dx/d.w*100,dy:so.m.dy+dy/d.h*100},c=PrismSO.render(so,m);L.so={...so,m,out:c};L.canvas=c;if(L.mask){const k=mk(d.w,d.h);cx(k).drawImage(L.mask,dx,dy);L.mask=k}return}
  return _bm.apply(this,arguments)};
function layerAt(x,y){const d=S.doc;x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=d.w||y>=d.h)return -1;
  for(let i=d.layers.length-1;i>=0;i--){const L=d.layers[i];if(L.kind!=='pixel'||L.visible===false||!lcv(L)||!(L.opacity>0))continue;if(lAlpha(L,x,y)<=8)continue;if(L.mask&&rx(L.mask).getImageData(x,y,1,1).data[3]<=8)continue;return i}return -1}
const mates=L=>L&&L.link?S.doc.layers.filter(l=>l!==L&&l.link===L.link&&l.kind==='pixel'&&l.visible!==false):[];

const _od=onDown;
onDown=function(e,p){const d=S.doc;
  if(d&&e.button===0&&!S.spaceDown&&(e.ctrlKey||e.metaKey)){
    if(S.tool==='crop'&&S.crop){S.drag={type:'straighten',x0:p.cx,y0:p.cy,x1:p.cx,y1:p.cy};requestRender();return}
    if(S.tool==='move'){const i=layerAt(p.x,p.y);if(i>=0&&i!==d.active){d.active=i;syncLayers();updateStatus()}}}
  _od.apply(this,arguments);const dr=S.drag;if(!dr)return;
  if(dr.type==='guide'&&!dr.isNew&&dr.orig==null)dr.orig=dr.pos;
  if(dr.type==='move'&&dr.L){
    if(canFloat(dr.L)){const sb=exactBB(d.sel);S.drag={type:'movesel',sx:dr.sx,sy:dr.sy,L:dr.L,bb:sb,fl:null,pv:null,dx:0,dy:0};return}
    if(dr.bb){try{dr.bb=exactBB(dr.L.canvas)}catch(err){}}}};
const _om=onMove;
onMove=function(e,p){const dr=S.drag;
  if(dr&&dr.type==='straighten'){dr.x1=p.cx;dr.y1=p.cy;requestRender();return}
  if(dr&&dr.type==='movesel'){const d=S.doc;let dx=Math.round(p.x-dr.sx),dy=Math.round(p.y-dr.sy),nx=false,ny=false;
    if(e.shiftKey){if(Math.abs(p.x-dr.sx)>=Math.abs(p.y-dr.sy)){dy=0;ny=true}else{dx=0;nx=true}}
    const s=e.altKey?{dx,dy,lines:null}:snapBox(dr.bb,dx,dy,nx,ny);dx=s.dx;dy=s.dy;S.snapLines=s.lines;
    if(!dr.fl){if(!dx&&!dy){requestRender();return}dr.fl=cutFloat(dr.L,d.sel);dr.pv=mk(d.w,d.h)}
    dr.dx=dx;dr.dy=dy;const g=cx(dr.pv);g.clearRect(0,0,d.w,d.h);g.drawImage(dr.fl.b,0,0);g.drawImage(dr.fl.f,dx,dy);dr.L.preview=dr.pv;S.selOff={x:dx,y:dy};markComp();return}
  _om.apply(this,arguments);
  if(dr&&dr.type==='move'&&dr.L&&S.drag===dr&&e.shiftKey){const L=dr.L,hz=Math.abs(p.x-dr.sx)>=Math.abs(p.y-dr.sy);if(hz)L.dy=0;else L.dx=0;(dr.mates||[]).forEach(m=>{m.dx=L.dx;m.dy=L.dy});
    if(S.snapLines){S.snapLines=hz?{v:S.snapLines.v||[],h:[]}:{v:[],h:S.snapLines.h||[]};if(!S.snapLines.v.length&&!S.snapLines.h.length)S.snapLines=null}markComp()}};
const _ou=onUp;
onUp=function(e){const dr=S.drag;
  if(dr&&dr.type==='straighten'){S.drag=null;straighten(dr);return}
  if(dr&&dr.type==='movesel'){S.drag=null;S.snapLines=null;S.selOff=null;const L=dr.L;delete L.preview;
    if(dr.fl&&(dr.dx||dr.dy)){dropFloat(L,dr.fl,dr.dx,dr.dy);pushHistory('Déplacer les pixels sélectionnés')}else markComp();requestRender();return}
  if(dr&&dr.type==='move'&&dr.L){S.drag=null;S.snapLines=null;const L=dr.L,dx=L.dx||0,dy=L.dy||0;[L,...(dr.mates||[])].forEach(l=>bakeMove(l,dx,dy));markComp();if(dx||dy)pushHistory('Déplacement');requestRender();return}
  return _ou.apply(this,arguments)};
const _cdg=cancelDrag;
cancelDrag=function(){const dr=S.drag;
  if(dr&&dr.type==='straighten'){S.drag=null;requestRender();return}
  if(dr&&dr.type==='movesel'){S.drag=null;S.snapLines=null;S.selOff=null;delete dr.L.preview;markComp();return}
  const r=_cdg.apply(this,arguments);
  if(dr&&dr.type==='move')(dr.mates||[]).forEach(m=>{m.dx=0;m.dy=0});
  if(dr&&dr.type==='guide'&&dr.orig!=null&&S.doc){const g=PrismGuides.G();(dr.axis==='v'?g.v:g.h).push(dr.orig)}
  requestRender();return r};
/* the straighten line */
const _dov=drawOverlays;
drawOverlays=function(c,pr){_dov.apply(this,arguments);const dr=S.drag;if(!dr||dr.type!=='straighten')return;c.save();c.setTransform(pr,0,0,pr,0,0);
  c.lineCap='round';c.beginPath();c.moveTo(dr.x0,dr.y0);c.lineTo(dr.x1,dr.y1);c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.5)';c.stroke();c.lineWidth=1.5;c.strokeStyle='#fff';c.stroke();c.restore()};

/* arrows: 1 px, Shift: 10 px (move tool: layer or selected pixels; free transform: the frame) */
let NUD={t:0,L:null};
function histNudge(label,L){const now=performance.now(),top=S.history[S.hi];if(top&&top._nudge===label&&NUD.L===L&&now-NUD.t<1500&&S.hi===S.history.length-1&&S.hi>0)S.hi--;
  pushHistory(label);const e=S.history[S.hi];if(e)e._nudge=label;NUD={t:now,L}}
function nudge(dx,dy){const d=S.doc,L=AL();if(!L||L.kind!=='pixel'){toast('Sélectionnez un calque de pixels à déplacer');return}
  if(canFloat(L)){if(!maskBBox(d.sel))return;dropFloat(L,cutFloat(L,d.sel),dx,dy);histNudge('Déplacer les pixels sélectionnés',L);return}
  [L,...mates(L)].forEach(l=>bakeMove(l,dx,dy));markComp();histNudge('Déplacement',L)}
window.addEventListener('keydown',e=>{const k=e.key;if(!/^Arrow(Left|Right|Up|Down)$/.test(k)||e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey)return;
  const d=S.doc;if(!d||S.drag||S.stroke||MODAL()||isField(e.target))return;if(S.tool!=='move'&&!(S.tool==='transform'&&S.tf))return;
  const s=e.shiftKey?10:1,dx=k==='ArrowLeft'?-s:k==='ArrowRight'?s:0,dy=k==='ArrowUp'?-s:k==='ArrowDown'?s:0;e.preventDefault();
  if(S.tool==='transform'){const T=S.tf,F=v=>({x:v.x+dx,y:v.y+dy});T.q=T.q.map(F);if(T.mode==='warp'&&T.mesh)T.mesh=T.mesh.map(r=>r.map(F));else PrismTF.mesh(T);PrismTF.preview();return}
  nudge(dx,dy)});

/* ---------- guides: Esc while dragging an existing guide puts it back ---------- */
/* (handled in cancelDrag above) */

/* ---------- canvas size and trim ---------- */
function canvasResize(w,h,ax,ay,fill){tfOff(true);const d=S.doc,ow=d.w,oh=d.h,ox=Math.round((w-ow)*ax/2),oy=Math.round((h-oh)*ay/2);
  if(fill&&fill!=='none'){const col=fill==='fg'?S.color:fill;PRE.push(()=>{cleanCtx();const L=S.doc.layers.find(l=>l.kind==='pixel'&&l.canvas);if(!L)return;const paint=(c,st)=>{const g=cx(c);g.save();g.fillStyle=st;g.beginPath();g.rect(0,0,w,h);g.rect(ox,oy,ow,oh);g.fill('evenodd');g.restore()};paint(L.canvas,col);if(L.mask)paint(L.mask,'#fff')})}
  PRE.push(()=>{cleanCtx();S.doc.layers.forEach(L=>{if(L.kind==='pixel'&&L.mask){const g=cx(L.mask);g.save();g.fillStyle='#fff';g.beginPath();g.rect(0,0,w,h);g.rect(ox,oy,ow,oh);g.fill('evenodd');g.restore()}})});
  transformDoc(w,h,g=>g.translate(ox,oy),'Taille de la zone de travail')}
function canvasSizeDialog(){const d=S.doc;if(!d)return;let ax=1,ay=1,rel=false;
  const cells=[0,1,2].map(y=>[0,1,2].map(x=>`<button type="button" class="cz-c${x===1&&y===1?' on':''}" data-x="${x}" data-y="${y}" aria-label="Ancrage ${['haut','milieu','bas'][y]} ${['gauche','centre','droite'][x]}"></button>`).join('')).join('');
  dialog({title:'Taille de la zone de travail',body:`<p class="muted" style="margin:0 0 10px">Actuellement ${d.w} × ${d.h} px. Agrandir ajoute une marge autour de la photo, réduire la rogne.</p>
    <div class="inline"><label class="field">Largeur (px)<input type="number" id="czW" value="${d.w}" min="1" max="30000"></label><label class="field">Hauteur (px)<input type="number" id="czH" value="${d.h}" min="1" max="30000"></label></div>
    <label class="inline" style="margin:8px 0"><input type="checkbox" id="czR">Relative (ajouter à la taille actuelle)</label>
    <div class="cz-row"><span class="field">Ancrage</span><div class="cz-a">${cells}</div><label class="field">Nouvelle zone<select id="czF"><option value="none">Transparente</option><option value="#ffffff">Blanche</option><option value="#000000">Noire</option><option value="fg">Couleur actuelle</option></select></label></div>
    <style>.cz-row{display:flex;gap:18px;align-items:flex-start;margin-top:4px}.cz-a{display:grid;grid-template-columns:repeat(3,22px);gap:3px;margin-top:5px}.cz-c{width:22px;height:22px;border-radius:5px;border:1px solid var(--line-2);background:var(--field);padding:0;cursor:pointer}.cz-c.on{background:var(--accent);border-color:var(--accent)}</style>`,
    onOpen:el=>{const W=$('#czW',el),H=$('#czH',el),R=$('#czR',el);R.onchange=()=>{rel=R.checked;W.value=rel?0:d.w;H.value=rel?0:d.h};
      el.querySelectorAll('.cz-c').forEach(b=>b.onclick=()=>{el.querySelectorAll('.cz-c').forEach(x=>x.classList.toggle('on',x===b));ax=+b.dataset.x;ay=+b.dataset.y});
      setTimeout(()=>{W.focus();W.select()},30)},
    buttons:[{label:'Annuler'},{label:'Appliquer',primary:true,onClick:el=>{let w=Math.round(+$('#czW',el).value||0),h=Math.round(+$('#czH',el).value||0);if(rel){w+=d.w;h+=d.h}
      if(!(w>=1&&h>=1&&w<=30000&&h<=30000)){toast('Entrez une largeur et une hauteur entre 1 et 30 000 px');return false}if(w*h>MAX_PX){toast('Taille trop grande pour ce navigateur');return false}
      if(w===d.w&&h===d.h)return;canvasResize(w,h,ax,ay,$('#czF',el).value)}}]})}
function trimDoc(){const d=S.doc;if(!d)return;tfOff(true);const b=maskBBox(flatSync());if(!b){toast('L’image est entièrement transparente');return}
  if(b.x0===0&&b.y0===0&&b.x1===d.w&&b.y1===d.h){toast('Aucun bord transparent à rogner');return}
  transformDoc(b.x1-b.x0,b.y1-b.y0,g=>g.translate(-b.x0,-b.y0),'Rogner les bords transparents')}
const _imi=MENU2.image.items;
MENU2.image.items=()=>{const a=_imi(),i=a.findIndex(x=>x&&x.label==='Taille de l’image…');
  a.splice(i<0?a.length:i+1,0,MI('Taille de la zone de travail…',{icon:'resize',kbd:MOD+'⌥C',fn:canvasSizeDialog,dis:docDis()}),MI('Rogner les bords transparents',{fn:trimDoc,dis:docDis()}));return a};
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!e.altKey||e.shiftKey||e.code!=='KeyC'||!S.doc||MODAL()||isField(e.target))return;e.preventDefault();e.stopImmediatePropagation();canvasSizeDialog()},true);

/* ---------- navigation ---------- */
/* wheel in lines or pages (Firefox, some mice) scrolled 3 px per notch; Shift+wheel scrolls sideways */
stage.addEventListener('wheel',e=>{if(!S.doc||e.ctrlKey||e.metaKey||e.altKey)return;if(!e.deltaMode&&!(e.shiftKey&&!e.deltaX&&e.deltaY))return;
  e.preventDefault();e.stopImmediatePropagation();const k=e.deltaMode===1?18:e.deltaMode===2?Math.max(120,S.vh*0.85):1;let dx=e.deltaX*k,dy=e.deltaY*k;if(e.shiftKey&&!dx){dx=dy;dy=0}
  S.fitted=false;S.panX-=dx;S.panY-=dy;markContent()},{capture:true,passive:false});
/* zoom tool shows zoom-out while Alt is held; double-click on Hand = fit, on Zoom = 100 % */
const zc=e=>{if(S.tool==='zoom'&&S.doc&&!S.spaceDown&&(e.key==='Alt'||e.type==='blur'))view.style.cursor=e.altKey&&e.type==='keydown'?'zoom-out':'zoom-in'};
window.addEventListener('keydown',zc);window.addEventListener('keyup',zc);
$('#dock')&&$('#dock').addEventListener('dblclick',e=>{const b=e.target.closest&&e.target.closest('[data-tool]');if(!b||!S.doc)return;if(b.dataset.tool==='hand')fit();else if(b.dataset.tool==='zoom')zoomAt(1)});
/* Esc during a straighten line only drops the line */
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.drag&&S.drag.type==='straighten'){e.preventDefault();e.stopImmediatePropagation();cancelDrag()}},true);

/* ---------- free transform: handle cursors follow the frame (corners were all ↘) ---------- */
view.addEventListener('pointermove',()=>{const T=S.tf;if(S.tool!=='transform'||!T||S.drag||T.mode==='warp')return;const p=S.pointer;if(!p)return;
  const toS=q=>({x:S.panX+q.x*S.zoom,y:S.panY+q.y*S.zoom}),q=T.q,n=v=>{const l=Math.hypot(v.x,v.y)||1;return{x:v.x/l,y:v.y/l}},C=toS({x:(q[0].x+q[1].x+q[2].x+q[3].x)/4,y:(q[0].y+q[1].y+q[2].y+q[3].y)/4});
  const hs=q.map((v,i)=>{const a=n({x:v.x-q[(i+3)%4].x,y:v.y-q[(i+3)%4].y}),b=n({x:v.x-q[(i+1)%4].x,y:v.y-q[(i+1)%4].y});return{p:v,dir:{x:a.x+b.x,y:a.y+b.y}}});
  if(T.mode==='free')for(let i=0;i<4;i++){const m={x:(q[i].x+q[(i+1)%4].x)/2,y:(q[i].y+q[(i+1)%4].y)/2},s=toS(m);hs.push({p:m,dir:{x:s.x-C.x,y:s.y-C.y}})}
  for(const h of hs){const s=toS(h.p);if(Math.hypot(s.x-p.cx,s.y-p.cy)>10)continue;if(T.mode==='persp'){view.style.cursor='move';return}
    let a=Math.atan2(h.dir.y,h.dir.x)*180/Math.PI;a=((a%180)+180)%180;view.style.cursor=a<22.5||a>=157.5?'ew-resize':a<67.5?'nwse-resize':a<112.5?'ns-resize':'nesw-resize';return}});

/* ---------- options bar hints ---------- */
const _rp=renderPill;
renderPill=function(){const r=_rp.apply(this,arguments);try{const ob=$('#pill');
  if(S.tool==='move'){const h=ob.querySelector('.hint');if(h)h.textContent=`Glissez pour déplacer le calque, ou les pixels sélectionnés. Flèches : 1 px (Maj : 10 px). ${KMOD}+clic : calque sous le pointeur.`}
  if(S.tool==='crop'){const a=$('#cropAng');const l=a&&a.closest('label');if(l)l.title=`Ou ${KMOD}+glisser le long de l’horizon sur la photo`}}catch(e){}return r};
if(window.TOOL_HELP||typeof TOOL_HELP!=='undefined'){try{TOOL_HELP.crop=(TOOL_HELP.crop?TOOL_HELP.crop+' ':'')+`${KMOD}+glisser le long de l’horizon pour redresser.`}catch(e){}}

/* ---------- dialogs of this area: Enter confirms (image size, canvas size, custom format, new guide) ---------- */
const _dlg=dialog;
dialog=function(o){const dl=_dlg.apply(this,arguments);
  try{if(o&&/^(Taille de l’image|Taille de la zone de travail|Format personnalisé|Nouveau repère)$/.test(o.title)&&dl&&!dl._geoEnter){dl._geoEnter=1;
    dl.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.shiftKey||e.isComposing||e.defaultPrevented)return;const t=e.target;if(t&&t.closest&&t.closest('textarea,select,button'))return;
      const b=dl.querySelector('.foot .btn.primary');if(!b||!b.isConnected)return;e.preventDefault();e.stopPropagation();b.click()})}}catch(err){}
  return dl};

/* ---------- guides: a click on a ruler makes no guide, guides sit on whole pixels, dropping one on its ruler removes it ---------- */
const _odG=onDown;
onDown=function(e,p){_odG.apply(this,arguments);const dr=S.drag;if(dr&&dr.type==='guide'){dr.sx=p.cx;dr.sy=p.cy}};
const _ouG=onUp;
onUp=function(e){const dr=S.drag;
  if(dr&&dr.type==='guide'&&S.doc){const r=view.getBoundingClientRect(),px=e&&e.clientX!=null?e.clientX-r.left:(S.pointer?S.pointer.cx:0),py=e&&e.clientY!=null?e.clientY-r.top:(S.pointer?S.pointer.cy:0);
    const moved=dr.sx==null||Math.hypot(px-dr.sx,py-dr.sy)>=3,onRuler=!!(window.PrismGuides&&PrismGuides.st.rulers)&&(dr.axis==='v'?px<20:py<20);
    if(dr.isNew&&!moved||onRuler){S.drag=null;S.snapLines=null;try{scheduleSave()}catch(err){}requestRender();return}
    dr.pos=Math.round(dr.pos);const g=PrismGuides.G(),arr=dr.axis==='v'?g.v:g.h;_ouG.apply(this,arguments);
    const k=arr.lastIndexOf(dr.pos);if(k>=0&&arr.indexOf(dr.pos)!==k)arr.splice(k,1);return}
  return _ouG.apply(this,arguments)};

/* ---------- crop: Esc during a drag, double-click inside the frame applies, the selection follows the crop ---------- */
const _ccG=cancelCrop;
cancelCrop=function(){if(S.drag&&S.drag.type==='crop')S.drag=null;return _ccG.apply(this,arguments)};
view.addEventListener('dblclick',e=>{const c=S.crop;if(S.tool!=='crop'||!c||!S.doc)return;const r=view.getBoundingClientRect(),q=toDoc(e.clientX-r.left,e.clientY-r.top),m=10/S.zoom;
  if(q.x>c.x+m&&q.x<c.x+c.w-m&&q.y>c.y+m&&q.y<c.y+c.h-m){e.preventDefault();applyCrop()}});
const _acS=applyCrop;
applyCrop=function(){const c=S.crop,d=S.doc;if(!c||!d)return _acS.apply(this,arguments);const sel0=d.sel;
  if(sel0){const a=c.angle||0,ow=d.w,oh=d.h,x0=c.angle?Math.round(c.x):clamp(Math.round(c.x),0,d.w-2),y0=c.angle?Math.round(c.y):clamp(Math.round(c.y),0,d.h-2),w=c.angle?Math.round(c.w):Math.min(Math.round(c.w),d.w-x0),h=c.angle?Math.round(c.h):Math.min(Math.round(c.h),d.h-y0);
    PRE.push(()=>{const dd=S.doc;if(!dd||dd.w!==w||dd.h!==h)return;try{const n=mk(w,h),g=cx(n);g.translate(-x0,-y0);if(a){g.translate(ow/2,oh/2);g.rotate(a*Math.PI/180);g.translate(-ow/2,-oh/2)}g.drawImage(sel0,0,0);g.setTransform(1,0,0,1,0,0);dd.sel=maskBBox(n)?n:null;selChanged()}catch(err){console.warn(err)}})}
  return _acS.apply(this,arguments)};

/* ---------- zoom tool: drag a rectangle to zoom onto it; a simple click still steps (Alt: out) ---------- */
const _odZ=onDown;
onDown=function(e,p){if(S.tool==='zoom'&&S.doc&&e.button===0&&!S.spaceDown&&!S.wbPick){S.drag={type:'zoomrect',x0:p.cx,y0:p.cy,x1:p.cx,y1:p.cy,alt:e.altKey};return}return _odZ.apply(this,arguments)};
const _omZ=onMove;
onMove=function(e,p){const dr=S.drag;if(dr&&dr.type==='zoomrect'){dr.x1=p.cx;dr.y1=p.cy;requestRender();return}return _omZ.apply(this,arguments)};
const _ouZ=onUp;
onUp=function(e){const dr=S.drag;
  if(dr&&dr.type==='zoomrect'){S.drag=null;const w=Math.abs(dr.x1-dr.x0),h=Math.abs(dr.y1-dr.y0);
    if(dr.alt||w<5||h<5){zoomStep(dr.alt?-1:1,dr.x0,dr.y0);return}
    const a=toDoc(Math.min(dr.x0,dr.x1),Math.min(dr.y0,dr.y1)),b=toDoc(Math.max(dr.x0,dr.x1),Math.max(dr.y0,dr.y1)),dw=Math.max(1,b.x-a.x),dh=Math.max(1,b.y-a.y),z=clamp(Math.min(S.vw/dw,S.vh/dh),0.02,32);
    S.fitted=false;S.zoom=z;S.panX=S.vw/2-(a.x+dw/2)*z;S.panY=S.vh/2-(a.y+dh/2)*z;markContent();return}
  return _ouZ.apply(this,arguments)};
const _dovZ=drawOverlays;
drawOverlays=function(c,pr){_dovZ.apply(this,arguments);const dr=S.drag;if(!dr||dr.type!=='zoomrect')return;
  c.save();c.setTransform(pr,0,0,pr,0,0);c.beginPath();c.rect(Math.min(dr.x0,dr.x1)+.5,Math.min(dr.y0,dr.y1)+.5,Math.abs(dr.x1-dr.x0),Math.abs(dr.y1-dr.y0));dash(c);c.restore()};

/* ---------- cursors: crop handles and frame, guides under the Move tool, closed hand while panning ---------- */
const CUR8=['nwse-resize','ns-resize','nesw-resize','ew-resize','nwse-resize','ns-resize','nesw-resize','ew-resize'];let curTouched=false;
view.addEventListener('pointermove',()=>{if(S.drag||S.spaceDown||!S.doc||S.stroke)return;const p=S.pointer;if(!p)return;let cur=null;
  if(S.tool==='crop'&&S.crop){const c=S.crop,tol=10/S.zoom,h=cropHandles(c).findIndex(([x,y])=>Math.abs(p.dx-x)<tol&&Math.abs(p.dy-y)<tol);
    cur=h>=0?CUR8[h]:(p.dx>c.x&&p.dx<c.x+c.w&&p.dy>c.y&&p.dy<c.y+c.h)?'move':'crosshair'}
  else if(S.tool==='move'&&window.PrismGuides){const g=PrismGuides.G(),t=5/S.zoom;if(g){if(g.v.some(x=>Math.abs(x-p.dx)<=t))cur='col-resize';else if(g.h.some(y=>Math.abs(y-p.dy)<=t))cur='row-resize';else if(curTouched)cur='crosshair'}}
  if(cur){view.style.cursor=cur;curTouched=cur!=='crosshair'}});
const _odP=onDown;
onDown=function(e,p){_odP.apply(this,arguments);if(S.drag&&S.drag.type==='pan')view.style.cursor='grabbing'};
const _ouP=onUp;
onUp=function(e){const dr=S.drag,r=_ouP.apply(this,arguments);if(dr&&dr.type==='pan')view.style.cursor=(S.spaceDown||S.tool==='hand')?'grab':(setCursor(),view.style.cursor);return r};

/* ---------- free transform follows its document: applied when the user leaves for another photo or tab, dropped when the document is closed ---------- */
const _sdT=setDoc;setDoc=function(){if(S.tf)tfOff(true);return _sdT.apply(this,arguments)};
const _cdT=closeDoc;closeDoc=function(){if(S.tf)tfOff(false);return _cdT.apply(this,arguments)};
{const tb=$('#tabbar');if(tb)tb.addEventListener('click',()=>{if(S.tf)tfOff(true)},true)}
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.altKey&&/^Arrow(Left|Right)$/.test(e.key)&&S.tf)tfOff(true)},true);

/* ---------- zoom: 100 % is one image pixel per screen pixel (device pixels), and the pan rests on the pixel grid at whole scales (a half-pixel offset blurred a 1-px pattern completely) ---------- */
const DPRz=()=>window.devicePixelRatio||1;
let snapT=0;
function snapPan(){snapT=0;if(!S.doc||S.drag||S.stroke)return;const pr=Math.min(DPRz(),2),sc=S.zoom*pr;if(sc<0.999||Math.abs(sc-Math.round(sc))>0.0015)return;
  const px=Math.round(S.panX*pr)/pr,py=Math.round(S.panY*pr)/pr;if(Math.abs(px-S.panX)>1e-6||Math.abs(py-S.panY)>1e-6){S.panX=px;S.panY=py;markContent()}}
const _zaZ=zoomAt;
zoomAt=function(z){const one=arguments.length===1&&z===1;if(one)z=1/DPRz();const r=_zaZ.call(this,z,arguments[1],arguments[2]);if(one)snapPan();return r};
const _zsZ=zoomStep;
zoomStep=function(dir,x,y){const k=DPRz();if(k===1)return _zsZ.apply(this,arguments);const l=S.zoom*k;
  zoomAt((dir>0?(ZS.find(s=>s>l*1.01)||32):([...ZS].reverse().find(s=>s<l/1.01)||0.02))/k,x,y)};
const _usZ=updateStatus;
updateStatus=function(){const r=_usZ.apply(this,arguments);const k=DPRz();if(k!==1&&S.doc){const t=Math.round(S.zoom*k*100)+' %',l=$('#zoomLbl');if(l)l.textContent=t;const f=$('#status span');if(f)f.textContent=t}return r};
const _rnZ=render;
/* the pointer's image coordinates follow the view when it zooms or pans under a resting mouse (status bar, clone source overlay) */
render=function(){const p=S.pointer;if(p&&S.doc&&p.cx!=null){const q=toDoc(p.cx,p.cy);p.dx=q.x;p.dy=q.y}const r=_rnZ.apply(this,arguments);clearTimeout(snapT);snapT=setTimeout(snapPan,150);return r};

/* ---------- Safari trackpad pinch (gesture events, no ctrl+wheel there): zoom the photo, not the page ---------- */
if('ongesturestart' in window&&!(navigator.maxTouchPoints>0)){let g0=null;
  stage.addEventListener('gesturestart',e=>{if(!S.doc)return;e.preventDefault();g0={z:S.zoom}},{passive:false});
  stage.addEventListener('gesturechange',e=>{if(!S.doc||!g0)return;e.preventDefault();const r=view.getBoundingClientRect();zoomAt(g0.z*e.scale,e.clientX-r.left,e.clientY-r.top)},{passive:false});
  stage.addEventListener('gestureend',e=>{if(g0)e.preventDefault();g0=null},{passive:false})}

/* AZERTY: the "-" key is Digit6 and the engine reads Ctrl+Digit as Ctrl+6, so Ctrl+- (zoom out) did nothing on French keyboards */
window.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||e.code!=='Digit6'||e.key!=='-'||!S.doc||MODAL()||isField(e.target)||$('#library'))return;e.preventDefault();e.stopImmediatePropagation();zoomStep(-1)},true);

/* right-click on the canvas opens the context menu; it must not start a stroke, a selection, a zoom step or a tool drag */
view.addEventListener('pointerdown',e=>{if(e.button===2&&e.pointerType==='mouse'&&!e.ctrlKey&&S.tool!=='pen')e.stopImmediatePropagation()},true);

window.PrismGeo={exactBB,cropOK,nudge,canvasResize,trimDoc,layerAt,gSync};
})();

