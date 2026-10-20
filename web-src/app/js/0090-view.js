/* ================= view ================= */
let rq=false;function requestRender(){if(!rq){rq=true;requestAnimationFrame(render)}}
function resizeView(){const r=stage.getBoundingClientRect(),pr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*pr)),h=Math.max(1,Math.round(r.height*pr));if(view.width!==w||view.height!==h){view.width=w;view.height=h;S.contentDirty=true}S.pr=pr;S.vw=r.width;S.vh=r.height}
function cropAngle(){return S.tool==='crop'&&S.crop?S.crop.angle:0}
function viewMatrix(dx,dy){const d=S.doc,sc=S.zoom*S.pr;let m=new DOMMatrix().translate(S.panX*S.pr-dx,S.panY*S.pr-dy).scale(sc);const a=cropAngle();if(a)m=m.translate(d.w/2,d.h/2).rotate(a).translate(-d.w/2,-d.h/2);return[m.a,m.b,m.c,m.d,m.e,m.f]}
function toDoc(x,y){return{x:(x-S.panX)/S.zoom,y:(y-S.panY)/S.zoom}}
let checker=null,histT=0;
function render(){rq=false;resizeView();const c=vctx,v=view;c.setTransform(1,0,0,1,0,0);c.fillStyle=getComputedStyle(stage).backgroundColor;c.fillRect(0,0,v.width,v.height);if(!S.doc)return;
  if(S.contentDirty)renderContent();const d=S.doc,pr=S.pr;
  if(!checker){const t=mk(16,16),g=cx(t);g.fillStyle='#b9b9b9';g.fillRect(0,0,16,16);g.fillStyle='#8e8e8e';g.fillRect(0,0,8,8);g.fillRect(8,8,8,8);checker=c.createPattern(t,'repeat')}
  c.save();c.setTransform(...viewMatrix(0,0));c.beginPath();c.rect(0,0,d.w,d.h);c.setTransform(1,0,0,1,0,0);c.clip();c.fillStyle=checker;c.fillRect(0,0,v.width,v.height);c.restore();
  if(S.workPos){c.drawImage(work,S.workPos.x,S.workPos.y);if(S.compare==='split'&&!S.holdBefore){const sx=Math.round(S.splitX*v.width);c.save();c.beginPath();c.rect(0,0,sx,v.height);c.clip();c.drawImage(workB,S.workPos.x,S.workPos.y);c.restore()}}
  drawOverlays(c,pr);updateStatus();positionSplit()}
function renderContent(){const _t0=performance.now();try{renderContent0()}finally{S.contentMs=performance.now()-_t0}}
function renderContent0(){S.contentDirty=false;const d=S.doc,pr=S.pr,W=view.width,H=view.height,sc=S.zoom*pr;
  const M=new DOMMatrix(viewMatrix(0,0));const pts=[[0,0],[d.w,0],[0,d.h],[d.w,d.h]].map(([x,y])=>{const p=M.transformPoint(new DOMPoint(x,y));return[p.x,p.y]});
  const bx0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[0])))),by0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1])))),bx1=Math.min(W,Math.ceil(Math.max(...pts.map(p=>p[0])))),by1=Math.min(H,Math.ceil(Math.max(...pts.map(p=>p[1]))));
  if(bx1<=bx0||by1<=by0){S.workPos=null;return}const bw=bx1-bx0,bh=by1-by0;if(work.width!==bw||work.height!==bh){work.width=bw;work.height=bh}
  const T=viewMatrix(bx0,by0),o={scale:sc,ox:T[4],oy:T[5]};
  const before=S.holdBefore;const A=AL();
  if(!before&&A&&A.kind==='adjust'&&!S.stroke){o.cacheIdx=d.active;o.cacheKey=[S.docVer,T.join(),bw,bh,d.layers.slice(0,d.active).map(L=>L.kind==='adjust'?JSON.stringify(L.dev):'').join('|')].join('#')}
  renderStack(wctx,bw,bh,T,{...o,before});if(PROOF.on)proofApply(wctx,bw,bh);
  if(S.compare==='split'&&!before){if(workB.width!==bw||workB.height!==bh){workB.width=bw;workB.height=bh}renderStack(cx(workB),bw,bh,T,{...o,before:true,cacheIdx:null,cacheKey:null});if(PROOF.on)proofApply(rx(workB),bw,bh)}
  S.workPos={x:bx0,y:by0};const now=performance.now();S.workSize={w:bw,h:bh};histoSched(now)}
