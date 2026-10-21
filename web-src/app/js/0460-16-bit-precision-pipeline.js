/* ================= 16-bit precision pipeline ================= */
/* A pixel layer may carry L.hi (Uint16 RGBA, doc size, top-down) next to its 8-bit canvas. L.hiC is the canvas that matched L.hi when it was made:
   pixels later edited in 8 bits (filters…) differ from L.hiC and are taken from the canvas, everything else keeps its 16-bit value.
   L.hiP (optional) holds HT px tiles painted at 16 bits over L.hi (see 16-bit painting below).
   Rendering runs in 32-bit float from the first layer to the last adjustment, and is dithered once at the end. */
const PREC={on:PREF.get('hiPrec',true),fail:false};
const precOK=()=>PREC.on&&!PREC.fail&&GPU.ok&&GPU.float;
const docHasHi=d=>!!(d&&d.layers.some(L=>L.hi));
const EFF=new Map();/* canvas -> merged hi, small LRU */
function effHi(L){if(!L.hi)return null;const P=L.hiP||null;if(!P&&(L.canvas===L.hiC||!L.hiC))return L.hi;const hit=EFF.get(L.canvas);if(hit&&hit.hi===L.hi&&hit.p===P)return hit.a;
  const w=L.canvas.width,h=L.canvas.height;if(L.hi.length!==w*h*4||(L.hiC&&(L.hiC.width!==w||L.hiC.height!==h)))return null;
  let src=L.hi,o;if(P){src=L.hi.slice();hiOver(src,P,w,h)}
  if(L.canvas===L.hiC||!L.hiC)o=src;else{o=P?src:new Uint16Array(src.length);const A=rx(L.canvas).getImageData(0,0,w,h).data,B=rx(L.hiC).getImageData(0,0,w,h).data;
  for(let i=0;i<A.length;i+=4){if(A[i]!==B[i]||A[i+1]!==B[i+1]||A[i+2]!==B[i+2]||A[i+3]!==B[i+3]){/* an 8-bit edit: add its change to the 16-bit value, so the fine detail around it survives */let v;v=src[i]+(A[i]-B[i])*257;o[i]=v<0?0:v>65535?65535:v;v=src[i+1]+(A[i+1]-B[i+1])*257;o[i+1]=v<0?0:v>65535?65535:v;v=src[i+2]+(A[i+2]-B[i+2])*257;o[i+2]=v<0?0:v>65535?65535:v;v=src[i+3]+(A[i+3]-B[i+3])*257;o[i+3]=v<0?0:v>65535?65535:v}else{o[i]=src[i];o[i+1]=src[i+1];o[i+2]=src[i+2];o[i+3]=src[i+3]}}}
  EFF.set(L.canvas,{hi:L.hi,p:P,a:o});while(EFF.size>2)EFF.delete(EFF.keys().next().value);return o}
function hiForget(){const L=AL(),c=L&&lcv(L);if(c)EFF.delete(c)}
/* 16-bit painting: a tool on a 16-bit layer computes in float from the 16-bit pixels (0..255 scale) and stores the result as HT px Uint16 tiles in L.hiP,
   copied on write, so history steps share every tile a stroke did not touch. The 8-bit canvas takes the rounded value wherever the 16-bit one changed,
   then L.hiC moves to it: there is no 8-bit change left to merge, and soft strokes keep their fractions of a level. */
const HT=256;
function hiOver(a,P,w,h){for(const[k,t]of P.t){const tx=k%65536,ty=(k-tx)/65536,x0=tx*HT,y0=ty*HT,tw=Math.min(HT,w-x0),th=Math.min(HT,h-y0);for(let r=0;r<th;r++)a.set(t.subarray(r*HT*4,(r*HT+tw)*4),((y0+r)*w+x0)*4)}}
/* call before editCanvas: the layer's pending 8-bit edits are folded into L.hi first. Returns L when the layer paints at 16 bits */
function hiTake(L){const d=S.doc;if(!L||!L.hi||L.kind!=='pixel'||!d||!L.canvas||L.canvas.width!==d.w||L.canvas.height!==d.h||L.hi.length!==d.w*d.h*4)return null;
  if(L.hiC&&L.canvas!==L.hiC){const e=effHi(L);if(!e)return null;L.hi=e;L.hiP=null}L.hiC=L.canvas;return L}
