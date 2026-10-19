/* ================= strokes (pixels, masks, healing, removal) ================= */
function stampFor(size,hard,color){const s=Math.max(1,Math.ceil(size)),c=mk(s,s),g=cx(c),r=s/2,gr=g.createRadialGradient(r,r,0,r,r,r),col=color||'#000';gr.addColorStop(0,col);gr.addColorStop(Math.min(0.99,hard),col);gr.addColorStop(1,hexA(col,0));g.fillStyle=gr;g.fillRect(0,0,s,s);return c}
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function beginStroke(p,e){const d=S.doc,t=S.tool,A=AL();if(!A)return;const o=S.opts[t];let L,target='pixel';
  if((t==='brush'||t==='eraser')&&((A.kind==='adjust'&&A.mask)||(A.mask&&A.editMask))){L=A;target='mask'}
  else{L=pixelTarget();if(!L){toast('Aucun calque de pixels à retoucher');return}}
  if(!L.visible){toast('Ce calque est masqué');return}
  const st={tool:t,layer:L,target,last:p,bounds:{x0:p.x,y0:p.y,x1:p.x,y1:p.y},pressure:1};
  if(t==='clone'||(t==='heal'&&o.mode==='source')){if(!S.cloneSrc){toast(ALT+'+clic pour définir la zone source');return}if(t==='heal'||!o.aligned||!S.cloneOff)S.cloneOff={x:S.cloneSrc.x-p.x,y:S.cloneSrc.y-p.y};st.off={...S.cloneOff}}
  if(t==='dodge'){editCanvas(L);st.selData=null;st.selC=d.sel?rx(d.sel):null;st.ctx=rx(L.canvas);S.stroke=st;dab(st,p);markComp();return}
  st.canvas=mk(d.w,d.h);st.g=cx(st.canvas);st.live=true;st.opacity=o.opacity??1;
  if(t==='clone'){st.src=S.opts.clone.all?cloneC(flatSync()):L.canvas;st.dabC=mk(Math.ceil(o.size)+2,Math.ceil(o.size)+2);st.mask=stampFor(o.size,o.hardness,'#000')}
  else if(t==='heal'||t==='remove'){st.target='heal';st.live=false;st.stamp=stampFor(o.size,t==='remove'?0.9:o.hardness,'#ffffff');st.opacity=1}
  else st.stamp=stampFor(o.size,o.hardness,(t==='eraser'||target==='mask')?'#ffffff':S.color);
  // the layer as it will be once the stroke is applied; after the first frame only the area the new dabs touched is recomposed
  st.liveCanvas=()=>{const base=target==='mask'?L.mask:L.canvas,full=!st.tmp;if(full)st.tmp=mk(d.w,d.h);const g=cx(st.tmp),R=full?{x0:0,y0:0,x1:d.w,y1:d.h}:st.dirty;st.dirty=null;if(!R)return st.tmp;
    const x=Math.max(0,Math.floor(R.x0)),y=Math.max(0,Math.floor(R.y0)),w=Math.min(d.w,Math.ceil(R.x1))-x,h=Math.min(d.h,Math.ceil(R.y1))-y;if(w<=0||h<=0)return st.tmp;
    g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(x,y,w,h);g.drawImage(base,x,y,w,h,x,y,w,h);
    let src=st.canvas,sx=x,sy=y;if(d.sel&&st.target!=='heal'){const t=scr('lstroke',w,h),tg=cx(t);tg.globalCompositeOperation='source-over';tg.clearRect(0,0,w,h);tg.drawImage(st.canvas,x,y,w,h,0,0,w,h);tg.globalCompositeOperation='destination-in';tg.drawImage(d.sel,x,y,w,h,0,0,w,h);tg.globalCompositeOperation='source-over';src=t;sx=0;sy=0}
    g.globalAlpha=st.opacity;g.globalCompositeOperation=st.tool==='eraser'?'destination-out':'source-over';g.drawImage(src,sx,sy,w,h,x,y,w,h);g.globalAlpha=1;g.globalCompositeOperation='source-over';return st.tmp};
  S.stroke=st;if(e&&e.pointerType==='pen')st.pressure=e.pressure||1;dab(st,p);if(st.target==='heal')requestRender();else markComp()}
