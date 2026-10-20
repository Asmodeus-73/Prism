/* ================= fx retouch: audit of the retouching tools (heal, remove, clone, patch, red eye, dodge, smudge, liquify) ================= */
(()=>{
// ---------- target layer for smudge, liquify and red eye (same rule as heal / clone / dodge: the pixel layer under an adjustment layer) ----------
window.rtPixelTarget=function(){const A=AL();
 if(A&&A.kind==='pixel'&&A.mask&&A.editMask){toast('Le masque est sélectionné : cliquez sur la vignette de l’image du calque pour retoucher ses pixels.',3600);return null}
 const L=A&&A.kind==='pixel'?A:pixelTarget();
 if(!L){toast('Aucun calque de pixels à retoucher');return null}
 if(L.visible===false){toast('Ce calque est masqué');return null}
 if(MEDIT(L)){delete L.txt;delete L.shp;toast('Ce calque devient un calque de pixels : le texte ou la forme ne sera plus modifiable',4000)}
 return L};

// ---------- source button: the explanation moves to its tooltip so the options bar fits on a laptop screen ----------
srcBtn=function(){return`<button class="btn sm ${S.pickSource?'on':''}" id="srcBtn" title="${S.cloneSrc?'Source définie. ':''}Définir la source : cliquez ici puis sur la zone à copier, ou ${ALT}+clic sur cette zone">Source</button>`};

// ---------- Échap (or a second finger) during a stroke cancels it cleanly ----------
const _cd=cancelDrag;cancelDrag=function(){const dr=S.drag;
 if(dr&&dr.type==='stroke'){S.drag=null;if(S.stroke)cancelStroke();requestRender();return}
 if(dr&&(dr.type==='ip'||dr.type==='lqf'||dr.type==='smg')){S.drag=null;if(dr.timer)clearInterval(dr.timer);if(S.doc&&S.hi>=0)restore(S.hi);requestRender();return}
 return _cd.apply(this,arguments)};

// ---------- clone stamp: whole-pixel offset and dab position, so the copy keeps the texture sharp ----------
// ---------- heal / remove: the painted zone is limited to the selection ----------
const _dab=dab;dab=function(st,p){
 if(st&&st.tool==='clone'&&st.dabC&&st.src&&st.off&&st.g){const o=S.opts.clone,r=o.size/2,b=st.bounds;b.x0=Math.min(b.x0,p.x-r);b.y0=Math.min(b.y0,p.y-r);b.x1=Math.max(b.x1,p.x+r);b.y1=Math.max(b.y1,p.y+r);
  const s=st.dabC.width-2,dc=cx(st.dabC),X=Math.round(p.x-s/2),Y=Math.round(p.y-s/2),ox=Math.round(st.off.x),oy=Math.round(st.off.y);
  dc.globalCompositeOperation='source-over';dc.clearRect(0,0,s+2,s+2);dc.drawImage(st.src,X+ox,Y+oy,s,s,0,0,s,s);dc.globalCompositeOperation='destination-in';dc.drawImage(st.mask,0,0);dc.globalCompositeOperation='source-over';
  st.g.globalAlpha=1;st.g.drawImage(st.dabC,0,0,s,s,X,Y,s,s);return}
 const r=_dab.apply(this,arguments);
 const d=S.doc;if(st&&(st.tool==='heal'||st.tool==='remove')&&st.g&&d&&d.sel){const o=S.opts[st.tool],h=Math.ceil(o.size/2)+2,x=Math.floor(p.x)-h,y=Math.floor(p.y)-h,w=2*h+1,g=st.g;
  g.save();g.beginPath();g.rect(x,y,w,w);g.clip();g.globalAlpha=1;g.globalCompositeOperation='destination-in';g.drawImage(d.sel,x,y,w,w,x,y,w,w);g.restore()}
 return r};
let clipSel=null;
const regBox=(c,b,W,H)=>{const x0=Math.max(0,Math.floor(b.x0)-2),y0=Math.max(0,Math.floor(b.y0)-2),x1=Math.min(W,Math.ceil(b.x1)+2),y1=Math.min(H,Math.ceil(b.y1)+2);if(x1<=x0||y1<=y0)return null;
 const w=x1-x0,h=y1-y0,a=rx(c).getImageData(x0,y0,w,h).data;let X0=w,Y0=h,X1=-1,Y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(a[(y*w+x)*4+3]>8){if(x<X0)X0=x;if(x>X1)X1=x;if(y<Y0)Y0=y;if(y>Y1)Y1=y}
 return X1<0?null:{x0:x0+X0,y0:y0+Y0,x1:x0+X1+1,y1:y0+Y1+1}};
const _es=endStroke;endStroke=function(){const st=S.stroke,d=S.doc;
 if(st&&d&&d.sel&&(st.tool==='heal'||st.tool==='remove')&&st.canvas){
  const g=cx(st.canvas);g.globalCompositeOperation='destination-in';g.drawImage(d.sel,0,0);g.globalCompositeOperation='source-over';
  const bb=regBox(st.canvas,st.bounds,d.w,d.h);if(!bb){S.stroke=null;requestRender();toast('Le trait est en dehors de la sélection');return Promise.resolve()}
  st.bounds=bb;if(st.tool==='remove')clipSel=d.sel}
 return _es.apply(this,arguments)};

// ---------- magic eraser: same engine, the result never spills outside the selection ----------
removeObject=async function(L,maskC,bx){const d=S.doc;const clip=clipSel;clipSel=null;const hw=bx.x1-bx.x0,hh=bx.y1-bx.y0;if(hw<2||hh<2)return;if(hw*hh>d.w*d.h*0.3){toast('Zone trop grande : peignez seulement l’objet à effacer');return}
 const mg=Math.max(40,Math.round(Math.max(hw,hh)*0.9)),x0=Math.max(0,Math.floor(bx.x0-mg)),y0=Math.max(0,Math.floor(bx.y0-mg)),x1=Math.min(d.w,Math.ceil(bx.x1+mg)),y1=Math.min(d.h,Math.ceil(bx.y1+mg));
 let f=1;const area=(x1-x0)*(y1-y0);if(area>900000)f=Math.sqrt(area/900000);const rw=Math.max(8,Math.round((x1-x0)/f)),rh=Math.max(8,Math.round((y1-y0)/f));
 const src=mk(rw,rh),sg=rx(src);sg.imageSmoothingQuality='high';sg.drawImage(L.canvas,x0,y0,x1-x0,y1-y0,0,0,rw,rh);const mc=mk(rw,rh),mg2=rx(mc);mg2.drawImage(maskC,x0,y0,x1-x0,y1-y0,0,0,rw,rh);
 const sd=sg.getImageData(0,0,rw,rh).data,md=mg2.getImageData(0,0,rw,rh).data,n=rw*rh,rgb=new Float32Array(n*3),hole=new Uint8Array(n);let hc=0;
 for(let i=0;i<n;i++){rgb[i*3]=sd[i*4];rgb[i*3+1]=sd[i*4+1];rgb[i*3+2]=sd[i*4+2];hole[i]=md[i*4+3]>10?1:0;hc+=hole[i]}
 if(!hc)return;
 for(let pass=0;pass<2;pass++){const h2=hole.slice();for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=y*rw+x;if(hole[i])continue;if((x>0&&hole[i-1])||(x<rw-1&&hole[i+1])||(y>0&&hole[i-rw])||(y<rh-1&&hole[i+rw]))h2[i]=1}hole.set(h2)}
 const holeC=hole.slice(),doc0=S.doc,h0=S.history[S.hi];busy(true,'Suppression de l’objet…',0);let out;try{out=await runInpaint(rw,rh,rgb,hole,p=>busy(true,'Suppression de l’objet…',p))}catch(e){busy(false);toast('La gomme magique n’a pas pu s’exécuter dans ce navigateur');return}busy(false);if(S.doc!==doc0||S.history[S.hi]!==h0||!doc0.layers.includes(L)){toast('Opération annulée : le document a changé');return}
 const res=mk(rw,rh),rg=cx(res),ri=rg.createImageData(rw,rh);for(let i=0;i<n;i++){ri.data[i*4]=out[i*3];ri.data[i*4+1]=out[i*3+1];ri.data[i*4+2]=out[i*3+2];ri.data[i*4+3]=holeC[i]?255:0}rg.putImageData(ri,0,0);
 const soft=blurCanvas(res,1.2);
 if(clip&&clip===d.sel){const full=mk(x1-x0,y1-y0),fg=cx(full);fg.imageSmoothingQuality='high';fg.drawImage(soft,0,0,rw,rh,0,0,x1-x0,y1-y0);fg.globalCompositeOperation='destination-in';fg.drawImage(clip,-x0,-y0);const g=editCanvas(L);g.drawImage(full,x0,y0)}
 else{const g=editCanvas(L);g.imageSmoothingQuality='high';g.drawImage(soft,0,0,rw,rh,x0,y0,x1-x0,y1-y0)}
 markComp();pushHistory('Gomme magique')};

// ---------- healing (heal, heal with source, patch): coarse-to-fine solve (same result, much faster on big zones); source near the edge repeats the edge instead of reading transparent black ----------
function relax(D,ins,w,h,iters,om){const n=w*h;let m=0;for(let i=0;i<n;i++)if(ins[i])m++;if(!m)return;const list=new Int32Array(m);let k=0;for(let i=0;i<n;i++)if(ins[i])list[k++]=i;
 const nb=new Int32Array(m*4).fill(-1);for(let k=0;k<m;k++){const i=list[k],x=i%w,y=(i/w)|0;if(x>0)nb[k*4]=i-1;if(x<w-1)nb[k*4+1]=i+1;if(y>0)nb[k*4+2]=i-w;if(y<h-1)nb[k*4+3]=i+w}
 for(let c=0;c<D.length;c++){const Dc=D[c];for(let it=0;it<iters;it++)for(let k=0;k<m;k++){let s=0,q=0,t;t=nb[k*4];if(t>=0){s+=Dc[t];q++}t=nb[k*4+1];if(t>=0){s+=Dc[t];q++}t=nb[k*4+2];if(t>=0){s+=Dc[t];q++}t=nb[k*4+3];if(t>=0){s+=Dc[t];q++}const i=list[k];if(q)Dc[i]+=om*(s/q-Dc[i])}}}
function initMean(D,ins,w,h){const n=w*h;for(let c=0;c<D.length;c++){let s=0,b=0;for(let i=0;i<n;i++){if(ins[i])continue;const x=i%w;if((x>0&&ins[i-1])||(x<w-1&&ins[i+1])||(i>=w&&ins[i-w])||(i+w<n&&ins[i+w])){s+=D[c][i];b++}}const mn=b?s/b:0;for(let i=0;i<n;i++)if(ins[i])D[c][i]=mn}}
function solveMG(D,ins,w,h){const n=w*h;let m=0;for(let i=0;i<n;i++)if(ins[i])m++;if(!m)return;
 if(m<=1500||w<16||h<16){initMean(D,ins,w,h);relax(D,ins,w,h,Math.min(1600,80+Math.round(Math.sqrt(m)*9)),1.92);return}
 const w2=(w+1)>>1,h2=(h+1)>>1,n2=w2*h2,ins2=new Uint8Array(n2),D2=D.map(()=>new Float32Array(n2)),s=[0,0,0];
 for(let y=0;y<h2;y++)for(let x=0;x<w2;x++){let k=0;s[0]=s[1]=s[2]=0;for(let dy=0;dy<2;dy++){const yy=2*y+dy;if(yy>=h)continue;for(let dx=0;dx<2;dx++){const xx=2*x+dx;if(xx>=w)continue;const i=yy*w+xx;if(!ins[i]){k++;for(let c=0;c<D.length;c++)s[c]+=D[c][i]}}}const j=y*w2+x;if(k){for(let c=0;c<D.length;c++)D2[c][j]=s[c]/k}else ins2[j]=1}
 solveMG(D2,ins2,w2,h2);
 for(let y=0;y<h;y++){const fy=Math.min(h2-1,Math.max(0,(y-.5)/2)),y0=Math.floor(fy),y1=Math.min(h2-1,y0+1),ty=fy-y0;for(let x=0;x<w;x++){const i=y*w+x;if(!ins[i])continue;const fx=Math.min(w2-1,Math.max(0,(x-.5)/2)),x0=Math.floor(fx),x1=Math.min(w2-1,x0+1),tx=fx-x0;
  for(let c=0;c<D.length;c++){const A=D2[c];D[c][i]=(A[y0*w2+x0]*(1-tx)+A[y0*w2+x1]*tx)*(1-ty)+(A[y1*w2+x0]*(1-tx)+A[y1*w2+x1]*tx)*ty}}}
 relax(D,ins,w,h,Math.min(120,40+Math.round(Math.sqrt(m)*.3)),1.6)}
function readClamped(g,sx,sy,w,h,W,H){if(sx>=0&&sy>=0&&sx+w<=W&&sy+h<=H)return g.getImageData(sx,sy,w,h).data;
 const rx0=clamp(sx,0,W-1),ry0=clamp(sy,0,H-1),rx1=clamp(sx+w,rx0+1,W),ry1=clamp(sy+h,ry0+1,H),rw=rx1-rx0,R=g.getImageData(rx0,ry0,rw,ry1-ry0).data,o=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++){const yy=clamp(sy+y,ry0,ry1-1)-ry0;for(let x=0;x<w;x++){const xx=clamp(sx+x,rx0,rx1-1)-rx0,j=(yy*rw+xx)*4,i=(y*w+x)*4;o[i]=R[j];o[i+1]=R[j+1];o[i+2]=R[j+2];o[i+3]=R[j+3]}}return o}
