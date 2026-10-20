/* ================= fx_select: selection, quick mask, pen paths (audit fixes) ================= */
(()=>{
const SELT=['marquee','lasso','wand'];
const inField=t=>!!(t&&t.closest&&t.closest('input:not([type=range]):not([type=checkbox]):not([type=color]):not([type=radio]),textarea,select,[contenteditable]'));
const modal=()=>!!(LIB.open||$('#library')||(MEN&&MEN.levels&&MEN.levels.length)||$('#cmdk')||$('#msheet')||($('#scrim')&&!$('#scrim').classList.contains('light')));
const busyOn=()=>{const b=$('#busy');return!!(b&&!b.hidden)};

/* ---------- marching ants: exact at every zoom, thin selections stay visible, cheap pan/zoom ---------- */
/* binary mask (alpha >= 50 %) + OR-pyramid, rebuilt only when the selection changes; the screen pass reads
   the level whose pixels are at least one device pixel wide, so nothing selected can fall between samples */
const AP={sel:null,ver:-1,lv:null,bb:null,warned:null};
function antsPyr(sel){
  if(AP.sel===sel&&AP.ver===S.selVer)return AP;
  const W=sel.width,H=sel.height,a=rx(sel).getImageData(0,0,W,H).data,l0=new Uint8Array(W*H);let x0=W,y0=H,x1=-1,y1=-1;
  for(let y=0;y<H;y++){const o=y*W;let f=-1,l=-1;for(let x=0;x<W;x++){if(a[(o+x)*4+3]>=128){l0[o+x]=1;if(f<0)f=x;l=x}}if(f>=0){if(f<x0)x0=f;if(l>x1)x1=l;if(y<y0)y0=y;y1=y}}
  const lv=[{w:W,h:H,d:l0}];let c=lv[0];
  while((c.w>8||c.h>8)&&lv.length<16){const nw=Math.ceil(c.w/2),nh=Math.ceil(c.h/2),nd=new Uint8Array(nw*nh),s=c.d,cw=c.w,ch=c.h;
    for(let y=0;y<nh;y++){const ya=2*y*cw,yb=Math.min(2*y+1,ch-1)*cw,o=y*nw;for(let x=0;x<nw;x++){const xa=2*x,xb=Math.min(2*x+1,cw-1);nd[o+x]=s[ya+xa]|s[ya+xb]|s[yb+xa]|s[yb+xb]}}
    c={w:nw,h:nh,d:nd};lv.push(c)}
  AP.sel=sel;AP.ver=S.selVer;AP.lv=lv;AP.bb=x1<0?null:{x0,y0,x1:x1+1,y1:y1+1};
  if(!AP.bb&&AP.warned!==sel){AP.warned=sel;setTimeout(()=>toast('Aucun pixel n’est sélectionné à plus de 50 % : le contour de la sélection n’est pas affiché.',5000),0)}
  return AP}
const AN={key:'',ix:null,ph:null,img:null,c:null,x:0,y:0};
function antsBuild(d){const P=antsPyr(d.sel),W=view.width,H=view.height;AN.ix=null;if(!P.bb)return;
  const pr=S.pr,z=S.zoom,sc=z*pr,off=S.selOff||{x:0,y:0},b=P.bb;
  let L=0;if(sc<1)L=Math.min(P.lv.length-1,Math.max(0,Math.ceil(Math.log2(1/sc)-1e-9)));const lv=P.lv[L],f=1/(1<<L),DW=P.lv[0].w,DH=P.lv[0].h;
  const rx0=Math.max(-1,Math.floor((S.panX+(b.x0+off.x)*z)*pr)-2),rx1=Math.min(W+1,Math.ceil((S.panX+(b.x1+off.x)*z)*pr)+2),ry0=Math.max(-1,Math.floor((S.panY+(b.y0+off.y)*z)*pr)-2),ry1=Math.min(H+1,Math.ceil((S.panY+(b.y1+off.y)*z)*pr)+2);
  if(rx1-rx0<3||ry1-ry0<3)return;const rw=rx1-rx0,rh=ry1-ry0,col=new Int32Array(rw),row=new Int32Array(rh);
  for(let i=0;i<rw;i++){const v=((rx0+i+.5)/pr-S.panX)/z-off.x;col[i]=v<0||v>=DW?-1:Math.min(lv.w-1,Math.floor(v*f))}
  for(let j=0;j<rh;j++){const v=((ry0+j+.5)/pr-S.panY)/z-off.y;row[j]=v<0||v>=DH?-1:Math.min(lv.h-1,Math.floor(v*f))}
  const B=new Uint8Array(rw*rh),ld=lv.d,lw=lv.w;
  for(let j=0;j<rh;j++){const r=row[j];if(r<0)continue;const base=r*lw,o=j*rw;for(let i=0;i<rw;i++){const c=col[i];if(c>=0&&ld[base+c])B[o+i]=1}}
  const dx0=Math.max(0,rx0),dy0=Math.max(0,ry0),dw=Math.min(W,rx1)-dx0,dh=Math.min(H,ry1)-dy0;if(dw<1||dh<1)return;
  const ix=[],ph=[];
  for(let j=1;j<rh-1;j++){const sy=ry0+j;if(sy<0||sy>=H)continue;const o=j*rw;for(let i=1;i<rw-1;i++){const k=o+i;if(!B[k]||(B[k-1]&&B[k+1]&&B[k-rw]&&B[k+rw]))continue;const sx=rx0+i;if(sx<0||sx>=W)continue;ix.push((sy-dy0)*dw+(sx-dx0));ph.push((sx+sy)&7)}}
  AN.ix=Int32Array.from(ix);AN.ph=Uint8Array.from(ph);AN.x=dx0;AN.y=dy0;
  if(!AN.c||AN.c.width!==dw||AN.c.height!==dh){AN.c=mk(dw,dh);AN.img=new ImageData(dw,dh)}else AN.img.data.fill(0)}
const _drawAnts=drawAnts;
drawAnts=function(c){const d=S.doc;if(!d||!d.sel)return;
  if(typeof cropAngle==='function'&&cropAngle())return _drawAnts.apply(this,arguments);
  try{const W=view.width,H=view.height,off=S.selOff||{x:0,y:0},key=[S.selVer,S.zoom,S.panX,S.panY,W,H,S.pr,off.x,off.y].join('|');
    if(AN.key!==key||AP.sel!==d.sel){AN.key=key;antsBuild(d)}
    const ix=AN.ix;if(!ix||!ix.length)return;const dd=AN.img.data,ph=AN.ph,P=S.antPhase|0;
    for(let k=0;k<ix.length;k++){const j=ix[k]*4,v=((ph[k]+P)&7)>>2?255:0;dd[j]=dd[j+1]=dd[j+2]=v;dd[j+3]=255}
    cx(AN.c).putImageData(AN.img,0,0);c.setTransform(1,0,0,1,0,0);c.drawImage(AN.c,AN.x,AN.y)}
  catch(e){console.warn(e);AN.key='';return _drawAnts.apply(this,arguments)}};
/* the selection is "inside" at a document point (alpha >= 50 %) */
const selInside=(x,y)=>{const d=S.doc;if(!d||!d.sel)return false;try{const P=antsPyr(d.sel),l=P.lv[0];x=Math.floor(x);y=Math.floor(y);return x>=0&&y>=0&&x<l.w&&y<l.h&&!!l.d[y*l.w+x]}catch(e){return false}};

/* ---------- quick mask: painting is no longer clipped by the old selection, entering it is undoable ---------- */
const QMS=new WeakMap();
quickMask=function(){const d=S.doc;if(!d||S.stroke||S.drag)return;const q=d.layers.findIndex(l=>l.qmask);
  if(q<0){const A=AL();QMS.set(d,{id:A&&A.id,tool:S.tool});const mask=d.sel?cloneC(d.sel):mk(d.w,d.h),L=newAdjust('Masque rapide',mask);L.qmask=true;d.layers.push(L);d.active=d.layers.length-1;d.sel=null;
    S.showMask=true;S.qmOn=true;setTool('brush');selChanged();markComp();pushHistory('Masque rapide');syncAll();toast('Masque rapide : peignez en blanc pour ajouter à la sélection, avec la gomme pour retirer. Q pour valider.',6000);return}
  const L=d.layers[q],m=maskBBox(L.mask)?cloneC(L.mask):null,st=QMS.get(d);QMS.delete(d);d.layers.splice(q,1);
  let ai=st&&st.id!=null?d.layers.findIndex(l=>l.id===st.id):-1;
  if(ai<0){ai=Math.min(d.active,d.layers.length-1);if(d.layers[ai]&&d.layers[ai].kind!=='pixel'){const p=d.layers.findLastIndex(l=>l.kind==='pixel');if(p>=0)ai=p}}
  d.active=Math.max(0,ai);d.sel=m;S.showMask=false;S.qmOn=false;
  if(st&&st.tool&&st.tool!=='brush'&&(S.tool==='brush'||S.tool==='eraser'))setTool(st.tool);
  selChanged();markComp();pushHistory(d.sel?'Masque rapide : sélection':'Masque rapide : désélection');syncAll();toast(d.sel?'Sélection mise à jour':'Rien n’est sélectionné')};
const qmSync=()=>{const on=inQuickMask();if(on&&!S.showMask){S.showMask=true;S.qmOn=true}else if(!on&&S.qmOn){S.showMask=false;S.qmOn=false;const st=S.doc&&QMS.get(S.doc);if(st&&st.tool&&st.tool!=='brush'&&(S.tool==='brush'||S.tool==='eraser'))setTool(st.tool)}};
/* Delete / Backspace inside the quick mask: empties it (Shift: fills it) instead of deleting the layer */
window.addEventListener('keydown',e=>{if(e.key!=='Delete'&&e.key!=='Backspace')return;if(e.metaKey||e.ctrlKey||e.altKey||inField(e.target)||modal())return;
  const d=S.doc;if(!d||S.stroke||S.drag||d.sel||!inQuickMask())return;const L=d.layers.find(l=>l.qmask);if(!L)return;e.preventDefault();e.stopImmediatePropagation();
  const m=mk(d.w,d.h);if(e.shiftKey){const g=cx(m);g.fillStyle='#fff';g.fillRect(0,0,d.w,d.h)}L.mask=m;markComp();pushHistory(e.shiftKey?'Masque rapide : tout':'Masque rapide : vider');syncLayers()},true);

/* ---------- Delete / Fill with a mask being edited act on the mask, not on the photo below ---------- */
const _clearSel=clearSel;clearSel=function(){const d=S.doc,mt=d&&d.sel&&maskTarget();if(!mt)return _clearSel.apply(this,arguments);
  const g=editMask(mt);g.globalCompositeOperation='destination-out';g.drawImage(d.sel,0,0);g.globalCompositeOperation='source-over';markComp();pushHistory('Masque : retirer la sélection');syncLayers()};
const _fillSel=fillSel;fillSel=function(){const d=S.doc,mt=d&&maskTarget();if(!mt)return _fillSel.apply(this,arguments);
  const g=editMask(mt);g.globalCompositeOperation='source-over';if(d.sel)g.drawImage(d.sel,0,0);else{g.fillStyle='#fff';g.fillRect(0,0,d.w,d.h)}markComp();pushHistory(d.sel?'Masque : remplir la sélection':'Masque : tout afficher');syncLayers()};

/* ---------- colour range: Escape cancels "pick on the photo"; a click on the photo samples while the dialog is open ---------- */
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.rangePick){e.preventDefault();e.stopImmediatePropagation();S.rangePick=false;S.rangePrev=null;requestRender();toast('Prélèvement annulé')}},true);
function rangeSample(p){const d=S.doc,x=Math.floor(p.x),y=Math.floor(p.y);if(x<0||y<0||x>=d.w||y>=d.h)return;const a=rx(flatSync()).getImageData(x,y,1,1).data,hex='#'+[a[0],a[1],a[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  const k=$('#rgK'),c=$('#rgC');if(!k||!c)return;if(k.value!=='color'){k.value='color';k.dispatchEvent(new Event('change'))}c.value=hex;c.dispatchEvent(new Event('input'))}

/* ---------- pen paths: part of undo/redo, follow crop/rotation/resize, faithful selection → path ---------- */
const cpP=P=>P?JSON.parse(JSON.stringify(P)):null;
const _snap=snap;snap=function(){const s=_snap.apply(this,arguments);try{if(s&&S.doc)s.path=cpP(S.doc.path)}catch(e){}return s};
/* path edits between two history steps get their own small undo stack, interleaved by the history step they belong to */
const PH=new WeakMap(),phOf=d=>{let o=PH.get(d);if(!o){o={u:[],r:[]};PH.set(d,o)}return o};let PSEQ=0;
function pathRecord(d,before){const top=S.history[S.hi];if(!top||d!==S.doc)return;const o=phOf(d);o.u.push({h:top,p:before});if(o.u.length>300)o.u.splice(0,o.u.length-300);o.r.length=0;top.path=cpP(d.path);PSEQ++;updateUndo();scheduleSave()}
function pathTx(d,j){if(!d||d!==S.doc)return;if(JSON.stringify(d.path||null)===j)return;pathRecord(d,JSON.parse(j))}
const canPU=k=>{const d=S.doc;if(!d||S.stroke||S.drag)return null;const o=PH.get(d);if(!o||!o[k].length)return null;return o[k][o[k].length-1].h===S.history[S.hi]?o:null};
const pathAfter=()=>{requestRender();renderPill();updateUndo();scheduleSave()};
const _undo=undo;undo=function(){const o=canPU('u');if(o){const d=S.doc,e=o.u.pop();o.r.push({h:e.h,p:cpP(d.path)});d.path=cpP(e.p);e.h.path=cpP(d.path);pathAfter();toast('Annulé : modification du tracé');return}return _undo.apply(this,arguments)};
const _redo=redo;redo=function(){const o=canPU('r');if(o){const d=S.doc,e=o.r.pop();o.u.push({h:e.h,p:cpP(d.path)});d.path=cpP(e.p);e.h.path=cpP(d.path);pathAfter();toast('Rétabli : modification du tracé');return}return _redo.apply(this,arguments)};
const _uu=updateUndo;updateUndo=function(){_uu.apply(this,arguments);try{if(canPU('u'))$('#bUndo').disabled=false;if(canPU('r'))$('#bRedo').disabled=false}catch(e){}};
$('#bUndo').onclick=()=>undo();$('#bRedo').onclick=()=>redo();
const _ph=pushHistory;pushHistory=function(){const o=S.doc&&PH.get(S.doc);if(o)o.r.length=0;return _ph.apply(this,arguments)};
const ptx=fn=>function(){const d=S.doc,j=d?JSON.stringify(d.path||null):null,seq=PSEQ;const r=fn.apply(this,arguments);if(d&&PSEQ===seq)pathTx(d,j);return r};
let penTx=null;
window.addEventListener('keydown',e=>{if(S.tool!=='pen'||!S.doc||inField(e.target)||!['Backspace','Delete','Escape'].includes(e.key))return;const d=S.doc,j=JSON.stringify(d.path||null),seq=PSEQ;setTimeout(()=>{if(PSEQ===seq)pathTx(d,j)},0)},true);
/* crop, rotation, flips and resizing carry the path along: done once, by 0850's mapPath before the history snapshot */
/* selection → path: traces the LARGEST region (it used to take the topmost speck), at a finer scale, on the true pixel edge */
traceMask=function(m){const s=Math.min(1,1600/Math.max(m.width,m.height)),w=Math.max(2,Math.round(m.width*s)),h=Math.max(2,Math.round(m.height*s)),t=mk(w,h),g=rx(t);g.imageSmoothingQuality='high';g.drawImage(m,0,0,w,h);const a=g.getImageData(0,0,w,h).data,N=w*h;
  const lab=new Int32Array(N),st=[];let cur=0,best=0,bestN=0,bestI=-1;
  for(let i=0;i<N;i++){if(lab[i]||a[i*4+3]<128)continue;cur++;let n=0;lab[i]=cur;st.push(i);
    while(st.length){const k=st.pop();n++;const x=k%w,y=(k/w)|0;for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const q=yy*w+xx;if(!lab[q]&&a[q*4+3]>=128){lab[q]=cur;st.push(q)}}}}
    if(n>bestN){bestN=n;best=cur;bestI=i}}
  if(!best||bestN<3)return null;const on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&lab[y*w+x]===best;
  const D=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]],sx=bestI%w,sy=(bestI/w)|0;let x=sx,y=sy,dir=7,first=-1,guard=N*4;const pts=[];
  while(guard-->0){const k=(dir+6)%8;let nd=-1;for(let j=0;j<8;j++){const q=(k+j)%8;if(on(x+D[q][0],y+D[q][1])){nd=q;break}}if(nd<0){pts.push([x,y]);break}
    if(x===sx&&y===sy){if(first<0)first=nd;else if(nd===first)break}pts.push([x,y]);x+=D[nd][0];y+=D[nd][1];dir=nd}
  if(pts.length<3)return null;
  const simp=(P,eps)=>{if(P.length<3)return P;let i0=0,dm=0;const a0=P[0],b0=P[P.length-1],L=Math.hypot(b0[0]-a0[0],b0[1]-a0[1])||1;for(let i=1;i<P.length-1;i++){const dd=Math.abs((b0[0]-a0[0])*(a0[1]-P[i][1])-(a0[0]-P[i][0])*(b0[1]-a0[1]))/L;if(dd>dm){dm=dd;i0=i}}return dm>eps?[...simp(P.slice(0,i0+1),eps).slice(0,-1),...simp(P.slice(i0),eps)]:[P[0],P[P.length-1]]};
  const half=Math.floor(pts.length/2),sp=[...simp(pts.slice(0,half+1),1.1).slice(0,-1),...simp([...pts.slice(half),pts[0]],1.1).slice(0,-1)];if(sp.length<3)return null;
  /* boundary pixel centres sit half a pixel inside the edge: push the polygon out by 0.5 px (mitred) */
  const n=sp.length;let A=0;for(let i=0;i<n;i++){const p=sp[i],q=sp[(i+1)%n];A+=p[0]*q[1]-q[0]*p[1]}const sg=A>0?1:-1;
  const nrm=(p,q)=>{const ex=q[0]-p[0],ey=q[1]-p[1],l=Math.hypot(ex,ey)||1;return[sg*ey/l,-sg*ex/l]};
  return sp.map((p,i)=>{const n1=nrm(sp[(i-1+n)%n],p),n2=nrm(p,sp[(i+1)%n]);let mx=n1[0]+n2[0],my=n1[1]+n2[1];const ml=Math.hypot(mx,my);let X=p[0],Y=p[1];
    if(ml>1e-6){mx/=ml;my/=ml;const c=Math.max(.5,mx*n1[0]+my*n1[1]),k=.5/c;X+=mx*k;Y+=my*k}X=(X+.5)/s;Y=(Y+.5)/s;return{x:X,y:Y,ix:X,iy:Y,ox:X,oy:Y}})};