function maskedStroke(st){const d=S.doc;if(!d.sel||st.target==='heal')return st.canvas;if(!st.m)st.m=mk(d.w,d.h);const g=cx(st.m);g.globalCompositeOperation='source-over';g.clearRect(0,0,d.w,d.h);g.drawImage(st.canvas,0,0);g.globalCompositeOperation='destination-in';g.drawImage(d.sel,0,0);g.globalCompositeOperation='source-over';return st.m}
function moveStroke(p,e){const st=S.stroke;if(!st)return;if(e&&e.pointerType==='pen')st.pressure=e.pressure||st.pressure;const o=S.opts[st.tool],sp=Math.max(1,o.size*(st.tool==='dodge'?0.2:(o.spacing||12)/100));const dx=p.x-st.last.x,dy=p.y-st.last.y,dist=Math.hypot(dx,dy);if(dist<sp)return;const n=Math.floor(dist/sp);
  for(let k=1;k<=n;k++)dab(st,{x:st.last.x+dx*k*sp/dist,y:st.last.y+dy*k*sp/dist});st.last={x:st.last.x+dx*n*sp/dist,y:st.last.y+dy*n*sp/dist};if(st.target==='heal')requestRender();else markComp()}
function dab(st,p){const o=S.opts[st.tool],r=o.size/2,b=st.bounds;b.x0=Math.min(b.x0,p.x-r);b.y0=Math.min(b.y0,p.y-r);b.x1=Math.max(b.x1,p.x+r);b.y1=Math.max(b.y1,p.y+r);if(st.tool==='dodge')return pixelDab(st,p);const g=st.g;
  if(st.tool==='clone'){const s=st.dabC.width-2,dc=cx(st.dabC);dc.globalCompositeOperation='source-over';dc.clearRect(0,0,s+2,s+2);dc.drawImage(st.src,p.x+st.off.x-s/2,p.y+st.off.y-s/2,s,s,0,0,s,s);dc.globalCompositeOperation='destination-in';dc.drawImage(st.mask,0,0);g.globalAlpha=1;g.drawImage(st.dabC,0,0,s,s,p.x-s/2,p.y-s/2,s,s);return}
  g.globalAlpha=st.tool==='brush'?clamp(o.flow*st.pressure,0.02,1):1;{const k=(st.pressure<1&&o.pressSize!==false&&(st.tool==='brush'||st.tool==='eraser'))?Math.max(.18,st.pressure):1,w=st.stamp.width*k,h=st.stamp.height*k;g.drawImage(st.stamp,p.x-w/2,p.y-h/2,w,h)}}
function pixelDab(st,p){const d=S.doc,o=S.opts.dodge,r=o.size/2,x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(d.w,Math.ceil(p.x+r)),y1=Math.min(d.h,Math.ceil(p.y+r));if(x1<=x0||y1<=y0)return;
  const w=x1-x0,h=y1-y0,img=st.ctx.getImageData(x0,y0,w,h),a=img.data,src=(o.mode==='blur'||o.mode==='sharpen')?a.slice():null,str=o.strength*0.22,mode=o.mode,sd=st.selC?st.selC.getImageData(x0,y0,w,h).data:null;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ddx=x0+x+0.5-p.x,ddy=y0+y+0.5-p.y,dist=Math.sqrt(ddx*ddx+ddy*ddy)/r;if(dist>=1)continue;let wg=(1-dist*dist);wg*=wg*str;if(sd)wg*=sd[(y*w+x)*4+3]/255;if(wg<=0.001)continue;const j=(y*w+x)*4;wg*=toneW(a[j],a[j+1],a[j+2]);if(wg<=0.001)continue;
    if(mode==='dodge'||mode==='burn'){const gm=mode==='dodge'?1/(1+wg*0.6):1+wg*0.6;for(let c=0;c<3;c++)a[j+c]=255*Math.pow(a[j+c]/255,gm)}
    else if(mode==='saturate'||mode==='desaturate'){const l=0.2126*a[j]+0.7152*a[j+1]+0.0722*a[j+2],f=mode==='saturate'?1+wg*0.8:1-wg*0.9;for(let c=0;c<3;c++)a[j+c]=clamp(l+(a[j+c]-l)*f,0,255)}
    else{let s0=0,s1=0,s2=0,n=0;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){const X=x+xx,Y=y+yy;if(X<0||Y<0||X>=w||Y>=h)continue;const k=(Y*w+X)*4;s0+=src[k];s1+=src[k+1];s2+=src[k+2];n++}const av=[s0/n,s1/n,s2/n];if(mode==='blur'){for(let c=0;c<3;c++){const v=src[j+c];a[j+c]=v+(av[c]-v)*Math.min(1,wg*3)}}else{const dl=0.2126*(src[j]-av[0])+0.7152*(src[j+1]-av[1])+0.0722*(src[j+2]-av[2]),ad=Math.abs(dl);if(ad>2){const g=dl*wg*1.6*Math.min(1,(ad-2)/6),dd=g>24?24:g<-24?-24:g;for(let c=0;c<3;c++)a[j+c]=clamp(src[j+c]+dd,0,255)}}}}
  st.ctx.putImageData(img,x0,y0)}
