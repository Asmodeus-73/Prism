/* ================= pano: panorama pro (homographies, projection plane/cylindre, gains, raccord, multi-bandes) ================= */
(()=>{
'use strict';
const PN={opts:{proj:'auto',bands:4,tile:1024,vignette:true},last:null,tests:{}};
window.PrismPano=PN;
const TILE_MARGIN=64,GAMMA=2.2;
let _ly=0;
async function pump(msg,fr){busy(true,msg,fr);const t=performance.now();if(t-_ly>40){_ly=t;await new Promise(r=>setTimeout(r,0))}}

/* ---------- algèbre ---------- */
const I3=()=>Float64Array.from([1,0,0,0,1,0,0,0,1]);
const m3mul=(a,b)=>{const r=new Float64Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];return r};
const m3inv=a=>{const A=a[4]*a[8]-a[5]*a[7],B=a[5]*a[6]-a[3]*a[8],C=a[3]*a[7]-a[4]*a[6],det=a[0]*A+a[1]*B+a[2]*C;if(!isFinite(det)||Math.abs(det)<1e-300)return null;const d=1/det;
  return Float64Array.from([A*d,(a[2]*a[7]-a[1]*a[8])*d,(a[1]*a[5]-a[2]*a[4])*d,B*d,(a[0]*a[8]-a[2]*a[6])*d,(a[2]*a[3]-a[0]*a[5])*d,C*d,(a[1]*a[6]-a[0]*a[7])*d,(a[0]*a[4]-a[1]*a[3])*d])};
const m3n=a=>{const s=a[8];if(!isFinite(s)||Math.abs(s)<1e-12)return a;const r=new Float64Array(9);for(let i=0;i<9;i++)r[i]=a[i]/s;return r};
const trM=(x,y)=>Float64Array.from([1,0,x,0,1,y,0,0,1]);
const scM=(s)=>Float64Array.from([s,0,0,0,s,0,0,0,1]);
/* échelle homogène fixée de sorte que le point (x,y) ait w=1 (le signe d'un produit de matrices est arbitraire) */
const normAt=(M,x,y)=>{if(!M)return M;const w=M[6]*x+M[7]*y+M[8];if(!isFinite(w)||Math.abs(w)<1e-12)return M;const r=new Float64Array(9);for(let i=0;i<9;i++)r[i]=M[i]/w;return r};
const hap=(H,x,y)=>{const w=H[6]*x+H[7]*y+H[8];return[(H[0]*x+H[1]*y+H[2])/w,(H[3]*x+H[4]*y+H[5])/w,w]};
function solveN(A,b,n){
  for(let c=0;c<n;c++){let p=c,mx=Math.abs(A[c*n+c]);for(let r=c+1;r<n;r++){const v=Math.abs(A[r*n+c]);if(v>mx){mx=v;p=r}}
    if(!(mx>1e-18))return null;
    if(p!==c){for(let k=0;k<n;k++){const t=A[c*n+k];A[c*n+k]=A[p*n+k];A[p*n+k]=t}const t=b[c];b[c]=b[p];b[p]=t}
    const d=1/A[c*n+c];
    for(let r=c+1;r<n;r++){const f=A[r*n+c]*d;if(!f)continue;for(let k=c;k<n;k++)A[r*n+k]-=f*A[c*n+k];b[r]-=f*b[c]}}
  const x=new Float64Array(n);
  for(let r=n-1;r>=0;r--){let s=b[r];for(let k=r+1;k<n;k++)s-=A[r*n+k]*x[k];x[r]=s/A[r*n+r]}
  return x}
/* PRNG déterministe */
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}

/* H (A -> B) moindres carrés normalisés (Hartley) sur P=[ax,ay,bx,by,...] ; idx optionnel */
function fitH(P,idx){
  const n=idx?idx.length:P.length>>2;if(n<4)return null;
  let ax=0,ay=0,bx=0,by=0;
  for(let t=0;t<n;t++){const k=(idx?idx[t]:t)*4;ax+=P[k];ay+=P[k+1];bx+=P[k+2];by+=P[k+3]}
  ax/=n;ay/=n;bx/=n;by/=n;let da=0,db=0;
  for(let t=0;t<n;t++){const k=(idx?idx[t]:t)*4;da+=Math.hypot(P[k]-ax,P[k+1]-ay);db+=Math.hypot(P[k+2]-bx,P[k+3]-by)}
  da/=n;db/=n;if(da<1e-9||db<1e-9)return null;
  const sa=Math.SQRT2/da,sb=Math.SQRT2/db,A=new Float64Array(64),b=new Float64Array(8),r1=new Float64Array(8),r2=new Float64Array(8);
  for(let t=0;t<n;t++){const k=(idx?idx[t]:t)*4,x=(P[k]-ax)*sa,y=(P[k+1]-ay)*sa,u=(P[k+2]-bx)*sb,v=(P[k+3]-by)*sb;
    r1[0]=x;r1[1]=y;r1[2]=1;r1[3]=0;r1[4]=0;r1[5]=0;r1[6]=-x*u;r1[7]=-y*u;
    r2[0]=0;r2[1]=0;r2[2]=0;r2[3]=x;r2[4]=y;r2[5]=1;r2[6]=-x*v;r2[7]=-y*v;
    for(let i=0;i<8;i++){const a1=r1[i],a2=r2[i];b[i]+=a1*u+a2*v;for(let j=i;j<8;j++)A[i*8+j]+=a1*r1[j]+a2*r2[j]}}
  for(let i=0;i<8;i++)for(let j=0;j<i;j++)A[i*8+j]=A[j*8+i];
  const h=solveN(A,b,8);if(!h)return null;
  const Hn=Float64Array.from([h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1]);
  const Ta=Float64Array.from([sa,0,-sa*ax,0,sa,-sa*ay,0,0,1]),Tb=Float64Array.from([1/sb,0,bx,0,1/sb,by,0,0,1]);
  const H=m3n(m3mul(Tb,m3mul(Hn,Ta)));for(let i=0;i<9;i++)if(!isFinite(H[i]))return null;return H}
/* H plausible pour une prise de vue (coins qui restent un quadrilatère convexe, aire raisonnable) */
function plausibleH(H,wA,hA,loose){
  const c=[[0,0],[wA,0],[wA,hA],[0,hA]],q=[];
  for(const[x,y]of c){const p=hap(H,x,y);if(!(p[2]>0)||!isFinite(p[0])||!isFinite(p[1]))return false;q.push(p)}
  let area=0,sg=0;
  for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],d=q[(i+2)%4];area+=a[0]*b[1]-b[0]*a[1];const cr=(b[0]-a[0])*(d[1]-b[1])-(b[1]-a[1])*(d[0]-b[0]);if(cr===0)return false;const s=cr>0?1:-1;if(sg&&s!==sg)return false;sg=s}
  area=Math.abs(area)/2;const r=area/(wA*hA);return loose||(r>.2&&r<5)}
function ransacH(P,wA,hA,iters,thr,seed){
  const n=P.length>>2;if(n<8)return null;const R=rng(seed||12345),pick=new Int32Array(4),thr2=thr*thr;
  let best=null,bestN=0;
  const tmp=new Float64Array(16);
  for(let it=0;it<iters;it++){
    let ok=true;for(let k=0;k<4;k++){let v,t=0;do{v=(R()*n)|0;t++}while(pick.indexOf(v)>=0&&pick.indexOf(v)<k&&t<20);pick[k]=v}
    for(let a=0;a<4&&ok;a++)for(let b=a+1;b<4&&ok;b++){const ka=pick[a]*4,kb=pick[b]*4;if(Math.hypot(P[ka]-P[kb],P[ka+1]-P[kb+1])<4||Math.hypot(P[ka+2]-P[kb+2],P[ka+3]-P[kb+3])<4)ok=false}
    if(!ok)continue;
    for(let k=0;k<4;k++){tmp.set(P.subarray(pick[k]*4,pick[k]*4+4),k*4)}
    /* trois points alignés ? */
    let col=false;for(let a=0;a<4&&!col;a++){const i0=a,i1=(a+1)%4,i2=(a+2)%4;const cr=(tmp[i1*4]-tmp[i0*4])*(tmp[i2*4+1]-tmp[i0*4+1])-(tmp[i1*4+1]-tmp[i0*4+1])*(tmp[i2*4]-tmp[i0*4]);if(Math.abs(cr)<30)col=true}
    if(col)continue;
    const H=fitH(tmp,null);if(!H||!plausibleH(H,wA,hA))continue;
    let cnt=0;for(let i=0;i<n;i++){const k=i*4,w=H[6]*P[k]+H[7]*P[k+1]+H[8];if(w<=0)continue;const dx=(H[0]*P[k]+H[1]*P[k+1]+H[2])/w-P[k+2],dy=(H[3]*P[k]+H[4]*P[k+1]+H[5])/w-P[k+3];if(dx*dx+dy*dy<thr2)cnt++}
    if(cnt>bestN){bestN=cnt;best=H;if(cnt>n*.9)break}}
  if(!best)return null;
  /* raffinement sur les inliers */
  let H=best,idx=null;
  for(let rep=0;rep<4;rep++){
    const ids=[];for(let i=0;i<n;i++){const k=i*4,w=H[6]*P[k]+H[7]*P[k+1]+H[8];if(w<=0)continue;const dx=(H[0]*P[k]+H[1]*P[k+1]+H[2])/w-P[k+2],dy=(H[3]*P[k]+H[4]*P[k+1]+H[5])/w-P[k+3];if(dx*dx+dy*dy<thr2)ids.push(i)}
    if(ids.length<6)break;const H2=fitH(P,ids);if(!H2||!plausibleH(H2,wA,hA))break;H=H2;idx=ids}
  if(!idx)return{H,idx:[],n:bestN};
  return{H,idx,n:idx.length}}

/* ---------- images ---------- */
function mkImg(c,name){return{c,w:c.width,h:c.height,name,gc:{},gx:{}}}
function cachedGray(im,kind,w,h){const k=kind+w;return im.gx[k]||(im.gx[k]=kind==='bp'?grayBP(im.c,w,h):grayF(im.c,w,h))}
function grayF(c,w,h){const t=mk(w,h),g=cx(t);g.imageSmoothingQuality='high';g.drawImage(c,0,0,w,h);const d=rx(t).getImageData(0,0,w,h).data,a=new Float32Array(w*h);
  for(let i=0;i<a.length;i++)a[i]=d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114;t.width=t.height=1;return a}