penClear=ptx(penClear);selToPath=ptx(selToPath);PILL_ACT.penClear=penClear;

/* ---------- Sélection > Resélectionner, Modifier (dilater, contracter, bordure, lisser, étendre), depuis le calque ---------- */
const LAST=new WeakMap();
const _sc=selChanged;selChanged=function(){const d=S.doc;if(d){const o=LAST.get(d)||{};if(o.cur&&!d.sel&&o.cur!==d.sel)o.prev=o.cur;o.cur=d.sel;LAST.set(d,o)}return _sc.apply(this,arguments)};
function reselect(){const d=S.doc;if(!d)return;const o=LAST.get(d);if(!o||!o.prev){toast('Aucune sélection à récupérer');return}if(inQuickMask()){toast('Quittez d’abord le masque rapide (Q)');return}d.sel=o.prev;selChanged();pushHistory('Resélectionner')}
const selAlpha=()=>{const d=S.doc;return rx(d.sel).getImageData(0,0,d.w,d.h).data};
const fromAlpha=(al,label)=>{const d=S.doc;combineSel(maskFromU8(al,d.w,d.h,true),'new',label)};
/* exact Euclidean distance transform (Felzenszwalb) on a region; feature pixels have distance 0 */
function dt1(f,n,o,v,z){let k=-1;for(let q=0;q<n;q++){if(f[q]>=1e19)continue;const fq=f[q]+q*q;if(k<0){k=0;v[0]=q;z[0]=-Infinity;z[1]=Infinity;continue}
    let s=(fq-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);while(s<=z[k]){k--;s=(fq-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k])}k++;v[k]=q;z[k]=s;z[k+1]=Infinity}
  if(k<0){for(let q=0;q<n;q++)o[q]=1e20;return}k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;const dq=q-v[k];o[q]=dq*dq+f[v[k]]}}