healRegion=function(L,maskC,bx,manualOff){const d=S.doc,W=d.w,H=d.h,x0=Math.max(0,Math.floor(bx.x0)-3),y0=Math.max(0,Math.floor(bx.y0)-3),x1=Math.min(W,Math.ceil(bx.x1)+3),y1=Math.min(H,Math.ceil(bx.y1)+3),rw=x1-x0,rh=y1-y0;if(rw<3||rh<3)return false;
 const g=rx(L.canvas),T=g.getImageData(x0,y0,rw,rh),td=T.data,M=rx(maskC).getImageData(x0,y0,rw,rh).data,n=rw*rh,ins=new Uint8Array(n);let cnt=0;for(let i=0;i<n;i++)if(M[i*4+3]>6){ins[i]=1;cnt++}if(!cnt)return false;
 let cur=ins.slice();for(let pass=0;pass<3;pass++){const nx=cur.slice();for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=y*rw+x;if(cur[i])continue;if((x>0&&cur[i-1])||(x<rw-1&&cur[i+1])||(y>0&&cur[i-rw])||(y<rh-1&&cur[i+rw]))nx[i]=1}cur=nx}
 const ringL=[];for(let i=0;i<n;i++)if(cur[i]&&!ins[i])ringL.push(i);let off=manualOff?{x:Math.round(manualOff.x),y:Math.round(manualOff.y)}:null;
 if(!off){const s=Math.max(bx.x1-bx.x0,bx.y1-bx.y0)+6,R=Math.ceil(s*2.4)+4,ax0=Math.max(0,x0-R),ay0=Math.max(0,y0-R),ax1=Math.min(W,x1+R),ay1=Math.min(H,y1+R),aw=ax1-ax0,A=g.getImageData(ax0,ay0,aw,ay1-ay0).data,insL=[];for(let i=0;i<n;i+=3)if(ins[i])insL.push(i);let best=Infinity;
  for(const f of[1.05,1.4,1.85,2.4])for(let k=0;k<24;k++){const an=k*Math.PI/12,dx=Math.round(Math.cos(an)*s*f),dy=Math.round(Math.sin(an)*s*f);if(x0+dx<0||y0+dy<0||x1+dx>W||y1+dy>H)continue;let cost=0;
   for(const i of ringL){const px=i%rw,py=(i/rw)|0,sj=((y0+py+dy-ay0)*aw+(x0+px+dx-ax0))*4,tj=i*4,e0=td[tj]-A[sj],e1=td[tj+1]-A[sj+1],e2=td[tj+2]-A[sj+2];cost+=e0*e0+e1*e1+e2*e2}cost/=Math.max(1,ringL.length);
   let ov=0;for(const i of insL){const px=(i%rw)+dx,py=((i/rw)|0)+dy;if(px>=0&&py>=0&&px<rw&&py<rh&&ins[py*rw+px])ov++}cost+=ov*400+f*40;if(cost<best){best=cost;off={x:dx,y:dy}}}
  if(!off){toast('Pas assez de matière autour pour corriger cette zone');return false}}
 const Sd=readClamped(g,x0+off.x,y0+off.y,rw,rh,W,H),D=[new Float32Array(n),new Float32Array(n),new Float32Array(n)];
 for(let i=0;i<n;i++){if(ins[i])continue;for(let c=0;c<3;c++)D[c][i]=td[i*4+c]-Sd[i*4+c]}
 solveMG(D,ins,rw,rh);
 for(let i=0;i<n;i++){if(!ins[i])continue;const a=Math.min(1,M[i*4+3]/255*1.15),j=i*4;for(let c=0;c<3;c++){const v=Sd[j+c]+D[c][i];td[j+c]=clamp(td[j+c]+(v-td[j+c])*a,0,255)}if(Sd[j+3]>0)td[j+3]=td[j+3]+(Sd[j+3]-td[j+3])*a}
 g.putImageData(T,x0,y0);return true};