/* histogram refresh: throttled (never debounced) so it follows a slider or a brush live, always read from the same region of the work canvas, through a small proxy so the read-back stays cheap */
const histoP=mk(1,1);
function histoRead(){const ws=S.workSize;if(!S.doc||!ws||work.width<2)return null;const k=Math.min(1,480/Math.max(ws.w,ws.h)),w=Math.max(1,Math.round(ws.w*k)),h=Math.max(1,Math.round(ws.h*k));if(histoP.width!==w||histoP.height!==h){histoP.width=w;histoP.height=h}const g=rx(histoP);g.clearRect(0,0,w,h);g.imageSmoothingQuality='low';g.drawImage(work,0,0,ws.w,ws.h,0,0,w,h);return g.getImageData(0,0,w,h)}
function histoNow(){histT=performance.now();const im=histoRead();if(im)histogram(im)}
function histoSched(now){const iv=(S.stroke||S.drag||S.sliding)?90:40;clearTimeout(histogram.t);if(now-histT>=iv)histoNow();else histogram.t=setTimeout(histoNow,iv-(now-histT))}

/* histogram */
const histoC=$('#histo'),hctx=cx(histoC);
function histogram(img){const d=img.data,n=d.length/4,step=Math.max(1,Math.floor(n/200000)),R=new Uint32Array(256),G=new Uint32Array(256),B=new Uint32Array(256);let cnt=0,lo=0,hi=0;
  for(let i=0;i<n;i+=step){const j=i*4;if(d[j+3]<10)continue;const r=d[j],g=d[j+1],b=d[j+2];R[r]++;G[g]++;B[b]++;cnt++;if(r>=254&&g>=254&&b>=254)hi++;if(r<=1&&g<=1&&b<=1)lo++}S.lastHist={R,G,B};
  const W=histoC.width,H=histoC.height,c=hctx,st=getComputedStyle(document.documentElement),mode=st.getPropertyValue('--hist-blend').trim()||'lighter';c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
  const sm=A=>{const o=new Float32Array(256);for(let i=0;i<256;i++){const a=A[Math.max(0,i-1)],b=A[i],c=A[Math.min(255,i+1)];o[i]=i===0||i===255?b:(a+2*b+c)/4}return o};const RS=sm(R),GS=sm(G),BS=sm(B);let mx=1;for(let i=2;i<254;i++)mx=Math.max(mx,RS[i],GS[i],BS[i]);mx*=1.08;c.strokeStyle=st.getPropertyValue('--line-2');c.lineWidth=1;for(let k=1;k<4;k++){const x=Math.round(W*k/4)+.5;c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke()}
  c.globalCompositeOperation=mode;const cols=mode==='multiply'?['rgba(232,96,90,.7)','rgba(96,190,110,.7)','rgba(90,130,232,.7)']:['rgba(214,74,66,.85)','rgba(70,170,92,.85)','rgba(70,110,226,.85)'];
  [RS,GS,BS].forEach((A,k)=>{c.fillStyle=cols[k];c.beginPath();c.moveTo(0,H);for(let i=0;i<256;i++)c.lineTo(i/255*W,H-Math.min(1,Math.sqrt(A[i]/mx))*H*0.95);c.lineTo(W,H);c.closePath();c.fill()});c.globalCompositeOperation='source-over';
  $('#hmL').textContent=cnt?`Ombres écrêtées ${(lo/cnt*100).toFixed(1)} %`:'—';$('#hmR').textContent=cnt?`Hautes lumières ${(hi/cnt*100).toFixed(1)} %`:'';if(!curveDrag)drawCurve()}