/* gris passe-bande normalisé : insensible à l'exposition, au vignettage et aux dégradés lents */
function grayBP(c,w,h){const a=grayF(c,w,h),bl=boxBlurF(a,w,h,Math.max(3,Math.round(w/24)));let v=0;for(let i=0;i<a.length;i++){a[i]-=bl[i];v+=a[i]*a[i]}const sd=Math.sqrt(v/a.length)||1;for(let i=0;i<a.length;i++)a[i]/=sd;return a}
function gray8At(im,sc){const w=Math.max(8,Math.round(im.w*sc)),k=w+'x'+sc;if(im.gc[k])return im.gc[k];
  const h=Math.max(8,Math.round(im.h*sc)),t=mk(w,h),g=cx(t);g.imageSmoothingQuality='high';g.drawImage(im.c,0,0,w,h);const d=rx(t).getImageData(0,0,w,h).data,a=new Uint8Array(w*h);
  for(let i=0;i<a.length;i++)a[i]=(d[i*4]*77+d[i*4+1]*150+d[i*4+2]*29)>>8;t.width=t.height=1;
  const keys=Object.keys(im.gc);if(keys.length>5)delete im.gc[keys[0]];return im.gc[k]={d:a,w,h}}
function boxBlurF(a,w,h,r){const t=new Float32Array(a.length),o=new Float32Array(a.length),k=2*r+1;
  for(let y=0;y<h;y++){const b=y*w;let s=0;for(let x=-r;x<=r;x++)s+=a[b+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){t[b+x]=s/k;s+=a[b+Math.min(w-1,x+r+1)]-a[b+Math.max(0,x-r)]}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){o[y*w+x]=s/k;s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}
  return o}
const bil=(a,w,x,y)=>{const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,i=y0*w+x0;return(a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+w]*(1-fx)+a[i+w+1]*fx)*fy};

/* ---------- translation (valeur de départ, et repli) : b = a + (dx,dy) ---------- */
function trErr(A,B,w,h,dx,dy,st,minOv){const x0=Math.max(0,-dx),x1=Math.min(w,w-dx),y0=Math.max(0,-dy),y1=Math.min(h,h-dy);
  if(x1-x0<=0||y1-y0<=0||(x1-x0)*(y1-y0)<w*h*minOv)return 1e9;let s=0,n=0;
  for(let y=y0;y<y1;y+=st){const ra=y*w,rb=(y+dy)*w+dx;for(let x=x0;x<x1;x+=st){const e=A[ra+x]-B[rb+x];s+=e<0?-e:e;n++}}return n?s/n:1e9}
function transSearch(A,B){
  const w0=Math.min(160,A.w),h0=Math.max(8,Math.round(A.h*w0/A.w));
  const gA=cachedGray(A,'bp',w0,h0),gB=cachedGray(B,'bp',w0,h0);
  let best=1e9,bx=0,by=0;const errs=[],cand=[];let q=0;
  const rx0=Math.round(w0*.9),ry0=Math.round(h0*.6);
  for(let dy=-ry0;dy<=ry0;dy++)for(let dx=-rx0;dx<=rx0;dx++){const e=trErr(gA,gB,w0,h0,dx,dy,2,.1);if(e>=1e8)continue;if((q++&15)===0)errs.push(e);cand.push(dx,dy,e);if(e<best){best=e;bx=dx;by=dy}}
  errs.sort((a,b)=>a-b);const med=errs.length?errs[errs.length>>1]:1;
  let w=w0,x=bx,y=by,e=best;
  for(const target of[480,960]){const ww=Math.min(target,A.w);if(ww<=w+10)continue;const hh=Math.max(8,Math.round(A.h*ww/A.w)),f=ww/w,ga=cachedGray(A,'bp',ww,hh),gb=cachedGray(B,'bp',ww,hh),cxs=Math.round(x*f),cys=Math.round(y*f),Rr=Math.ceil(f)+1;
    let b2=1e9,x2=cxs,y2=cys;for(let dy=cys-Rr;dy<=cys+Rr;dy++)for(let dx=cxs-Rr;dx<=cxs+Rr;dx++){const ee=trErr(ga,gb,ww,hh,dx,dy,2,.02);if(ee<b2){b2=ee;x2=dx;y2=dy}}
    x=x2;y=y2;w=ww;e=b2}
  /* second meilleur pic éloigné du premier : le pic doit être net */
  let second=1e9;for(let k=0;k<cand.length;k+=3){if(Math.abs(cand[k]-bx)<=8||Math.abs(cand[k+1]-by)<=8)continue;if(cand[k+2]<second)second=cand[k+2]}
  const s=A.w/w;
  return{dx:x*s,dy:y*s,err:best,err2:second,med,good:best<.6*med&&best<.9&&second>best*1.2}}

/* ---------- points d'intérêt (Harris) + descripteurs orientés ---------- */
function harris(g,w,h,maxN,cell){
  const n=w*h,ix=new Float32Array(n),iy=new Float32Array(n);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;ix[i]=(g[i+1]-g[i-1])*.5;iy[i]=(g[i+w]-g[i-w])*.5}
  const xx=new Float32Array(n),yy=new Float32Array(n),xy=new Float32Array(n);
  for(let i=0;i<n;i++){xx[i]=ix[i]*ix[i];yy[i]=iy[i]*iy[i];xy[i]=ix[i]*iy[i]}
  const a=boxBlurF(xx,w,h,2),b=boxBlurF(yy,w,h,2),c=boxBlurF(xy,w,h,2),R=new Float32Array(n);let mx=0;
  for(let i=0;i<n;i++){const t=a[i]+b[i],r=a[i]*b[i]-c[i]*c[i]-.04*t*t;R[i]=r;if(r>mx)mx=r}
  const thr=mx*.002,B=14,cw=Math.ceil(w/cell),ch=Math.ceil(h/cell),bi=new Int32Array(cw*ch).fill(-1),bv=new Float32Array(cw*ch);
  for(let y=B;y<h-B;y++)for(let x=B;x<w-B;x++){const r=R[y*w+x];if(r<=thr)continue;const ci=((y/cell)|0)*cw+((x/cell)|0);if(r>bv[ci]){bv[ci]=r;bi[ci]=y*w+x}}
  const pts=[];for(let i=0;i<bi.length;i++)if(bi[i]>=0)pts.push([bi[i]%w,(bi[i]/w)|0,bv[i]]);
  pts.sort((p,q)=>q[2]-p[2]);if(pts.length>maxN)pts.length=maxN;return pts}
const DISK=(()=>{const o=[];for(let dy=-9;dy<=9;dy++)for(let dx=-9;dx<=9;dx++)if(dx*dx+dy*dy<=81)o.push([dx,dy]);return o})();
function describe(gb,w,pts){
  const N=pts.length,D=new Float32Array(N*64),ok=new Uint8Array(N);
  for(let k=0;k<N;k++){const x=pts[k][0],y=pts[k][1];let s=0;for(const[dx,dy]of DISK)s+=gb[(y+dy)*w+x+dx];const m=s/DISK.length;let m10=0,m01=0;
    for(const[dx,dy]of DISK){const v=gb[(y+dy)*w+x+dx]-m;m10+=dx*v;m01+=dy*v}
    const th=Math.atan2(m01,m10),cs=Math.cos(th),sn=Math.sin(th);let mean=0;const o=k*64;
    for(let j=0;j<8;j++)for(let i=0;i<8;i++){const ox=(i-3.5)*2.5,oy=(j-3.5)*2.5,v=bil(gb,w,x+cs*ox-sn*oy,y+sn*ox+cs*oy);D[o+j*8+i]=v;mean+=v}
    mean/=64;let nn=0;for(let i=0;i<64;i++){const v=D[o+i]-mean;D[o+i]=v;nn+=v*v}nn=Math.sqrt(nn);
    if(nn<1e-3){ok[k]=0;continue}for(let i=0;i<64;i++)D[o+i]/=nn;ok[k]=1}
  return{D,ok}}
/* appariement : ratio + croisé ; gate(ax,ay)->[cx,cy,r] optionnel */
function matchDesc(pa,da,pb,db,gate){
  const Na=pa.length,Nb=pb.length,Ds=da.D,Dt=db.D;
  const bestA=new Int32Array(Na).fill(-1),r1=new Float32Array(Na).fill(-9),r2=new Float32Array(Na).fill(-9),bestB=new Int32Array(Nb).fill(-1),vB=new Float32Array(Nb).fill(-9);
  for(let i=0;i<Na;i++){if(!da.ok[i])continue;let g=null;if(gate)g=gate(pa[i][0],pa[i][1]);const oi=i*64;
    for(let j=0;j<Nb;j++){if(!db.ok[j])continue;if(g){const ddx=pb[j][0]-g[0],ddy=pb[j][1]-g[1];if(ddx*ddx+ddy*ddy>g[2]*g[2])continue}
      const oj=j*64;let s=0;for(let k=0;k<64;k++)s+=Ds[oi+k]*Dt[oj+k];
      if(s>r1[i]){r2[i]=r1[i];r1[i]=s;bestA[i]=j}else if(s>r2[i])r2[i]=s;
      if(s>vB[j]){vB[j]=s;bestB[j]=i}}}
  const out=[];
  for(let i=0;i<Na;i++){const j=bestA[i];if(j<0||bestB[j]!==i)continue;const d1=Math.sqrt(Math.max(0,2-2*r1[i])),d2=Math.sqrt(Math.max(0,2-2*Math.max(r2[i],-1)));if(d2>0&&d1/d2>.85)continue;out.push([pa[i][0],pa[i][1],pb[j][0],pb[j][1]])}
  return out}

