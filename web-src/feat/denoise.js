/* ===== Réduction du bruit v2 : luminance (moyennes non locales) + couleur (filtre guidé) + détails + contours =====
   Le noyau (entre CORE_BEGIN et CORE_END) est autonome : il tourne tel quel dans des Web Workers (Blob) et sur le fil principal (repli synchrone). */
/*CORE_BEGIN*/
function dnTile(job){
  const P=job.P,W=P.W,H=P.H,ov=P.ov,c=job.core,rg=job.reg;
  const wx0=c.x-ov,wy0=c.y-ov,ww=c.w+2*ov,wh=c.h+2*ov,n=ww*wh;
  const Y=new Float32Array(n),Cb=new Float32Array(n),Cr=new Float32Array(n),A=new Uint8Array(n);
  const rd=rg.data,KB=0.5389,KR=0.6350;
  for(let j=0;j<wh;j++){let gy=wy0+j;gy=gy<0?0:gy>=H?H-1:gy;const ro=(gy-rg.y)*rg.w;
    for(let i=0;i<ww;i++){let gx=wx0+i;gx=gx<0?0:gx>=W?W-1:gx;const q=(ro+gx-rg.x)*4,r=rd[q],g=rd[q+1],b=rd[q+2],k=j*ww+i;
      const y=0.2126*r+0.7152*g+0.0722*b;Y[k]=y;Cb[k]=(b-y)*KB;Cr[k]=(r-y)*KR;A[k]=rd[q+3]}}
  const sY=P.sY,S=P.S,lum=P.lum,col=P.col,det=P.det,prot=P.prot;
  /* mesure de contour (dégradé du luma lissé 3x3), support 2 px */
  const E=new Float32Array(n),Ys=new Float32Array(n);
  if(lum>0||det>0){
    for(let y=1;y<wh-1;y++)for(let x=1;x<ww-1;x++){const k=y*ww+x;Ys[k]=(Y[k-ww-1]+Y[k-ww]+Y[k-ww+1]+Y[k-1]+Y[k]+Y[k+1]+Y[k+ww-1]+Y[k+ww]+Y[k+ww+1])/9}
    const t0=0.8*sY,t1=6*sY;
    for(let y=2;y<wh-2;y++)for(let x=2;x<ww-2;x++){const k=y*ww+x,gx=Ys[k+1]-Ys[k-1],gy=Ys[k+ww]-Ys[k-ww],g=Math.sqrt(gx*gx+gy*gy);let t=(g-t0)/t1;t=t<0?0:t>1?1:t;E[k]=t*t*(3-2*t)}}
  /* luma : moyennes non locales (symétriques, fenêtre de recherche S, patch 5x5) */
  let Yd=Y;
  if(lum>0){
    const hb=P.hBase,hl=new Float32Array(n),acc=new Float32Array(n),ws=new Float32Array(n),sd=new Float32Array(n),hs=new Float32Array(n);
    const pk=1-0.8*prot;for(let k=0;k<n;k++)hl[k]=hb*(1-0.8*prot*E[k]);
    const LS=64,XM=6,lut=new Float32Array(XM*LS+2);for(let i=0;i<lut.length;i++)lut[i]=Math.exp(-i/LS);
    const s2=2*sY*sY;
    for(let dy=0;dy<=S;dy++)for(let dx=-S;dx<=S;dx++){
      if(dy===0&&dx<=0)continue;
      const o=dy*ww+dx,xl=2+(dx<0?-dx:0),xh=ww-3-(dx>0?dx:0),yl=2,yh=wh-3-dy;if(xh<xl||yh<yl)continue;
      for(let y=yl-2;y<=yh+2;y++){const b=y*ww;for(let x=xl-2;x<=xh+2;x++){const d=Y[b+x]-Y[b+x+o];sd[b+x]=d*d}}
      for(let y=yl-2;y<=yh+2;y++){const b=y*ww;for(let x=xl;x<=xh;x++){const k=b+x;hs[k]=sd[k-2]+sd[k-1]+sd[k]+sd[k+1]+sd[k+2]}}
      for(let y=yl;y<=yh;y++){const b=y*ww;for(let x=xl;x<=xh;x++){const k=b+x,d2=(hs[k-2*ww]+hs[k-ww]+hs[k]+hs[k+ww]+hs[k+2*ww])*0.04,hq=0.5*(hl[k]+hl[k+o]);
        let v=(d2-s2)/(hq*hq);if(v<0)v=0;if(v>=XM)continue;const w=lut[(v*LS)|0];acc[k]+=w*Y[k+o];ws[k]+=w;acc[k+o]+=w*Y[k];ws[k+o]+=w}}
    }
    Yd=new Float32Array(n);for(let k=0;k<n;k++)Yd[k]=(Y[k]+acc[k])/(1+ws[k]);
  }
  /* détails : on réinjecte la texture (résidu) là où la variance locale dépasse le bruit */
  let Yo=Yd;
  if(det>0&&lum>0){
    Yo=new Float32Array(n);const m1=new Float32Array(n),m2=new Float32Array(n),h1=new Float32Array(n),h2=new Float32Array(n),s2=sY*sY;
    for(let y=0;y<wh;y++)for(let x=2;x<ww-2;x++){const k=y*ww+x,a=Y[k-2],b=Y[k-1],cc=Y[k],d=Y[k+1],e=Y[k+2];h1[k]=a+b+cc+d+e;h2[k]=a*a+b*b+cc*cc+d*d+e*e}
    for(let y=2;y<wh-2;y++)for(let x=2;x<ww-2;x++){const k=y*ww+x;m1[k]=(h1[k-2*ww]+h1[k-ww]+h1[k]+h1[k+ww]+h1[k+2*ww])*0.04;m2[k]=(h2[k-2*ww]+h2[k-ww]+h2[k]+h2[k+ww]+h2[k+2*ww])*0.04}
    const dk=det/100;
    for(let k=0;k<n;k++){const v=m2[k]-m1[k]*m1[k];let g=(v/s2-1.2)/1.0;g=g<0?0:g>1?1:g;g=0.08+0.92*g;Yo[k]=Yd[k]+dk*g*(Y[k]-Yd[k])}
  }
  /* couleur : filtre guidé (guide = luma débruité + un peu de chroma pour tenir les bords de couleur) */
  let Cb2=Cb,Cr2=Cr;
  if(col>0){
    const r=P.rC,eps=P.eps,r2=Math.max(1,Math.round(r/2));
    const cbs=new Float32Array(n),crs=new Float32Array(n);
    for(let y=1;y<wh-1;y++)for(let x=1;x<ww-1;x++){const k=y*ww+x;let a=0,b=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){a+=Cb[k+dy*ww+dx];b+=Cr[k+dy*ww+dx]}cbs[k]=a/9;crs[k]=b/9}
    /* le lissage de la chroma se fait à demi-résolution (cellules 2x2 alignées sur des coordonnées paires), coefficients ré-échantillonnés en bilinéaire */
    const hw=(ww+1)>>1,hh=(wh+1)>>1,m=hw*hh,nb=()=>new Float32Array(m);
    const down=src=>{const o=nb();for(let y=0;y<hh;y++)for(let x=0;x<hw;x++){const x1=Math.min(ww-1,2*x+1),y1=Math.min(wh-1,2*y+1);o[y*hw+x]=(src[2*y*ww+2*x]+src[2*y*ww+x1]+src[y1*ww+2*x]+src[y1*ww+x1])*0.25}return o};
    const bx=(src,rad)=>{
      const t=new Float64Array(m);
      for(let y=0;y<hh;y++){const b=y*hw;let s=0;const lim=Math.min(rad,hw-1);for(let x=0;x<=lim;x++)s+=src[b+x];
        for(let x=0;x<hw;x++){if(x>0){const hi=x+rad,lo=x-rad-1;if(hi<hw)s+=src[b+hi];if(lo>=0)s-=src[b+lo]}t[b+x]=s}}
      const o=nb();
      for(let x=0;x<hw;x++){const cx2=Math.min(hw-1,x+rad)-Math.max(0,x-rad)+1;let s=0;const lim=Math.min(rad,hh-1);for(let y=0;y<=lim;y++)s+=t[y*hw+x];
        for(let y=0;y<hh;y++){if(y>0){const hi=y+rad,lo=y-rad-1;if(hi<hh)s+=t[hi*hw+x];if(lo>=0)s-=t[lo*hw+x]}
          o[y*hw+x]=s/((Math.min(hh-1,y+rad)-Math.max(0,y-rad)+1)*cx2)}}
      return o};
    const I=[Yd,cbs,crs],Ih=I.map(down),mI=Ih.map(v=>bx(v,r2));
    const S6=[],tmp=nb();
    for(let a=0;a<3;a++)for(let b=a;b<3;b++){for(let k=0;k<m;k++)tmp[k]=Ih[a][k]*Ih[b][k];const q=bx(tmp,r2);for(let k=0;k<m;k++)q[k]-=mI[a][k]*mI[b][k];S6.push(q)}
    const iv=[nb(),nb(),nb(),nb(),nb(),nb()];
    for(let k=0;k<m;k++){const a=S6[0][k]+eps,b=S6[1][k],c2=S6[2][k],d=S6[3][k]+eps,e=S6[4][k],f=S6[5][k]+eps;
      const c00=d*f-e*e,c01=c2*e-b*f,c02=b*e-c2*d,c11=a*f-c2*c2,c12=b*c2-a*e,c22=a*d-b*b,det=a*c00+b*c01+c2*c02,id=1/det;
      iv[0][k]=c00*id;iv[1][k]=c01*id;iv[2][k]=c02*id;iv[3][k]=c11*id;iv[4][k]=c12*id;iv[5][k]=c22*id}
    /* échantillonnage bilinéaire (centres de cellules à 2x+0.5) */
    const up=(src,dst)=>{for(let y=0;y<wh;y++){let fy=(y-0.5)/2;if(fy<0)fy=0;let y0=Math.floor(fy);if(y0>hh-1)y0=hh-1;const y1=Math.min(hh-1,y0+1),ty=fy-y0;
        for(let x=0;x<ww;x++){let fx=(x-0.5)/2;if(fx<0)fx=0;let x0=Math.floor(fx);if(x0>hw-1)x0=hw-1;const x1=Math.min(hw-1,x0+1),tx=fx-x0;
          dst[y*ww+x]=(src[y0*hw+x0]*(1-tx)+src[y0*hw+x1]*tx)*(1-ty)+(src[y1*hw+x0]*(1-tx)+src[y1*hw+x1]*tx)*ty}}return dst};
    const gf=Pc=>{const Ph=down(Pc),mP=bx(Ph,r2),cv=[];
      for(let a=0;a<3;a++){for(let k=0;k<m;k++)tmp[k]=Ih[a][k]*Ph[k];const q=bx(tmp,r2);for(let k=0;k<m;k++)q[k]-=mI[a][k]*mP[k];cv.push(q)}
      const A0=nb(),A1=nb(),A2=nb(),B=nb();
      for(let k=0;k<m;k++){const x=cv[0][k],y=cv[1][k],z=cv[2][k],a0=iv[0][k]*x+iv[1][k]*y+iv[2][k]*z,a1=iv[1][k]*x+iv[3][k]*y+iv[4][k]*z,a2=iv[2][k]*x+iv[4][k]*y+iv[5][k]*z;
        A0[k]=a0;A1[k]=a1;A2[k]=a2;B[k]=mP[k]-a0*mI[0][k]-a1*mI[1][k]-a2*mI[2][k]}
      const f0=up(bx(A0,r2),new Float32Array(n)),f1=up(bx(A1,r2),new Float32Array(n)),f2=up(bx(A2,r2),new Float32Array(n)),fb=up(bx(B,r2),new Float32Array(n)),o=new Float32Array(n),bl=P.cBlend;
      for(let k=0;k<n;k++){const f=f0[k]*Yd[k]+f1[k]*cbs[k]+f2[k]*crs[k]+fb[k];o[k]=Pc[k]+(f-Pc[k])*bl}return o};
    Cb2=gf(Cb);Cr2=gf(Cr);
  }
  const out=new Uint8ClampedArray(c.w*c.h*4);
  for(let j=0;j<c.h;j++){const sb=(j+ov)*ww+ov;for(let i=0;i<c.w;i++){const k=sb+i,y=Yo[k],cb=Cb2[k]/KB,cr=Cr2[k]/KR,r=y+cr,b=y+cb,g=(y-0.2126*r-0.0722*b)/0.7152,q=(j*c.w+i)*4;
    out[q]=r;out[q+1]=g;out[q+2]=b;out[q+3]=A[k]}}
  return {out:out,x:c.x,y:c.y,w:c.w,h:c.h};
}
/* estimation du bruit (MAD du résidu laplacien) sur des blocs fixes ; getReg(x,y,w,h) -> {data,w,h} */
function dnEstimate(W,H,getReg){
  const BS=Math.min(160,W,H),nx=Math.min(4,Math.max(1,Math.floor(W/BS))),ny=Math.min(3,Math.max(1,Math.floor(H/BS))),ry=[],rc=[];
  for(let by=0;by<ny;by++)for(let bx=0;bx<nx;bx++){
    const x0=Math.round((bx+0.5)*W/nx-BS/2),y0=Math.round((by+0.5)*H/ny-BS/2),X=Math.max(0,Math.min(W-BS,x0)),Y0=Math.max(0,Math.min(H-BS,y0)),r=getReg(X,Y0,BS,BS),d=r.data,w=BS;
    const Yb=new Float32Array(BS*BS),Cbb=new Float32Array(BS*BS),Crb=new Float32Array(BS*BS);
    for(let k=0;k<BS*BS;k++){const R=d[k*4],G=d[k*4+1],B=d[k*4+2],y=0.2126*R+0.7152*G+0.0722*B;Yb[k]=y;Cbb[k]=(B-y)*0.5389;Crb[k]=(R-y)*0.635}
    for(let y=1;y<BS-1;y++)for(let x=1;x<BS-1;x++){const k=y*w+x;
      ry.push(Math.abs(Yb[k]-0.25*(Yb[k-1]+Yb[k+1]+Yb[k-w]+Yb[k+w])));
      rc.push(Math.abs(Cbb[k]-0.25*(Cbb[k-1]+Cbb[k+1]+Cbb[k-w]+Cbb[k+w])));rc.push(Math.abs(Crb[k]-0.25*(Crb[k-1]+Crb[k+1]+Crb[k-w]+Crb[k+w])))}}
  const med=a=>{const f=Float32Array.from(a).sort();return f[f.length>>1]||0};
  const k=1.4826/Math.sqrt(1.25);
  return {sY:Math.max(1.5,med(ry)*k),sC:Math.max(1,med(rc)*k)};
}
/* paramètres dérivés (identiques pour toutes les tuiles : c'est ce qui rend le résultat indépendant du découpage) */
function dnPlan(W,H,p,getReg,tile){
  const lum=Math.max(0,+(p.a==null?50:p.a)),col=Math.max(0,+(p.c==null?70:p.c)),det=Math.max(0,+(p.d==null?30:p.d)),prot=Math.min(1,Math.max(0,(p.e==null?60:p.e)/100));
  const est=dnEstimate(W,H,getReg),mp=W*H/1e6,sc=Math.min(2,Math.max(1,Math.sqrt(mp/2)));
  const S=lum<=0?0:lum<35?3:lum<70?4:5,rC=col>0?Math.min(16,Math.max(2,Math.round((2+0.12*col)*sc))):0;
  const P={W:W,H:H,lum:lum,col:col,det:det,prot:prot,sY:est.sY,sC:est.sC,S:S,rC:rC,
    hBase:est.sY*(0.1+lum/100*0.9),
    eps:Math.pow(Math.max(3,est.sC*(0.8+col/100*4))*(1-0.6*prot)+2,2),gc:0.5,cBlend:Math.min(1,col/15)};
  P.ov=Math.max(S+4,(col>0?S+2+2*rC+12:0),6);P.ov+=P.ov&1;
  const T=(tile||512)&~1,tiles=[];
  for(let y=0;y<H;y+=T)for(let x=0;x<W;x+=T)tiles.push({x:x,y:y,w:Math.min(T,W-x),h:Math.min(T,H-y)});
  return {P:P,tiles:tiles};
}
function dnRegion(P,c){const ov=P.ov,x0=Math.max(0,c.x-ov),y0=Math.max(0,c.y-ov),x1=Math.min(P.W,c.x+c.w+ov),y1=Math.min(P.H,c.y+c.h+ov);return {x:x0,y:y0,w:x1-x0,h:y1-y0}}
/*CORE_END*/

