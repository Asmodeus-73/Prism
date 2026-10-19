/* ================= develop model ================= */
const DEV0=()=>({temp:0,tint:0,exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,texture:0,clarity:0,dehaze:0,vibrance:0,saturation:0,
  curve:{rgb:[[0,0],[1,1]],r:[[0,0],[1,1]],g:[[0,0],[1,1]],b:[[0,0],[1,1]]},hslH:[0,0,0,0,0,0,0,0],hslS:[0,0,0,0,0,0,0,0],hslL:[0,0,0,0,0,0,0,0],
  shH:215,shS:0,midH:30,midS:0,hiH:45,hiS:0,balance:0,sharpen:0,sharpRadius:1,noise:0,vignette:0,vigMid:50,vigFeather:50,grain:0,grainSize:25});
const DEV_ID=JSON.stringify(DEV0());const devIsId=d=>JSON.stringify(d)===DEV_ID;
function curveFn(pts){const p=pts.slice().sort((a,b)=>a[0]-b[0]),m=p.length,xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);const dx=[],ms=[];for(let i=0;i<m-1;i++){dx[i]=xs[i+1]-xs[i];ms[i]=dx[i]>1e-6?(ys[i+1]-ys[i])/dx[i]:0}
  const c1=[ms[0]];for(let i=1;i<m-1;i++){const a=ms[i-1],b=ms[i];if(a*b<=0)c1.push(0);else{const cm=dx[i-1]+dx[i];c1.push(3*cm/((cm+dx[i])/a+(cm+dx[i-1])/b))}}c1.push(ms[m-2]);
  const c2=[],c3=[];for(let i=0;i<m-1;i++){const c=c1[i],inv=1/(dx[i]||1),cm=c+c1[i+1]-2*ms[i];c2[i]=(ms[i]-c-cm)*inv;c3[i]=cm*inv*inv}
  return x=>{if(x<=xs[0])return ys[0];if(x>=xs[m-1])return ys[m-1];let i=0;while(i<m-2&&x>xs[i+1])i++;const t=x-xs[i];return clamp(ys[i]+c1[i]*t+c2[i]*t*t+c3[i]*t*t*t,0,1)}}
const isIdCurve=p=>p.length===2&&p[0][0]===0&&p[0][1]===0&&p[1][0]===1&&p[1][1]===1;
const lutMap=new Map();
function getLUTs(dv){const key=JSON.stringify([dv.temp,dv.tint,dv.exposure,dv.contrast,dv.highlights,dv.shadows,dv.whites,dv.blacks,dv.dehaze,dv.curve]);let r=lutMap.get(key);if(r)return r;
  const t=dv.temp/100,ti=dv.tint/100;let g=[1+0.3*t,1-0.22*ti,1-0.3*t];const nrm=0.2126*g[0]+0.7152*g[1]+0.0722*g[2];g=g.map(v=>v/nrm);
  const ev=Math.pow(2,dv.exposure),hl=dv.highlights/100,sh=dv.shadows/100,wh=dv.whites/100,bl=dv.blacks/100,dh=dv.dehaze/100,c=dv.contrast/100+dh*0.35,k=c>=0?1+c*1.5:1+c*0.65;
  const mf=isIdCurve(dv.curve.rgb)?null:curveFn(dv.curve.rgb);
  r=['r','g','b'].map((ch,ci)=>{const L=new Float32Array(4096),gain=g[ci]*ev,knee=gain>1?1-Math.min(0.3,(gain-1)*0.35):1,cf=isIdCurve(dv.curve[ch])?null:curveFn(dv.curve[ch]);
    for(let i=0;i<4096;i++){let x=i/4095;if(dh>0)x=(x-0.1*dh)/(1-0.1*dh);else if(dh<0)x=x+(0.78-x)*(-dh)*0.35;if(x<0)x=0;x=Math.pow(Math.pow(x,2.2)*gain,1/2.2);
      if(x>knee&&knee<1)x=knee+(1-knee)*(1-Math.exp(-(x-knee)/(1-knee)));if(x>1)x=1;
      x+=sh*1.35*x*(1-x)*(1-x);x+=hl*1.35*x*x*(1-x);x+=wh*0.25*x*x*x;x+=bl*0.2*(1-x)*(1-x)*(1-x);x=clamp(x,0,1);
      if(k!==1)x=x<0.5?0.5*Math.pow(2*x,k):1-0.5*Math.pow(2-2*x,k);if(mf)x=mf(x);if(cf)x=cf(x);L[i]=x}return L});
  if(lutMap.size>24)lutMap.delete(lutMap.keys().next().value);lutMap.set(key,r);return r}
