/* Empilement de mise au point (focus stacking) : alignement similitude (décalage + échelle + rotation) pyramidal,
   fusion par pyramide laplacienne pondérée par la netteté locale (type Mertens), calques alignés + masques optionnels. */
(()=>{
const STK_MIN=2,STK_MAX=30;
/* ---------- plans flottants : réduction / agrandissement / flou ---------- */
function red(a,w,h){const w2=(w+1)>>1,h2=(h+1)>>1,t=new Float32Array(w2*h),o=new Float32Array(w2*h2);
  for(let y=0;y<h;y++){const r=y*w,q=y*w2;for(let i=0;i<w2;i++){const x=2*i,x0=x>0?x-1:0,x2=x+1<w?x+1:w-1,x3=x+2<w?x+2:w-1;t[q+i]=(a[r+x0]+3*a[r+x]+3*a[r+x2]+a[r+x3])*.125}}
  for(let j=0;j<h2;j++){const y=2*j,y0=y>0?y-1:0,y2=y+1<h?y+1:h-1,y3=y+2<h?y+2:h-1,r0=y0*w2,r1=y*w2,r2=y2*w2,r3=y3*w2,q=j*w2;for(let i=0;i<w2;i++)o[q+i]=(t[r0+i]+3*t[r1+i]+3*t[r2+i]+t[r3+i])*.125}
  return o}
function expd(a,w,h,W,H){const o=new Float32Array(W*H),xi=new Int32Array(W),xf=new Float32Array(W);
  for(let x=0;x<W;x++){let s=(x+.5)*w/W-.5;if(s<0)s=0;if(s>w-1)s=w-1;const i=Math.floor(s);xi[x]=i;xf[x]=s-i}
  for(let y=0;y<H;y++){let s=(y+.5)*h/H-.5;if(s<0)s=0;if(s>h-1)s=h-1;const j=Math.floor(s),fy=s-j,j1=j+1<h?j+1:j,r0=j*w,r1=j1*w,ob=y*W;
    for(let x=0;x<W;x++){const i=xi[x],i1=i+1<w?i+1:i,fx=xf[x],t=a[r0+i]+(a[r0+i1]-a[r0+i])*fx,b=a[r1+i]+(a[r1+i1]-a[r1+i])*fx;o[ob+x]=t+(b-t)*fy}}
  return o}
function box(a,w,h,r){if(r<1)return a;const t=new Float32Array(a.length),o=new Float32Array(a.length),k=1/(2*r+1);
  for(let y=0;y<h;y++){const b=y*w;let s=0;for(let x=-r;x<=r;x++)s+=a[b+(x<0?0:x>=w?w-1:x)];for(let x=0;x<w;x++){t[b+x]=s*k;s+=a[b+(x+r+1>=w?w-1:x+r+1)]-a[b+(x-r<0?0:x-r)]}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[(y<0?0:y>=h?h-1:y)*w+x];for(let y=0;y<h;y++){o[y*w+x]=s*k;s+=t[(y+r+1>=h?h-1:y+r+1)*w+x]-t[(y-r<0?0:y-r)*w+x]}}
  return o}
function blur3(a,w,h){const t=new Float32Array(a.length),o=new Float32Array(a.length);
  for(let y=0;y<h;y++){const b=y*w;for(let x=0;x<w;x++){const l=a[b+(x>0?x-1:0)],r=a[b+(x<w-1?x+1:x)];t[b+x]=(l+2*a[b+x]+r)*.25}}
  for(let y=0;y<h;y++){const u=(y>0?y-1:0)*w,d=(y<h-1?y+1:y)*w,b=y*w;for(let x=0;x<w;x++)o[b+x]=(t[u+x]+2*t[b+x]+t[d+x])*.25}
  return o}
/* ---------- alignement : Lucas-Kanade similitude (échelle, rotation, décalage) sur pyramide ---------- */
function grayPyr(cv){const w=cv.width,h=cv.height,a=new Float32Array(w*h);
  {const d=rx(cv).getImageData(0,0,w,h).data;for(let i=0,n=w*h;i<n;i++)a[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2]}
  let m=0;for(let i=0;i<a.length;i++)m+=a[i];m/=a.length;let v=0;for(let i=0;i<a.length;i++){const e=a[i]-m;v+=e*e}const sd=Math.sqrt(v/a.length)||1;for(let i=0;i<a.length;i++)a[i]=(a[i]-m)/sd;
  const L=[];let cur=a,cw=w,ch=h;
  for(;;){const bl=blur3(cur,cw,ch);L.push({a:bl,w:cw,h:ch});if(Math.min(cw,ch)<96)break;cur=red(blur3(bl,cw,ch),cw,ch);cw=(cw+1)>>1;ch=(ch+1)>>1}
  return L}
function solve4(H,g){const n=4,A=[];for(let i=0;i<n;i++){A.push([H[i*4],H[i*4+1],H[i*4+2],H[i*4+3],g[i]])}
  for(let i=0;i<n;i++){let p=i;for(let r=i+1;r<n;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;if(Math.abs(A[p][i])<1e-12)return null;[A[i],A[p]]=[A[p],A[i]];
    for(let r=i+1;r<n;r++){const f=A[r][i]/A[i][i];for(let c=i;c<=n;c++)A[r][c]-=f*A[i][c]}}
  const x=[0,0,0,0];for(let i=n-1;i>=0;i--){let s=A[i][n];for(let c=i+1;c<n;c++)s-=A[i][c]*x[c];x[i]=s/A[i][i]}return x}
/* p = {a,b,tx,ty} : x_B = c + [[1+a,-b],[b,1+a]](x_A-c) + t   (coordonnées du niveau) */
function lkLevel(A,B,p,iters,fixAB){const w=A.w,h=A.h,aa=A.a,bb=B.a,cxx=(w-1)/2,cyy=(h-1)/2,stride=Math.max(1,Math.floor(Math.sqrt(w*h/160000)));let sc=1e9,ok=true;
  for(let it=0;it<iters;it++){const H=new Float64Array(16),g=new Float64Array(4);let n=0,sa=0;
    for(let y=2;y<h-2;y+=stride){const v=y-cyy;for(let x=2;x<w-2;x+=stride){const u=x-cxx,xs=cxx+(1+p.a)*u-p.b*v+p.tx,ys=cyy+p.b*u+(1+p.a)*v+p.ty;
      if(xs<1||ys<1||xs>=w-2||ys>=h-2)continue;const ix=xs|0,iy=ys|0,fx=xs-ix,fy=ys-iy,o=iy*w+ix,v00=bb[o],v10=bb[o+1],v01=bb[o+w],v11=bb[o+w+1];
      const val=v00*(1-fx)*(1-fy)+v10*fx*(1-fy)+v01*(1-fx)*fy+v11*fx*fy,gx=(1-fy)*(v10-v00)+fy*(v11-v01),gy=(1-fx)*(v01-v00)+fx*(v11-v10);
      const io=y*w+x,ax=aa[io+1]-aa[io-1],ay=aa[io+w]-aa[io-w],ga=.5*Math.sqrt(ax*ax+ay*ay),gb=Math.sqrt(gx*gx+gy*gy),rr=((ga<gb?ga:gb)+.01)/((ga<gb?gb:ga)+.01),r=val-aa[io],wt=rr*rr/(1+(r*r)/(sc*sc)),j0=gx*u+gy*v,j1=-gx*v+gy*u,j2=gx,j3=gy;n++;sa+=Math.abs(r);
      H[0]+=wt*j0*j0;H[1]+=wt*j0*j1;H[2]+=wt*j0*j2;H[3]+=wt*j0*j3;H[5]+=wt*j1*j1;H[6]+=wt*j1*j2;H[7]+=wt*j1*j3;H[10]+=wt*j2*j2;H[11]+=wt*j2*j3;H[15]+=wt*j3*j3;
      g[0]-=wt*j0*r;g[1]-=wt*j1*r;g[2]-=wt*j2*r;g[3]-=wt*j3*r}}
    if(n<80){ok=false;break}
    H[4]=H[1];H[8]=H[2];H[9]=H[6];H[12]=H[3];H[13]=H[7];H[14]=H[11];for(let i=0;i<4;i++)H[i*5]*=1.0005;
    let d;if(fixAB){const a=H[10],b=H[11],c=H[15],det=a*c-b*b;if(det<1e-12){ok=false;break}d=[0,0,(g[2]*c-g[3]*b)/det,(g[3]*a-g[2]*b)/det]}else d=solve4(H,g);if(!d){ok=false;break}
    p.a+=d[0];p.b+=d[1];p.tx+=d[2];p.ty+=d[3];sc=Math.max(.05,1.5*sa/n);
    if(Math.abs(p.a)>.05||Math.abs(p.b)>.04||Math.abs(p.tx)>w*.5||Math.abs(p.ty)>h*.5){ok=false;break}
    if(Math.hypot(d[2],d[3])<.005&&Math.abs(d[0])<2e-6&&Math.abs(d[1])<2e-6)break}
  return ok}
function cost(A,B,p){const w=A.w,h=A.h,aa=A.a,bb=B.a,cxx=(w-1)/2,cyy=(h-1)/2,stride=Math.max(1,Math.floor(Math.sqrt(w*h/120000)));let s=0,n=0;
  for(let y=2;y<h-2;y+=stride){const v=y-cyy;for(let x=2;x<w-2;x+=stride){const u=x-cxx,xs=cxx+(1+p.a)*u-p.b*v+p.tx,ys=cyy+p.b*u+(1+p.a)*v+p.ty;if(xs<1||ys<1||xs>=w-2||ys>=h-2)continue;
    const ix=xs|0,iy=ys|0,fx=xs-ix,fy=ys-iy,o=iy*w+ix,val=bb[o]*(1-fx)*(1-fy)+bb[o+1]*fx*(1-fy)+bb[o+w]*(1-fx)*fy+bb[o+w+1]*fx*fy;s+=Math.abs(val-aa[y*w+x]);n++}}
  return n>50?s/n:1e9}
/* estime la transformation (coordonnées de A -> coordonnées de B), A et B pyramides de gris */
function estimate(PA,PB){const nl=Math.min(PA.length,PB.length),top=nl-1;let p={a:0,b:0,tx:0,ty:0};
  /* recherche entière du décalage au niveau le plus grossier */
  {const A=PA[top],B=PB[top],w=A.w,h=A.h,R=Math.max(3,Math.round(Math.min(w,h)*.08));let best=1e18,bx=0,by=0;
    for(let sy=-R;sy<=R;sy++)for(let sx=-R;sx<=R;sx++){let s=0,n=0;const x0=Math.max(0,-sx),x1=Math.min(w,w-sx),y0=Math.max(0,-sy),y1=Math.min(h,h-sy);if(x1-x0<w*.4||y1-y0<h*.4)continue;
      for(let y=y0;y<y1;y++){const ra=y*w,rb=(y+sy)*w+sx;for(let x=x0;x<x1;x++){const e=A.a[ra+x]-B.a[rb+x];s+=e*e;n++}}
      s/=n;if(s<best){best=s;bx=sx;by=sy}}
    /* B(x+s)≈A(x) : x_B = x_A + s */ p.tx=bx;p.ty=by}
  /* niveaux grossiers : décalage seul ; ensuite échelle et rotation libres. Chaque étape n'est gardée que si elle réduit l'erreur */
  let okAll=true,hist=[];
  for(let l=top;l>=0;l--){const coarse=Math.min(PA[l].w,PA[l].h)<160&&l>0,it=l===top?14:l>top-3?8:l>0?6:8,q={...p},before=cost(PA[l],PB[l],p);
    const okl=lkLevel(PA[l],PB[l],q,it,coarse);if(okl&&cost(PA[l],PB[l],q)<=before*1.02)p=q;else if(l>=top-1)okAll=false;
    if(l>0){p.tx*=2;p.ty*=2}}
  /* garde-fou : au niveau d'environ 400 px, l'estimation doit faire mieux que l'identité */
  const lc=Math.max(0,PA.findIndex(x=>Math.min(x.w,x.h)<400)-1)||0;const sh=Math.pow(2,lc);const pc={a:p.a,b:p.b,tx:p.tx/sh,ty:p.ty/sh};
  if(cost(PA[lc],PB[lc],pc)>cost(PA[lc],PB[lc],{a:0,b:0,tx:0,ty:0})*1.0){okAll=false}
  return{p,ok:okAll}}
const m3=(P,M)=>[P[0]*M[0]+P[1]*M[3],P[0]*M[1]+P[1]*M[4],P[0]*M[2]+P[1]*M[5]+P[2],P[3]*M[0]+P[4]*M[3],P[3]*M[1]+P[4]*M[4],P[3]*M[2]+P[4]*M[5]+P[5]];
/* m: [m00,m01,m02,m10,m11,m12] : x' = m00 x + m01 y + m02 ... */
function inv3(m){const d=m[0]*m[4]-m[1]*m[3];const a=m[4]/d,b=-m[1]/d,c=-m[3]/d,e=m[0]/d;return[a,b,-(a*m[2]+b*m[5]),c,e,-(c*m[2]+e*m[5])]}
function pToM(p,w,h){const cxx=(w-1)/2,cyy=(h-1)/2,A=1+p.a,B=p.b;return[A,-B,cxx-A*cxx+B*cyy+p.tx,B,A,cyy-B*cxx-A*cyy+p.ty]}
const apply=(m,x,y)=>[m[0]*x+m[1]*y+m[2],m[3]*x+m[4]*y+m[5]];
/* ---------- pyramides couleur et énergie de netteté ---------- */
function levelsFor(w,h){return Math.max(2,Math.min(9,Math.floor(Math.log2(Math.min(w,h)))-3))}
function pyrLap(P,w,h,n){/* P: [R,G,B] Float32 ; renvoie les niveaux laplaciens + résidu (en place) */
  const G=[{p:P,w,h}];for(let l=1;l<n;l++){const q=G[l-1];G.push({p:q.p.map(c=>red(c,q.w,q.h)),w:(q.w+1)>>1,h:(q.h+1)>>1})}
  for(let l=0;l<n-1;l++){const g=G[l],u=G[l+1];g.p=g.p.map((c,i)=>{const e=expd(u.p[i],u.w,u.h,g.w,g.h);for(let k=0;k<c.length;k++)c[k]-=e[k];return c})}
  return G}
function sharpEnergy(L,liss,sc){const m=Math.min(3,L.length-1);let acc=null;
  for(let l=m-1;l>=0;l--){const q=L[l],n=q.w*q.h,lum=new Float32Array(n),R=q.p[0],G=q.p[1],B=q.p[2];for(let k=0;k<n;k++)lum[k]=Math.abs(.299*R[k]+.587*G[k]+.114*B[k]);
    const r=Math.max(1,Math.round((2+liss*.08*sc)/(1<<l))),e=box(lum,q.w,q.h,r),wl=l===0?.5:1;
    if(acc){const u=expd(acc,L[l+1].w,L[l+1].h,q.w,q.h);for(let k=0;k<n;k++)e[k]=e[k]*wl+u[k]}else if(wl!==1)for(let k=0;k<n;k++)e[k]*=wl;
    acc=e}
  return acc}
const EPS=.01,PB=6;
function weightMap(E,valid,liss){const n=E.length,o=new Float32Array(n),p=Math.round(PB-2*liss/100);
  for(let k=0;k<n;k++){if(valid&&!valid[k]){o[k]=0;continue}const x=E[k]*10+EPS,x2=x*x,x4=x2*x2;o[k]=p>=8?x4*x4:p>=6?x4*x2:p===5?x4*x:x4}
  return o}
/* ---------- chargement d'une image dans un plan flottant ---------- */
function planesOf(cv){const w=cv.width,h=cv.height,n=w*h,R=new Float32Array(n),G=new Float32Array(n),B=new Float32Array(n);
  {const d=rx(cv).getImageData(0,0,w,h).data;for(let i=0;i<n;i++){R[i]=d[i*4]/255;G[i]=d[i*4+1]/255;B[i]=d[i*4+2]/255}}
  return[R,G,B]}
const yieldUI=()=>new Promise(r=>setTimeout(r,0));
/* ---------- coeur : frames = {n, get(i)->Promise<canvas>} ---------- */
async function stackRun(frames,opts){opts=opts||{};const n=frames.n,liss=opts.liss==null?30:opts.liss,t0=performance.now(),prog=opts.progress||(()=>{});
  if(n<STK_MIN||n>STK_MAX)throw new Error('choisissez entre '+STK_MIN+' et '+STK_MAX+' photos');
  const ref=Math.floor((n-1)/2),refC=await frames.get(ref),W=refC.width,H=refC.height,info={ref,W,H,n,lkFail:0};
  const fit=(c)=>{if(c.width===W&&c.height===H)return c;const t=mk(W,H),g=rx(t);g.imageSmoothingQuality='high';g.drawImage(c,0,0,W,H);return t};
  /* 1. alignement de proche en proche à partir de la photo centrale */
  const M=new Array(n);M[ref]=[1,0,0,0,1,0];prog(0,'Alignement des photos…');await yieldUI();
  const pyrRef=grayPyr(refC);let t1=performance.now();
  for(const dir of [1,-1]){let prevP=pyrRef,prevM=M[ref];
    for(let k=ref+dir;k>=0&&k<n;k+=dir){const c=fit(await frames.get(k)),pk=grayPyr(c),e=estimate(prevP,pk);
      if(!e.ok){info.lkFail++;}
      const P=e.ok?pToM(e.p,W,H):[1,0,0,0,1,0];M[k]=m3(P,prevM);prevP=pk;prevM=M[k];
      prog(.18*((Math.abs(k-ref))/Math.max(1,n-1)),'Alignement des photos…');await yieldUI()}}
  info.alignMs=performance.now()-t1;info.M=M;
  /* 2. fusion en flux : une photo à la fois */
  const lv=levelsFor(W,H),sc=Math.max(1,Math.min(W,H)/1000),acc=[],masks=opts.layers?[]:null,aligned=opts.layers?[]:null;let den0=null;
  const cov=mk(W,H);rx(cov);
  for(let k=0;k<n;k++){const raw=fit(await frames.get(k));let c=raw,valid=null;
    const id=Math.abs(M[k][0]-1)<1e-9&&Math.abs(M[k][4]-1)<1e-9&&Math.abs(M[k][2])<1e-6&&Math.abs(M[k][5])<1e-6&&Math.abs(M[k][1])<1e-9;
    if(!id){const iv=inv3(M[k]),t=mk(W,H),g=rx(t);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(raw,0,0);g.setTransform(iv[0],iv[3],iv[1],iv[4],iv[2],iv[5]);g.drawImage(raw,0,0);c=t;
      const cg=rx(cov);cg.setTransform(1,0,0,1,0,0);cg.clearRect(0,0,W,H);cg.setTransform(iv[0],iv[3],iv[1],iv[4],iv[2],iv[5]);cg.fillStyle='#fff';cg.fillRect(0,0,W,H);
      const al=new Float32Array(W*H);{const d=rx(cov).getImageData(0,0,W,H).data;for(let i=0,m=W*H;i<m;i++)al[i]=d[i*4+3]>=250?1:0}
      const bl=box(al,W,H,2);valid=new Uint8Array(W*H);let any=false;for(let i=0;i<valid.length;i++){const v=bl[i]>.999?1:0;valid[i]=v;if(!v)any=true}if(!any)valid=null}
    prog(.2+.7*(k+.1)/n,'Fusion des photos…');await yieldUI();
    const P=planesOf(c),Gp=pyrLap(P,W,H,lv),E=sharpEnergy(Gp,liss,sc),wm=weightMap(E,valid,liss);
    /* accumulation : somme pondérée de chaque niveau laplacien par la pyramide gaussienne des poids */
    let wl=wm,ww=W,hh=H;
    for(let l=0;l<Gp.length;l++){const q=Gp[l],m=q.w*q.h;let A=acc[l];if(!A)A=acc[l]={w:q.w,h:q.h,n:[new Float32Array(m),new Float32Array(m),new Float32Array(m)],d:new Float32Array(m)};
      const n0=A.n[0],n1=A.n[1],n2=A.n[2],d=A.d,p0=q.p[0],p1=q.p[1],p2=q.p[2];
      for(let i=0;i<m;i++){const v=wl[i];d[i]+=v;n0[i]+=v*p0[i];n1[i]+=v*p1[i];n2[i]+=v*p2[i]}
      if(l===0)den0=d;
      if(l<Gp.length-1){wl=red(wl,ww,hh);ww=(ww+1)>>1;hh=(hh+1)>>1}}
    if(masks){/* masque cumulatif : l'empilement des calques en mode normal reproduit la moyenne pondérée */
      const mk8=new Uint8Array(W*H);for(let i=0;i<mk8.length;i++){const d=den0[i];mk8[i]=d>1e-30?Math.min(255,Math.round(255*wm[i]/d)):255}
      masks.push(mk8);aligned.push(c)}
    prog(.2+.7*(k+1)/n,'Fusion des photos…');await yieldUI()}
  /* 3. reconstruction */
  prog(.92,'Reconstruction…');await yieldUI();
  let cur=null;
  for(let l=acc.length-1;l>=0;l--){const A=acc[l],m=A.d.length,r=[0,1,2].map(ci=>{const o=new Float32Array(m),nn=A.n[ci],d=A.d;for(let i=0;i<m;i++)o[i]=d[i]>1e-30?nn[i]/d[i]:0;return o});
    if(cur)for(let ci=0;ci<3;ci++){const e=expd(cur[ci],acc[l+1].w,acc[l+1].h,A.w,A.h),o=r[ci];for(let i=0;i<m;i++)o[i]+=e[i]}
    cur=r;acc[l+1]&&(acc[l+1]=null)}
  const out=mk(W,H),og=cx(out);
  for(let y0=0;y0<H;y0+=256){const bh=Math.min(256,H-y0),im=og.createImageData(W,bh),d=im.data,o=y0*W;
    for(let i=0,m=W*bh;i<m;i++){const r=cur[0][o+i],g=cur[1][o+i],b=cur[2][o+i];d[i*4]=r<0?0:r>1?255:r*255+.5;d[i*4+1]=g<0?0:g>1?255:g*255+.5;d[i*4+2]=b<0?0:b>1?255:b*255+.5;d[i*4+3]=255}
    og.putImageData(im,0,y0)}
  info.ms=performance.now()-t0;
  return{canvas:out,masks,aligned,info}}
/* ---------- sources : fichiers ou calques ---------- */
const pickMany_=()=>new Promise(res=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='image/*,.heic,.heif,.tif,.tiff,'+RAW_ACCEPT;i.onchange=()=>res([...i.files]);i.oncancel=()=>res([]);i.click()});
async function decodeTo(f,W,H){let bm=null;if(!RAW_EXT.test(f.name||'')&&!/\.(heic|heif|avif|tiff?)$/i.test(f.name||'')){try{bm=await createImageBitmap(f)}catch(e){}}
  let src=bm;if(!bm){src=await styleFromFile(f)}
  const sw=src.width,sh=src.height;if(!W){const cap=stackCap(),s=Math.min(1,Math.sqrt(cap/(sw*sh)));W=Math.round(sw*s);H=Math.round(sh*s)}
  const c=mk(W,H),g=rx(c);g.imageSmoothingQuality='high';g.drawImage(src,0,0,W,H);bm&&bm.close&&bm.close();return c}
/* plafond de pixels de travail selon la mémoire (traitement par photo entière) */
function stackCap(){const mem=navigator.deviceMemory||8;return Math.min(MAX_PX,mem>=8?24e6:mem>=4?12e6:6e6)}
function fileFrames(files){let dims=null;const cache=new Map();let keep=true;
  return{n:files.length,async get(i){if(cache.has(i))return cache.get(i);let c;
    if(!dims){const t=await decodeTo(files[i]);dims=[t.width,t.height];c=t}else c=await decodeTo(files[i],dims[0],dims[1]);
    if(keep&&files.length*dims[0]*dims[1]<=110e6)cache.set(i,c);return c}}}
function layerFrames(Ls){const cap=stackCap();return{n:Ls.length,async get(i){const c=Ls[i].canvas,s=Math.min(1,Math.sqrt(cap/(c.width*c.height))),t=mk(Math.round(c.width*s),Math.round(c.height*s)),g=rx(t);g.imageSmoothingQuality='high';g.drawImage(c,0,0,t.width,t.height);return t}}}
function maskCanvas(m8,W,H){const c=mk(W,H),g=cx(c);for(let y0=0;y0<H;y0+=256){const bh=Math.min(256,H-y0),im=g.createImageData(W,bh),d=im.data,o=y0*W;for(let i=0,n=W*bh;i<n;i++){d[i*4]=d[i*4+1]=d[i*4+2]=255;d[i*4+3]=m8[o+i]}g.putImageData(im,0,y0)}return c}
/* ---------- action complète : calcule puis ouvre le résultat dans un nouveau document ---------- */
async function stackCommand(frames,opts){opts=opts||{};busy(true,'Empilement de mise au point…',0);await tick();
  try{const prog=(p,m)=>busy(true,m,p);const r=await stackRun(frames,{liss:opts.liss,layers:opts.layers,progress:prog});
    const W=r.info.W,H=r.info.H;let names=opts.names||[];
    if(r.masks&&r.info.n*W*H>260e6){r.masks=null;r.aligned=null;toast('Trop de pixels pour garder les calques : seul le résultat est créé',5000)}
    busy(true,'Création du document…',.97);await tick();
    setDoc(r.canvas,'empilement.jpg',{});
    if(r.masks&&S.doc){const d=S.doc,Ls=[];for(let k=0;k<r.masks.length;k++){const L=newPixel(names[k]||('Prise '+(k+1)),r.aligned[k]);L.mask=maskCanvas(r.masks[k],W,H);r.masks[k]=null;Ls.push(L)}
      d.layers.splice(1,0,...Ls);d.active=1+Ls.length-1;S.history=[];S.hi=-1;markComp();pushHistory('Empilement de mise au point');syncAll()}
    busy(false);let mx=0;for(const m of r.info.M){const q=m.slice();mx=Math.max(mx,Math.hypot(q[2],q[5]))}
    toast('Empilement terminé : '+r.info.n+' photos alignées (décalage max '+mx.toFixed(1)+' px)'+(r.masks?'. Les masques des calques se retouchent au pinceau.':'.')+(r.info.lkFail?' '+r.info.lkFail+' photo(s) non alignées automatiquement.':''),7000);
    window.PrismStack.last=r.info;return r}
  catch(e){busy(false);console.error(e);toast('Empilement impossible : '+(e.message||e),5000)}}
function stackDialog(){const d=S.doc,Ls=d?d.layers.filter(L=>L.kind==='pixel'&&L.canvas&&!L.editMask):[],canL=Ls.length>=2&&Ls.length<=STK_MAX;
  dialog({title:'Empilement de mise au point',light:true,body:`<p class="muted" style="margin:0 0 10px">Fusionne plusieurs prises faites à des mises au point différentes pour obtenir une photo nette partout. Les prises sont alignées automatiquement (décalage, échelle, légère rotation).</p>
  <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"><label style="display:flex;gap:6px;align-items:center"><input type="radio" name="stkSrc" value="files" checked> Choisir de ${STK_MIN} à ${STK_MAX} photos</label>
  <label style="display:flex;gap:6px;align-items:center;${canL?'':'opacity:.5'}"><input type="radio" name="stkSrc" value="layers" ${canL?'':'disabled'}> Utiliser les calques du document${canL?' ('+Ls.length+')':''}</label></div>
  ${rangeRow('stkL','Lissage',0,100,1,30,'')}
  <label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="stkK" checked> Garder les prises alignées en calques avec masques</label>`,
  onOpen:el=>{const r=$('#stkL',el),o=$('#stkL-o',el);r.addEventListener('input',()=>{o.textContent=r.value})},
  buttons:[{label:'Annuler'},{label:'Empiler',primary:true,onClick:el=>{const src=(el.querySelector('input[name=stkSrc]:checked')||{}).value,liss=+$('#stkL',el).value,keep=$('#stkK',el).checked;
    if(src==='layers'&&canL){stackCommand(layerFrames(Ls),{liss,layers:keep,names:Ls.map(L=>L.name)});return}
    pickMany_().then(fs=>{if(fs.length<STK_MIN){if(fs.length)toast('Choisissez au moins deux photos');return}if(fs.length>STK_MAX){toast('Trente photos au maximum');return}
      fs.sort((a,b)=>(a.name||'').localeCompare(b.name||'',undefined,{numeric:true}));stackCommand(fileFrames(fs),{liss,layers:keep,names:fs.map(f=>(f.name||'').replace(/\.[^.]+$/,''))})})}}]})}
/* ---------- menu Fichier > Photos multiples + palette Ctrl+K ---------- */
const _mf=MENU2.file.items;
MENU2.file.items=()=>{const a=_mf();const g=a.find(x=>x&&x.label==='Photos multiples'&&typeof x.sub==='function');const it=MI('Empilement de mise au point…',{fn:stackDialog});
  if(g){const s0=g.sub;if(!g.__stk){g.__stk=1;g.sub=()=>{const b=s0();return b.some(x=>x&&x.label===it.label)?b:[...b,it]}}}
  else if(!a.some(x=>x&&x.label===it.label)){const k=a.findIndex(x=>x&&x.label==='Panorama…');if(k>=0)a.splice(k+1,0,it);else a.push(SEP,it)}
  return a};
window.PrismStack={run:stackRun,command:stackCommand,dialog:stackDialog,fileFrames,layerFrames,estimate,grayPyr,pToM,inv3,apply,cap:stackCap};
})();