function edt(feat,w,h){const g=new Float32Array(w*h),n=Math.max(w,h),f=new Float64Array(n),o=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1);
  for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=feat[y*w+x]?0:1e20;dt1(f,h,o,v,z);for(let y=0;y<h;y++)g[y*w+x]=o[y]}
  for(let y=0;y<h;y++){const r=y*w;for(let x=0;x<w;x++)f[x]=g[r+x];dt1(f,w,o,v,z);for(let x=0;x<w;x++)g[r+x]=o[x]}return g}
/* kind: 'grow' | 'shrink' | 'border'; edges lying on the canvas border are left alone (like Photoshop's default) */
function morph(kind,r){const d=S.doc,W=d.w,H=d.h,a=selAlpha(),N=W*H,B=new Uint8Array(N);let x0=W,y0=H,x1=-1,y1=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(a[i*4+3]>=128){B[i]=1;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  const out=new Uint8Array(N);if(kind==='grow')for(let i=0;i<N;i++)out[i]=a[i*4+3];if(x1<0)return out;
  const m=Math.ceil(r)+2,X0=Math.max(0,x0-m),Y0=Math.max(0,y0-m),X1=Math.min(W,x1+1+m),Y1=Math.min(H,y1+1+m),rw=X1-X0,rh=Y1-Y0,fi=new Uint8Array(rw*rh),fo=new Uint8Array(rw*rh);
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const b=B[(y+Y0)*W+x+X0];fi[y*rw+x]=b;fo[y*rw+x]=1-b}
  const din=kind!=='shrink'?edt(fi,rw,rh):null,dout=kind!=='grow'?edt(fo,rw,rh):null,c01=v=>v<=0?0:v>=1?255:Math.round(v*255);
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const k=y*rw+x,i=(y+Y0)*W+x+X0;
    if(kind==='grow'){const v=c01(r+1-Math.sqrt(din[k]));if(v>out[i])out[i]=v}
    else if(kind==='shrink'){out[i]=B[i]?Math.min(a[i*4+3],c01(Math.sqrt(dout[k])-r)):0}
    else{const h=r/2;out[i]=B[i]?c01(h+1-Math.sqrt(dout[k])):c01(h+1-Math.sqrt(din[k]))}}
  return out}
