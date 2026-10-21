/* ================= v19: paint bucket, live magic wand, colour range, polygonal and magnetic lasso ================= */
(()=>{
const OB=S.opts;OB.bucket=Object.assign({tol:28,contiguous:true,all:false,opacity:1,soft:true},PREF.get('bucketOpts',{}));if(!OB.lasso.mode)OB.lasso.mode='free';
const U8=(a,W,H,px,py,tol,contig)=>{const j0=(py*W+px)*4,r0=a[j0],g0=a[j0+1],b0=a[j0+2],a0=a[j0+3];const ok=i=>{const j=i*4;return Math.abs(a[j]-r0)<=tol&&Math.abs(a[j+1]-g0)<=tol&&Math.abs(a[j+2]-b0)<=tol&&Math.abs(a[j+3]-a0)<=tol};
 const m=new Uint8Array(W*H);if(contig){const st=[py*W+px];while(st.length){let i=st.pop();if(m[i])continue;const y=(i/W)|0;let x=i-y*W;while(x>0&&!m[i-1]&&ok(i-1)){x--;i--}let up=false,dn=false;while(x<W&&!m[i]&&ok(i)){m[i]=1;if(y>0){const u=i-W;if(!m[u]&&ok(u)){if(!up){st.push(u);up=true}}else up=false}if(y<H-1){const v=i+W;if(!m[v]&&ok(v)){if(!dn){st.push(v);dn=true}}else dn=false}x++;i++}}}else for(let i=0;i<W*H;i++)if(ok(i))m[i]=1;return m};
const pixelsOf=(src)=>rx(cloneC(src)).getImageData(0,0,src.width,src.height).data;
// ---------- paint bucket ----------
function bucketAt(p){const d=S.doc,o=OB.bucket,A=AL(),L=pixelTarget();const x=Math.floor(p.x),y=Math.floor(p.y);if(x<0||y<0||x>=d.w||y>=d.h)return;
 if(!A||(A.kind!=='pixel'&&(A.kind!=='adjust'||A.mask))||A.editMask||!L){toast('Sélectionnez un calque de pixels pour le remplir.');return}if(L.visible===false){toast('Ce calque est masqué');return}
 const src=o.all?flatSync():L.canvas,a=pixelsOf(src),m=U8(a,d.w,d.h,x,y,o.tol,o.contiguous);let n=0;for(let i=0;i<m.length;i+=7)n+=m[i];if(!n&&!m[y*d.w+x]){toast('Rien à remplir ici.');return}
 let mask=maskFromU8(m,d.w,d.h);if(o.soft){const g=cx(mask),t=cloneC(mask);for(const[ox,oy]of[[1,0],[-1,0],[0,1],[0,-1]])g.drawImage(t,ox,oy);mask=blurCanvas(mask,.6)}
 const tmp=mk(d.w,d.h),tg=cx(tmp);tg.fillStyle=S.color;tg.fillRect(0,0,d.w,d.h);tg.globalCompositeOperation='destination-in';tg.drawImage(mask,0,0);if(d.sel){tg.drawImage(d.sel,0,0)}
 const H=hiTake(L),g=editCanvas(L);g.globalAlpha=o.opacity;g.drawImage(tmp,0,0);if(H)hiComp(L,{x0:0,y0:0,x1:d.w,y1:d.h},hiSrc(tmp,hexRGB(S.color)),o.opacity);markComp();pushHistory('Pot de peinture');syncLayers()}
addTool('bucket','Pot de peinture','K',IC.bucket,'gradient','remplit par tolérance');
// ---------- live wand: drag left/right after the click to change the tolerance ----------
function wandData(){const d=S.doc,o=OB.wand,T=pixelTarget();if(!o.all&&!T)return null;const key=S.docVer+'|'+(o.all?'all':T.id);if(wandCache.key!==key){const src=o.all?flatSync():T.canvas;wandCache={key,data:rx(cloneC(src)).getImageData(0,0,d.w,d.h).data}}return wandCache.data}
function overlayMask(c,pr,mask,col){if(!mask)return;const W=view.width,H=view.height,t=scr('mt2',W,H),g=cx(t);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.setTransform(...viewMatrix(0,0));g.drawImage(mask,0,0);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-in';g.fillStyle=col||'rgba(235,70,60,.45)';g.fillRect(0,0,W,H);c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(t,0,0);c.restore()}
// ---------- colour range ----------
const RNG={kind:'color',color:'#ff0000',tol:30,fuzz:40,inv:false};
function rangeAlpha(a,n,k){const out=new Uint8Array(n);const c=parseInt(RNG.color.slice(1),16),cr=c>>16&255,cg=c>>8&255,cb=c&255,t=RNG.tol*2.2,fz=Math.max(1,RNG.fuzz*2.2);
 for(let i=0;i<n;i++){const j=i*4;let v;if(RNG.kind==='color'){const dr=a[j]-cr,dg=a[j+1]-cg,db=a[j+2]-cb,dd=Math.sqrt((2*dr*dr+4*dg*dg+3*db*db)/9);v=dd<=t?1:dd>=t+fz?0:1-(dd-t)/fz}
  else{const l=.2126*a[j]+.7152*a[j+1]+.0722*a[j+2],T=RNG.tol*2.55;if(RNG.kind==='shadows')v=l<=T?1:l>=T+fz?0:1-(l-T)/fz;else if(RNG.kind==='high')v=l>=255-T?1:l<=255-T-fz?0:1-((255-T)-l)/fz;else{const dd=Math.abs(l-128);v=dd<=T/2?1:dd>=T/2+fz?0:1-(dd-T/2)/fz}}
  if(RNG.inv)v=1-v;out[i]=Math.round(v*255)*(a[j+3]>8?1:0)}return out}
function rangeMask(full){const d=S.doc,f=flatSync();let W=d.w,H=d.h,c=f;if(!full){const sc=Math.min(1,700/Math.max(d.w,d.h));W=Math.max(1,Math.round(d.w*sc));H=Math.max(1,Math.round(d.h*sc));c=mk(W,H);cx(c).drawImage(f,0,0,W,H)}
 const a=rx(c).getImageData(0,0,W,H).data,al=rangeAlpha(a,W*H);const m=maskFromU8(al,W,H,true);if(full)return m;const up=mk(d.w,d.h);cx(up).drawImage(m,0,0,d.w,d.h);return up}
function rangeDialog(){const d=S.doc;if(!d){toast('Ouvrez une photo d’abord.');return}
 const upd=el=>{S.rangePrev=rangeMask(false);requestRender()};
 dialog({title:'Plage de couleurs',light:true,body:`<label class="field">Sélectionner<select id="rgK"><option value="color">Une couleur</option><option value="high">Les hautes lumières</option><option value="mid">Les tons moyens</option><option value="shadows">Les ombres</option></select></label>
 <div id="rgCol" class="row" style="display:flex;gap:8px;align-items:center"><input type="color" id="rgC" value="${esc(RNG.color)}" style="width:44px;height:28px"><button class="btn sm" id="rgPick">Prélever sur la photo</button></div>
 ${rangeRow('rgT','Étendue',0,100,1,RNG.tol,' %')}${rangeRow('rgF','Flou des bords',0,100,1,RNG.fuzz,' %')}
 <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="rgI" ${RNG.inv?'checked':''}>Inverser</label><div class="muted" style="font-size:12px">Cliquez sur la photo pour prélever la couleur. La zone choisie apparaît en rouge ; « Appliquer » en fait une sélection.</div>`,
 onOpen:el=>{const K=$('#rgK',el);K.value=RNG.kind;const vis=()=>{$('#rgCol',el).style.display=K.value==='color'?'flex':'none'};vis();
  K.onchange=()=>{RNG.kind=K.value;vis();upd()};$('#rgC',el).oninput=e=>{RNG.color=e.target.value;upd()};
  const sl=(id,k)=>{const r=$('#'+id,el);r.oninput=()=>{RNG[k]=+r.value;$('#'+id+'-o',el).textContent=r.value+' %';upd()}};sl('rgT','tol');sl('rgF','fuzz');
  $('#rgI',el).onchange=e=>{RNG.inv=e.target.checked;upd()};
  $('#rgPick',el).onclick=()=>{S.rangePick=true;closeDialog();toast('Cliquez sur la couleur à sélectionner dans la photo.')};upd()},
 buttons:[{label:'Annuler',onClick:()=>{S.rangePrev=null;requestRender()}},{label:'Appliquer',primary:true,onClick:()=>{const m=rangeMask(true);S.rangePrev=null;combineSel(m,OB.selMode==='new'?'new':OB.selMode,'Plage de couleurs')}}]})}
const _mis=MENU2.select.items;MENU2.select.items=()=>{const a=_mis();const i=a.findIndex(x=>x&&x.label&&/Détourer le sujet/.test(x.label));a.splice(i<0?a.length:i+1,0,MI('Plage de couleurs…',{icon:'wand',fn:rangeDialog,dis:docDis()}));return a};
// ---------- lasso: polygonal and magnetic ----------
let EDGE=null;
function edgeMap(){const d=S.doc,key=S.docVer+'|'+d.w+'|'+d.h;if(EDGE&&EDGE.key===key)return EDGE;const sc=Math.min(1,1200/Math.max(d.w,d.h)),W=Math.max(8,Math.round(d.w*sc)),H=Math.max(8,Math.round(d.h*sc)),c=mk(W,H);cx(c).drawImage(flatSync(),0,0,W,H);
 const a=rx(c).getImageData(0,0,W,H).data,Y=new Float32Array(W*H);for(let i=0;i<W*H;i++)Y[i]=.2126*a[i*4]+.7152*a[i*4+1]+.0722*a[i*4+2];
 const G=new Float32Array(W*H);let mx=0;const hist=new Uint32Array(256);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,gx=Y[i-W+1]+2*Y[i+1]+Y[i+W+1]-Y[i-W-1]-2*Y[i-1]-Y[i+W-1],gy=Y[i+W-1]+2*Y[i+W]+Y[i+W+1]-Y[i-W-1]-2*Y[i-W]-Y[i-W+1],g=Math.hypot(gx,gy);G[i]=g;if(g>mx)mx=g}
 for(let i=0;i<W*H;i++)hist[Math.min(255,(G[i]/(mx||1)*255)|0)]++;let acc=0,p98=mx;for(let k=0;k<256;k++){acc+=hist[k];if(acc>=W*H*.97){p98=Math.max(1,k/255*mx);break}}
 const cost=new Float32Array(W*H);for(let i=0;i<W*H;i++){const gn=Math.min(1,G[i]/p98);cost[i]=1/(.03+gn)}EDGE={key,sc,W,H,cost};return EDGE}
function livewire(ax,ay,bx,by){const E=edgeMap(),W=E.W,H=E.H,sc=E.sc,cost=E.cost;let x0=Math.round(ax*sc),y0=Math.round(ay*sc),x1=Math.round(bx*sc),y1=Math.round(by*sc);
 x0=clamp(x0,0,W-1);y0=clamp(y0,0,H-1);x1=clamp(x1,0,W-1);y1=clamp(y1,0,H-1);const mg=Math.max(24,Math.round(Math.hypot(x1-x0,y1-y0)*.6)),bx0=Math.max(0,Math.min(x0,x1)-mg),by0=Math.max(0,Math.min(y0,y1)-mg),bx1=Math.min(W-1,Math.max(x0,x1)+mg),by1=Math.min(H-1,Math.max(y0,y1)+mg),bw=bx1-bx0+1,bh=by1-by0+1;
 const dist=new Float32Array(bw*bh).fill(1e30),prev=new Int32Array(bw*bh).fill(-1),done=new Uint8Array(bw*bh);const heap=[],push=(k,v)=>{heap.push([v,k]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}},pop=()=>{const t=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let i=0;for(;;){let a=i*2+1,b=a+1,m=i;if(a<heap.length&&heap[a][0]<heap[m][0])m=a;if(b<heap.length&&heap[b][0]<heap[m][0])m=b;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return t};
 const s=(y0-by0)*bw+(x0-bx0),t=(y1-by0)*bw+(x1-bx0);dist[s]=0;push(s,0);let guard=0;
 while(heap.length&&guard++<400000){const[dv,k]=pop();if(done[k])continue;done[k]=1;if(k===t)break;const x=k%bw,y=(k/bw)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=bw||ny>=bh)continue;const nk=ny*bw+nx;if(done[nk])continue;const c=cost[(ny+by0)*W+nx+bx0]*(dx&&dy?1.414:1),nd=dv+c;if(nd<dist[nk]){dist[nk]=nd;prev[nk]=k;push(nk,nd)}}}
 const pts=[];let k=t;if(prev[t]<0&&s!==t)return[{x:bx,y:by}];while(k>=0){const x=k%bw,y=(k/bw)|0;pts.push({x:(x+bx0)/sc,y:(y+by0)/sc});if(k===s)break;k=prev[k]}pts.reverse();pts.push({x:bx,y:by});return pts}
const PL={pts:[],anchor:null,live:null,t:0,lx:0,ly:0};S.poly=null;
const polyReset=()=>{S.poly=null;PL.pts=[];PL.live=null;requestRender()};
function polyCommit(mode){const d=S.doc,pts=PL.pts.slice();if(pts.length<3){polyReset();return}const m=mk(d.w,d.h),g=cx(m);g.fillStyle='#fff';g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();const md=PL.mode||OB.selMode;polyReset();combineSel(featherMask(m,OB.lasso.feather),md,'Lasso')}
function polyAdd(p,e){const o=OB.lasso,now=performance.now();const first=PL.pts[0];
 if(!S.poly){S.poly=true;PL.pts=[{x:p.x,y:p.y}];PL.anchor={x:p.x,y:p.y};PL.live=null;PL.mode=modeFrom(e);PL.t=now;PL.lx=p.cx;PL.ly=p.cy;requestRender();return}
 const dbl=now-PL.t<350&&Math.hypot(p.cx-PL.lx,p.cy-PL.ly)<5;PL.t=now;PL.lx=p.cx;PL.ly=p.cy;
 const nearFirst=first&&PL.pts.length>=3&&Math.hypot((p.x-first.x)*S.zoom,(p.y-first.y)*S.zoom)<9;
 if(dbl||nearFirst){polyCommit();return}
 if(o.mode==='magnetic'&&PL.live&&PL.live.length>1){PL.pts.push(...PL.live.slice(1))}else PL.pts.push({x:p.x,y:p.y});PL.anchor={x:p.x,y:p.y};PL.live=null;requestRender()}
let wireBusy=false;view.addEventListener('pointermove',()=>{if(!S.poly||OB.lasso.mode!=='magnetic'||S.tool!=='lasso'||wireBusy)return;const p=S.pointer;if(!p)return;wireBusy=true;setTimeout(()=>{wireBusy=false;if(!S.poly||!PL.anchor||!S.pointer)return;try{PL.live=livewire(PL.anchor.x,PL.anchor.y,S.pointer.dx,S.pointer.dy);requestRender()}catch(e){PL.live=null}},40)});
window.addEventListener('keydown',e=>{if(!S.poly)return;if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();polyCommit()}else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();polyReset()}else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();e.stopImmediatePropagation();if(PL.pts.length>1){PL.pts.pop();PL.anchor=PL.pts[PL.pts.length-1];PL.live=null;requestRender()}else polyReset()}},true);
const _st=setTool;setTool=function(t){if(S.poly&&t!=='lasso')polyReset();return _st.apply(this,arguments)};
// ---------- event routing ----------
const _od=onDown;onDown=function(e,p){
 if(S.rangePick&&e.button!==1){S.rangePick=false;const f=flatSync(),x=Math.floor(p.x),y=Math.floor(p.y);if(x>=0&&y>=0&&x<S.doc.w&&y<S.doc.h){const a=rx(f).getImageData(x,y,1,1).data;RNG.color='#'+[a[0],a[1],a[2]].map(v=>v.toString(16).padStart(2,'0')).join('')}rangeDialog();return}
 if(e.button!==1&&!S.spaceDown&&!S.wbPick){
  if(S.tool==='bucket'){bucketAt(p);return}
  if(S.tool==='lasso'&&OB.lasso.mode!=='free'){polyAdd(p,e);return}
  if(S.tool==='wand'){const d=S.doc,px=Math.floor(p.x),py=Math.floor(p.y);if(px<0||py<0||px>=d.w||py>=d.h)return;const a=wandData();if(!a)return;const o=OB.wand;S.drag={type:'wandlive',px,py,sx:p.cx,tol0:o.tol,tol:o.tol,mode:modeFrom(e),moved:false,prev:null,a};return}}
 _od(e,p)};