async function endStroke(){const st=S.stroke;if(!st)return;S.stroke=null;const L=st.layer;
  if(st.tool==='dodge'){markComp();pushHistory({dodge:'Densité −',burn:'Densité +',blur:'Goutte d’eau',sharpen:'Netteté',saturate:'Éponge (saturer)',desaturate:'Éponge (désaturer)'}[S.opts.dodge.mode]);return}
  if(st.tool==='heal'){busy(true,'Correction…');await tick();let ok=true;const prevC=L.canvas;try{editCanvas(L);ok=healRegion(L,st.canvas,st.bounds,S.opts.heal.mode==='source'?st.off:null)!==false}finally{busy(false)}if(!ok){L.canvas=prevC;markComp();return}markComp();pushHistory(S.opts.heal.mode==='spot'?'Correcteur localisé':'Correcteur');return}
  if(st.tool==='remove'){requestRender();await removeObject(L,st.canvas,st.bounds);return}
  const m=maskedStroke(st);if(st.target==='mask'){const g=editMask(L);g.globalAlpha=st.opacity;g.globalCompositeOperation=st.tool==='eraser'?'destination-out':'source-over';g.drawImage(m,0,0)}
  else{const g=editCanvas(L);g.globalAlpha=st.opacity;g.globalCompositeOperation=st.tool==='eraser'?'destination-out':'source-over';g.drawImage(m,0,0)}
  [st.tmp,st.m].forEach(c=>{if(c&&c!==L.canvas&&c!==L.mask){c.width=c.height=0}});st.live=false;markComp();pushHistory(st.target==='mask'?(st.tool==='eraser'?'Masque : retirer':'Masque : ajouter'):{brush:'Pinceau',eraser:'Gomme',clone:'Tampon de duplication'}[st.tool]);syncLayers()}
function cancelDrag(){const dr=S.drag;S.drag=null;if(!dr)return;if(dr.type==='move'&&dr.L){dr.L.dx=0;dr.L.dy=0}if(dr.type==='gradient'&&dr.target){delete dr.target.preview;delete dr.target.maskPreview}if(dr.type==='pen'&&typeof penCancelDrag==='function')penCancelDrag(dr);markComp()}
function cancelStroke(){if(!S.stroke)return;const st=S.stroke;S.stroke=null;if(st.tool==='dodge')restore(S.hi);markComp()}