function smoothSel(r){const d=S.doc,sg=Math.max(.5,r/2),bl=blurCanvas(d.sel,sg),a=rx(bl).getImageData(0,0,d.w,d.h).data,N=d.w*d.h,out=new Uint8Array(N),k=Math.max(1,sg*2.5);
  for(let i=0;i<N;i++){const v=(a[i*4+3]-127.5)*k+127.5;out[i]=v<=0?0:v>=255?255:Math.round(v)}return out}
/* grow: adds neighbouring pixels whose colour is within the magic wand tolerance of the selected pixel they spread from */
function growSel(){const d=S.doc,o=S.opts.wand,T=pixelTarget();const src=o.all||!T?flatSync():T.canvas,c=rx(cloneC(src)).getImageData(0,0,d.w,d.h).data,a=selAlpha(),W=d.w,H=d.h,N=W*H,tol=o.tol;
  const seed=new Int32Array(N).fill(-1),stack=[];
  for(let i=0;i<N;i++)if(a[i*4+3]>=128){seed[i]=i;const x=i%W;if((x>0&&a[(i-1)*4+3]<128)||(x<W-1&&a[(i+1)*4+3]<128)||(i>=W&&a[(i-W)*4+3]<128)||(i<N-W&&a[(i+W)*4+3]<128))stack.push(i)}
  const out=new Uint8Array(N);for(let i=0;i<N;i++)out[i]=a[i*4+3];
  while(stack.length){const i=stack.pop(),s=seed[i]*4,x=i%W;for(const q of[x>0?i-1:-1,x<W-1?i+1:-1,i-W,i+W]){if(q<0||q>=N||seed[q]>=0)continue;const j=q*4;
      if(Math.abs(c[j]-c[s])<=tol&&Math.abs(c[j+1]-c[s+1])<=tol&&Math.abs(c[j+2]-c[s+2])<=tol&&Math.abs(c[j+3]-c[s+3])<=tol){seed[q]=seed[i];out[q]=255;stack.push(q)}}}
  return out}