// ---------- Densité: the tonal range only applies to the modes that show it (Éclaircir, Assombrir, Saturer, Désaturer) ----------
const _tw=window.toneW;window.toneW=function(r,g,b){const m=S.opts.dodge.mode;if(m==='blur'||m==='sharpen')return 1;return _tw(r,g,b)};

// ---------- Densité, Netteté: halo control. The result never goes more than 10 levels beyond the local range of the photo as it was before the stroke,
//            so strong edges get crisper without bright and dark rims, even at 100 % or after many passes ----------
let preNext=null;
const _bs=beginStroke;beginStroke=function(p,e){const L0=S.tool==='dodge'&&S.doc?pixelTarget():null;preNext=L0?L0.canvas:null;try{const r=_bs.apply(this,arguments);const st=S.stroke;if(st&&st.tool==='dodge'&&preNext&&st.layer.canvas!==preNext&&!st.pre)st.pre=preNext;return r}finally{preNext=null}};
const _pd=pixelDab;pixelDab=function(st,p){const o=S.opts.dodge,pre=st.pre||(st.layer&&st.layer.canvas!==preNext?preNext:null);if(o.mode!=='sharpen'||!pre)return _pd.apply(this,arguments);if(!st.pre)st.pre=pre;
 const d=S.doc,r=o.size/2,x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(d.w,Math.ceil(p.x+r)),y1=Math.min(d.h,Math.ceil(p.y+r));if(x1<=x0||y1<=y0)return;
 const w=x1-x0,h=y1-y0,img=st.ctx.getImageData(x0,y0,w,h),a=img.data,src=a.slice(),str=o.strength*0.22,sd=st.selC?st.selC.getImageData(x0,y0,w,h).data:null,OV=10;
 const qx0=Math.max(0,x0-1),qy0=Math.max(0,y0-1),qw=Math.min(d.w,x1+1)-qx0,qh=Math.min(d.h,y1+1)-qy0,R=rx(pre).getImageData(qx0,qy0,qw,qh).data,RL=new Float32Array(qw*qh);for(let i=0;i<RL.length;i++)RL[i]=0.2126*R[i*4]+0.7152*R[i*4+1]+0.0722*R[i*4+2];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ddx=x0+x+0.5-p.x,ddy=y0+y+0.5-p.y,dist=Math.sqrt(ddx*ddx+ddy*ddy)/r;if(dist>=1)continue;let wg=(1-dist*dist);wg*=wg*str;const j=(y*w+x)*4;if(sd)wg*=sd[j+3]/255;if(wg<=0.001)continue;
  let s0=0,s1=0,s2=0,n=0;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){const X=x+xx,Y=y+yy;if(X<0||Y<0||X>=w||Y>=h)continue;const k=(Y*w+X)*4;s0+=src[k];s1+=src[k+1];s2+=src[k+2];n++}
  const ls=0.2126*src[j]+0.7152*src[j+1]+0.0722*src[j+2],dl=ls-(0.2126*s0+0.7152*s1+0.0722*s2)/n,ad=Math.abs(dl);if(ad<=2)continue;
  const g=dl*wg*1.6*Math.min(1,(ad-2)/6);let dd=g>24?24:g<-24?-24:g;
  let mn=255,mx=0;const X0=x0+x-qx0,Y0=y0+y-qy0;for(let yy=-1;yy<=1;yy++){const Y=Y0+yy;if(Y<0||Y>=qh)continue;for(let xx=-1;xx<=1;xx++){const X=X0+xx;if(X<0||X>=qw)continue;const v=RL[Y*qw+X];if(v<mn)mn=v;if(v>mx)mx=v}}
  if(ls+dd>mx+OV)dd=Math.max(0,mx+OV-ls);else if(ls+dd<mn-OV)dd=Math.min(0,mn-OV-ls);if(!dd)continue;
  for(let c=0;c<3;c++)a[j+c]=clamp(src[j+c]+dd,0,255)}
 st.ctx.putImageData(img,x0,y0)};