/* the 16-bit pixels of a rectangle as floats 0..255 (0 outside the layer) */
function hiRead(L,x0,y0,w,h,out){const W=L.canvas.width,H=L.canvas.height,A=L.hi,P=L.hiP&&L.hiP.t,k=1/257;out=out||new Float32Array(w*h*4);
  for(let y=0;y<h;y++){const Y=y0+y,o=y*w*4;if(Y<0||Y>=H){out.fill(0,o,o+w*4);continue}const ty=(Y/HT)|0;
    for(let x=0;x<w;){const X=x0+x;if(X<0||X>=W){const j=o+x*4;out[j]=out[j+1]=out[j+2]=out[j+3]=0;x++;continue}const tx=(X/HT)|0,e=Math.min(w,(tx+1)*HT-x0,W-x0),t=P&&P.get(ty*65536+tx);
      let si=t?((Y-ty*HT)*HT+X-tx*HT)*4:(Y*W+X)*4;const s=t||A;for(let j=o+x*4,je=o+e*4;j<je;j++)out[j]=s[si++]*k;x=e}}return out}
/* a write transaction: hiWrite(T,…) as many rectangles as needed (inside the layer; F floats 0..255, row stride fs px), then hiEnd(T) */
function hiTx(L){return{L,m:new Map(L.hiP?L.hiP.t:undefined),own:new Set(),ch:false}}
function hiWrite(T,x0,y0,w,h,F,fs){const L=T.L,W=L.canvas.width,H=L.canvas.height,A=L.hi;fs=fs||w;if(x0<0||y0<0||x0+w>W||y0+h>H||w<=0||h<=0)return;const g=rx(L.canvas),id=g.getImageData(x0,y0,w,h),c8=id.data;let any=false;
  for(let ty=(y0/HT)|0;ty*HT<y0+h;ty++)for(let tx=(x0/HT)|0;tx*HT<x0+w;tx++){const k=ty*65536+tx,X0=Math.max(x0,tx*HT),Y0=Math.max(y0,ty*HT),X1=Math.min(x0+w,(tx+1)*HT,W),Y1=Math.min(y0+h,(ty+1)*HT,H);
    let t=T.m.get(k),own=T.own.has(k);const bx=tx*HT,by=ty*HT;
    for(let Y=Y0;Y<Y1;Y++){let f=((Y-y0)*fs+X0-x0)*4,j=((Y-y0)*w+X0-x0)*4,q=((Y-by)*HT+X0-bx)*4,p=(Y*W+X0)*4;
      for(let X=X0;X<X1;X++,f+=4,j+=4,q+=4,p+=4){let v0=F[f]*257+.5,v1=F[f+1]*257+.5,v2=F[f+2]*257+.5,v3=F[f+3]*257+.5;
        v0=v0<=0?0:v0>=65535?65535:v0|0;v1=v1<=0?0:v1>=65535?65535:v1|0;v2=v2<=0?0:v2>=65535?65535:v2|0;v3=v3<=0?0:v3>=65535?65535:v3|0;
        if(t){if(v0===t[q]&&v1===t[q+1]&&v2===t[q+2]&&v3===t[q+3])continue}else if(v0===A[p]&&v1===A[p+1]&&v2===A[p+2]&&v3===A[p+3])continue;
        if(!own){const n=new Uint16Array(HT*HT*4);if(t)n.set(t);else{const tw=Math.min(HT,W-bx),th=Math.min(HT,H-by);for(let r=0;r<th;r++)n.set(A.subarray(((by+r)*W+bx)*4,((by+r)*W+bx+tw)*4),r*HT*4)}t=n;T.m.set(k,t);T.own.add(k);own=true}
        t[q]=v0;t[q+1]=v1;t[q+2]=v2;t[q+3]=v3;c8[j]=(v0*255+32895)>>>16;c8[j+1]=(v1*255+32895)>>>16;c8[j+2]=(v2*255+32895)>>>16;c8[j+3]=(v3*255+32895)>>>16;any=true}}}
  if(any){g.putImageData(id,x0,y0);T.ch=true}}