/* healing brush: Poisson blending */
function healRegion(L,maskC,bx,manualOff){const d=S.doc,W=d.w,H=d.h,x0=Math.max(0,Math.floor(bx.x0)-3),y0=Math.max(0,Math.floor(bx.y0)-3),x1=Math.min(W,Math.ceil(bx.x1)+3),y1=Math.min(H,Math.ceil(bx.y1)+3),rw=x1-x0,rh=y1-y0;if(rw<3||rh<3)return false;
  const g=rx(L.canvas),T=g.getImageData(x0,y0,rw,rh),td=T.data,M=rx(maskC).getImageData(x0,y0,rw,rh).data,n=rw*rh,ins=new Uint8Array(n);let cnt=0;for(let i=0;i<n;i++)if(M[i*4+3]>6){ins[i]=1;cnt++}if(!cnt)return false;
  let cur=ins.slice();for(let pass=0;pass<3;pass++){const nx=cur.slice();for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=y*rw+x;if(cur[i])continue;if((x>0&&cur[i-1])||(x<rw-1&&cur[i+1])||(y>0&&cur[i-rw])||(y<rh-1&&cur[i+rw]))nx[i]=1}cur=nx}
  const ringL=[];for(let i=0;i<n;i++)if(cur[i]&&!ins[i])ringL.push(i);let off=manualOff?{x:Math.round(manualOff.x),y:Math.round(manualOff.y)}:null;
  if(!off){const s=Math.max(bx.x1-bx.x0,bx.y1-bx.y0)+6,R=Math.ceil(s*2.4)+4,ax0=Math.max(0,x0-R),ay0=Math.max(0,y0-R),ax1=Math.min(W,x1+R),ay1=Math.min(H,y1+R),aw=ax1-ax0,A=g.getImageData(ax0,ay0,aw,ay1-ay0).data,insL=[];for(let i=0;i<n;i+=3)if(ins[i])insL.push(i);let best=Infinity;
    for(const f of[1.05,1.4,1.85,2.4])for(let k=0;k<24;k++){const an=k*Math.PI/12,dx=Math.round(Math.cos(an)*s*f),dy=Math.round(Math.sin(an)*s*f);if(x0+dx<0||y0+dy<0||x1+dx>W||y1+dy>H)continue;let cost=0;
      for(const i of ringL){const px=i%rw,py=(i/rw)|0,sj=((y0+py+dy-ay0)*aw+(x0+px+dx-ax0))*4,tj=i*4,e0=td[tj]-A[sj],e1=td[tj+1]-A[sj+1],e2=td[tj+2]-A[sj+2];cost+=e0*e0+e1*e1+e2*e2}cost/=Math.max(1,ringL.length);
      let ov=0;for(const i of insL){const px=(i%rw)+dx,py=((i/rw)|0)+dy;if(px>=0&&py>=0&&px<rw&&py<rh&&ins[py*rw+px])ov++}cost+=ov*400+f*40;if(cost<best){best=cost;off={x:dx,y:dy}}}
    if(!off){toast('Pas assez de matière autour pour corriger cette zone');return false}}
  const Sd=g.getImageData(x0+off.x,y0+off.y,rw,rh).data,D=[new Float32Array(n),new Float32Array(n),new Float32Array(n)],inL=[],mean=[0,0,0];let bn=0;
  for(let i=0;i<n;i++){if(ins[i]){inL.push(i);continue}for(let c=0;c<3;c++)D[c][i]=td[i*4+c]-Sd[i*4+c]}
  for(const i of ringL){const px=i%rw,py=(i/rw)|0;if((px>0&&ins[i-1])||(px<rw-1&&ins[i+1])||(py>0&&ins[i-rw])||(py<rh-1&&ins[i+rw])){for(let c=0;c<3;c++)mean[c]+=D[c][i];bn++}}for(let c=0;c<3;c++)mean[c]/=Math.max(1,bn);
  const m=inL.length,nb=new Int32Array(m*4).fill(-1);for(let k=0;k<m;k++){const i=inL[k],px=i%rw,py=(i/rw)|0;if(px>0)nb[k*4]=i-1;if(px<rw-1)nb[k*4+1]=i+1;if(py>0)nb[k*4+2]=i-rw;if(py<rh-1)nb[k*4+3]=i+rw;for(let c=0;c<3;c++)D[c][i]=mean[c]}
  const iters=Math.min(1600,80+Math.round(Math.sqrt(m)*9)),w=1.92;for(let c=0;c<3;c++){const Dc=D[c];for(let it=0;it<iters;it++)for(let k=0;k<m;k++){let s=0,q=0,t;t=nb[k*4];if(t>=0){s+=Dc[t];q++}t=nb[k*4+1];if(t>=0){s+=Dc[t];q++}t=nb[k*4+2];if(t>=0){s+=Dc[t];q++}t=nb[k*4+3];if(t>=0){s+=Dc[t];q++}const i=inL[k];Dc[i]+=w*(s/q-Dc[i])}}
  for(const i of inL){const a=Math.min(1,M[i*4+3]/255*1.15),j=i*4;for(let c=0;c<3;c++){const v=Sd[j+c]+D[c][i];td[j+c]=clamp(td[j+c]+(v-td[j+c])*a,0,255)}if(Sd[j+3]>0)td[j+3]=td[j+3]+(Sd[j+3]-td[j+3])*a}g.putImageData(T,x0,y0);return true}