// ---------- clone / heal-with-source overlay and patch preview: show the source as it looks on screen (with the develop settings),
//            not the raw pixels; parts of the source outside the window fall back to the raw pixels ----------
function devRegion(name,dx0,dy0,dw,dh,W,H,pr){const t=scr(name,W,H),g=cx(t);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.imageSmoothingEnabled=true;
 g.drawImage(flatSync(),dx0,dy0,dw,dh,0,0,W,H);
 if(S.workPos&&work.width>1&&!S.holdBefore&&S.compare!=='split')g.drawImage(work,(S.panX+dx0*S.zoom)*pr-S.workPos.x,(S.panY+dy0*S.zoom)*pr-S.workPos.y,dw*S.zoom*pr,dh*S.zoom*pr,0,0,W,H);
 return t}
const _dov=drawOverlays;drawOverlays=function(c,pr){const t=S.tool,p=S.pointer,o=S.opts.clone,d=S.doc;
 const ov=!!(o.overlay&&p&&p.inside&&!S.spaceDown&&!S.stroke&&d&&S.cloneSrc&&(t==='clone'||(t==='heal'&&S.opts.heal.mode==='source')));
 const P=S.patch&&S.patch.phase==='drag'&&d?S.patch:null;
 if(!ov&&!P)return _dov.apply(this,arguments);
 if(ov)o.overlay=false;if(P)S.patch=null;try{_dov.apply(this,arguments)}finally{if(ov)o.overlay=true;if(P&&!S.patch)S.patch=P}
 try{
  if(ov){let sx,sy;if(S.cloneOff&&o.aligned&&t==='clone'){sx=p.dx+S.cloneOff.x;sy=p.dy+S.cloneOff.y}else{sx=S.cloneSrc.x;sy=S.cloneSrc.y}
   const r=S.opts[t].size/2,rs=Math.max(2,r*S.zoom),N=Math.max(4,Math.ceil(rs*2*pr)),sc=devRegion('rtov',sx-r,sy-r,2*r,2*r,N,N,pr);
   c.save();c.setTransform(1,0,0,1,0,0);c.beginPath();c.arc(p.cx*pr,p.cy*pr,rs*pr,0,7);c.clip();c.globalAlpha=.55;c.drawImage(sc,p.cx*pr-rs*pr,p.cy*pr-rs*pr,N,N);c.restore()}
  if(P){const Q=P,pts=Q.pts.map(q=>[S.panX+q.x*S.zoom,S.panY+q.y*S.zoom]);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const[x,y]of pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
   x0=Math.max(x0,0);y0=Math.max(y0,0);x1=Math.min(x1,S.vw);y1=Math.min(y1,S.vh);
   if(x1>x0&&y1>y0){const W=Math.max(1,Math.ceil((x1-x0)*pr)),H=Math.max(1,Math.ceil((y1-y0)*pr)),sc=devRegion('rtpa',(x0-S.panX)/S.zoom+Q.off.x,(y0-S.panY)/S.zoom+Q.off.y,(x1-x0)/S.zoom,(y1-y0)/S.zoom,W,H,pr);
    c.save();c.setTransform(pr,0,0,pr,0,0);c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();c.globalAlpha=.85;c.drawImage(sc,x0,y0,x1-x0,y1-y0);c.restore()}
   const line=(dx,dy,col)=>{c.beginPath();Q.pts.forEach((q,i)=>{const x=S.panX+(q.x+dx)*S.zoom,y=S.panY+(q.y+dy)*S.zoom;i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();c.lineWidth=1.5;c.setLineDash([5,4]);c.strokeStyle=col;c.stroke();c.setLineDash([])};
   c.save();c.setTransform(pr,0,0,pr,0,0);line(0,0,'#fff');line(Q.off.x,Q.off.y,'#4fd1ff');c.restore()}
 }catch(err){}};

// ---------- liquify: one displacement field per session, the photo is resampled once from the original (no blur that builds up stroke after stroke);
//            Gonfler, Pincer, Tourbillon and Reconstruire keep working while the button is held still ----------
const TS=64;let LQF=null;
const falloff=(dist,hard)=>{const t=Math.min(1,dist);if(t<=hard)return 1;const u=1-(t-hard)/(1-hard+1e-6);return u*u};
function lqSession(dr,pre){const L=dr.L,d=S.doc;
 if(!LQF||LQF.layer!==L||LQF.doc!==d||LQF.hist!==S.history[S.hi]||LQF.w!==d.w||LQF.h!==d.h){const src=pre&&pre!==L.canvas?pre:L.canvas,oc=mk(d.w,d.h);rx(oc).drawImage(src,0,0);LQF={layer:L,doc:d,orig:oc,tiles:new Map(),w:d.w,h:d.h,hist:null}}
 return LQF}
const POOL={};const buf=(k,n)=>{let b=POOL[k];if(!b||b.length<n)b=POOL[k]=new Float32Array(Math.ceil(n*1.25));return b};
function fieldRead(Q,x0,y0,w,h){const fx=buf('fx',w*h),fy=buf('fy',w*h);fx.fill(0,0,w*h);fy.fill(0,0,w*h);const tx0=Math.floor(x0/TS),ty0=Math.floor(y0/TS),tx1=Math.floor((x0+w-1)/TS),ty1=Math.floor((y0+h-1)/TS);
 for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const t=Q.tiles.get(ty*100000+tx);if(!t)continue;const X0=Math.max(x0,tx*TS),Y0=Math.max(y0,ty*TS),X1=Math.min(x0+w,tx*TS+TS),Y1=Math.min(y0+h,ty*TS+TS);
  for(let y=Y0;y<Y1;y++){const ti=((y-ty*TS)*TS+(X0-tx*TS))*2;let li=(y-y0)*w+(X0-x0);for(let x=X0,k=ti;x<X1;x++,k+=2,li++){fx[li]=t[k];fy[li]=t[k+1]}}}
 return[fx,fy]}
function fieldWriteBlock(Q,x0,y0,w,h,nx,ny,wt){const tx0=Math.floor(x0/TS),ty0=Math.floor(y0/TS),tx1=Math.floor((x0+w-1)/TS),ty1=Math.floor((y0+h-1)/TS);
 for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const key=ty*100000+tx,X0=Math.max(x0,tx*TS),Y0=Math.max(y0,ty*TS),X1=Math.min(x0+w,tx*TS+TS),Y1=Math.min(y0+h,ty*TS+TS);let t=Q.tiles.get(key);
  for(let y=Y0;y<Y1;y++){let li=(y-y0)*w+(X0-x0),k=((y-ty*TS)*TS+(X0-tx*TS))*2;for(let x=X0;x<X1;x++,li++,k+=2){if(!(wt[li]>0))continue;if(!t){if(nx[li]===0&&ny[li]===0)continue;t=new Float32Array(TS*TS*2);Q.tiles.set(key,t)}t[k]=nx[li];t[k+1]=ny[li]}}}}