const MOD_V={grow:4,shrink:4,border:10,smooth:4};
async function selOp(fn,label){const d=S.doc;if(!d||!d.sel){toast(NOSEL);return}busy(true,label+'…',null);await tick();try{if(S.doc!==d||!d.sel)return;const al=fn();fromAlpha(al,label)}catch(e){console.error(e);toast(label+' impossible : '+(e.message||e),5000)}finally{busy(false)}}
function modDialog(kind){const d=S.doc;if(!d||!d.sel){toast(NOSEL);return}
  const cfg={grow:['Dilater la sélection','Distance',1,500],shrink:['Contracter la sélection','Distance',1,500],border:['Bordure de la sélection','Largeur',1,400],smooth:['Lisser la sélection','Rayon',1,100]}[kind];
  dialog({title:cfg[0],body:rangeRow('mdV',cfg[1],cfg[2],cfg[3],1,MOD_V[kind],' px'),onOpen:el=>{const i=$('#mdV',el);i.oninput=()=>$('#mdV-o',el).textContent=i.value+' px'},
    buttons:[{label:'Annuler'},{label:'Appliquer',primary:true,onClick:el=>{const v=+$('#mdV',el).value;MOD_V[kind]=v;selOp(kind==='smooth'?()=>smoothSel(v):()=>morph(kind,v),cfg[0])}}]})}