/* correspondances par points d'intérêt à l'échelle de travail : H (coordonnées pleine résolution) ou null */
function featureH(A,B,H0,seed){
  const wsA=Math.min(960,A.w),sA=wsA/A.w,hsA=Math.max(16,Math.round(A.h*sA)),wsB=Math.min(960,B.w),sB=wsB/B.w,hsB=Math.max(16,Math.round(B.h*sB));
  const gA=cachedGray(A,'f',wsA,hsA),gB=cachedGray(B,'f',wsB,hsB),bA=boxBlurF(boxBlurF(boxBlurF(gA,wsA,hsA,1),wsA,hsA,1),wsA,hsA,1),bB=boxBlurF(boxBlurF(boxBlurF(gB,wsB,hsB,1),wsB,hsB,1),wsB,hsB,1);
  const sg=boxBlurF(gA,wsA,hsA,1),sg2=boxBlurF(gB,wsB,hsB,1);
  const pa=harris(sg,wsA,hsA,1100,12),pb=harris(sg2,wsB,hsB,1100,12);
  if(pa.length<12||pb.length<12)return null;
  const da=describe(bA,wsA,pa),db=describe(bB,wsB,pb);
  let gate=null;
  if(H0){const Hs=m3mul(scM(sB),m3mul(H0,scM(1/sA))),rad=Math.max(36,.09*Math.max(wsA,wsB));gate=(x,y)=>{const p=hap(Hs,x,y);return[p[0],p[1],rad]}}
  const mt=matchDesc(pa,da,pb,db,gate);
  if(mt.length<10)return null;
  const P=new Float64Array(mt.length*4);mt.forEach((m,i)=>P.set(m,i*4));
  const r=ransacH(P,wsA,hsA,2500,3,seed);
  if(!r||r.n<12||r.n<mt.length*.18)return null;
  const Hw=r.H,Hf=m3n(m3mul(scM(1/sB),m3mul(Hw,scM(sA))));
  return{H:Hf,inl:r.n,tot:mt.length}}

/* ---------- affinage par corrélation de patchs (NCC) à 0.5x puis pleine résolution ---------- */
function patchMatch(gA,gB,Hs,R,half){
  const wA=gA.w,hA=gA.h,wB=gB.w,hB=gB.h,mg=half+R+2;
  /* zone de A dont l'image dans B est valide */
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  const inB=(x,y)=>{const p=hap(Hs,x,y);return p[2]>0&&p[0]>=mg&&p[1]>=mg&&p[0]<wB-1-mg&&p[1]<hB-1-mg};
  for(let y=mg;y<hA-mg;y+=8)for(let x=mg;x<wA-mg;x+=8)if(inB(x,y)){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<x0)return[];
  const area=(x1-x0)*(y1-y0),step=Math.max(6,Math.round(Math.sqrt(area/700))),T=new Float32Array((2*half+1)**2),n=T.length,out=[];
  const bx=new Float32Array(n),by=new Float32Array(n),side=2*R+1,surf=new Float32Array(side*side);
  for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step){
    if(!inB(x,y))continue;
    let s=0,k=0;for(let j=-half;j<=half;j++)for(let i=-half;i<=half;i++){const v=gA.d[(y+j)*wA+x+i];T[k++]=v;s+=v}
    const m=s/n;let tn=0;for(let q=0;q<n;q++){T[q]-=m;tn+=T[q]*T[q]}if(tn<n*5)continue;tn=Math.sqrt(tn);
    k=0;for(let j=-half;j<=half;j++)for(let i=-half;i<=half;i++){const p=hap(Hs,x+i,y+j);bx[k]=p[0];by[k]=p[1];k++}
    let best=-2,bi=0,bj=0;
    for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
      let sb=0,sbb=0,stb=0;
      for(let q=0;q<n;q++){const xx=bx[q]+dx,yy=by[q]+dy;if(xx<0||yy<0||xx>=wB-1||yy>=hB-1){sb=NaN;break}const v=bil(gB.d,wB,xx,yy);sb+=v;sbb+=v*v;stb+=T[q]*v}
      let ncc=-2;if(sb===sb){const vb=sbb-sb*sb/n;if(vb>1e-6)ncc=stb/(tn*Math.sqrt(vb))}
      surf[(dy+R)*side+dx+R]=ncc;if(ncc>best){best=ncc;bi=dx;bj=dy}}
    if(best<.8||Math.abs(bi)===R||Math.abs(bj)===R)continue;
    const c=(dx,dy)=>surf[(dy+R)*side+dx+R];let sx=0,sy=0;
    {const a=c(bi-1,bj),b=c(bi,bj),d=c(bi+1,bj),den=a-2*b+d;if(den<-1e-9)sx=Math.max(-.5,Math.min(.5,.5*(a-d)/den))}
    {const a=c(bi,bj-1),b=c(bi,bj),d=c(bi,bj+1),den=a-2*b+d;if(den<-1e-9)sy=Math.max(-.5,Math.min(.5,.5*(a-d)/den))}
    const p=hap(Hs,x,y);out.push(x,y,p[0]+bi+sx,p[1]+bj+sy)}
  return out}
function robustFit(P,H0,thr0){
  let H=H0,n=P.length>>2;
  const resid=(H)=>{const r=new Float64Array(n);for(let i=0;i<n;i++){const k=i*4,p=hap(H,P[k],P[k+1]);r[i]=Math.hypot(p[0]-P[k+2],p[1]-P[k+3])}return r};
  let idx=null,rr=resid(H);
  for(let it=0;it<5;it++){
    const s=Float64Array.from(rr).sort(),med=s[s.length>>1],th=Math.max(thr0,Math.min(3*med,6));
    const ids=[];for(let i=0;i<n;i++)if(rr[i]<th)ids.push(i);
    if(ids.length<10)return null;const Hn=fitH(P,ids);if(!Hn)return null;H=Hn;rr=resid(H);idx=ids}
  const ids=[];let s2=0;for(let i=0;i<n;i++)if(rr[i]<Math.max(thr0,1.2)){ids.push(i);s2+=rr[i]*rr[i]}
  return{H,ids,rms:Math.sqrt(s2/Math.max(1,ids.length))}}
function refineH(A,B,H0){
  let H=H0,last=null;
  for(const sc of[.125,.25,.5,1]){
    if(A.w*sc<110&&sc<1)continue;
    const gA=gray8At(A,sc),gB=gray8At(B,sc),Hs=m3mul(scM(sc),m3mul(H,scM(1/sc))),lo=sc<=.25?12:18;
    const P=patchMatch(gA,gB,Hs,sc<1?3:2,8);
    if(P.length<4*lo)continue;
    const rf=robustFit(Float64Array.from(P),Hs,sc<1?.6:.45);if(!rf||rf.ids.length<lo)continue;
    const Hn=m3n(m3mul(scM(1/sc),m3mul(rf.H,scM(sc))));if(!plausibleH(Hn,A.w,A.h))continue;
    H=Hn;const pts=new Float64Array(rf.ids.length*4);rf.ids.forEach((id,q)=>{for(let c=0;c<4;c++)pts[q*4+c]=P[id*4+c]/sc});
    last={H,pts,rms:rf.rms/sc,n:rf.ids.length,sc}}
  return last}

/* estimation d'une paire (A -> B) en pleine résolution */
async function estimatePair(A,B,H0hint,seed){
  let tr=null,Hg=H0hint||null,conf=!!H0hint;const pf=PN.prof=PN.prof||{};let t0=performance.now();const lap=k=>{const t=performance.now();pf[k]=(pf[k]||0)+t-t0;t0=t};
  if(!Hg){tr=transSearch(A,B);Hg=trM(tr.dx,tr.dy);conf=tr.good}
  lap('trans');
  let feat=featureH(A,B,conf?Hg:null,seed);
  if(!feat&&conf)feat=featureH(A,B,null,seed+7);
  lap('feat');
  let H=null,method='none';
  if(feat&&plausibleH(feat.H,A.w,A.h)){H=feat.H;method='feat'}
  else if(conf){H=Hg;method='trans'}
  else{H=trM(-A.w*.9,0);method='none'}
  let rf=null;
  if(method!=='none'){rf=refineH(A,B,H);if(rf&&method==='trans'){if(rf.n>=40&&rf.sc===1&&rf.rms<.8)method='refined';else rf=null}if(rf)H=rf.H}
  lap('refine');
  return{H,method,pts:rf?rf.pts:null,rms:rf?rf.rms:null,nInl:rf?rf.n:feat?feat.inl:0,tr}}