function lqStep(dr,p,sx,sy){const d=S.doc,Q=LQF,o=S.opts.liquify,r=o.size/2,mode=o.mode,S0=o.strength*(dr.pressure||1);if(!Q||r<1)return;
 const x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(d.w,Math.ceil(p.x+r)),y1=Math.min(d.h,Math.ceil(p.y+r));if(x1<=x0||y1<=y0)return;
 const w=x1-x0,h=y1-y0,n=w*h,ux=buf('ux',n),uy=buf('uy',n),wt=buf('wt',n),sel=dr.sel?dr.sel.getImageData(x0,y0,w,h).data:null,alt=S.altDown?-1:1;let um=0;ux.fill(0,0,n);uy.fill(0,0,n);wt.fill(0,0,n);
 const r2=r*r;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ddx=x0+x+.5-p.x,ddy=y0+y+.5-p.y,d2=ddx*ddx+ddy*ddy;if(d2>=r2)continue;const dist=Math.sqrt(d2)/r,f=falloff(dist,.15);if(f<=.002)continue;const i=y*w+x,ws=sel?sel[i*4+3]/255:1;if(ws<=0)continue;wt[i]=ws;
  let vx=0,vy=0;if(mode==='push'){vx=-sx*f*S0*1.1;vy=-sy*f*S0*1.1}
  else if(mode==='bloat'){const k=-f*S0*.14;vx=ddx*k;vy=ddy*k}
  else if(mode==='pinch'){const k=f*S0*.14;vx=ddx*k;vy=ddy*k}
  else if(mode==='twirl'){const a=f*S0*.22*alt,c=Math.cos(a),s=Math.sin(a);vx=ddx*c-ddy*s-ddx;vy=ddx*s+ddy*c-ddy}
  else if(mode==='reconstruct'){wt[i]=Math.min(1,f*S0*.35*ws);continue}
  ux[i]=vx;uy[i]=vy;const a=Math.abs(vx)+Math.abs(vy);if(a>um)um=a}
 // old field around the dab (enough margin to read D at x+u)
 const m=Math.ceil(um)+2,ex0=Math.max(0,x0-m),ey0=Math.max(0,y0-m),ex1=Math.min(d.w,x1+m),ey1=Math.min(d.h,y1+m),ew=ex1-ex0,eh=ey1-ey0,[Fx,Fy]=fieldRead(Q,ex0,ey0,ew,eh);
 const nx=buf('nx',n),ny=buf('ny',n);let sx0=Infinity,sy0=Infinity,sx1=-Infinity,sy1=-Infinity;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,X=x0+x,Y=y0+y,ei=(Y-ey0)*ew+(X-ex0);let vx=Fx[ei],vy=Fy[ei];
  if(wt[i]>0){if(mode==='reconstruct'){vx*=1-wt[i];vy*=1-wt[i]}
   else{let qx=X+ux[i]-ex0,qy=Y+uy[i]-ey0;qx=qx<0?0:qx>ew-1.001?ew-1.001:qx;qy=qy<0?0:qy>eh-1.001?eh-1.001:qy;const qi=qx|0,qj=qy|0,tx=qx-qi,ty=qy-qj,a=qj*ew+qi,b=a+ew;
    const ix=(Fx[a]*(1-tx)+Fx[a+1]*tx)*(1-ty)+(Fx[b]*(1-tx)+Fx[b+1]*tx)*ty,iy=(Fy[a]*(1-tx)+Fy[a+1]*tx)*(1-ty)+(Fy[b]*(1-tx)+Fy[b+1]*tx)*ty;
    vx+=(ux[i]+ix-vx)*wt[i];vy+=(uy[i]+iy-vy)*wt[i]}}
  nx[i]=vx;ny[i]=vy;if(wt[i]>0){const px=X+vx,py=Y+vy;if(px<sx0)sx0=px;if(px>sx1)sx1=px;if(py<sy0)sy0=py;if(py>sy1)sy1=py}}
 if(sx0===Infinity)return;
 fieldWriteBlock(Q,x0,y0,w,h,nx,ny,wt);
 // resample the original once
 const ox0=clamp(Math.floor(sx0),0,d.w-1),oy0=clamp(Math.floor(sy0),0,d.h-1),ox1=clamp(Math.ceil(sx1)+2,ox0+1,d.w),oy1=clamp(Math.ceil(sy1)+2,oy0+1,d.h),ow=ox1-ox0,oh=oy1-oy0;
 const O=rx(Q.orig).getImageData(ox0,oy0,ow,oh).data,img=dr.ctx.getImageData(x0,y0,w,h),a=img.data;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!(wt[i]>0))continue;let qx=x0+x+nx[i]-ox0,qy=y0+y+ny[i]-oy0;qx=qx<0?0:qx>ow-1.001?Math.max(0,ow-1.001):qx;qy=qy<0?0:qy>oh-1.001?Math.max(0,oh-1.001):qy;
  const qi=qx|0,qj=qy|0,tx=qx-qi,ty=qy-qj,i00=(qj*ow+qi)*4,i10=i00+(qi+1<ow?4:0),i01=i00+(qj+1<oh?ow*4:0),i11=i01+(qi+1<ow?4:0),j=i*4;
  for(let c=0;c<4;c++)a[j+c]=(O[i00+c]*(1-tx)+O[i10+c]*tx)*(1-ty)+(O[i01+c]*(1-tx)+O[i11+c]*tx)*ty}
 dr.ctx.putImageData(img,x0,y0)}
