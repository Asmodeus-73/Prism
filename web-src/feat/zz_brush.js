/* ===== 0.4: Densité (éclaircir, assombrir, saturer, désaturer, goutte d'eau, netteté) rebuilt.
   Before, every dab re-processed the pixels the previous dab had just changed: the effect compounded with the speed of the hand,
   8-bit rounding piled up into blotches in dark areas, and Netteté amplified its own output into a pixel grid along edges.
   Now a stroke only paints a coverage map (0..1, building up like flow), and every pixel is recomputed from the photo as it was
   before the stroke: the same pixel never gets processed twice within a stroke, whatever the speed or the number of passes.
   Netteté is an unsharp mask on luminance (no colour fringes), with a noise threshold and a halo clamp to the local range. ===== */

const BR={pre:null,T:128};
const _bsBR=beginStroke;
beginStroke=function(p,e){
  let L0=null;try{L0=S.tool==='dodge'&&S.doc?pixelTarget():null}catch(err){}
  BR.pre=L0?L0.canvas:null;
  try{const r=_bsBR.apply(this,arguments);const st=S.stroke;if(st&&st.tool==='dodge'&&BR.pre&&!st.base&&st.layer.canvas!==BR.pre)st.base=BR.pre;return r}
  finally{BR.pre=null}};

const _pdBR=pixelDab;
function accTile(st,tx,ty){const k=ty*65536+tx;let t=st.acc.get(k);if(!t){t=new Float32Array(BR.T*BR.T);st.acc.set(k,t)}return t}
function gaussK(s){const r=Math.max(1,Math.ceil(s*3)),k=new Float32Array(2*r+1);let t=0;for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*s*s));k[i+r]=v;t+=v}for(let i=0;i<k.length;i++)k[i]/=t;return k}
// separable gaussian of nch planes (Float32Array each) of size w*h
function blurPlanes(P,w,h,s){const k=gaussK(s),r=(k.length-1)/2,tmp=new Float32Array(w*h);
  for(const A of P){
    for(let y=0;y<h;y++){const o=y*w;for(let x=0;x<w;x++){let v=0;for(let i=-r;i<=r;i++){const X=x+i<0?0:x+i>=w?w-1:x+i;v+=A[o+X]*k[i+r]}tmp[o+x]=v}}
    for(let x=0;x<w;x++)for(let y=0;y<h;y++){let v=0;for(let i=-r;i<=r;i++){const Y=y+i<0?0:y+i>=h?h-1:y+i;v+=tmp[Y*w+x]*k[i+r]}A[y*w+x]=v}}
  return P}

const sigOf=(mode,o,d)=>mode==='sharpen'?Math.max(.9,Math.min(2.2,Math.max(d.w,d.h)/4000)):Math.max(1.2,Math.min(10,o.size/36));
// the result for the pixels of a rectangle (x0,y0,w,h), from the photo as it was before the stroke (B: RGBA over bx0,by0,bw,bh, 8-bit or float 0..255)
// and the coverage cov (row stride cs); circ limits it to the dab's disc
function shade(B,bx0,by0,bw,bh,x0,y0,w,h,cov,cs,out,mode,sig,circ){
  let Pb=null;
  if(mode==='blur'||mode==='sharpen'){const n=bw*bh;
    if(mode==='blur'){Pb=[new Float32Array(n),new Float32Array(n),new Float32Array(n)];for(let i=0;i<n;i++){Pb[0][i]=B[i*4];Pb[1][i]=B[i*4+1];Pb[2][i]=B[i*4+2]}}
    else{Pb=[new Float32Array(n)];for(let i=0;i<n;i++)Pb[0][i]=0.2126*B[i*4]+0.7152*B[i*4+1]+0.0722*B[i*4+2]}
    blurPlanes(Pb,bw,bh,sig)}
  const EV=0.85,amt=1.2,thr=4,OV=4;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const X=x0+x,Y=y0+y;if(circ){const dx=X+.5-circ.x,dy=Y+.5-circ.y;if(dx*dx+dy*dy>=circ.r*circ.r)continue}
    const c=cov[y*cs+x],j=(y*w+x)*4,bi=(Y-by0)*bw+(X-bx0),k=bi*4;
    const R=B[k],G=B[k+1],Bl=B[k+2];out[j+3]=B[k+3];
    if(c<=0){out[j]=R;out[j+1]=G;out[j+2]=Bl;continue}
    if(mode==='dodge'||mode==='burn'){const gm=mode==='dodge'?1/(1+c*EV):1+c*EV;out[j]=255*Math.pow(R/255,gm);out[j+1]=255*Math.pow(G/255,gm);out[j+2]=255*Math.pow(Bl/255,gm)}
    else if(mode==='saturate'||mode==='desaturate'){const l=0.2126*R+0.7152*G+0.0722*Bl,f=mode==='saturate'?1+c*0.9:1-c;out[j]=l+(R-l)*f;out[j+1]=l+(G-l)*f;out[j+2]=l+(Bl-l)*f}
    else if(mode==='blur'){out[j]=R+(Pb[0][bi]-R)*c;out[j+1]=G+(Pb[1][bi]-G)*c;out[j+2]=Bl+(Pb[2][bi]-Bl)*c}
    else{const l=0.2126*R+0.7152*G+0.0722*Bl;let det=l-Pb[0][bi];const ad=Math.abs(det);
      if(ad<=thr){out[j]=R;out[j+1]=G;out[j+2]=Bl;continue}
      det=Math.sign(det)*(ad-thr)*Math.min(1,(ad-thr)/6);let dd=det*amt*c;
      // halo clamp: never beyond the 3x3 range of the original photo (plus a few levels)
      let mn=255,mx=0;const lx=X-bx0,ly=Y-by0;
      for(let yy=-1;yy<=1;yy++){const YY=ly+yy;if(YY<0||YY>=bh)continue;for(let xx=-1;xx<=1;xx++){const XX=lx+xx;if(XX<0||XX>=bw)continue;const kk=(YY*bw+XX)*4,v=0.2126*B[kk]+0.7152*B[kk+1]+0.0722*B[kk+2];if(v<mn)mn=v;if(v>mx)mx=v}}
      if(l+dd>mx+OV)dd=Math.max(0,mx+OV-l);else if(l+dd<mn-OV)dd=Math.min(0,mn-OV-l);
      out[j]=R+dd;out[j+1]=G+dd;out[j+2]=Bl+dd}}}