/* ---------- ajustement global (Levenberg-Marquardt sur les 8 paramètres de chaque G) ---------- */
function globalAdjust(G,ref,pairs,maxPts){
  const n=G.length,R=new Map(),idxOf=i=>i===ref?-1:(i<ref?i:i-1);
  const items=pairs.filter(p=>p.pts&&p.pts.length>=4*10);if(!items.length)return{G,rms0:0,rms1:0};
  const sel=items.map(p=>{const m=p.pts.length>>2;let ids=[];if(m<=maxPts){for(let i=0;i<m;i++)ids.push(i)}else{const r=rng(7+p.i*31+p.j);const s=new Set();while(s.size<maxPts)s.add((r()*m)|0);ids=[...s]}
    const a=new Float64Array(ids.length*4);ids.forEach((id,q)=>a.set(p.pts.subarray(id*4,id*4+4),q*4));return{i:p.i,j:p.j,P:a,w:p.w||1,cx:p.cx||0,cy:p.cy||0}});
  const np=(n-1)*8,x=new Float64Array(np);
  const unpack=(x)=>G.map((g,i)=>{if(i===ref)return g;const o=idxOf(i)*8,r=new Float64Array(9);for(let k=0;k<8;k++)r[k]=x[o+k];r[8]=1;return r});
  const get=(g)=>{const r=new Float64Array(8);for(let k=0;k<8;k++)r[k]=g[k]/g[8];return r};
  G.forEach((g,i)=>{if(i!==ref)x.set(get(g),idxOf(i)*8)});
  const x0=Float64Array.from(x);
  const resid=(x,out)=>{const Gs=unpack(x),inv=Gs.map(g=>m3inv(g));let q=0,tot=0;
    for(const s of sel){const Gi=Gs[s.i],Gj=inv[s.j];if(!Gj){return null}const Mij=normAt(m3mul(Gj,Gi),s.cx,s.cy),P=s.P;
      for(let k=0;k<P.length;k+=4){const p=hap(Mij,P[k],P[k+1]);let ex=(p[0]-P[k+2])*s.w,ey=(p[1]-P[k+3])*s.w;if(!isFinite(ex)||!isFinite(ey)||Math.abs(p[2])<1e-9){ex=50;ey=50}
        /* Huber */const m=Math.hypot(ex,ey);if(m>3){const f=Math.sqrt(3/m);ex*=f;ey*=f}
        if(out){out[q]=ex;out[q+1]=ey}q+=2;tot+=ex*ex+ey*ey}}
    return{n:q,tot}};
  const r0=resid(x,null);if(!r0)return{G,rms0:0,rms1:0};
  const nr=r0.n,rv=new Float64Array(nr),rv2=new Float64Array(nr);
  const scale=new Float64Array(np);for(let i=0;i<n;i++){if(i===ref)continue;const o=idxOf(i)*8;[1,1,100,1,1,100,1e-3,1e-3].forEach((v,k)=>scale[o+k]=v)}
  let lam=1e-3,cost=r0.tot;const rms0=Math.sqrt(cost/(nr/2));
  for(let it=0;it<25;it++){
    resid(x,rv);const J=new Float64Array(nr*np);
    for(let p=0;p<np;p++){const h=1e-6*scale[p],xs=x[p];x[p]=xs+h;resid(x,rv2);x[p]=xs;for(let r=0;r<nr;r++)J[r*np+p]=(rv2[r]-rv[r])/h}
    const A=new Float64Array(np*np),b=new Float64Array(np);
    for(let r=0;r<nr;r++){const o=r*np;for(let a=0;a<np;a++){const ja=J[o+a];if(ja===0)continue;b[a]-=ja*rv[r];for(let c=a;c<np;c++)A[a*np+c]+=ja*J[o+c]}}
    for(let a=0;a<np;a++)for(let c=0;c<a;c++)A[a*np+c]=A[c*np+a];
    let improved=false;
    for(let tries=0;tries<6;tries++){
      const A2=Float64Array.from(A),b2=Float64Array.from(b);for(let a=0;a<np;a++)A2[a*np+a]+=lam*(A[a*np+a]+1e-9/(scale[a]*scale[a]));
      const d=solveN(A2,b2,np);if(!d){lam*=10;continue}
      const xn=Float64Array.from(x);for(let a=0;a<np;a++)xn[a]+=d[a];
      const Gs=unpack(xn);if(!Gs.every((g,i)=>i===ref||plausibleH(g,200,200,true))){lam*=10;continue}
      const rn=resid(xn,null);if(rn&&rn.tot<cost){x.set(xn);const gain=cost-rn.tot;cost=rn.tot;lam=Math.max(1e-7,lam/4);improved=true;if(gain<1e-6*cost)it=99;break}lam*=8}
    if(!improved)break}
  const rms1=Math.sqrt(cost/(nr/2));
  if(!(cost<=r0.tot))return{G,rms0,rms1:rms0};
  const Gn=unpack(x);return{G:Gn.map(g=>m3n(g)),rms0,rms1}}

/* ---------- focale (rotation pure, point principal au centre) ---------- */
function focalsFromH(H,wA,hA,wB,hB){
  /* H : A -> B en pixels ; on centre les deux images */
  const h=m3mul(trM(-wB/2,-hB/2),m3mul(H,trM(wA/2,hA/2)));const n=m3n(h);
  const out=[];
  let d1=n[6]*n[7],d2=(n[7]-n[6])*(n[7]+n[6]),v1=-(n[0]*n[1]+n[3]*n[4])/d1,v2=(n[0]*n[0]+n[3]*n[3]-n[1]*n[1]-n[4]*n[4])/d2;
  if(v1<v2){const t=v1;v1=v2;v2=t}
  let f1=null;if(v1>0&&v2>0)f1=Math.sqrt(Math.abs(d1)>Math.abs(d2)?v1:v2);else if(v1>0)f1=Math.sqrt(v1);
  d1=n[0]*n[3]+n[1]*n[4];d2=n[0]*n[0]+n[1]*n[1]-n[3]*n[3]-n[4]*n[4];v1=-n[2]*n[5]/d1;v2=(n[5]*n[5]-n[2]*n[2])/d2;
  if(v1<v2){const t=v1;v1=v2;v2=t}
  let f0=null;if(v1>0&&v2>0)f0=Math.sqrt(Math.abs(d1)>Math.abs(d2)?v1:v2);else if(v1>0)f0=Math.sqrt(v1);
  if(f0&&isFinite(f0))out.push(f0);if(f1&&isFinite(f1))out.push(f1);return out}

/* écart au modèle de rotation pure : M = K_B^-1 H K_A doit être une rotation (colonnes orthonormées) */
function rotModelErr(H,wA,hA,wB,hB,f){
  const KA=Float64Array.from([f,0,wA/2,0,f,hA/2,0,0,1]),KBi=m3inv(Float64Array.from([f,0,wB/2,0,f,hB/2,0,0,1]));if(!KBi)return 9;
  let M=m3mul(KBi,m3mul(H,KA));const det=M[0]*(M[4]*M[8]-M[5]*M[7])-M[1]*(M[3]*M[8]-M[5]*M[6])+M[2]*(M[3]*M[7]-M[4]*M[6]);if(!isFinite(det)||Math.abs(det)<1e-12)return 9;
  const k=1/Math.cbrt(det);let e=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++){let d=0;for(let r=0;r<3;r++)d+=M[r*3+i]*M[r*3+j]*k*k;if(i===j)d-=1;e+=d*d}return Math.sqrt(e)}
/* ---------- projection ---------- */
function makeProj(kind,f,cxr,cyr){
  if(kind==='cyl')return{kind,f,cx:cxr,cy:cyr,fwd:(X,Y)=>{const th=Math.atan2(X-cxr,f);return[f*th,(Y-cyr)*Math.cos(th),th]}};
  return{kind:'plane',fwd:(X,Y)=>[X,Y,0]}}
function outline(w,h,k){const o=[];for(let i=0;i<=k;i++){const t=i/k;o.push([t*w,0],[t*w,h],[0,t*h],[w,t*h])}return o}
function geometry(ims,G,proj){
  let minU=1e18,minV=1e18,maxU=-1e18,maxV=-1e18,maxTh=0;
  for(let i=0;i<ims.length;i++)for(const[x,y]of outline(ims[i].w,ims[i].h,24)){const p=hap(G[i],x,y);if(!(p[2]>0)||!isFinite(p[0])||!isFinite(p[1]))return null;const q=proj.fwd(p[0],p[1]);
    if(proj.kind==='cyl'){if(Math.abs(q[2])>1.45)return null;maxTh=Math.max(maxTh,Math.abs(q[2]))}
    if(q[0]<minU)minU=q[0];if(q[0]>maxU)maxU=q[0];if(q[1]<minV)minV=q[1];if(q[1]>maxV)maxV=q[1]}
  const W=Math.ceil(maxU-minU),H=Math.ceil(maxV-minV);if(!(W>0&&H>0))return null;
  return{minU:Math.floor(minU),minV:Math.floor(minV),W:Math.ceil(maxU)-Math.floor(minU),H:Math.ceil(maxV)-Math.floor(minV),maxTh}}
/* total angle seen from the reference (radians) given focal f */
function totalAngle(ims,G,ref,f){
  const cxr=ims[ref].w/2;let a=1e9,b=-1e9;
  for(let i=0;i<ims.length;i++)for(const[x,y]of outline(ims[i].w,ims[i].h,8)){const p=hap(G[i],x,y);if(!(p[2]>0))return 9;const th=Math.atan2(p[0]-cxr,f);a=Math.min(a,th);b=Math.max(b,th)}
  return b-a}
function rescaleAll(ims,G,ref,s,proj){
  const nims=ims.map(im=>{const w=Math.max(8,Math.round(im.w*s)),h=Math.max(8,Math.round(im.h*s)),c=mk(w,h),g=cx(c);g.imageSmoothingQuality='high';g.drawImage(im.c,0,0,w,h);return mkImg(c,im.name)});
  const nG=G.map((g,i)=>{const si=nims[i].w/ims[i].w,sr=nims[ref].w/ims[ref].w;return m3n(m3mul(scM(sr),m3mul(g,scM(1/si))))});
  const np=proj.kind==='cyl'?makeProj('cyl',proj.f*nims[ref].w/ims[ref].w,nims[ref].w/2,nims[ref].h/2):proj;
  return{ims:nims,G:nG,proj:np}}

/* ---------- warp bilinéaire : sortie (ow x oh) échantillonnée en u=u0+a*step ---------- */
/* M : plan -> pixels source (incluant le décalage de la sous-copie), src : {d,w,h,ox,oy} ; vig : {lg,a,b,cx,cy,hd2,q} ou null */
function warpInto(o,ow,oh,u0,v0,step,proj,M,src,rc,corr){
  const rgb=o.rgb,valid=o.valid,r2o=o.r2,sd=src.d,sw=src.w,sh=src.h,ox=src.ox,oy=src.oy;
  const m0=M[0],m1=M[1],m2=M[2],m3=M[3],m4=M[4],m5=M[5],m6=M[6],m7=M[7],m8=M[8];
  const cyl=proj.kind==='cyl',f=proj.f,colX=new Float64Array(ow),colK=new Float64Array(ow);
  for(let a=0;a<ow;a++){const u=u0+a*step;if(cyl){const th=u/f;colX[a]=proj.cx+f*Math.tan(th);colK[a]=Math.abs(th)<1.5?1/Math.cos(th):1e9}else{colX[a]=u;colK[a]=1}}
  const cyc=cyl?proj.cy:0;
  for(let b=0;b<oh;b++){const v=v0+b*step;
    for(let a=0;a<ow;a++){
      const X=colX[a],Y=cyc+v*colK[a],hw=m6*X+m7*Y+m8,idx=b*ow+a;
      if(!(hw>1e-9)){valid[idx]=0;continue}
      const sx=(m0*X+m1*Y+m2)/hw-ox,sy=(m3*X+m4*Y+m5)/hw-oy;
      if(sx<0||sy<0||sx>=sw-1||sy>=sh-1){valid[idx]=0;continue}
      const x0=sx|0,y0=sy|0,fx=sx-x0,fy=sy-y0,i=(y0*sw+x0)*4,j=i+sw*4,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
      let r=sd[i]*w00+sd[i+4]*w10+sd[j]*w01+sd[j+4]*w11,g=sd[i+1]*w00+sd[i+5]*w10+sd[j+1]*w01+sd[j+5]*w11,bl=sd[i+2]*w00+sd[i+6]*w10+sd[j+2]*w01+sd[j+6]*w11;
      if(r2o||corr){const px=sx+ox-rc.cx,py=sy+oy-rc.cy,r2=(px*px+py*py)/rc.hd2;
        if(r2o)r2o[idx]=r2;
        if(corr){const fc=Math.exp(-(corr.lg+corr.a*r2+corr.b*r2*r2)/GAMMA);r*=fc;g*=fc;bl*=fc}}
      const k=idx*3;rgb[k]=r>255?255:r;rgb[k+1]=g>255?255:g;rgb[k+2]=bl>255?255:bl;valid[idx]=1}}}