function lqPath(dr,p){const o=S.opts.liquify,sp=Math.max(1.5,o.size*.07),dx=p.x-dr.last.x,dy=p.y-dr.last.y,dist=Math.hypot(dx,dy);dr.cur={x:p.x,y:p.y};if(dist<sp)return;
 const n=Math.floor(dist/sp),sx=dx/dist*sp,sy=dy/dist*sp;let q={x:dr.last.x,y:dr.last.y};for(let k=1;k<=n;k++){q={x:q.x+sx,y:q.y+sy};lqStep(dr,q,sx,sy)}dr.last=q;dr.lastT=performance.now();markComp()}
// ---------- smudge: the paint picked up now travels with the brush (it stayed where it was taken, so the tool barely changed anything) ----------
let SB=[new Float32Array(0),new Float32Array(0)];
function smStep(dr,p){const d=S.doc,o=S.opts.smudge,r=o.size/2;if(r<.5)return;const x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(d.w,Math.ceil(p.x+r)),y1=Math.min(d.h,Math.ceil(p.y+r));if(x1<=x0||y1<=y0)return;
 const w=x1-x0,h=y1-y0,n=w*h*4,img=dr.ctx.getImageData(x0,y0,w,h),a=img.data,C=dr.cy;
 if(!C){const buf=new Float32Array(n);for(let i=0;i<n;i++)buf[i]=a[i];dr.cy={x:x0,y:y0,w,h,px:p.x,py:p.y,rx:0,ry:0,data:buf};return}
 const S0=clamp(o.strength*(dr.pressure||1),.02,1),q=Math.min(.985,Math.pow(S0,.3)),hard=clamp(o.hardness,0,1),sel=dr.sel?dr.sel.getImageData(x0,y0,w,h).data:null;
 const fx=p.x-C.px+C.rx,fy=p.y-C.py+C.ry,ix=Math.round(fx),iy=Math.round(fy);
 let nc=SB[0]===C.data?SB[1]:SB[0];if(nc.length<n){nc=new Float32Array(n);if(SB[0]===C.data)SB[1]=nc;else SB[0]=nc}
 const cd=C.data,cxp=p.x-x0,cyp=p.y-y0;
 for(let y=0;y<h;y++){const sy=y0+y-iy-C.y;for(let x=0;x<w;x++){const j=(y*w+x)*4,sx=x0+x-ix-C.x;const ddx=x+.5-cxp,ddy=y+.5-cyp,dist=Math.sqrt(ddx*ddx+ddy*ddy)/r;
  if(dist>=1||sx<0||sy<0||sx>=C.w||sy>=C.h){nc[j]=a[j];nc[j+1]=a[j+1];nc[j+2]=a[j+2];nc[j+3]=a[j+3];continue}
  const f=dist<=hard?1:Math.pow(1-(dist-hard)/(1-hard+1e-6),2),ws=sel?sel[j+3]/255:1,i=(sy*C.w+sx)*4,pk=1-(1-q)*f,k=f*S0*ws;
  for(let c=0;c<4;c++){const cur=a[j+c],v=cd[i+c]*pk+cur*(1-pk);nc[j+c]=v;if(k>0)a[j+c]=cur+(v-cur)*k}}}
 dr.ctx.putImageData(img,x0,y0);dr.cy={x:x0,y:y0,w,h,px:p.x,py:p.y,rx:fx-ix,ry:fy-iy,data:nc};SB=[C.data,nc]}