/* overlays: marching ants, mask tint, crop, brush cursor */
const ants={key:'',idx:null,img:null,c:null,m:null};
function drawAnts(c){const d=S.doc;if(!d.sel)return;const W=view.width,H=view.height,key=[S.selVer,S.zoom,S.panX,S.panY,W,H,cropAngle()].join('|');
  if(ants.key!==key){ants.key=key;if(!ants.m||ants.m.width!==W||ants.m.height!==H){ants.m=mk(W,H);ants.c=mk(W,H);ants.img=new ImageData(W,H)}else ants.img.data.fill(0);
    const m=rx(ants.m);m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,W,H);m.setTransform(...viewMatrix(0,0));m.drawImage(d.sel,0,0);m.setTransform(1,0,0,1,0,0);const a=m.getImageData(0,0,W,H).data,list=[];
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(a[i*4+3]>=128&&(a[i*4-1]<128||a[i*4+7]<128||a[(i-W)*4+3]<128||a[(i+W)*4+3]<128))list.push(i)}ants.idx=Int32Array.from(list)}
  const dd=ants.img.data,idx=ants.idx;for(let k=0;k<idx.length;k++){const i=idx[k],x=i%W,y=(i/W)|0,v=((x+y+S.antPhase)>>2)&1?255:0,j=i*4;dd[j]=dd[j+1]=dd[j+2]=v;dd[j+3]=255}cx(ants.c).putImageData(ants.img,0,0);c.setTransform(1,0,0,1,0,0);c.drawImage(ants.c,0,0)}