/* ---- colle navigateur ---- */
const DN={workers:null,src:null,wsrc(){if(!this.src)this.src=URL.createObjectURL(new Blob(['const dnTile='+dnTile.toString()+';onmessage=e=>{try{const r=dnTile(e.data);postMessage(r,[r.out.buffer])}catch(err){postMessage({err:String(err&&err.message||err)})}}'],{type:'text/javascript'}));return this.src}};
const dnReg=g=>(x,y,w,h)=>{const im=g.getImageData(x,y,w,h);return {data:im.data,w:w,h:h}};
/* synchrone (repli : effets modifiables, actions, dernier filtre) ; opts.tile pour les tests */
function dnRunSync(s,p,opts){opts=opts||{};const W=s.width,H=s.height,g=cx(s),pl=dnPlan(W,H,p||{},dnReg(g),opts.tile),out=mk(W,H),og=cx(out);
  for(const c of pl.tiles){const r=dnRegion(pl.P,c),im=g.getImageData(r.x,r.y,r.w,r.h),o=dnTile({P:pl.P,core:c,reg:{x:r.x,y:r.y,w:r.w,h:r.h,data:im.data}});og.putImageData(new ImageData(o.out,o.w,o.h),o.x,o.y)}
  return out}
/* asynchrone par Workers, tuiles avec recouvrement, progression + annulation. region = {x,y,w,h} pour l'aperçu */
function dnRunAsync(s,p,opts){opts=opts||{};const W=s.width,H=s.height,g=cx(s),pl=dnPlan(W,H,p||{},dnReg(g),opts.tile);
  let tiles=pl.tiles;
  const out=mk(W,H),og=cx(out);og.drawImage(s,0,0);
  const nW=Math.max(1,Math.min(opts.workers||Math.min(4,Math.max(1,(navigator.hardwareConcurrency||4)-1)),tiles.length));
  let next=0,done=0,fail=null,cancelled=false;const ws=[];
  let rejectFn=null;const job={cancel(){if(cancelled)return;cancelled=true;ws.forEach(w=>w.terminate());if(rejectFn)rejectFn(Object.assign(new Error('annulé'),{code:'cancelled'}))},promise:null};
  job.promise=new Promise((res,rej)=>{rejectFn=rej;
    const finish=()=>{ws.forEach(w=>w.terminate());if(cancelled)rej(Object.assign(new Error('annulé'),{code:'cancelled'}));else if(fail)rej(fail);else res(out)};
    const feed=w=>{if(cancelled||fail)return;if(next>=tiles.length){return}const c=tiles[next++],r=dnRegion(pl.P,c),im=g.getImageData(r.x,r.y,r.w,r.h);w.postMessage({P:pl.P,core:c,reg:{x:r.x,y:r.y,w:r.w,h:r.h,data:im.data}},[im.data.buffer])};
    for(let i=0;i<nW;i++){
      const w=new Worker(DN.wsrc());ws.push(w);
      w.onmessage=e=>{const o=e.data;if(o.err){fail=new Error(o.err);finish();return}
        og.putImageData(new ImageData(o.out,o.w,o.h),o.x,o.y);done++;if(opts.onProgress)opts.onProgress(done/tiles.length);
        if(done===tiles.length)finish();else feed(w)};
      w.onerror=e=>{fail=new Error(e.message||'worker');finish()};
      feed(w)}
  });
  job.promise.P=pl.P;job.P=pl.P;return job}