const _om=onMove;onMove=function(e,p){const dr=S.drag;if(dr&&dr.type==='wandlive'){const dx=p.cx-dr.sx;if(Math.abs(dx)>4)dr.moved=true;if(dr.moved){const t=clamp(Math.round(dr.tol0+dx/2.5),0,128);if(t!==dr.tol||!dr.prev){dr.tol=t;const d=S.doc;dr.prev=maskFromU8(U8(dr.a,d.w,d.h,dr.px,dr.py,t,OB.wand.contiguous),d.w,d.h);dr.cur=p}requestRender()}return}_om(e,p)};
const _ou=onUp;onUp=function(e){const dr=S.drag;if(dr&&dr.type==='wandlive'){S.drag=null;const d=S.doc,o=OB.wand;const tol=dr.moved?dr.tol:o.tol;const m=dr.moved&&dr.prev?dr.prev:maskFromU8(U8(dr.a,d.w,d.h,dr.px,dr.py,tol,o.contiguous),d.w,d.h);if(dr.moved){o.tol=tol;renderPill()}combineSel(m,dr.mode,'Baguette magique');return}_ou(e)};
const _dov=drawOverlays;drawOverlays=function(c,pr){_dov.apply(this,arguments);try{const dr=S.drag;
 if(dr&&dr.type==='wandlive'&&dr.moved&&dr.prev){overlayMask(c,pr,dr.prev);const p=S.pointer;if(p){c.save();c.setTransform(pr,0,0,pr,0,0);c.font='600 12px '+getComputedStyle(document.body).fontFamily;const t='Tolérance '+dr.tol;const w=c.measureText(t).width+14;c.fillStyle='rgba(0,0,0,.72)';c.fillRect(p.cx+14,p.cy+14,w,22);c.fillStyle='#fff';c.fillText(t,p.cx+21,p.cy+29);c.restore()}}
 if(S.rangePrev)overlayMask(c,pr,S.rangePrev);
 if(S.poly&&PL.pts.length){c.save();c.setTransform(pr,0,0,pr,0,0);const P=(x,y)=>[S.panX+x*S.zoom,S.panY+y*S.zoom];c.beginPath();PL.pts.forEach((q,i)=>{const[x,y]=P(q.x,q.y);i?c.lineTo(x,y):c.moveTo(x,y)});
  const pt=S.pointer;const live=OB.lasso.mode==='magnetic'&&PL.live?PL.live:(pt&&pt.inside?[PL.pts[PL.pts.length-1],{x:pt.dx,y:pt.dy}]:[]);live.forEach(q=>{const[x,y]=P(q.x,q.y);c.lineTo(x,y)});dash(c);
  const[sx,sy]=P(PL.pts[0].x,PL.pts[0].y);c.beginPath();c.arc(sx,sy,5,0,7);c.fillStyle='#fff';c.fill();c.strokeStyle='#000';c.lineWidth=1;c.stroke();c.restore()}}catch(err){}};