setInterval(()=>{if(S.doc&&S.doc.sel&&!matchMedia('(prefers-reduced-motion: reduce)').matches){S.antPhase=(S.antPhase+1)%8;requestRender()}},140);
function maskTarget(){const L=AL();if(!L)return null;if(L.kind==='adjust'&&L.mask)return L;if(L.kind==='pixel'&&L.mask&&L.editMask)return L;return null}
function drawOverlays(c,pr){const d=S.doc;
  const mt=maskTarget()||(S.drag&&S.drag.type==='gradient'&&S.drag.target&&S.drag.target.kind==='adjust'&&S.drag.target.maskPreview?S.drag.target:null);const st=S.stroke;if(mt&&(S.showMask||(st&&st.target==='mask')||(S.drag&&S.drag.type==='gradient'))){const ms=maskSrc(mt);if(ms){const W=view.width,H=view.height,t=scr('mt',W,H),g=cx(t);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.setTransform(...viewMatrix(0,0));g.drawImage(ms,0,0);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-in';g.fillStyle='rgba(235,70,60,.5)';g.fillRect(0,0,W,H);c.setTransform(1,0,0,1,0,0);c.drawImage(t,0,0)}}
  if(st&&st.target==='heal'){const W=view.width,H=view.height,t=scr('mt',W,H),g=cx(t);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.setTransform(...viewMatrix(0,0));g.drawImage(st.canvas,0,0);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-in';g.fillStyle=st.tool==='remove'?'rgba(120,140,255,.55)':'rgba(235,90,60,.5)';g.fillRect(0,0,W,H);c.setTransform(1,0,0,1,0,0);c.drawImage(t,0,0)}
  drawAnts(c);c.setTransform(pr,0,0,pr,0,0);const P=(x,y)=>[S.panX+x*S.zoom,S.panY+y*S.zoom],dr=S.drag;
  if(dr&&dr.type==='marquee'){const[a,b]=P(Math.min(dr.x0,dr.x1),Math.min(dr.y0,dr.y1)),w=Math.abs(dr.x1-dr.x0)*S.zoom,h=Math.abs(dr.y1-dr.y0)*S.zoom;c.beginPath();if(dr.shape==='ellipse')c.ellipse(a+w/2,b+h/2,w/2,h/2,0,0,7);else c.rect(a,b,w,h);dash(c)}
  if(dr&&dr.type==='lasso'&&dr.pts.length>1){c.beginPath();dr.pts.forEach((p,i)=>{const[x,y]=P(p.x,p.y);i?c.lineTo(x,y):c.moveTo(x,y)});dash(c)}
  if(dr&&dr.type==='gradient'){const[a,b]=P(dr.x0,dr.y0),[e,f]=P(dr.x1,dr.y1);c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();if(dr.shape==='radial'){c.arc(a,b,Math.hypot(e-a,f-b),0,7)}c.moveTo(a,b);c.lineTo(e,f);c.stroke();c.fillStyle='#fff';[[a,b],[e,f]].forEach(([x,y])=>{c.beginPath();c.arc(x,y,4,0,7);c.fill()})}
  if(S.tool==='crop'&&S.crop){const cr=S.crop,[a,b]=P(cr.x,cr.y),w=cr.w*S.zoom,h=cr.h*S.zoom;c.fillStyle='rgba(0,0,0,.55)';c.beginPath();c.rect(0,0,S.vw,S.vh);c.rect(a,b,w,h);c.fill('evenodd');
    cropGrid(c,a,b,w,h);c.strokeStyle='#fff';c.lineWidth=1.5;c.strokeRect(a,b,w,h);c.fillStyle='#fff';
    for(const[hx,hy]of cropHandles(cr)){const[x,y]=P(hx,hy);c.fillRect(x-4,y-4,8,8)}c.font='600 11px '+getComputedStyle(document.body).fontFamily;c.fillText(`${Math.round(cr.w)} × ${Math.round(cr.h)}`,a+6,b>20?b-7:b+18)}
  const p=S.pointer;if(p&&p.inside&&!S.spaceDown){const t=S.tool,o=S.opts[t];
    if(o&&o.size&&['brush','eraser','clone','heal','dodge','remove'].includes(t)){const r=o.size/2*S.zoom;c.beginPath();(window.PAINTRING?PAINTRING(c,p,t,o,r):c.arc(p.cx,p.cy,Math.max(r,1.5),0,7));c.lineWidth=2.5;c.strokeStyle='rgba(0,0,0,.55)';c.stroke();c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.95)';c.stroke()}
    if((t==='clone'||(t==='heal'&&S.opts.heal.mode==='source'))&&S.cloneSrc){let sx,sy;if(S.stroke&&S.stroke.off){sx=p.dx+S.stroke.off.x;sy=p.dy+S.stroke.off.y}else if(S.cloneOff&&S.opts.clone.aligned&&t==='clone'){sx=p.dx+S.cloneOff.x;sy=p.dy+S.cloneOff.y}else{sx=S.cloneSrc.x;sy=S.cloneSrc.y}
      const[x,y]=P(sx,sy);c.strokeStyle='#fff';c.lineWidth=1;c.beginPath();c.moveTo(x-7,y);c.lineTo(x+7,y);c.moveTo(x,y-7);c.lineTo(x,y+7);c.stroke();c.strokeStyle='rgba(0,0,0,.6)';c.beginPath();c.arc(x,y,(S.opts[t].size/2)*S.zoom,0,7);c.stroke()}}}
function dash(c){c.lineWidth=1;c.setLineDash([5,4]);c.strokeStyle='#000';c.stroke();c.lineDashOffset=4.5;c.strokeStyle='#fff';c.stroke();c.setLineDash([]);c.lineDashOffset=0}
function updateStatus(){const d=S.doc,p=S.pointer,L=AL();const parts=[`${Math.round(S.zoom*100)} %`];if(p&&p.inside)parts.push(`x ${Math.floor(p.dx)}  y ${Math.floor(p.dy)}`);if(L)parts.push((L.kind==='adjust'?'Réglage : ':'Calque : ')+L.name+(maskTarget()?' (masque)':''));if(S.sample)parts.push('photo d’exemple');
  $('#status').innerHTML=parts.map(s=>`<span>${esc(s)}</span>`).join('');$('#zoomLbl').textContent=Math.round(S.zoom*100)+' %'}
function positionSplit(){const sp=$('#split');const on=S.doc&&S.compare==='split';sp.hidden=!on;if(on)sp.style.left=(S.splitX*S.vw)+'px';$('#beforeBadge').hidden=!S.holdBefore;$('#bCompare').classList.toggle('on',S.compare==='split')}

/* zoom & pan */
function zoomAt(z,x,y){if(!S.doc)return;S.fitted=false;z=clamp(z,0.02,32);if(x==null){x=S.vw/2;y=S.vh/2}const p=toDoc(x,y);S.zoom=z;S.panX=x-p.x*z;S.panY=y-p.y*z;markContent()}
function fit(cap){if(!S.doc)return;resizeView();const narrow=S.vw<600,short=S.vh<500,mx=narrow?16:short?96:110,my=short?44:narrow?70:90;let z=Math.min((S.vw-mx)/S.doc.w,(S.vh-my)/S.doc.h);if(cap)z=Math.min(z,1);S.fitted=true;S.zoom=Math.max(z,0.01);S.panX=(S.vw-S.doc.w*S.zoom)/2+(narrow?0:20);S.panY=(S.vh-S.doc.h*S.zoom)/2+(narrow?-20:10);markContent()}
const ZS=[0.02,0.03,0.05,0.0833,0.125,0.1667,0.25,0.3333,0.5,0.6667,1,1.5,2,3,4,6,8,12,16,24,32];
function zoomStep(dir,x,y){const z=dir>0?(ZS.find(s=>s>S.zoom*1.01)||32):([...ZS].reverse().find(s=>s<S.zoom/1.01)||0.02);zoomAt(z,x,y)}