/* ---- branchement dans les filtres ---- */
{const F=FILTERS.denoise;
 F.params=[['a','Luminance',0,100,1,50,' %'],['c','Couleur',0,100,1,70,' %'],['d','Détails',0,100,1,30,' %'],['e','Contours protégés',0,100,1,60,' %']];
 F.run=function(s,p){F._lp={...p};const R=(window.PrismC&&window.PrismC.REC)||(typeof REC==='object'?REC:null);if(R)R.last={id:'denoise',p:{...p}};return dnRunSync(s,p)};
 window.DNX={plan:dnPlan,tile:dnTile,runSync:dnRunSync,runAsync:dnRunAsync};
 const _fd=filterDialog;
 const dnTarget=()=>{const d=S.doc;if(!d)return null;const M=maskTarget();if(M)return{L:M,mask:true};const L=pixelTarget();return L?{L,mask:false}:null};
 const alive=(d,L)=>S.doc===d&&d.layers.includes(L);
 const mixSel=(o,r,sel)=>{const out=cloneC(o),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(sel,0,0);const t=cloneC(r),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(sel,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};
 filterDialog=function(id){
  if(id!=='denoise')return _fd.apply(this,arguments);
  const d=S.doc;if(!d)return;const T=dnTarget();if(!T){toast('Aucun calque de pixels à filtrer');return}
  if(T.mask)return _fd.apply(this,arguments);
  const L=T.L;if(L.visible===false){toast('Ce calque est masqué : affichez-le pour appliquer un filtre');return}
  const P=F.params,p={};P.forEach(q=>p[q[0]]=q[5]);const orig=L.canvas;let tmr=null,job=null,seq=0;
  const clear=()=>{clearTimeout(tmr);seq++;if(job){job.cancel();job=null}delete L.preview};
  const big=orig.width*orig.height>1.6e6;
  /* aperçu : zone de 700x700 au centre de l'écran quand la photo est grande, photo entière sinon */
  const prev=()=>{clearTimeout(tmr);const my=++seq;if(job){job.cancel();job=null}
   tmr=setTimeout(async()=>{
    try{const w=orig.width,h=orig.height;let x=0,y=0,cw=w,ch=h;
     if(big){cw=Math.min(w,700);ch=Math.min(h,700);const cxp=(view.width/S.pr/2-S.panX)/S.zoom,cyp=(view.height/S.pr/2-S.panY)/S.zoom;x=Math.round(Math.max(0,Math.min(w-cw,cxp-cw/2)));y=Math.round(Math.max(0,Math.min(h-ch,cyp-ch/2)))}
     const pr=big?await cropPrev(orig,x,y,cw,ch,p,j=>{job=j}):await new Promise((res,rej)=>{job=dnRunAsync(orig,p);job.promise.then(res,rej)});
     if(my!==seq||!alive(d,L))return;job=null;let r=pr;if(d.sel)r=mixSel(orig,r,d.sel);L.preview=r;markComp()}
    catch(e){if(e&&e.code==='cancelled')return;console.error(e);toast('Aperçu impossible : '+(e.message||e),3000)}},150)};
  /* aperçu local : on filtre un morceau avec les paramètres globaux de toute la photo (même résultat que l'application) */
  async function cropPrev(src,x,y,cw,ch,p,setJob){
   const pl=dnPlan(src.width,src.height,p,dnReg(cx(src))),res=mk(src.width,src.height),rg=cx(res);rg.drawImage(src,0,0);
   const sg=cx(src);const jb={cancel(){this.c=true},c:false};setJob(jb);
   for(const c of dnTilesIn(pl,x,y,cw,ch)){if(jb.c)throw Object.assign(new Error('annulé'),{code:'cancelled'});
    const r=dnRegion(pl.P,c),im=sg.getImageData(r.x,r.y,r.w,r.h),o=dnTile({P:pl.P,core:c,reg:{x:r.x,y:r.y,w:r.w,h:r.h,data:im.data}});rg.putImageData(new ImageData(o.out,o.w,o.h),o.x,o.y);await new Promise(r=>setTimeout(r,0))}
   return res}
  dialog({title:F.name,light:true,
   body:P.map(q=>rangeRow('f-'+q[0],q[1],q[2],q[3],q[4],q[5],q[6])).join('')+(big?'<p class="muted">Aperçu sur la zone centrale ; l’application traite toute la photo.</p>':'')+(d.sel?'<p class="muted">Appliqué uniquement à la sélection.</p>':''),
   onOpen:el=>{P.forEach(q=>{const i=$('#f-'+q[0],el);i.oninput=()=>{p[q[0]]=+i.value;$('#f-'+q[0]+'-o',el).textContent=fmtN(+i.value,q[4])+q[6];prev()}});prev()},
   buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
    {label:'Appliquer',primary:true,onClick:()=>{clear();if(!alive(d,L)){toast('Le calque n’existe plus');return}
      runApply(d,L,orig,p);}}]})};
 async function runApply(d,L,orig,p){
  const total=orig.width*orig.height;busy(true,'Réduction du bruit…',0);
  let job,cancelled=false;const bz=$('#busy');let btn=null;
  if(bz){const box=bz.firstElementChild;btn=document.createElement('button');btn.className='btn';btn.textContent='Annuler';btn.style.justifySelf='end';btn.onclick=()=>{cancelled=true;if(job)job.cancel()};box.appendChild(btn)}
  try{
   await new Promise(r=>setTimeout(r,30));
   job=dnRunAsync(orig,p,{onProgress:f=>busy(true,'Réduction du bruit…',f)});
   let r=await job.promise;
   if(!alive(d,L)){toast('Le calque n’existe plus');return}
   F._lp={...p};
   applyMasked(L,r,F.name)}
  catch(e){if(!(e&&e.code==='cancelled')){console.error(e);toast('Filtre impossible : '+(e.message||e),4000)}}
  finally{if(btn)btn.remove();busy(false)}}
 function dnTilesIn(pl,x,y,w,h){const T=pl.tiles,ts=[];const t=512;x&=~1;y&=~1;for(let ty=y;ty<y+h;ty+=t)for(let tx=x;tx<x+w;tx+=t)ts.push({x:tx,y:ty,w:Math.min(t,x+w-tx),h:Math.min(t,y+h-ty)});return ts}
}