function hiEnd(T){const L=T.L;if(T.ch)L.hiP={t:T.m};L.hiC=L.canvas}
/* composite a source over the 16-bit pixels inside box b, tile by tile: src(x,y,w,h) gives straight colour 0..255 and alpha 0..1 (or null where empty);
   source-over with opacity op, or destination-out when erase, as the 8-bit canvas does */
function hiComp(L,b,src,op,erase){const W=L.canvas.width,H=L.canvas.height,x0=Math.max(0,Math.floor(b.x0)),y0=Math.max(0,Math.floor(b.y0)),x1=Math.min(W,Math.ceil(b.x1)),y1=Math.min(H,Math.ceil(b.y1)),T=hiTx(L);let F=null;
  for(let ty=(y0/HT)|0;ty*HT<y1;ty++)for(let tx=(x0/HT)|0;tx*HT<x1;tx++){const X0=Math.max(x0,tx*HT),Y0=Math.max(y0,ty*HT),w=Math.min(x1,(tx+1)*HT)-X0,h=Math.min(y1,(ty+1)*HT)-Y0;if(w<=0||h<=0)continue;
    const C=src(X0,Y0,w,h);if(!C)continue;F=hiRead(L,X0,Y0,w,h,F&&F.length===w*h*4?F:null);
    for(let j=0;j<F.length;j+=4){const sa=C[j+3]*op;if(sa<=0)continue;if(erase){F[j+3]*=1-sa;continue}
      if(F[j+3]>=255){const t=1-sa;F[j]=C[j]*sa+F[j]*t;F[j+1]=C[j+1]*sa+F[j+1]*t;F[j+2]=C[j+2]*sa+F[j+2]*t;continue}
      const da=F[j+3]/255,oa=sa+da*(1-sa),t=da*(1-sa);F[j]=(C[j]*sa+F[j]*t)/oa;F[j+1]=(C[j+1]*sa+F[j+1]*t)/oa;F[j+2]=(C[j+2]*sa+F[j+2]*t)/oa;F[j+3]=oa*255}
    hiWrite(T,X0,Y0,w,h,F)}hiEnd(T)}
/* source for hiComp from an 8-bit canvas: its alpha, with a flat colour col ([r,g,b]), the colours of cs(x,y,w,h) (floats), or its own colours */
function hiSrc(m,col,cs){const g=rx(m);return(x,y,w,h)=>{const a=g.getImageData(x,y,w,h).data;let any=false;for(let j=3;j<a.length;j+=4)if(a[j]){any=true;break}if(!any)return null;
  const o=new Float32Array(a.length),C=cs?cs(x,y,w,h):null;for(let j=0;j<a.length;j+=4){if(!a[j+3])continue;o[j+3]=a[j+3]/255;if(col){o[j]=col[0];o[j+1]=col[1];o[j+2]=col[2]}else if(C){o[j]=C[j];o[j+1]=C[j+1];o[j+2]=C[j+2]}else{o[j]=a[j];o[j+1]=a[j+1];o[j+2]=a[j+2]}}return o}}