// ---------- pills ----------
const _pe=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe.apply(this,arguments)||'';
 if(t==='lasso')h=seg('lasso.mode',[['free','Libre'],['poly','Polygonal'],['magnetic','Magnétique']])+h+(o.lasso.mode!=='free'?`<span class="hint">Cliquez pour poser les points. Double-clic ou Entrée pour fermer, Retour arrière pour annuler le dernier point.</span>`:'');
 if(t==='wand')h+=`<span class="hint">Après le clic, glissez à gauche ou à droite pour régler la tolérance en direct.</span><button class="btn sm" data-act="range">Plage de couleurs…</button>`;
 if(t==='bucket')h=optRange('bucket.tol','Tolérance',0,128,1,'')+`<label><input type="checkbox" data-chk="bucket.contiguous" ${o.bucket.contiguous?'checked':''}>Contigus</label><label><input type="checkbox" data-chk="bucket.all" ${o.bucket.all?'checked':''}>Tous les calques</label>`+optRange('bucket.opacity','Opacité',1,100,1,' %',100)+`<input type="color" class="swatch" id="optColor" value="${esc(S.color)}" aria-label="Couleur de remplissage">`+h;
 return h};
PILL_ACT.range=rangeDialog;
document.addEventListener('change',e=>{const k=e.target&&e.target.dataset&&e.target.dataset.chk;if(k&&k.startsWith('bucket.'))PREF.set('bucketOpts',OB.bucket)});
document.addEventListener('input',e=>{if(e.target&&e.target.dataset&&/^bucket\./.test(e.target.dataset.opt||''))PREF.set('bucketOpts',OB.bucket)});
window.rangeDialog=rangeDialog;
})();