/* ---------- pyramides ---------- */
function reduceP(src,sw,sh,ch){
  const dw=(sw+1)>>1,dh=(sh+1)>>1,tmp=new Float32Array(dw*sh*ch),dst=new Float32Array(dw*dh*ch);
  for(let y=0;y<sh;y++){const ro=y*sw*ch;for(let x=0;x<dw;x++){const c=2*x,a0=Math.max(0,c-2),a1=Math.max(0,c-1),a3=Math.min(sw-1,c+1),a4=Math.min(sw-1,c+2),c0=Math.min(sw-1,c);
    for(let k=0;k<ch;k++)tmp[(y*dw+x)*ch+k]=(src[ro+a0*ch+k]+4*src[ro+a1*ch+k]+6*src[ro+c0*ch+k]+4*src[ro+a3*ch+k]+src[ro+a4*ch+k])*.0625}}
  for(let y=0;y<dh;y++){const c=2*y,r0=Math.max(0,c-2),r1=Math.max(0,c-1),r3=Math.min(sh-1,c+1),r4=Math.min(sh-1,c+2),r2=Math.min(sh-1,c);
    for(let x=0;x<dw*ch;x++)dst[y*dw*ch+x]=(tmp[r0*dw*ch+x]+4*tmp[r1*dw*ch+x]+6*tmp[r2*dw*ch+x]+4*tmp[r3*dw*ch+x]+tmp[r4*dw*ch+x])*.0625}
  return dst}
function expandP(src,sw,sh,dw,dh,ch){
  const dst=new Float32Array(dw*dh*ch),xi=new Int32Array(dw),xf=new Float32Array(dw);
  for(let x=0;x<dw;x++){const s=x*.5,i=Math.min(sw-1,s|0);xi[x]=i;xf[x]=Math.min(1,s-i)}
  for(let y=0;y<dh;y++){const s=y*.5,i=Math.min(sh-1,s|0),fy=Math.min(1,s-i),i2=Math.min(sh-1,i+1);
    for(let x=0;x<dw;x++){const a=xi[x],b=Math.min(sw-1,a+1),fx=xf[x];
      for(let k=0;k<ch;k++){const t0=src[(i*sw+a)*ch+k]*(1-fx)+src[(i*sw+b)*ch+k]*fx,t1=src[(i2*sw+a)*ch+k]*(1-fx)+src[(i2*sw+b)*ch+k]*fx;dst[(y*dw+x)*ch+k]=t0*(1-fy)+t1*fy}}}
  return dst}
/* remplit les pixels invalides par la couleur valide la plus proche sur la ligne puis la colonne */
function fillInvalid(rgb,valid,w,h){
  const ok=Uint8Array.from(valid);
  for(let y=0;y<h;y++){let last=-1;const r=y*w;for(let x=0;x<w;x++){if(ok[r+x]){last=x}else if(last>=0){const s=(r+last)*3,d=(r+x)*3;rgb[d]=rgb[s];rgb[d+1]=rgb[s+1];rgb[d+2]=rgb[s+2];ok[r+x]=2}}
    last=-1;for(let x=w-1;x>=0;x--){if(ok[r+x]===1){last=x}else if(ok[r+x]===0&&last>=0){const s=(r+last)*3,d=(r+x)*3;rgb[d]=rgb[s];rgb[d+1]=rgb[s+1];rgb[d+2]=rgb[s+2];ok[r+x]=2}}}
  for(let x=0;x<w;x++){let last=-1;for(let y=0;y<h;y++){const i=y*w+x;if(ok[i]){last=y}else if(last>=0){const s=(last*w+x)*3,d=i*3;rgb[d]=rgb[s];rgb[d+1]=rgb[s+1];rgb[d+2]=rgb[s+2];ok[i]=2}}
    last=-1;for(let y=h-1;y>=0;y--){const i=y*w+x;if(ok[i]){last=y}else if(last>=0){const s=(last*w+x)*3,d=i*3;rgb[d]=rgb[s];rgb[d+1]=rgb[s+1];rgb[d+2]=rgb[s+2];ok[i]=2}}}}

/* ---------- distance au bord (chamfer) ---------- */
function distMap(valid,w,h){
  const d=new Float32Array(w*h),INF=1e9;for(let i=0;i<d.length;i++)d[i]=valid[i]?INF:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;let v=d[i];
    const l=x>0?d[i-1]+1:1,u=y>0?d[i-w]+1:1;v=Math.min(v,l,u);if(x>0&&y>0)v=Math.min(v,d[i-w-1]+1.414);if(x<w-1&&y>0)v=Math.min(v,d[i-w+1]+1.414);d[i]=v}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;let v=d[i];
    const r=x<w-1?d[i+1]+1:1,dn=y<h-1?d[i+w]+1:1;v=Math.min(v,r,dn);if(x<w-1&&y<h-1)v=Math.min(v,d[i+w+1]+1.414);if(x>0&&y<h-1)v=Math.min(v,d[i+w-1]+1.414);d[i]=v}
  return d}

/* ---------- plus grand rectangle plein dans un masque ---------- */
function largestRect(cov,w,h){
  const hs=new Int32Array(w);let best=0,bx0=0,by0=0,bx1=0,by1=0;
  for(let y=0;y<h;y++){for(let x=0;x<w;x++)hs[x]=cov[y*w+x]?hs[x]+1:0;
    const st=[];for(let x=0;x<=w;x++){const cur=x<w?hs[x]:0;let start=x;while(st.length&&st[st.length-1][1]>=cur){const[sx,sh]=st.pop();const a=sh*(x-sx);if(a>best){best=a;bx0=sx;bx1=x-1;by1=y;by0=y-sh+1}start=sx}st.push([start,cur])}}
  return{x0:bx0,y0:by0,x1:bx1,y1:by1,area:best}}

/* ---------- raccords : coupe de coût minimal (programmation dynamique) par paire ---------- */
function seamPair(i,j,lab,rgbs,valids,dists,aw,ah){
  const vi=valids[i],vj=valids[j];let x0=aw,y0=ah,x1=-1,y1=-1,cnt=0;
  for(let y=0;y<ah;y++)for(let x=0;x<aw;x++){const p=y*aw+x;if(vi[p]&&vj[p]&&(lab[p]===i||lab[p]===j)){cnt++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  if(cnt<30)return 0;
  const bw=x1-x0+1,bh=y1-y0+1,horiz=bw>=bh; /* coupe qui court horizontalement : une ligne par colonne */
  const R=horiz?bw:bh,C=horiz?bh:bw,BIG=1e5,cost=new Float32Array(R*C),ri=rgbs[i],rj=rgbs[j],di=dists[i],dj=dists[j];
  const at=(r,c)=>horiz?(y0+c)*aw+(x0+r):(y0+r)*aw+(x0+c);
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){const p=at(r,c);
    if(!(vi[p]&&vj[p]&&(lab[p]===i||lab[p]===j))){cost[r*C+c]=BIG;continue}
    const dr=ri[p*3]-rj[p*3],dg=ri[p*3+1]-rj[p*3+1],db=ri[p*3+2]-rj[p*3+2];
    /* écart de gradient (structure) */
    let gx=0;{const q=p+1<aw*ah?p+1:p,e1=(ri[q*3]+ri[q*3+1]+ri[q*3+2])-(ri[p*3]+ri[p*3+1]+ri[p*3+2]),e2=(rj[q*3]+rj[q*3+1]+rj[q*3+2])-(rj[p*3]+rj[p*3+1]+rj[p*3+2]);gx=(e1-e2)/3}
    const e=Math.min(di[p],dj[p]);
    cost[r*C+c]=dr*dr+dg*dg+db*db+gx*gx*.5+60*Math.exp(-e/6)}
  const cum=new Float32Array(R*C),from=new Int8Array(R*C);
  for(let c=0;c<C;c++)cum[c]=cost[c];
  for(let r=1;r<R;r++)for(let c=0;c<C;c++){let b=1e30,bk=0;for(let k=-2;k<=2;k++){const cc=c+k;if(cc<0||cc>=C)continue;const v=cum[(r-1)*C+cc]+(k?Math.abs(k)*.5:0);if(v<b){b=v;bk=k}}cum[r*C+c]=b+cost[r*C+c];from[r*C+c]=bk}
  let bc=0,bv=1e30;for(let c=0;c<C;c++)if(cum[(R-1)*C+c]<bv){bv=cum[(R-1)*C+c];bc=c}
  const sp=new Int32Array(R);sp[R-1]=bc;for(let r=R-1;r>0;r--)sp[r-1]=sp[r]+from[r*C+sp[r]];
  /* image du côté « bas » (indices c petits) */
  let ci=0,cj=0,ni=0,nj=0;
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){const p=at(r,c);if(vi[p]){ci+=c;ni++}if(vj[p]){cj+=c;nj++}}
  const lowImg=(ci/Math.max(1,ni))<=(cj/Math.max(1,nj))?i:j,highImg=lowImg===i?j:i;
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){const p=at(r,c);if(vi[p]&&vj[p]&&(lab[p]===i||lab[p]===j))lab[p]=c<sp[r]?lowImg:highImg}
  return cnt}