const hexRGB=h=>{const n=parseInt(String(h).slice(1),16);return[n>>16&255,n>>8&255,n&255]};
/* stroke-time float copy of the 16-bit pixels (tiles loaded on demand) for tools that read what they just painted (smudge); commit() stores it */
function hiWork(L){const m=new Map(),W=L.canvas.width,H=L.canvas.height,tile=k=>{let t=m.get(k);if(!t){const tx=k%65536,ty=(k-tx)/65536;t=hiRead(L,tx*HT,ty*HT,HT,HT);m.set(k,t)}return t};
  const walk=(x0,y0,w,h,F,put)=>{for(let y=0;y<h;y++){const Y=y0+y;if(Y<0||Y>=H)continue;const ty=(Y/HT)|0;for(let x=0;x<w;){const X=x0+x;if(X<0||X>=W){x++;continue}const tx=(X/HT)|0,e=Math.min(w,(tx+1)*HT-x0,W-x0),t=tile(ty*65536+tx);
    let q=((Y-ty*HT)*HT+X-tx*HT)*4;for(let j=(y*w+x)*4,je=(y*w+e)*4;j<je;j++,q++){if(put)t[q]=F[j];else F[j]=t[q]}x=e}}};
  return{L,get(x0,y0,w,h,F){F=F||new Float32Array(w*h*4);walk(x0,y0,w,h,F,false);return F},set(x0,y0,w,h,F){walk(x0,y0,w,h,F,true)},
    commit(){const T=hiTx(L);for(const[k,t]of m){const tx=k%65536,ty=(k-tx)/65536;hiWrite(T,tx*HT,ty*HT,Math.min(HT,W-tx*HT),Math.min(HT,H-ty*HT),t,HT)}hiEnd(T);m.clear()}}}
/* half-size pyramid of a Uint16 RGBA image, for zoomed-out views */
const HIMIP=new WeakMap();
function hiLevel(a,w,h,scale){let lv=HIMIP.get(a);if(!lv){lv=[];HIMIP.set(a,lv)}let cur={a,w,h},k=0;while(scale<0.5/(1<<k)&&cur.w>64&&cur.h>64){let n=lv[k];
    if(!n){const W=cur.w>>1,H=cur.h>>1,o=new Uint16Array(W*H*4),s=cur.a,sw=cur.w;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=((2*y)*sw+2*x)*4,q=p+sw*4,j=(y*W+x)*4;for(let c=0;c<4;c++)o[j+c]=(s[p+c]+s[p+4+c]+s[q+c]+s[q+4+c]+2)>>2}n=lv[k]={a:o,w:W,h:H}}
    cur=n;k++}return{...cur,f:w/cur.w}}
/* sample a Uint16 RGBA doc image through doc->target matrix T into a bottom-up Float32 buffer (0..1), bilinear */
function sampleHi(a,dw,dh,T,W,H,dx,dy,out){const sc=Math.sqrt(Math.abs(T[0]*T[3]-T[1]*T[2])),lv=hiLevel(a,dw,dh,sc),A=lv.a,lw=lv.w,lh=lv.h,f=lv.f;out=out||new Float32Array(W*H*4);
  const M=new DOMMatrix(T).inverse(),k=1/65535;
  if(T[0]===1&&T[3]===1&&!T[1]&&!T[2]&&f===1&&Number.isInteger(T[4]+dx)&&Number.isInteger(T[5]+dy)){const ox=-(T[4]+dx),oy=-(T[5]+dy);
    for(let y=0;y<H;y++){const sy=y+oy,row=(H-1-y)*W*4;if(sy<0||sy>=lh){out.fill(0,row,row+W*4);continue}for(let x=0;x<W;x++){const sx=x+ox,j=row+x*4;if(sx<0||sx>=lw){out[j]=out[j+1]=out[j+2]=out[j+3]=0;continue}const p=(sy*lw+sx)*4;out[j]=A[p]*k;out[j+1]=A[p+1]*k;out[j+2]=A[p+2]*k;out[j+3]=A[p+3]*k}}return out}
  for(let y=0;y<H;y++){const row=(H-1-y)*W*4;for(let x=0;x<W;x++){const px=x+0.5,py=y+0.5;let u=(M.a*px+M.c*py+M.e-dx)/f-0.5,v=(M.b*px+M.d*py+M.f-dy)/f-0.5;const j=row+x*4;
      if(u<-0.5||v<-0.5||u>lw-0.5||v>lh-0.5){out[j]=out[j+1]=out[j+2]=out[j+3]=0;continue}if(u<0)u=0;if(v<0)v=0;if(u>lw-1)u=lw-1;if(v>lh-1)v=lh-1;
      const x0=u|0,y0=v|0,x1=x0+1<lw?x0+1:x0,y1=y0+1<lh?y0+1:y0,fx=u-x0,fy=v-y0,p00=(y0*lw+x0)*4,p10=(y0*lw+x1)*4,p01=(y1*lw+x0)*4,p11=(y1*lw+x1)*4,w00=(1-fx)*(1-fy)*k,w10=fx*(1-fy)*k,w01=(1-fx)*fy*k,w11=fx*fy*k;
      out[j]=A[p00]*w00+A[p10]*w10+A[p01]*w01+A[p11]*w11;out[j+1]=A[p00+1]*w00+A[p10+1]*w10+A[p01+1]*w01+A[p11+1]*w11;out[j+2]=A[p00+2]*w00+A[p10+2]*w10+A[p01+2]*w01+A[p11+2]*w11;out[j+3]=A[p00+3]*w00+A[p10+3]*w10+A[p01+3]*w01+A[p11+3]*w11}}return out}