/* object removal: multi-scale PatchMatch inpainting in a worker */
const INPAINT_SRC=`self.onmessage=e=>{const{w,h,rgb,hole}=e.data;const out=inpaint(w,h,rgb,hole,p=>self.postMessage({progress:p}));self.postMessage({done:true,rgb:out},[out.buffer])};
function inpaint(W,H,rgb,hole,prog){const R=3;const lv=[{w:W,h:H,img:rgb,hole:hole}];
 while(true){const L=lv[lv.length-1];if(Math.min(L.w,L.h)<40||lv.length>7)break;let hc=0;for(let i=0;i<L.hole.length;i++)hc+=L.hole[i];if(hc<12)break;
  const w=L.w>>1,h=L.h>>1,img=new Float32Array(w*h*3),ho=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s0=0,s1=0,s2=0,n=0,hh=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const i=(2*y+dy)*L.w+2*x+dx;if(L.hole[i])hh=1;else{s0+=L.img[i*3];s1+=L.img[i*3+1];s2+=L.img[i*3+2];n++}}const j=y*w+x;ho[j]=hh;if(n){img[j*3]=s0/n;img[j*3+1]=s1/n;img[j*3+2]=s2/n}}
  lv.push({w,h,img,hole:ho})}
 const nL=lv.length;let nnf=null,prevL=null;
 for(let li=nL-1;li>=0;li--){const L=lv[li],w=L.w,h=L.h,N=w*h,img=L.img,ho=L.hole;
  const I=new Int32Array((w+1)*(h+1));for(let y=0;y<h;y++){let rs=0;for(let x=0;x<w;x++){rs+=ho[y*w+x];I[(y+1)*(w+1)+x+1]=I[y*(w+1)+x+1]+rs}}
  const box=(x0,y0,x1,y1)=>{x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(w-1,x1);y1=Math.min(h-1,y1);return I[(y1+1)*(w+1)+x1+1]-I[y0*(w+1)+x1+1]-I[(y1+1)*(w+1)+x0]+I[y0*(w+1)+x0]};
  const valid=new Uint8Array(N),vl=[];for(let y=R;y<h-R;y++)for(let x=R;x<w-R;x++)if(box(x-R,y-R,x+R,y+R)===0){valid[y*w+x]=1;vl.push(y*w+x)}
  if(!vl.length)return lv[0].img;
  const tg=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(box(x-R,y-R,x+R,y+R)>0)tg.push(y*w+x);
  const NN=new Int32Array(N).fill(-1),DS=new Float32Array(N);const rnd=()=>vl[(Math.random()*vl.length)|0];
  if(li===nL-1){for(let it=0;it<Math.max(w,h);it++){let ch=0;for(let i=0;i<N;i++){if(!ho[i])continue;const x=i%w,y=(i/w)|0;let s0=0,s1=0,s2=0,n=0;const nb=[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1];for(const q of nb){if(q<0)continue;if(ho[q]&&!img.fill_done)continue;s0+=img[q*3];s1+=img[q*3+1];s2+=img[q*3+2];n++}if(n){img[i*3]=s0/n;img[i*3+1]=s1/n;img[i*3+2]=s2/n;ch++}}if(!ch)break}
    const done=new Uint8Array(N);for(let i=0;i<N;i++)done[i]=!ho[i];let front=true;while(front){front=false;const nd=done.slice();for(let i=0;i<N;i++){if(done[i])continue;const x=i%w,y=(i/w)|0;let s0=0,s1=0,s2=0,n=0;const nb=[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1];for(const q of nb){if(q<0||!done[q])continue;s0+=img[q*3];s1+=img[q*3+1];s2+=img[q*3+2];n++}if(n){img[i*3]=s0/n;img[i*3+1]=s1/n;img[i*3+2]=s2/n;nd[i]=1;front=true}}done.set(nd)}
    for(const p of tg)NN[p]=rnd()}
  else{for(const p of tg){const x=p%w,y=(p/w)|0,cxp=Math.min(prevL.w-1,x>>1),cyp=Math.min(prevL.h-1,y>>1),q0=nnf[cyp*prevL.w+cxp];let q=-1;if(q0>=0){const qx=Math.min(w-1-R,Math.max(R,(q0%prevL.w)*2+(x&1))),qy=Math.min(h-1-R,Math.max(R,((q0/prevL.w)|0)*2+(y&1)));const c=qy*w+qx;if(valid[c])q=c}NN[p]=q>=0?q:rnd()}vote(L,tg,NN,null,R)}
  const dist=(p,q,best)=>{const px=p%w,py=(p/w)|0,qx=q%w,qy=(q/w)|0;let s=0;for(let dy=-R;dy<=R;dy++){const y=py+dy;if(y<0||y>=h)continue;const ro=y*w,qo=(qy+dy)*w;for(let dx=-R;dx<=R;dx++){const x=px+dx;if(x<0||x>=w)continue;const a=(ro+x)*3,b=(qo+qx+dx)*3;const e0=img[a]-img[b],e1=img[a+1]-img[b+1],e2=img[a+2]-img[b+2];s+=e0*e0+e1*e1+e2*e2}if(s>best)return s}return s};
  for(const p of tg)DS[p]=dist(p,NN[p],1e30);
  const iters=li===nL-1?7:li===0?3:4;
  for(let it=0;it<iters;it++){const fwd=it%2===0,n=tg.length;
   for(let k=0;k<n;k++){const p=tg[fwd?k:n-1-k],x=p%w,y=(p/w)|0,st=fwd?-1:1;
    for(const nbp of [x+st>=0&&x+st<w?p+st:-1,y+st>=0&&y+st<h?p+st*w:-1]){if(nbp<0||NN[nbp]<0)continue;const c=NN[nbp]-(nbp-p);if(c<0||c>=N||!valid[c])continue;if(Math.abs((c%w)-(NN[nbp]%w))>1)continue;const dd=dist(p,c,DS[p]);if(dd<DS[p]){DS[p]=dd;NN[p]=c}}
    let rad=Math.max(w,h);const qx=NN[p]%w,qy=(NN[p]/w)|0;while(rad>=1){const cxr=Math.round(qx+(Math.random()*2-1)*rad),cyr=Math.round(qy+(Math.random()*2-1)*rad);if(cxr>=R&&cyr>=R&&cxr<w-R&&cyr<h-R){const c=cyr*w+cxr;if(valid[c]){const dd=dist(p,c,DS[p]);if(dd<DS[p]){DS[p]=dd;NN[p]=c}}}rad*=0.5}}
   vote(L,tg,NN,DS,R);for(const p of tg)DS[p]=dist(p,NN[p],1e30);prog(((nL-1-li)+(it+1)/iters)/nL)}
  nnf=NN;prevL=L;
  if(li>0){const F=lv[li-1];for(let y=0;y<F.h;y++)for(let x=0;x<F.w;x++){const i=y*F.w+x;if(!F.hole[i])continue;const c=Math.min(h-1,y>>1)*w+Math.min(w-1,x>>1);F.img[i*3]=img[c*3];F.img[i*3+1]=img[c*3+1];F.img[i*3+2]=img[c*3+2]}}}
 return lv[0].img}
function vote(L,tg,NN,DS,R){const w=L.w,h=L.h,img=L.img,ho=L.hole,acc=new Float32Array(w*h*4);let sig=1;if(DS){let s=0;for(const p of tg)s+=DS[p];sig=Math.max(1,s/Math.max(1,tg.length)/((2*R+1)*(2*R+1)))}
 for(const p of tg){const q=NN[p];if(q<0)continue;const px=p%w,py=(p/w)|0,qx=q%w,qy=(q/w)|0;const wt=DS?Math.exp(-(DS[p]/((2*R+1)*(2*R+1)))/(2*sig)):1;
  for(let dy=-R;dy<=R;dy++){const y=py+dy;if(y<0||y>=h)continue;for(let dx=-R;dx<=R;dx++){const x=px+dx;if(x<0||x>=w)continue;const i=y*w+x;if(!ho[i])continue;const s=((qy+dy)*w+qx+dx)*3;acc[i*4]+=img[s]*wt;acc[i*4+1]+=img[s+1]*wt;acc[i*4+2]+=img[s+2]*wt;acc[i*4+3]+=wt}}}
 for(let i=0;i<w*h;i++){if(!ho[i]||acc[i*4+3]<=0)continue;img[i*3]=acc[i*4]/acc[i*4+3];img[i*3+1]=acc[i*4+1]/acc[i*4+3];img[i*3+2]=acc[i*4+2]/acc[i*4+3]}}`;