/* ---------- gains + vignettage (moindres carrés sur les recouvrements) ---------- */
function solveExposure(n,prev,valids,r2s,aw,ah,pairs,withVig){
  const lin=new Float32Array(256);for(let i=0;i<256;i++)lin[i]=Math.pow(i/255,GAMMA);
  const samples=[]; /* [i,j,y,ri2,rj2] */
  for(const[i,j]of pairs){const vi=valids[i],vj=valids[j],ri=prev[i],rj=prev[j];let cnt=0;for(let p=0;p<aw*ah;p++)if(vi[p]&&vj[p])cnt++;
    if(cnt<200)continue;const st=Math.max(1,Math.floor(cnt/5000));let q=0;
    for(let p=0;p<aw*ah;p++){if(!(vi[p]&&vj[p]))continue;if((q++%st)!==0)continue;
      const Li=.299*ri[p*3]+.587*ri[p*3+1]+.114*ri[p*3+2],Lj=.299*rj[p*3]+.587*rj[p*3+1]+.114*rj[p*3+2];
      if(Li<10||Lj<10||Li>245||Lj>245)continue;
      samples.push([i,j,Math.log(Math.max(1e-4,Math.pow(Li/255,GAMMA)))-Math.log(Math.max(1e-4,Math.pow(Lj/255,GAMMA))),r2s[i][p],r2s[j][p]])}}
  const sol=(useVig,wts)=>{const m=n+(useVig?2:0),A=new Float64Array(m*m),b=new Float64Array(m),row=new Float64Array(m);
    samples.forEach((s,q)=>{const w=wts?wts[q]:1;row.fill(0);row[s[0]]+=1;row[s[1]]-=1;if(useVig){row[n]=s[3]-s[4];row[n+1]=s[3]*s[3]-s[4]*s[4]}
      for(let a=0;a<m;a++){if(!row[a])continue;b[a]+=w*row[a]*s[2];for(let c=0;c<m;c++)if(row[c])A[a*m+c]+=w*row[a]*row[c]}});
    const N=samples.length;for(let a=0;a<n;a++){for(let c=0;c<n;c++)A[a*m+c]+=N*10;A[a*m+a]+=N*1e-5}
    if(useVig){A[n*m+n]+=N*1e-3;A[(n+1)*m+n+1]+=N*1e-3}
    const x=solveN(A,b,m);return x};
  if(samples.length<300)return{lg:new Float64Array(n),a:0,b:0,N:samples.length,vig:false};
  const fit=useVig=>{let w=null,x=null;for(let it=0;it<3;it++){x=sol(useVig,w);if(!x)return null;
    const res=samples.map(s=>s[2]-(x[s[0]]-x[s[1]]+(useVig?x[n]*(s[3]-s[4])+x[n+1]*(s[3]*s[3]-s[4]*s[4]):0)));const ab=res.map(Math.abs).sort((p,q)=>p-q),mad=Math.max(.02,ab[ab.length>>1]*1.48);
    w=res.map(r=>{const a=Math.abs(r)/(1.5*mad);return a<1?1:1/a})}return x};
  let x=withVig?fit(true):null,vig=false;
  if(x){const a=x[n],b=x[n+1],e1=a+b;if(e1<=.1&&e1>=-1.6&&a<=.2)vig=true}
  if(!vig)x=fit(false);
  if(!x)return{lg:new Float64Array(n),a:0,b:0,N:samples.length,vig:false};
  const lg=new Float64Array(n);for(let i=0;i<n;i++)lg[i]=x[i];
  return{lg,a:vig?x[n]:0,b:vig?x[n+1]:0,N:samples.length,vig}}

/* ---------- orchestrateur ---------- */
function mapProj(proj,minU,minV){
  return(u,v)=>{if(proj.kind==='cyl'){const th=(u+minU)/proj.f;return[proj.cx+proj.f*Math.tan(th),proj.cy+(v+minV)/Math.cos(th)]}return[u+minU,v+minV]}}