/* geometric ops: transform L.hi with the same matrix as the canvas (doc -> new doc) */
let TFM=null;
function hiXform(L,eff,ow,oh,nw,nh,M){if(!eff){L.hi=null;L.hiP=null;L.hiC=null;return}const F=sampleHi(eff,ow,oh,[M.a,M.b,M.c,M.d,M.e,M.f],nw,nh,0,0),o=new Uint16Array(nw*nh*4);
  for(let y=0;y<nh;y++){const r=(nh-1-y)*nw*4,q=y*nw*4;for(let i=0;i<nw*4;i++){const v=F[r+i];o[q+i]=v<=0?0:v>=1?65535:(v*65535+0.5)|0}}L.hi=o;L.hiP=null;L.hiC=L.canvas}
/* float buffers (bottom-up) <-> 8-bit */
function floatFromCanvas(c,W,H,out){const a=rx(c).getImageData(0,0,W,H).data;out=out||new Float32Array(W*H*4);const k=1/255;for(let y=0;y<H;y++){const r=(H-1-y)*W*4,q=y*W*4;for(let i=0;i<W*4;i++)out[r+i]=a[q+i]*k}return out}
let ditherSeed=1;
function floatToCtx(F,tc,W,H){const id=tc.createImageData(W,H),o=id.data;let s=ditherSeed;for(let y=0;y<H;y++){const r=(H-1-y)*W*4,q=y*W*4;for(let i=0;i<W*4;i++){s=(s*1103515245+12345)&0x7fffffff;const v=F[r+i]*255+((s>>>8)&255)/256;o[q+i]=v<=0?0:v>=255?255:v|0}}
  ditherSeed=s;tc.setTransform(1,0,0,1,0,0);tc.globalAlpha=1;tc.globalCompositeOperation='source-over';tc.putImageData(id,0,0)}
function overF(F,src,W,H,op){/* straight-alpha source-over of an 8-bit top-down RGBA onto F */const k=1/255;for(let y=0;y<H;y++){const r=(H-1-y)*W*4,q=y*W*4;for(let x=0;x<W*4;x+=4){const sa=src[q+x+3]*k*op;if(sa<=0)continue;const j=r+x,da=F[j+3],oa=sa+da*(1-sa),t=da*(1-sa);
      F[j]=(src[q+x]*k*sa+F[j]*t)/oa;F[j+1]=(src[q+x+1]*k*sa+F[j+1]*t)/oa;F[j+2]=(src[q+x+2]*k*sa+F[j+2]*t)/oa;F[j+3]=oa}}}