const HSL_C=[0,30,60,120,180,240,275,310];const hslMap=new Map();
function getHSLT(dv){const key=dv.hslH.join()+'|'+dv.hslS.join()+'|'+dv.hslL.join();if(hslMap.has(key))return hslMap.get(key);let t=null;
  if(dv.hslH.some(v=>v)||dv.hslS.some(v=>v)||dv.hslL.some(v=>v)){const H=new Float32Array(360),Sa=new Float32Array(360),Lu=new Float32Array(360);
    for(let h=0;h<360;h++){let i=7;for(let j=0;j<8;j++){const nx=j<7?HSL_C[j+1]:360;if(h>=HSL_C[j]&&h<nx){i=j;break}}const a=HSL_C[i],b=i<7?HSL_C[i+1]:360,tt=(h-a)/(b-a),i2=(i+1)%8;
      H[h]=((1-tt)*dv.hslH[i]+tt*dv.hslH[i2])/100*30;Sa[h]=((1-tt)*dv.hslS[i]+tt*dv.hslS[i2])/100;Lu[h]=((1-tt)*dv.hslL[i]+tt*dv.hslL[i2])/100*0.45}t={H,Sa,Lu}}
  if(hslMap.size>24)hslMap.delete(hslMap.keys().next().value);hslMap.set(key,t);return t}
function hue2(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p}
function hsl2rgbA(h,s,l){if(s===0)return[l,l,l];const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;return[hue2(p,q,h+1/3),hue2(p,q,h),hue2(p,q,h-1/3)]}
function hueOff(h){const c=hsl2rgbA(h/360,1,0.5),l=0.2126*c[0]+0.7152*c[1]+0.0722*c[2];return[c[0]-l,c[1]-l,c[2]-l]}
function devParams(dv,o){const short=Math.min(o.docW,o.docH),sc=o.scale;const p={cl:dv.clarity/100,tx:dv.texture/100,sp:dv.sharpen/100,nr:dv.noise/100,sat:dv.saturation/100,vib:dv.vibrance/100,dhs:dv.dehaze/100*0.25,
  sigC:Math.max(0.6,short*0.012*sc),sigT:Math.max(0.5,3.5*sc),sigS:Math.max(0.4,dv.sharpRadius*sc),sigN:Math.max(0.5,1.6*sc),
  bal:dv.balance/100*0.3,vg:dv.vignette/100,r0:dv.vigMid/100*0.75,gr:dv.grain/100*0.2,gs:0.6+dv.grainSize/20};p.r1=p.r0+0.08+dv.vigFeather/100*0.85;
  p.grade=!!(dv.shS||dv.midS||dv.hiS);p.so=hueOff(dv.shH).map(v=>v*dv.shS/100*0.32);p.mo=hueOff(dv.midH).map(v=>v*dv.midS/100*0.25);p.ho=hueOff(dv.hiH).map(v=>v*dv.hiS/100*0.28);return p}