async function stitchImages(canvases,names,optsIn){
  const o=Object.assign({},PN.opts,optsIn||{}),T0=performance.now(),warn=[],stat={};
  const ims=canvases.map((c,i)=>mkImg(c,names&&names[i]||('photo'+(i+1))));const n=ims.length;
  if(n<2)throw new Error('il faut au moins deux photos');
  /* 1. alignement par paires : translation -> points d'intérêt + RANSAC -> affinage par patchs */
  const pairs=[],Hf=[];let tAl=performance.now();
  for(let k=0;k<n-1;k++){
    await pump('Alignement des photos '+(k+1)+' et '+(k+2)+'…',.08+.2*k/Math.max(1,n-1));
    const r=await estimatePair(ims[k],ims[k+1],null,1000+k);pairs.push({i:k,j:k+1,...r});Hf.push(r.H);
    if(r.method==='trans')warn.push('alignement par translation pour les photos '+(k+1)+' et '+(k+2));
    if(r.method==='none')warn.push('recouvrement ou détails insuffisants entre les photos '+(k+1)+' et '+(k+2)+' : elles sont placées côte à côte')}
  stat.methods=pairs.map(p=>p.method);stat.pairRms=pairs.map(p=>p.rms);stat.pairInl=pairs.map(p=>p.nInl);
  let ref=n>>1;let G=new Array(n);G[ref]=I3();
  for(let i=ref+1;i<n;i++)G[i]=m3n(m3mul(G[i-1],m3inv(Hf[i-1])));
  for(let i=ref-1;i>=0;i--)G[i]=m3n(m3mul(G[i+1],Hf[i]));
  /* paires non adjacentes qui se recouvrent */
  if(n>=3){
    for(let i=0;i<n-2;i++)for(let j=i+2;j<n;j++){
      const Hij=normAt(m3mul(m3inv(G[j]),G[i]),ims[i].w/2,ims[i].h/2);if(!Hij)continue;
      let inside=0,tot=0;for(let y=0;y<=8;y++)for(let x=0;x<=8;x++){tot++;const p=hap(Hij,x/8*ims[i].w,y/8*ims[i].h);if(p[2]>0&&p[0]>=0&&p[1]>=0&&p[0]<ims[j].w&&p[1]<ims[j].h)inside++}
      if(inside/tot<.15)continue;
      await pump('Alignement des photos '+(i+1)+' et '+(j+1)+'…',.3);
      const r=await estimatePair(ims[i],ims[j],Hij,2000+i*7+j);
      if((r.method==='feat'||r.method==='refined')&&r.pts&&r.pts.length>=4*25&&r.rms<1.5)pairs.push({i,j,...r,cx:ims[i].w/2,cy:ims[i].h/2})}}
  /* points d'ancrage pour les paires en translation */
  for(const p of pairs){if(!p.pts&&(p.method==='trans')){const P=[];for(let y=1;y<6;y++)for(let x=1;x<6;x++){const a=[x/6*ims[p.i].w,y/6*ims[p.i].h],b=hap(p.H,a[0],a[1]);if(b[0]>0&&b[1]>0&&b[0]<ims[p.j].w&&b[1]<ims[p.j].h)P.push(a[0],a[1],b[0],b[1])}if(P.length>=40){p.pts=Float64Array.from(P);p.w=.3}}}
  for(const p of pairs){p.cx=ims[p.i].w/2;p.cy=ims[p.i].h/2}
  await pump('Ajustement global…',.32);
  let adj=null;
  try{adj=globalAdjust(G,ref,pairs,260)}catch(e){console.warn('pano: ajustement global',e)}
  stat.rms0=adj&&adj.rms0;stat.rms1=adj&&adj.rms1;
  if(adj&&adj.rms1<=adj.rms0*1.0001&&adj.G.every((g,i)=>i===ref||plausibleH(g,ims[i].w,ims[i].h)))G=adj.G;
  /* image de référence = la plus centrale (le champ ne dépasse pas 90 degrés de chaque côté) */
  {const fq=(()=>{const c=[];for(const p of pairs)if(p.j===p.i+1&&(p.method==='feat'||p.method==='refined')){const H=m3mul(m3inv(G[p.j]),G[p.i]);if(H)for(const f of focalsFromH(H,ims[p.i].w,ims[p.i].h,ims[p.j].w,ims[p.j].h))if(f>.25*ims[ref].w&&f<6*ims[ref].w)c.push(f)}c.sort((a,b)=>a-b);return c.length?c[c.length>>1]:null})();
   const cxr0=ims[ref].w/2,keys=G.map((g,i)=>{const p=hap(g,ims[i].w/2,ims[i].h/2);return fq?Math.atan2(p[0]-cxr0,fq):p[0]});
   const mid=(Math.min(...keys)+Math.max(...keys))/2;let nr=ref,bd=Infinity;keys.forEach((k,i)=>{const d=Math.abs(k-mid);if(d<bd-1e-9){bd=d;nr=i}});
   if(nr!==ref){const gi=m3inv(G[nr]);if(gi){G=G.map(g=>m3n(m3mul(gi,g)));ref=nr}}}
  stat.tAlign=Math.round(performance.now()-tAl);stat.prof=Object.fromEntries(Object.entries(PN.prof||{}).map(([k,v])=>[k,Math.round(v)]));PN.prof={};
  /* 2. focale / projection */
  const fc=[];for(const p of pairs){if(p.j===p.i+1&&(p.method==='feat'||p.method==='refined')){const H=m3mul(m3inv(G[p.j]),G[p.i]);if(H)for(const f of focalsFromH(H,ims[p.i].w,ims[p.i].h,ims[p.j].w,ims[p.j].h))if(f>.25*ims[ref].w&&f<6*ims[ref].w)fc.push(f)}}
  fc.sort((a,b)=>a-b);let fEst=fc.length?fc[fc.length>>1]:null;stat.f=fEst;stat.fCand=fc.length;
  if(fEst){let me=0;for(const p of pairs){if(p.j!==p.i+1||!(p.method==='feat'||p.method==='refined'))continue;const H=m3mul(m3inv(G[p.j]),G[p.i]);if(H)me=Math.max(me,rotModelErr(normAt(H,ims[p.i].w/2,ims[p.i].h/2),ims[p.i].w,ims[p.i].h,ims[p.j].w,ims[p.j].h,fEst))}
    stat.rotErr=me;if(me>.18){stat.fRejected=fEst;fEst=null}}
  let kind='plane',ang=null,G2=null,Hd=null;
  if(fEst){
    /* caméra virtuelle au milieu du champ (rotation autour de l'axe vertical) : le champ reste dans +-90 degrés */
    const cxr=ims[ref].w/2,cyr=ims[ref].h/2,th=G.map((g,i)=>{const q=hap(g,ims[i].w/2,ims[i].h/2);return Math.atan2(q[0]-cxr,fEst)}),mid=(Math.min(...th)+Math.max(...th))/2;
    if(Math.abs(mid)>.02){const c=Math.cos(-mid),s=Math.sin(-mid),K=Float64Array.from([fEst,0,cxr,0,fEst,cyr,0,0,1]),Ki=m3inv(K),Ry=Float64Array.from([c,0,s,0,1,0,-s,0,c]);Hd=m3n(m3mul(K,m3mul(Ry,Ki)));G2=G.map(g=>m3n(m3mul(Hd,g)))}
    ang=totalAngle(ims,G2||G,ref,fEst);stat.angDeg=ang*180/Math.PI;stat.virtual=!!G2}
  if(o.proj==='cyl')kind=fEst?'cyl':'plane';else if(o.proj==='plane')kind='plane';else if(fEst&&ang>1.75&&ang<3)kind='cyl';
  if(kind==='cyl'&&G2){G=G2}else Hd=null;
  let proj=kind==='cyl'?makeProj('cyl',fEst,ims[ref].w/2,ims[ref].h/2):makeProj('plane');
  let geo=geometry(ims,G,proj);
  if(!geo&&kind==='cyl'){kind='plane';proj=makeProj('plane');geo=geometry(ims,G,proj);if(geo)warn.push('champ trop large pour la projection cylindrique')}
  if(!geo)throw new Error('géométrie impossible (champ de vision trop large)');
  /* taille maximale */
  let ws=ims,wG=G,wproj=proj,wgeo=geo,sc=1;
  if(geo.W*geo.H>MAX_PX){sc=Math.sqrt(MAX_PX/(geo.W*geo.H))*.985;if(sc<.03)throw new Error('panorama trop grand');
    const rs=rescaleAll(ims,G,ref,sc,proj);ws=rs.ims;wG=rs.G;wproj=rs.proj;wgeo=geometry(ws,wG,wproj);
    if(!wgeo)throw new Error('panorama trop grand');
    while(wgeo.W*wgeo.H>MAX_PX&&sc>.05){sc*=.97;const r2=rescaleAll(ims,G,ref,sc,proj);ws=r2.ims;wG=r2.G;wproj=r2.proj;wgeo=geometry(ws,wG,wproj)}
    warn.push('panorama réduit à '+wgeo.W+' × '+wgeo.H+' px')}
  const W=wgeo.W,H=wgeo.H,minU=wgeo.minU,minV=wgeo.minV;stat.W=W;stat.H=H;stat.proj=wproj.kind;stat.scale=sc;
  /* 3. analyse basse résolution : warp, gains, raccords */
  await pump('Préparation des raccords…',.4);
  const p=Math.min(1,3000/Math.max(W,H)),aw=Math.max(8,Math.ceil(W*p)),ah=Math.max(8,Math.ceil(H*p)),invStep=1/p;
  const Ginv=wG.map((g,i)=>{const gi=m3inv(g),q=hap(g,ws[i].w/2,ws[i].h/2);return normAt(gi,q[0],q[1])}),prevSrc=[];
  const q=p;
  /* sous-copies des sources à l'échelle p (préfiltrées) */
  for(let i=0;i<n;i++){const im=ws[i],sw=Math.max(8,Math.round(im.w*q)),sh=Math.max(8,Math.round(im.h*q)),c=mk(sw,sh),g=cx(c);g.imageSmoothingQuality='high';g.drawImage(im.c,0,0,sw,sh);
    const d=rx(c).getImageData(0,0,sw,sh).data;prevSrc.push({d,w:sw,h:sh,ox:0,oy:0,q:sw/im.w,qy:sh/im.h});c.width=c.height=1}
  const rgbU=[],valids=[],r2s=[],rawU=[];
  const warpPrev=(i,vig)=>{const so=prevSrc[i],M=m3mul(Float64Array.from([so.q,0,.5*so.q-.5,0,so.qy,.5*so.qy-.5,0,0,1]),Ginv[i]);
    const out={rgb:new Float32Array(aw*ah*3),valid:new Uint8Array(aw*ah),r2:new Float32Array(aw*ah)};
    const im=ws[i],hd2=(im.w*im.w+im.h*im.h)/4,cxi=im.w/2,cyi=im.h/2;
    warpInto(out,aw,ah,minU,minV,invStep,wproj,M,so,{cx:cxi*so.q,cy:cyi*so.qy,hd2:hd2*so.q*so.q},vig);
    return out};
  for(let i=0;i<n;i++){const w=warpPrev(i,null);rawU.push(w.rgb);valids.push(w.valid);r2s.push(w.r2);if((i&1)===0)await pump('Préparation des raccords…',.4+.04*i/n)}
  /* paires exploitables pour l'exposition */
  const expPairs=[];for(const pp of pairs)if(pp.method==='feat'||pp.method==='refined')expPairs.push([pp.i,pp.j]);
  let ex={lg:new Float64Array(n),a:0,b:0,N:0,vig:false};
  if(expPairs.length&&o.gain!==false){ex=solveExposure(n,rawU,valids,r2s,aw,ah,expPairs,o.vignette);}
  stat.gains=Array.from(ex.lg).map(v=>Math.exp(v));stat.vig=ex.vig?{a:ex.a,b:ex.b}:null;stat.expSamples=ex.N;
    for(let i=0;i<n;i++){const w=warpPrev(i,{lg:ex.lg[i],a:ex.a,b:ex.b});const u8=new Uint8ClampedArray(aw*ah*3);for(let k=0;k<u8.length;k++)u8[k]=w.rgb[k];rgbU[i]=u8;valids[i]=w.valid}
  await pump('Placement des raccords…',.46);
  const dists=valids.map(v=>distMap(v,aw,ah)),lab=new Int8Array(aw*ah).fill(-1);
  for(let pp=0;pp<aw*ah;pp++){let b=-1,bd=0;for(let i=0;i<n;i++){const d=dists[i][pp];if(d>bd){bd=d;b=i}}lab[pp]=b}
  for(let i=0;i<n-1;i++)seamPair(i,i+1,lab,rgbU,valids,dists,aw,ah);
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++)seamPair(i,j,lab,rgbU,valids,dists,aw,ah);
  /* recadrage : plus grand rectangle entièrement couvert */
  const cov=new Uint8Array(aw*ah);for(let pp=0;pp<aw*ah;pp++)cov[pp]=lab[pp]>=0?1:0;
  const lr=largestRect(cov,aw,ah);let cr={x0:0,y0:0,x1:W,y1:H},cropped=false;
  const covN=cov.reduce((a,b)=>a+b,0);
  if(lr.area<covN*.985&&lr.area>=aw*ah*.5){const pad=Math.ceil(1/p)+2;cr={x0:Math.ceil(lr.x0/p)+pad,y0:Math.ceil(lr.y0/p)+pad,x1:Math.floor((lr.x1+1)/p)-pad,y1:Math.floor((lr.y1+1)/p)-pad};
    if(cr.x1-cr.x0>16&&cr.y1-cr.y0>16)cropped=true;else cr={x0:0,y0:0,x1:W,y1:H}}
  const cw=cr.x1-cr.x0,chh=cr.y1-cr.y0;
  /* 4. rendu par tuiles, multi-bandes */
  const out=mk(cw,chh),og=cx(out);
  const L=Math.max(1,Math.min(5,o.bands|0||4)),TS=o.tile,MG=TILE_MARGIN;
  const tx0=Math.floor(cr.x0/TS)*TS,ty0=Math.floor(cr.y0/TS)*TS,tiles=[];
  for(let ty=ty0;ty<cr.y1;ty+=TS)for(let tx=tx0;tx<cr.x1;tx+=TS)tiles.push([tx,ty]);
  stat.tiles=tiles.length;stat.multi=0;
  const full=[],pix=ws.map(()=>null);
  const ind=(i)=>i; /* indicateur par image -> échantillonné dans lab */
  const Mfull=ws.map((im,i)=>Ginv[i]);
  const T1=performance.now();
  let tdone=0;
  for(const[tx,ty]of tiles){
    const cx0=Math.max(tx,cr.x0),cy0=Math.max(ty,cr.y0),cx1=Math.min(tx+TS,cr.x1),cy1=Math.min(ty+TS,cr.y1);
    const ex0=tx-MG,ey0=ty-MG,ew=Math.ceil((Math.min(tx+TS,cr.x1)+MG-ex0)/16)*16,eh=Math.ceil((Math.min(ty+TS,cr.y1)+MG-ey0)/16)*16;
    /* labels présents dans la zone élargie (grille d'analyse) */
    const ax0=Math.max(0,Math.floor(ex0*p)-2),ay0=Math.max(0,Math.floor(ey0*p)-2),ax1=Math.min(aw-1,Math.ceil((ex0+ew)*p)+2),ay1=Math.min(ah-1,Math.ceil((ey0+eh)*p)+2);
    const present=new Set();for(let y=ay0;y<=ay1;y++)for(let x=ax0;x<=ax1;x++){const l=lab[y*aw+x];if(l>=0)present.add(l)}
    const inv=[...present].sort((a,b)=>a-b);
    const cwid=cx1-cx0,chei=cy1-cy0;
    const res=new Uint8ClampedArray(cwid*chei*4);
    if(inv.length===0){/* rien */}
    else if(inv.length===1){
      const i=inv[0],bufs=await warpTile(i,cx0,cy0,cwid,chei);
      if(bufs){for(let k=0;k<cwid*chei;k++){if(bufs.valid[k]){res[k*4]=bufs.rgb[k*3];res[k*4+1]=bufs.rgb[k*3+1];res[k*4+2]=bufs.rgb[k*3+2];res[k*4+3]=255}}}}
    else{
      stat.multi++;
      const weights=new Float32Array(ew*eh*inv.length);
      const wb=[];for(const i of inv){const b=await warpTile(i,ex0,ey0,ew,eh);wb.push(b)}
      /* poids : indicateur bilinéaire de la carte d'étiquettes x validité */
      const ncl=inv.length,sum=new Float32Array(ew*eh);
      for(let y=0;y<eh;y++){const ay=(ey0+y)*p,y0=Math.max(0,Math.min(ah-1,Math.floor(ay))),y1=Math.min(ah-1,y0+1),fy=Math.max(0,Math.min(1,ay-y0));
        for(let x=0;x<ew;x++){const axx=(ex0+x)*p,xa=Math.max(0,Math.min(aw-1,Math.floor(axx))),xb=Math.min(aw-1,xa+1),fx=Math.max(0,Math.min(1,axx-xa));
          const l00=lab[y0*aw+xa],l10=lab[y0*aw+xb],l01=lab[y1*aw+xa],l11=lab[y1*aw+xb];let s=0;
          for(let c=0;c<ncl;c++){const li=inv[c];const b=wb[c];const v=(b&&b.valid[y*ew+x])?1:0;
            const wgt=v?((l00===li?(1-fx)*(1-fy):0)+(l10===li?fx*(1-fy):0)+(l01===li?(1-fx)*fy:0)+(l11===li?fx*fy:0)):0;
            weights[c*ew*eh+y*ew+x]=wgt;s+=wgt}
          /* repli : si aucun poids, répartir entre les images valides */
          if(s<=1e-6){let nv=0;for(let c=0;c<ncl;c++)if(wb[c]&&wb[c].valid[y*ew+x])nv++;if(nv){for(let c=0;c<ncl;c++)if(wb[c]&&wb[c].valid[y*ew+x]){weights[c*ew*eh+y*ew+x]=1/nv}s=1}}
          else for(let c=0;c<ncl;c++)weights[c*ew*eh+y*ew+x]/=s;
          sum[y*ew+x]=s}}
      /* pyramides */
      const dims=[[ew,eh]];for(let k=1;k<=L;k++)dims.push([(dims[k-1][0]+1)>>1,(dims[k-1][1]+1)>>1]);
      const B=dims.map(d=>new Float32Array(d[0]*d[1]*3));
      for(let c=0;c<ncl;c++){const b=wb[c];if(!b)continue;
        fillInvalid(b.rgb,b.valid,ew,eh);
        const Gp=[b.rgb];for(let k=1;k<=L;k++)Gp.push(reduceP(Gp[k-1],dims[k-1][0],dims[k-1][1],3));
        let Mp=weights.subarray(c*ew*eh,(c+1)*ew*eh);const Mpy=[Mp];for(let k=1;k<=L;k++)Mpy.push(reduceP(Mpy[k-1],dims[k-1][0],dims[k-1][1],1));
        for(let k=0;k<=L;k++){const w=dims[k][0],h=dims[k][1],g=Gp[k],m=Mpy[k],bk=B[k];
          if(k<L){const up=expandP(Gp[k+1],dims[k+1][0],dims[k+1][1],w,h,3);for(let t=0;t<w*h;t++){const mm=m[t];if(mm===0)continue;bk[t*3]+=(g[t*3]-up[t*3])*mm;bk[t*3+1]+=(g[t*3+1]-up[t*3+1])*mm;bk[t*3+2]+=(g[t*3+2]-up[t*3+2])*mm}}
          else for(let t=0;t<w*h;t++){const mm=m[t];bk[t*3]+=g[t*3]*mm;bk[t*3+1]+=g[t*3+1]*mm;bk[t*3+2]+=g[t*3+2]*mm}}
        wb[c].rgb=null}
      let acc=B[L];for(let k=L-1;k>=0;k--){const up=expandP(acc,dims[k+1][0],dims[k+1][1],dims[k][0],dims[k][1],3),bk=B[k];for(let t=0;t<up.length;t++)up[t]+=bk[t];acc=up}
      for(let y=cy0;y<cy1;y++)for(let x=cx0;x<cx1;x++){const e=(y-ey0)*ew+(x-ex0),d=((y-cy0)*cwid+(x-cx0))*4;
        if(sum[e]<=0)continue;let r=acc[e*3],g=acc[e*3+1],bb=acc[e*3+2];res[d]=r<0?0:r>255?255:r;res[d+1]=g<0?0:g>255?255:g;res[d+2]=bb<0?0:bb>255?255:bb;res[d+3]=255}
    }
    if(cwid>0&&chei>0)og.putImageData(new ImageData(res,cwid,chei),cx0-cr.x0,cy0-cr.y0);
    tdone++;await pump('Fusion des photos…',.5+.46*tdone/tiles.length)}
  stat.tRender=Math.round(performance.now()-T1);

  async function warpTile(i,u0,v0,w,h){
    const im=ws[i],Mi=Mfull[i];
    /* boîte source de la tuile */
    let sx0=1e9,sy0=1e9,sx1=-1e9,sy1=-1e9,any=false;
    const mp=mapProj(wproj,minU,minV);
    for(let a=0;a<=8;a++)for(let b=0;b<=8;b++){const pt=mp(u0+a/8*w,v0+b/8*h),hh=hap(Mi,pt[0],pt[1]);if(!(hh[2]>0)||!isFinite(hh[0]))continue;any=true;sx0=Math.min(sx0,hh[0]);sx1=Math.max(sx1,hh[0]);sy0=Math.min(sy0,hh[1]);sy1=Math.max(sy1,hh[1])}
    if(!any)return null;
    const pad=Math.ceil(Math.max(sx1-sx0,sy1-sy0)*.03)+4;sx0=Math.max(0,Math.floor(sx0-pad));sy0=Math.max(0,Math.floor(sy0-pad));sx1=Math.min(im.w,Math.ceil(sx1+pad));sy1=Math.min(im.h,Math.ceil(sy1+pad));
    if(sx1-sx0<2||sy1-sy0<2)return null;
    const id=rx(im.c).getImageData(sx0,sy0,sx1-sx0,sy1-sy0);
    const o2={rgb:new Float32Array(w*h*3),valid:new Uint8Array(w*h)};
    warpInto(o2,w,h,u0+minU,v0+minV,1,wproj,Mi,{d:id.data,w:id.width,h:id.height,ox:sx0,oy:sy0},{cx:im.w/2,cy:im.h/2,hd2:(im.w*im.w+im.h*im.h)/4},{lg:ex.lg[i],a:ex.a,b:ex.b});
    return o2}
  /* le warp ci-dessus reçoit u0+minU : warpInto attend des coordonnées u absolues (plan: X=u) */
  const dt=Math.round(performance.now()-T0);stat.ms=dt;
  PN.last={sr:ws[ref].w/ims[ref].w,Gv:Hd,proj:wproj,f:fEst,G:wG,Gorig:G,ref,minU,minV,W,H,crop:cr,cropped,lab,aw,ah,p,stat,warn,n,ims:null,scale:sc,pairs:pairs.map(p=>({i:p.i,j:p.j,method:p.method,rms:p.rms,nInl:p.nInl})),ex:{lg:Array.from(ex.lg),a:ex.a,b:ex.b,vig:ex.vig}};
  return{canvas:out,warn,stat,cropped,kind:wproj.kind}}