function overFF(F,S2,W,H,op){for(let j=0;j<F.length;j+=4){const sa=S2[j+3]*op;if(sa<=0)continue;const da=F[j+3],oa=sa+da*(1-sa),t=da*(1-sa);F[j]=(S2[j]*sa+F[j]*t)/oa;F[j+1]=(S2[j+1]*sa+F[j+1]*t)/oa;F[j+2]=(S2[j+2]*sa+F[j+2]*t)/oa;F[j+3]=oa}}
function devFloat(F,W,H,L,mc,o){const po={scale:o.scale,ox:o.ox,oy:o.oy,docW:S.doc.w,docH:S.doc.h};
  if(GPU.ok&&GPU.float&&W<=GPU.max&&H<=GPU.max)return GPU.develop({f32:F,width:W,height:H},L.dev,mc,L.opacity,po);
  /* CPU: top-down 0..255 floats */const T=new Float32Array(F.length);for(let y=0;y<H;y++){const r=(H-1-y)*W*4,q=y*W*4;for(let i=0;i<W*4;i++)T[q+i]=F[r+i]*255}
  developCPU({data:T,width:W,height:H},L.dev,po,mc?rx(mc).getImageData(0,0,W,H).data:null,L.opacity);for(let y=0;y<H;y++){const r=(H-1-y)*W*4,q=y*W*4;for(let i=0;i<W*4;i++)F[r+i]=T[q+i]/255}return F}
const FCACHE={key:'',F:null};
const renderStack8=renderStack;
PREC.ms=0;PREC.t=null;PREC.refining=false;
renderStack=function(tc,W,H,T,o){const d=S.doc;if(o.before||!d||!(precOK()||(o.want16&&docHasHi(d)))||W*H>36e6)return renderStack8(tc,W,H,T,o);
  const view=tc.canvas===work||tc.canvas===workB;
  if(view&&(PREC.ms>45||S.stroke||S.drag||S.sliding)&&!PREC.refining){renderStack8(tc,W,H,T,o);clearTimeout(PREC.t);
    const refine=()=>{if(!S.doc)return;if(S.stroke||S.drag||S.sliding){PREC.t=setTimeout(refine,220);return}PREC.refining=true;try{S.contentDirty=true;render()}finally{PREC.refining=false}};PREC.t=setTimeout(refine,260);return}
  const t0=performance.now();try{renderStackF(tc,W,H,T,o)}catch(e){console.warn('précision 16 bits désactivée',e);PREC.fail=true;return renderStack8(tc,W,H,T,o)}if(view)PREC.ms=performance.now()-t0};
function renderStackF(tc,W,H,T,o){const d=S.doc,upto=o.upto==null?d.layers.length:o.upto;let F=null,i0=0,empty=true;
  tc.setTransform(1,0,0,1,0,0);tc.globalAlpha=1;tc.globalCompositeOperation='source-over';tc.clearRect(0,0,W,H);
  if(o.cacheIdx!=null&&o.cacheKey&&FCACHE.key===o.cacheKey+'|F'&&FCACHE.F&&FCACHE.F.length===W*H*4){F=FCACHE.F.slice();i0=o.cacheIdx;empty=false}
  const flush=()=>{if(F){floatToCtx(F,tc,W,H);F=null}};
  for(let i=i0;i<upto;i++){
    if(o.cacheIdx!=null&&o.cacheKey&&i===o.cacheIdx&&i0!==o.cacheIdx){FCACHE.key=o.cacheKey+'|F';FCACHE.F=F?F.slice():null}
    const L=d.layers[i];if(!L.visible)continue;
    if(L.kind==='adjust'){if(devIsId(L.dev))continue;const ms=maskSrc(L);let mc=null;if(ms){mc=scr('am',W,H);const g=cx(mc);g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);g.imageSmoothingEnabled=true;g.setTransform(...T);drawMip(g,ms,0,0,o.scale,ms===L.mask);g.setTransform(1,0,0,1,0,0)}
      if(empty)continue;if(!F)F=floatFromCanvas(tc.canvas,W,H);F=devFloat(F,W,H,L,mc,o);continue}
    const src=layerSrc(L),ms=L.mask?maskSrc(L):null,dx=L.dx||0,dy=L.dy||0,wasEmpty=empty;
    empty=false;let S2=null;const eh=src===lcv(L)?effHi(L):null;
    if(eh){S2=sampleHi(eh,d.w,d.h,T,W,H,dx,dy);if(ms){const t=scr('lm',W,H),g=rx(t);g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);g.setTransform(...T);drawMip(g,ms,dx,dy,o.scale,ms===L.mask);g.setTransform(1,0,0,1,0,0);const m=g.getImageData(0,0,W,H).data;
        for(let y=0;y<H;y++){const r=(H-1-y)*W*4,q=y*W*4;for(let x=3;x<W*4;x+=4)S2[r+x]*=m[q+x]/255}}}
    else{const t=scr('lf',W,H),g=rx(t);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.imageSmoothingEnabled=o.scale<2;g.imageSmoothingQuality='high';g.setTransform(...T);drawMip(g,src,dx,dy,o.scale,src===lcv(L)||src.__fx);
      if(ms){g.globalCompositeOperation='destination-in';g.imageSmoothingEnabled=true;drawMip(g,ms,dx,dy,o.scale,ms===L.mask);g.globalCompositeOperation='source-over'}g.setTransform(1,0,0,1,0,0);
      if(L.blend==='source-over'&&F){overF(F,g.getImageData(0,0,W,H).data,W,H,L.opacity);continue}
      S2=floatFromCanvas(t,W,H)}
    if(L.blend!=='source-over'){if(!F)F=wasEmpty?new Float32Array(W*H*4):floatFromCanvas(tc.canvas,W,H);blendFF(F,S2,L.blend,L.opacity);continue}
    if(!F&&wasEmpty){F=S2;if(L.opacity<1)for(let j=3;j<F.length;j+=4)F[j]*=L.opacity;continue}if(!F)F=wasEmpty?new Float32Array(W*H*4):floatFromCanvas(tc.canvas,W,H);overFF(F,S2,W,H,L.opacity)}
  if(o.keepF)o.F=F||floatFromCanvas(tc.canvas,W,H);flush()}