let inpaintURL=null;
function runInpaint(w,h,rgb,hole,onProg){if(!inpaintURL)inpaintURL=URL.createObjectURL(new Blob([INPAINT_SRC],{type:'text/javascript'}));return new Promise((res,rej)=>{let wk;try{wk=new Worker(inpaintURL)}catch(e){rej(e);return}wk.onmessage=e=>{if(e.data.progress!=null)onProg&&onProg(e.data.progress);if(e.data.done){wk.terminate();res(e.data.rgb)}};wk.onerror=e=>{wk.terminate();rej(e)};wk.postMessage({w,h,rgb,hole},[rgb.buffer,hole.buffer])})}
async function removeObject(L,maskC,bx){const d=S.doc;const hw=bx.x1-bx.x0,hh=bx.y1-bx.y0;if(hw<2||hh<2)return;if(hw*hh>d.w*d.h*0.3){toast('Zone trop grande : peignez seulement l’objet à effacer');return}
  const mg=Math.max(40,Math.round(Math.max(hw,hh)*0.9)),x0=Math.max(0,Math.floor(bx.x0-mg)),y0=Math.max(0,Math.floor(bx.y0-mg)),x1=Math.min(d.w,Math.ceil(bx.x1+mg)),y1=Math.min(d.h,Math.ceil(bx.y1+mg));
  let f=1;const area=(x1-x0)*(y1-y0);if(area>900000)f=Math.sqrt(area/900000);const rw=Math.max(8,Math.round((x1-x0)/f)),rh=Math.max(8,Math.round((y1-y0)/f));
  const src=mk(rw,rh),sg=rx(src);sg.imageSmoothingQuality='high';sg.drawImage(L.canvas,x0,y0,x1-x0,y1-y0,0,0,rw,rh);const mc=mk(rw,rh),mg2=rx(mc);mg2.drawImage(maskC,x0,y0,x1-x0,y1-y0,0,0,rw,rh);
  const sd=sg.getImageData(0,0,rw,rh).data,md=mg2.getImageData(0,0,rw,rh).data,n=rw*rh,rgb=new Float32Array(n*3),hole=new Uint8Array(n);
  for(let i=0;i<n;i++){rgb[i*3]=sd[i*4];rgb[i*3+1]=sd[i*4+1];rgb[i*3+2]=sd[i*4+2];hole[i]=md[i*4+3]>10?1:0}
  // grow hole by 2px so edges of the object are removed too
  for(let pass=0;pass<2;pass++){const h2=hole.slice();for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=y*rw+x;if(hole[i])continue;if((x>0&&hole[i-1])||(x<rw-1&&hole[i+1])||(y>0&&hole[i-rw])||(y<rh-1&&hole[i+rw]))h2[i]=1}hole.set(h2)}
  const holeC=hole.slice(),doc0=S.doc,h0=S.history[S.hi];busy(true,'Suppression de l’objet…',0);let out;try{out=await runInpaint(rw,rh,rgb,hole,p=>busy(true,'Suppression de l’objet…',p))}catch(e){busy(false);toast('La gomme magique n’a pas pu s’exécuter dans ce navigateur');return}busy(false);if(S.doc!==doc0||S.history[S.hi]!==h0||!doc0.layers.includes(L)){toast('Opération annulée : le document a changé');return}
  const res=mk(rw,rh),rg=cx(res),ri=rg.createImageData(rw,rh);for(let i=0;i<n;i++){ri.data[i*4]=out[i*3];ri.data[i*4+1]=out[i*3+1];ri.data[i*4+2]=out[i*3+2];ri.data[i*4+3]=holeC[i]?255:0}rg.putImageData(ri,0,0);
  const soft=blurCanvas(res,1.2);const g=editCanvas(L);g.imageSmoothingQuality='high';g.drawImage(soft,0,0,rw,rh,x0,y0,x1-x0,y1-y0);markComp();pushHistory('Gomme magique')}
async function removeSelected(){const d=S.doc;if(!d||!d.sel){toast('Sélectionnez d’abord l’objet à effacer');return}const L=pixelTarget();if(!L)return;const b=maskBBox(d.sel);if(!b)return;await removeObject(L,d.sel,b)}