function selFromLayer(){const d=S.doc,L=AL();if(!d||!L)return;let m;
  if(L.mask){m=cloneC(L.mask)}else if(L.kind==='pixel'&&L.canvas){m=mk(d.w,d.h);const g=cx(m);g.drawImage(L.canvas,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#fff';g.fillRect(0,0,d.w,d.h)}
  else{toast('Ce réglage n’a pas de masque');return}if(inQuickMask()){toast('Quittez d’abord le masque rapide (Q)');return}
  combineSel(m,S.opts.selMode,L.mask?'Sélection depuis le masque':'Sélection depuis le calque')}
const _msi=MENU2.select.items;MENU2.select.items=()=>{const a=_msi(),d=S.doc,L=d&&AL(),at=re=>a.findIndex(x=>x&&x.label&&re.test(x.label)),ins=(i,...it)=>a.splice(i<0?a.length:i,0,...it);
  const lo=d&&LAST.get(d),noDoc=docDis();
  ins(at(/^Désélectionner/)+1||a.length,MI('Resélectionner',{kbd:MOD+'⇧D',fn:reselect,dis:noDoc||(lo&&lo.prev?false:'Aucune sélection récente')}));
  const sd=selDis();
  ins(at(/^Contour progressif/)+1||a.length,MI('Modifier',{icon:'sel',dis:sd,sub:()=>[MI('Dilater…',{fn:()=>modDialog('grow')}),MI('Contracter…',{fn:()=>modDialog('shrink')}),MI('Bordure…',{fn:()=>modDialog('border')}),MI('Lisser…',{fn:()=>modDialog('smooth')}),SEP,MI('Étendre',{fn:()=>selOp(growSel,'Étendre la sélection')})]}));
  ins(at(/^Convertir la sélection en tracé/),MI(L&&L.mask?'Sélection depuis le masque':'Sélection depuis le calque',{fn:selFromLayer,dis:noDoc||(L&&L.kind==='adjust'&&!L.mask?'Ce réglage n’a pas de masque':false)}));
  return a};
window.addEventListener('keydown',e=>{const mod=(e.metaKey||e.ctrlKey)&&!(e.getModifierState&&e.getModifierState('AltGraph'));if(!mod||!e.shiftKey||e.altKey||e.code!=='KeyD'||!S.doc||inField(e.target)||modal()||busyOn())return;e.preventDefault();e.stopImmediatePropagation();reselect()},true);

/* ---------- the active selection is saved with the project and comes back after a reload ---------- */
const realDoc=d=>!!d&&(d===S.doc||!!(window.PrismTabs&&PrismTabs.tabs&&PrismTabs.tabs.some(t=>t&&t.doc===d)));
const _bm=buildManifest;buildManifest=async function(d){const D=d||S.doc,m=await _bm.apply(this,arguments);try{if(m&&D&&D.sel&&realDoc(D)&&!D.layers.some(l=>l.qmask))m.sel=await encodeCanvas(D.sel)}catch(e){console.warn('sélection',e)}return m};
const _mk=manifestKeys;manifestKeys=function(m){const k=_mk.apply(this,arguments);try{if(m&&Array.isArray(m.sel))m.sel.forEach(t=>t&&t.key&&k.add(t.key))}catch(e){}return k};
const _lm=loadManifest;loadManifest=async function(m,getBlob){const r=await _lm.apply(this,arguments);
  try{const d=S.doc;if(m&&Array.isArray(m.sel)&&m.sel.length&&d&&d.pid===m.id&&!d.sel&&d.w===m.w&&d.h===m.h){const c=await decodeTiles(m.sel,m.w,m.h,getBlob);encCache.set(c,m.sel);
      if(S.doc===d&&!d.sel){d.sel=c;const top=S.history[S.hi];if(top&&!top.sel&&S.history.length===1)top.sel=c;selChanged()}}}catch(e){console.warn('sélection',e)}return r};

/* ---------- options bar of the selection tools: hints go last so the controls stay visible on 1280 px screens ---------- */
const _rp=renderPill;renderPill=function(){const r=_rp.apply(this,arguments);try{if(SELT.includes(S.tool)||S.tool==='pen'){const ob=$('#pill');ob.querySelectorAll(':scope > .hint').forEach(x=>{x.title=x.textContent;ob.appendChild(x)})}}catch(e){}return r};

/* ---------- event routing ---------- */
/* drag inside the selection with the marquee or the free lasso (mode Nouvelle) moves the selection outline */
const canMoveSel=e=>{const d=S.doc;return!!(d&&d.sel&&(S.tool==='marquee'||(S.tool==='lasso'&&S.opts.lasso.mode==='free'))&&S.opts.selMode==='new'&&!e.shiftKey&&!e.altKey&&!e.metaKey&&!e.ctrlKey&&!S.spaceDown&&!S.rangePick&&!S.wbPick&&!inQuickMask())};
const shiftSel=(dx,dy)=>{const d=S.doc,c=mk(d.w,d.h);cx(c).drawImage(d.sel,dx,dy);d.sel=maskBBox(c)?c:null;selChanged()};
let NUDGE=null;
window.addEventListener('keydown',e=>{const k=e.key;if(!/^Arrow(Left|Right|Up|Down)$/.test(k)||e.metaKey||e.ctrlKey||e.altKey)return;const d=S.doc;if(!d||!d.sel||!SELT.includes(S.tool)||S.drag||S.stroke||S.poly||modal()||busyOn())return;
  const ae=document.activeElement;if(ae&&ae!==document.body&&ae!==view)return;e.preventDefault();e.stopImmediatePropagation();
  const s=e.shiftKey?10:1,dx=k==='ArrowLeft'?-s:k==='ArrowRight'?s:0,dy=k==='ArrowUp'?-s:k==='ArrowDown'?s:0;shiftSel(dx,dy);
  const top=S.history[S.hi];if(d.sel&&NUDGE&&NUDGE.h===top&&NUDGE.d===d&&Date.now()-NUDGE.t<1500){top.sel=d.sel;NUDGE.t=Date.now();scheduleSave()}else{pushHistory(d.sel?'Déplacer la sélection':'Désélection');NUDGE={h:S.history[S.hi],d,t:Date.now()}}});
view.addEventListener('pointermove',e=>{if(S.drag||S.spaceDown||!S.doc)return;if(S.tool!=='marquee'&&S.tool!=='lasso')return;const p=S.pointer;if(!p)return;const mv=canMoveSel(e)&&selInside(p.dx,p.dy),c=mv?'move':'crosshair';if(view.style.cursor!==c)view.style.cursor=c});
const _od=onDown;onDown=function(e,p){
  if(S.doc&&e.button===0&&!S.spaceDown&&!S.rangePick&&$('#rgK')&&$('#rgC')){rangeSample(p);return}
  if(S.tool==='pen'&&S.doc&&e.button!==1&&!S.spaceDown)penTx={d:S.doc,j:JSON.stringify(S.doc.path||null)};
  if(e.button===0&&canMoveSel(e)&&selInside(p.x,p.y)){S.drag={type:'selmove',sx:p.x,sy:p.y,dx:0,dy:0,moved:false};S.selOff={x:0,y:0};return}
  return _od.apply(this,arguments)};
const _om=onMove;onMove=function(e,p){const dr=S.drag;
  if(dr&&dr.type==='selmove'){let dx=Math.round(p.x-dr.sx),dy=Math.round(p.y-dr.sy);if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0}if(Math.hypot(dx,dy)*S.zoom>2)dr.moved=true;if(dr.moved){dr.dx=dx;dr.dy=dy;S.selOff={x:dx,y:dy};requestRender()}return}
  if(dr&&dr.type==='marquee'){/* pixel-snapped; Shift after the press: square/circle; Alt after the press: from the centre; Space: move the frame */
    const px=Math.round(p.x),py=Math.round(p.y);if(dr.ax==null){dr.ax=Math.round(dr.x0);dr.ay=Math.round(dr.y0);dr.sh0=!!e.shiftKey;dr.al0=!!e.altKey;dr.lp={x:px,y:py}}
    if(S.spaceDown){dr.ax+=px-dr.lp.x;dr.ay+=py-dr.lp.y}dr.lp={x:px,y:py};if(!e.shiftKey)dr.shUp=true;if(!e.altKey)dr.alUp=true;
    const sq=e.shiftKey&&(!dr.sh0||dr.shUp),ctr=e.altKey&&(!dr.al0||dr.alUp),rt=S.opts.marquee.ratio;let vx=px-dr.ax,vy=py-dr.ay;
    if(rt&&rt!=='free'){const[rw,rh]=rt.split(':').map(Number);if(rw>0&&rh>0){const s=Math.max(Math.abs(vx)/rw,Math.abs(vy)/rh);vx=Math.sign(vx||1)*s*rw;vy=Math.sign(vy||1)*s*rh}}
    else if(sq){const s=Math.max(Math.abs(vx),Math.abs(vy));vx=Math.sign(vx||1)*s;vy=Math.sign(vy||1)*s}
    if(ctr){dr.x0=Math.round(dr.ax-vx);dr.y0=Math.round(dr.ay-vy)}else{dr.x0=dr.ax;dr.y0=dr.ay}dr.x1=Math.round(dr.ax+vx);dr.y1=Math.round(dr.ay+vy);return}
  return _om.apply(this,arguments)};
const _ou=onUp;onUp=function(){const dr=S.drag;
  if(dr&&dr.type==='selmove'){S.drag=null;S.selOff=null;const d=S.doc;if(dr.moved&&(dr.dx||dr.dy)&&d&&d.sel){shiftSel(dr.dx,dr.dy);pushHistory(d.sel?'Déplacer la sélection':'Désélection')}else if(!dr.moved)deselect();requestRender();return}
  const t=penTx;penTx=null;const r=_ou.apply(this,arguments);if(t)pathTx(t.d,t.j);return r};
const _cd=cancelDrag;cancelDrag=function(){S.selOff=null;const t=penTx;penTx=null;const r=_cd.apply(this,arguments);if(t)pathTx(t.d,t.j);requestRender();return r};
const _rs=restore;restore=function(i){const s=S.history[i];const r=_rs.apply(this,arguments);try{if(s&&'path' in s&&S.doc&&S.history[S.hi]===s){S.doc.path=cpP(s.path);renderPill();requestRender()}qmSync()}catch(e){}return r};
/* gradient on a pixel layer stays inside the active selection (masks keep their own gradient behaviour) */
const _gcv=gradientCanvas;gradientCanvas=function(dr,color){const m=_gcv.apply(this,arguments);try{const d=S.doc;if(color!==undefined&&d&&d.sel&&m&&!m.__sel){const g=cx(m);g.globalCompositeOperation='destination-in';g.drawImage(d.sel,0,0);g.globalCompositeOperation='source-over';m.__sel=1}}catch(e){}return m};
window.PrismSel={antsPyr,selInside,AP,AN};window.PrismSelT={morph,smoothSel,growSel,traceMask};
})();