function smPath(dr,p){const o=S.opts.smudge,sp=Math.max(1.5,o.size*.06),dx=p.x-dr.last.x,dy=p.y-dr.last.y,dist=Math.hypot(dx,dy);if(dist<sp)return;
 const n=Math.floor(dist/sp),sx=dx/dist*sp,sy=dy/dist*sp;let q={x:dr.last.x,y:dr.last.y};for(let k=1;k<=n;k++){q={x:q.x+sx,y:q.y+sy};smStep(dr,q)}dr.last=q;dr.moved=true;markComp()}
const _od=onDown;onDown=function(e,p){const pre=new Map();if(S.tool==='liquify'&&S.doc){S.doc.layers.forEach(l=>pre.set(l,l.canvas));if(e&&e.altKey!=null)S.altDown=!!e.altKey}
 const r=_od.apply(this,arguments);const dr=S.drag;
 if(dr&&dr.type==='ip'&&dr.tool==='smudge'){dr.type='smg';dr.cy=null;smStep(dr,{x:p.x,y:p.y})}
 if(dr&&dr.type==='ip'&&dr.tool==='liquify'){dr.type='lqf';lqSession(dr,pre.get(dr.L));dr.cur={x:p.x,y:p.y};
  if(S.opts.liquify.mode!=='push'){lqStep(dr,p,0,0);markComp();
   dr.timer=setInterval(()=>{if(S.drag!==dr){clearInterval(dr.timer);return}if(performance.now()-(dr.lastT||0)<60)return;lqStep(dr,dr.cur,0,0);markComp()},70)}}
 return r};