/* ---------- entrée fichiers + message final ---------- */
function pickManyP(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='image/*,.heic,.heif,.tif,.tiff,'+RAW_ACCEPT;i.onchange=()=>res([...i.files]);i.oncancel=()=>res([]);i.click()})}
async function loadScaledP(f,maxPx){let bm=null;if(!RAW_EXT.test(f.name||'')&&!/\.(heic|heif|avif|tiff?)$/i.test(f.name||'')){try{bm=await createImageBitmap(f)}catch(e){}}
  if(!bm){const src=await styleFromFile(f);const s=Math.min(1,maxPx/Math.max(src.width,src.height)),c=mk(Math.round(src.width*s),Math.round(src.height*s));cx(c).drawImage(src,0,0,c.width,c.height);return c}
  const s=Math.min(1,maxPx/Math.max(bm.width,bm.height)),c=mk(Math.round(bm.width*s),Math.round(bm.height*s));cx(c).drawImage(bm,0,0,c.width,c.height);bm.close&&bm.close();return c}
async function stitchFiles(files){
  busy(true,'Assemblage du panorama…',0);await tick();
  try{
    const cs=[],names=[];for(const f of files){cs.push(await loadScaledP(f,4000));names.push(f.name||'')}
    let pj='auto';try{pj=PREF.get('panoProj','auto')}catch(e){}
    const r=await stitchImages(cs,names,{proj:pj});
    busy(false);setDoc(r.canvas,'panorama.jpg',{});
    const mode=r.kind==='cyl'?'projection cylindrique':'projection plane';
    let msg='Panorama assemblé ('+cs.length+' photos, '+mode+(r.cropped?', recadré':'')+').';
    if(r.warn.length)msg+=' Attention : '+r.warn.join(' ; ')+'.';
    toast(msg,r.warn.length?9000:6000);
  }catch(e){busy(false);console.error(e);toast('Panorama impossible : '+(e.message||e),5000)}}
async function panoDialog2(){const fs=await pickManyP();if(fs.length<2){if(fs.length)toast('Choisissez au moins deux photos');return}fs.sort((a,b)=>(a.name||'').localeCompare(b.name||''));stitchFiles(fs)}
PN.stitchImages=stitchImages;PN.stitchFiles=stitchFiles;PN.estimatePair=async(a,b)=>estimatePair(mkImg(a),mkImg(b),null,5);PN.focalsFromH=focalsFromH;PN.fitH=fitH;PN.mkImg=mkImg;
if(window.PrismF)window.PrismF.stitch=stitchFiles;
/* remplace l'entrée de menu existante : même libellé, nouveau moteur */
{const _f=MENU2.file.items;const mapIt=it=>{if(!it||it==='-'||typeof it!=='object')return it;if(it.label==='Panorama…')return{...it,fn:panoDialog2};if(it.sub){const s=it.sub;return{...it,sub:()=>s().map(mapIt)}}return it};
 MENU2.file.items=()=>_f().map(mapIt)}
})();