/* blend modes in 32-bit float (W3C compositing, on the same gamma-encoded values the 8-bit canvas path uses) */
const _lum=(r,g,b)=>0.3*r+0.59*g+0.11*b;
function _clip(c){const l=_lum(c[0],c[1],c[2]),n=Math.min(c[0],c[1],c[2]),x=Math.max(c[0],c[1],c[2]);if(n<0){const k=l/(l-n);for(let i=0;i<3;i++)c[i]=l+(c[i]-l)*k}if(x>1){const k=(1-l)/(x-l);for(let i=0;i<3;i++)c[i]=l+(c[i]-l)*k}return c}
function _setLum(c,l,o){const d=l-_lum(c[0],c[1],c[2]);o[0]=c[0]+d;o[1]=c[1]+d;o[2]=c[2]+d;return _clip(o)}
const _sat=c=>Math.max(c[0],c[1],c[2])-Math.min(c[0],c[1],c[2]);
function _setSat(c,s,o){const mx=Math.max(c[0],c[1],c[2]),mn=Math.min(c[0],c[1],c[2]);if(mx>mn){const k=s/(mx-mn);o[0]=(c[0]-mn)*k;o[1]=(c[1]-mn)*k;o[2]=(c[2]-mn)*k}else o[0]=o[1]=o[2]=0;return o}
const _D=x=>x<=0.25?((16*x-12)*x+4)*x:Math.sqrt(x);
const BSEP={multiply:(b,s)=>b*s,screen:(b,s)=>b+s-b*s,overlay:(b,s)=>b<=0.5?2*b*s:1-2*(1-b)*(1-s),darken:(b,s)=>b<s?b:s,lighten:(b,s)=>b>s?b:s,
  'color-dodge':(b,s)=>b===0?0:s>=1?1:Math.min(1,b/(1-s)),'color-burn':(b,s)=>b>=1?1:s<=0?0:1-Math.min(1,(1-b)/s),'hard-light':(b,s)=>s<=0.5?2*b*s:1-2*(1-b)*(1-s),
  'soft-light':(b,s)=>s<=0.5?b-(1-2*s)*b*(1-b):b+(2*s-1)*(_D(b)-b),difference:(b,s)=>Math.abs(b-s),exclusion:(b,s)=>b+s-2*b*s,lighter:(b,s)=>Math.min(1,b+s)};