const _om=onMove;onMove=function(e,p){const dr=S.drag;if(dr&&dr.type==='lqf'&&e&&e.altKey!=null)S.altDown=!!e.altKey;if(dr&&(dr.type==='lqf'||dr.type==='smg')){if(e&&e.pointerType==='pen')dr.pressure=e.pressure||dr.pressure;if(dr.type==='lqf')lqPath(dr,p);else smPath(dr,p);return}return _om.apply(this,arguments)};
const _ou=onUp;onUp=function(e){const dr=S.drag;if(dr&&dr.type==='smg'){S.drag=null;SB=[new Float32Array(0),new Float32Array(0)];if(!dr.moved){if(S.doc&&S.hi>=0)restore(S.hi);requestRender();return}/* a click without moving is not a step */markComp();pushHistory('Doigt');return}
 if(dr&&dr.type==='lqf'){S.drag=null;if(dr.timer)clearInterval(dr.timer);markComp();pushHistory('Fluidité');if(LQF&&LQF.layer===dr.L)LQF.hist=S.history[S.hi];return}return _ou.apply(this,arguments)};
const SHORT={remove:1,clone:1,dodge:1};
const _st=setTool;setTool=function(t){if(t!=='liquify')LQF=null;const r=_st.apply(this,arguments);
 // options bar: the short name (as on the tool rail) leaves room for the options at 1280 px
 try{const b=SHORT[t]&&TOOL_NAMES[t]&&document.querySelector('#optTool b');if(b)b.textContent=TOOL_NAMES[t]}catch(e){}
 return r};
})();