function maxSigma(dv,docW,docH,scale){if(!dv)return 0;let s=0;if(dv.clarity)s=Math.max(s,Math.min(docW,docH)*0.012*scale);if(dv.texture)s=Math.max(s,3.5*scale);if(dv.sharpen)s=Math.max(s,dv.sharpRadius*scale);if(dv.noise)s=Math.max(s,1.6*scale);return s}
/* CPU version (fallback and small thumbnails) */
function lerpL(L,v){if(v<=0)return L[0];if(v>=1)return L[4095];const f=v*4095,i=f|0;return L[i]+(L[i+1]-L[i])*(f-i)}
function developCPU(img,dv,o,mask,opacity){const FLT=img.data instanceof Float32Array,d=img.data,W=img.width,Hh=img.height,N=W*Hh;const orig=(mask||opacity<1)?d.slice():null;const [Lr,Lg,Lb]=getLUTs(dv),P=devParams(dv,o);
  let Y=null,Bc,Bt,Bs,Bn,Bnr,Bng,Bnb;if(P.cl||P.tx||P.sp||P.nr){Y=new Float32Array(N);for(let i=0,j=0;i<N;i++,j+=4)Y[i]=(0.2126*d[j]+0.7152*d[j+1]+0.0722*d[j+2])/255;if(P.cl)Bc=gaussF(Y,W,Hh,P.sigC);if(P.tx)Bt=gaussF(Y,W,Hh,P.sigT);if(P.sp)Bs=gaussF(Y,W,Hh,P.sigS);if(P.nr){Bn=gaussF(Y,W,Hh,P.sigN);const chn=k=>{const a=new Float32Array(N);for(let i=0,j=k;i<N;i++,j+=4)a[i]=d[j]/255;return gaussF(a,W,Hh,P.sigN)};Bnr=chn(0);Bng=chn(1);Bnb=chn(2)}}
  const HT=getHSLT(dv),doSat=P.sat||P.vib||P.dhs,sc=o.scale,hw=o.docW/2,hh=o.docH/2;
  for(let y=0,i=0;y<Hh;y++){const vy=((y+0.5-o.oy)/sc-hh)/hh,vy2=vy*vy,docY=(y+0.5-o.oy)/sc;for(let x=0;x<W;x++,i++){const j=i*4;let r=d[j]/255,g=d[j+1]/255,b=d[j+2]/255;
    if(Y){const yy=Y[i];let dy=0;if(P.cl){const m=1-Math.abs(2*yy-1);dy+=P.cl*1.1*(yy-Bc[i])*(0.25+0.75*m)}if(P.tx)dy+=P.tx*1.3*(yy-Bt[i]);if(P.sp)dy+=P.sp*1.8*(yy-Bs[i]);if(P.nr){const df=yy-Bn[i],e=Math.min(1,Math.abs(df)*14);dy-=P.nr*df*(1-e);const bl=0.2126*Bnr[i]+0.7152*Bng[i]+0.0722*Bnb[i],cr=r-yy,cg=g-yy,cb2=b-yy,br=Bnr[i]-bl,bg=Bng[i]-bl,bb=Bnb[i]-bl,dc=Math.hypot(cr-br,cg-bg,cb2-bb),tt=clamp((dc-0.04)/0.08,0,1),wn=Math.min(1,P.nr*1.2)*(1-tt*tt*(3-2*tt));r+=(br-cr)*wn;g+=(bg-cg)*wn;b+=(bb-cb2)*wn}r+=dy;g+=dy;b+=dy}
    r=lerpL(Lr,r);g=lerpL(Lg,g);b=lerpL(Lb,b);
    if(doSat){const l=0.2126*r+0.7152*g+0.0722*b;let f=1+P.sat+P.dhs;if(P.vib){const mx=Math.max(r,g,b),mn=Math.min(r,g,b);f+=P.vib*(1-(mx-mn))*(P.vib>0?1.1:1)}if(f<0)f=0;r=l+(r-l)*f;g=l+(g-l)*f;b=l+(b-l)*f}
    if(HT){r=clamp(r,0,1);g=clamp(g,0,1);b=clamp(b,0,1);const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;if(mx-mn>1e-4){const dd=mx-mn,s=l>0.5?dd/(2-mx-mn):dd/(mx+mn);let h=mx===r?(g-b)/dd+(g<b?6:0):mx===g?(b-r)/dd+2:(r-g)/dd+4;h*=60;const hi=Math.min(359,h|0),w=Math.min(1,s*2.2);
      let h2=h+HT.H[hi]*w;if(h2<0)h2+=360;if(h2>=360)h2-=360;const sa=HT.Sa[hi],c=hsl2rgbA(h2/360,clamp(s*(1+Math.max(sa,0)),0,1),clamp(l*(1+HT.Lu[hi]*w),0,1));r=c[0];g=c[1];b=c[2];if(sa<0){const yy=0.2126*r+0.7152*g+0.0722*b,f=1+sa;r=yy+(r-yy)*f;g=yy+(g-yy)*f;b=yy+(b-yy)*f}}}
    if(P.grade){const l=0.2126*r+0.7152*g+0.0722*b;const t=clamp(l+P.bal,0,1),ws=(1-t)*(1-t),wh=t*t,wm=1-ws-wh;r+=ws*P.so[0]+wm*P.mo[0]+wh*P.ho[0];g+=ws*P.so[1]+wm*P.mo[1]+wh*P.ho[1];b+=ws*P.so[2]+wm*P.mo[2]+wh*P.ho[2]}
    if(P.vg){const vx=((x+0.5-o.ox)/sc-hw)/hw,dd=Math.sqrt(vx*vx+vy2)/1.4142;let w=(dd-P.r0)/(P.r1-P.r0);if(w>0){w=w>1?1:w*w*(3-2*w);if(P.vg<0){const f=1+P.vg*w;r*=f;g*=f;b*=f}else{const f=P.vg*w;r+=(1-r)*f;g+=(1-g)*f;b+=(1-b)*f}}}
    if(P.gr){const gx=Math.floor((x+0.5-o.ox)/sc/P.gs),gy=Math.floor(docY/P.gs);let q=(gx*374761393+gy*668265263)|0;q=Math.imul(q^(q>>>13),1274126177);const n=((q^(q>>>16))&1023)/1023-0.5,l=0.2126*r+0.7152*g+0.0722*b,a=n*P.gr*(0.35+2.6*l*(1-l));r+=a;g+=a;b+=a}
    let m=1;if(orig){m=opacity*(mask?mask[j+3]/255:1)}
    r=r*255;g=g*255;b=b*255;if(m<1){r=orig[j]+(r-orig[j])*m;g=orig[j+1]+(g-orig[j+1])*m;b=orig[j+2]+(b-orig[j+2])*m}
    if(FLT){d[j]=r<=0?0:r>=255?255:r;d[j+1]=g<=0?0:g>=255?255:g;d[j+2]=b<=0?0:b>=255?255:b}else{d[j]=r<=0?0:r>=255?255:r+.5|0;d[j+1]=g<=0?0:g>=255?255:g+.5|0;d[j+2]=b<=0?0:b>=255?255:b+.5|0}}}}