function blendFF(F,S2,mode,op){const sep=BSEP[mode],t1=[0,0,0],t2=[0,0,0],cb=[0,0,0],cs=[0,0,0],B=[0,0,0];
  for(let j=0;j<F.length;j+=4){const as=S2[j+3]*op;if(as<=0)continue;const ab=F[j+3];
    cs[0]=S2[j];cs[1]=S2[j+1];cs[2]=S2[j+2];
    if(ab<=0){F[j]=cs[0];F[j+1]=cs[1];F[j+2]=cs[2];F[j+3]=as;continue}
    cb[0]=F[j];cb[1]=F[j+1];cb[2]=F[j+2];
    if(sep){B[0]=sep(cb[0],cs[0]);B[1]=sep(cb[1],cs[1]);B[2]=sep(cb[2],cs[2])}
    else if(mode==='hue'){_setSat(cs,_sat(cb),t1);_setLum(t1,_lum(cb[0],cb[1],cb[2]),B)}
    else if(mode==='saturation'){_setSat(cb,_sat(cs),t1);_setLum(t1,_lum(cb[0],cb[1],cb[2]),B)}
    else if(mode==='color'){_setLum(cs,_lum(cb[0],cb[1],cb[2]),B)}
    else if(mode==='luminosity'){_setLum(cb,_lum(cs[0],cs[1],cs[2]),B)}
    else{B[0]=cs[0];B[1]=cs[1];B[2]=cs[2]}
    const ao=as+ab*(1-as),k1=as*(1-ab),k2=as*ab,k3=(1-as)*ab;
    F[j]=(k1*cs[0]+k2*B[0]+k3*cb[0])/ao;F[j+1]=(k1*cs[1]+k2*B[1]+k3*cb[1])/ao;F[j+2]=(k1*cs[2]+k2*B[2]+k3*cb[2])/ao;F[j+3]=ao}}

/* 16-bit render of the whole document, tiled like renderDoc: returns {data:Uint16Array top-down RGBA, w, h} */
async function renderDoc16(scale,o={}){const d=S.doc,W=Math.max(1,Math.round(d.w*scale)),H=Math.max(1,Math.round(d.h*scale)),out=new Uint16Array(W*H*4);
  let pad=0;d.layers.forEach(L=>{if(L.kind==='adjust'&&L.visible)pad=Math.max(pad,maxSigma(L.dev,d.w,d.h,scale))});pad=Math.ceil(pad*3)+(pad?4:0);
  const T0=Math.min(2048,(GPU.ok?GPU.max:4096)-2*pad-8);const nT=Math.ceil(W/T0)*Math.ceil(H/T0);let k=0;
  for(let y=0;y<H;y+=T0)for(let x=0;x<W;x+=T0){const tw=Math.min(T0,W-x),th=Math.min(T0,H-y),x0=Math.max(0,x-pad),y0=Math.max(0,y-pad),x1=Math.min(W,x+tw+pad),y1=Math.min(H,y+th+pad),w=x1-x0,h=y1-y0;
    const t=scr('tile',w,h),g=cx(t),ro={scale,ox:-x0,oy:-y0,want16:true,keepF:true};renderStack(g,w,h,[scale,0,0,scale,-x0,-y0],ro);
    let F=ro.F;if(!F){const a=rx(t).getImageData(0,0,w,h).data;F=new Float32Array(w*h*4);for(let yy=0;yy<h;yy++)for(let i=0;i<w*4;i++)F[(h-1-yy)*w*4+i]=a[yy*w*4+i]/255}
    for(let yy=0;yy<th;yy++){const sr=(h-1-(yy+y-y0))*w*4+(x-x0)*4,dr=((y+yy)*W+x)*4;for(let i=0;i<tw*4;i++){const v=F[sr+i];out[dr+i]=v<=0?0:v>=1?65535:(v*65535+0.5)|0}}
    k++;o.progress&&o.progress(k/nT);await tick()}
  return{data:out,w:W,h:H}}