const margin=(mode,sig)=>mode==='blur'||mode==='sharpen'?Math.ceil(sig*3)+2:0;
// a 16-bit layer (st.hiL) reads the photo before the stroke from its 16-bit pixels: the canvas shows the result rounded, and the stroke's end stores it at 16 bits
const baseOf=(st,x,y,w,h)=>st.hiL?hiRead(st.hiL,x,y,w,h):st.bctx.getImageData(x,y,w,h).data;

pixelDab=function(st,p){
  const d=S.doc,o=S.opts.dodge,mode=o.mode;
  if(!st.base){const c=BR.pre;if(!c||!st.layer||st.layer.canvas===c)return _pdBR.apply(this,arguments);st.base=c}
  if(!st.acc){st.acc=new Map();st.bctx=rx(st.base)}
  const r=o.size/2,x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(d.w,Math.ceil(p.x+r)),y1=Math.min(d.h,Math.ceil(p.y+r));if(x1<=x0||y1<=y0)return;
  const w=x1-x0,h=y1-y0;
  // per-dab amount: about five dabs overlap each pixel (spacing 20 % of the size); one pass at strength s gives about s at the centre
  const s=Math.min(.97,Math.max(.01,o.strength)),a0=1-Math.pow(1-s,1/2.6);
  const sel=st.selC?st.selC.getImageData(x0,y0,w,h).data:null;
  const sig=sigOf(mode,o,d);
  const m=margin(mode,sig),bx0=Math.max(0,x0-m),by0=Math.max(0,y0-m),bw=Math.min(d.w,x1+m)-bx0,bh=Math.min(d.h,y1+m)-by0;
  const B=baseOf(st,bx0,by0,bw,bh);
  // coverage update
  const cov=new Float32Array(w*h),T=BR.T;
  for(let y=0;y<h;y++){const Y=y0+y,ty=(Y/T)|0,ly=Y-ty*T;let tile=null,ttx=-1;
    for(let x=0;x<w;x++){const X=x0+x,dx=X+.5-p.x,dy=Y+.5-p.y,q=(dx*dx+dy*dy)/(r*r);
      const tx=(X/T)|0;if(tx!==ttx){ttx=tx;tile=null}
      if(q>=1){if(!tile)tile=st.acc.get(ty*65536+tx)||null;cov[y*w+x]=tile?tile[ly*T+(X-tx*T)]:0;continue}
      let f=(1-q);f*=f;if(sel)f*=sel[(y*w+x)*4+3]/255;
      if(mode!=='blur'&&mode!=='sharpen'){const j=((Y-by0)*bw+(X-bx0))*4;f*=toneW(B[j],B[j+1],B[j+2])}
      if(!tile)tile=accTile(st,tx,ty);const ii=ly*T+(X-tx*T);let a=tile[ii];if(f>0.0005){a+=a0*f*(1-a);tile[ii]=a}cov[y*w+x]=a}}
  // result, always from the photo as it was before the stroke
  const img=st.ctx.getImageData(x0,y0,w,h);
  shade(B,bx0,by0,bw,bh,x0,y0,w,h,cov,w,img.data,mode,sig,{x:p.x,y:p.y,r});
  st.ctx.putImageData(img,x0,y0)};
// end of a stroke on a 16-bit layer: every pixel the coverage reached, recomputed in float and stored at 16 bits
const _esBR=endStroke;
endStroke=function(){const st=S.stroke;
  if(st&&st.tool==='dodge'&&st.hiL&&st.acc&&st.layer===st.hiL){try{const d=S.doc,o=S.opts.dodge,mode=o.mode,sig=sigOf(mode,o,d),m=margin(mode,sig),T=BR.T,X=hiTx(st.hiL);
    for(const[k,cv]of st.acc){const tx=k%65536,ty=(k-tx)/65536,x0=tx*T,y0=ty*T,w=Math.min(T,d.w-x0),h=Math.min(T,d.h-y0);if(w<=0||h<=0)continue;
      const bx0=Math.max(0,x0-m),by0=Math.max(0,y0-m),bw=Math.min(d.w,x0+w+m)-bx0,bh=Math.min(d.h,y0+h+m)-by0,out=new Float32Array(w*h*4);
      shade(hiRead(st.hiL,bx0,by0,bw,bh),bx0,by0,bw,bh,x0,y0,w,h,cv,T,out,mode,sig,null);hiWrite(X,x0,y0,w,h,out)}
    hiEnd(X)}catch(e){console.warn(e)}}
  return _esBR.apply(this,arguments)};
