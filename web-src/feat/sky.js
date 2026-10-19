/* ================= Sélectionner le ciel : segmentation classique, sans modèle ================= */
/* Pipeline : copie réduite (~800 px) -> croissance de région depuis le bord haut (continuité de couleur,
   texture faible, familles de teintes ciel) -> nuages (clairs, sous la ligne basse du ciel) -> bord récupéré,
   trous bouchés, horizon -> remontée à ~1600 px, détection des structures fines sombres (branches, fils)
   -> filtre guidé (refineMask) sur la photo -> masque pleine résolution. */
const SKY={};
SKY.analyze=(rgba,W,H)=>{
  const n=W*H,T=new Float32Array(n),F=()=>new Float32Array(n);
  const R=F(),G=F(),B=F();for(let i=0;i<n;i++){R[i]=rgba[i*4]/255;G[i]=rgba[i*4+1]/255;B[i]=rgba[i*4+2]/255}
  const sR=F(),sG=F(),sB=F();boxMean(R,W,H,1,sR,T);boxMean(G,W,H,1,sG,T);boxMean(B,W,H,1,sB,T);
  const L=F(),L2=F(),m1=F(),m2=F(),tex=F();
  for(let i=0;i<n;i++){const l=.299*sR[i]+.587*sG[i]+.114*sB[i];L[i]=l;L2[i]=l*l}
  boxMean(L,W,H,2,m1,T);boxMean(L2,W,H,2,m2,T);for(let i=0;i<n;i++)tex[i]=Math.sqrt(Math.max(0,m2[i]-m1[i]*m1[i]));
  // familles de teintes : 1 bleu, 2 gris/blanc, 3 chaud (orange, rose, violet)
  const fam=new Uint8Array(n),sat=F(),val=F();
  for(let i=0;i<n;i++){const r=sR[i],g=sG[i],b=sB[i],mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=mx,s=mx>0?(mx-mn)/mx:0;sat[i]=s;val[i]=v;let h=0;const d=mx-mn;
    if(d>1e-6){h=mx===r?((g-b)/d+6)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}
    let f=0;
    if(s<.14&&v>.4)f=2;
    else if(h>=170&&h<=268&&s>=.09&&v>.12)f=1;
    else if((h<=52||h>=268)&&s>=.28&&v>=.28)f=3;
    else if(h>52&&h<72&&s>=.2&&v>=.6)f=3;
    fam[i]=f}
  // bruit de fond : médiane de la texture en haut de l'image
  const top=Math.max(2,Math.round(H*.12)),smp=[];for(let y=0;y<top;y++)for(let x=0;x<W;x+=2)if(fam[y*W+x])smp.push(tex[y*W+x]);
  smp.sort((a,b)=>a-b);const tm=smp.length?smp[smp.length>>1]:.02;
  const tTex=Math.min(.05,Math.max(.022,2.2*tm+.012)),tStep=Math.min(.06,Math.max(.03,.03+2*tm));
  const mask=new Uint8Array(n),stack=new Int32Array(n);let sp=0;
  const ok=(i)=>fam[i]>0&&tex[i]<tTex;
  const dist=(a,b)=>{const dr=sR[a]-sR[b],dg=sG[a]-sG[b],db=sB[a]-sB[b];return Math.sqrt(dr*dr+dg*dg+db*db)};
  for(let x=0;x<W;x++){if(ok(x)){mask[x]=1;stack[sp++]=x}}
  const grow=(test)=>{while(sp>0){const p=stack[--sp],x=p%W,y=(p-x)/W;
    if(x>0){const q=p-1;if(!mask[q]&&test(p,q)){mask[q]=1;stack[sp++]=q}}
    if(x<W-1){const q=p+1;if(!mask[q]&&test(p,q)){mask[q]=1;stack[sp++]=q}}
    if(y>0){const q=p-W;if(!mask[q]&&test(p,q)){mask[q]=1;stack[sp++]=q}}
    if(y<H-1){const q=p+W;if(!mask[q]&&test(p,q)){mask[q]=1;stack[sp++]=q}}}};
  grow((p,q)=>ok(q)&&dist(p,q)<tStep);
  let core=0;for(let i=0;i<n;i++)core+=mask[i];
  const info={tTex,tStep,core:core/n};
  if(core/n<.015)return{mask:null,cov:core/n,info};
  // ligne basse du ciel par colonne (maximum sur ±4 % de la largeur)
  const low=new Int32Array(W).fill(-1);for(let x=0;x<W;x++)for(let y=H-1;y>=0;y--)if(mask[y*W+x]){low[x]=y;break}
  const RB=Math.max(2,Math.round(W*.04)),band=new Int32Array(W).fill(-1);
  {const dq=[];for(let x=0;x<W;x++){let m=-1;for(let k=Math.max(0,x-RB);k<=Math.min(W-1,x+RB);k++)if(low[k]>m)m=low[k];band[x]=m}}
  // nuages : clairs et peu saturés, au-dessus de la ligne basse (marge de 4 px)
  const cloudy=(i)=>sat[i]<.3&&val[i]>.6;
  for(let i=0;i<n;i++)if(mask[i])stack[sp++]=i;
  grow((p,q)=>{const x=q%W,y=(q-x)/W;return cloudy(q)&&y<=band[x]+4});
  // poches de ciel (entre feuillages, branches) : pixels proches de la couleur moyenne du ciel sur la même ligne
  {const mr=new Float32Array(H),mg=new Float32Array(H),mb=new Float32Array(H),mc=new Int32Array(H);
    for(let y=0;y<H;y++){let c=0,r=0,g=0,b=0;for(let x=0;x<W;x++){const i=y*W+x;if(mask[i]){c++;r+=sR[i];g+=sG[i];b+=sB[i]}}mc[y]=c;if(c){mr[y]=r/c;mg[y]=g/c;mb[y]=b/c}}
    const need=Math.max(3,Math.round(W*.01));
    const cand=(i,y)=>{if(mask[i]||mc[y]<need||fam[i]===0||tex[i]>=tTex)return false;const dr=sR[i]-mr[y],dg=sG[i]-mg[y],db=sB[i]-mb[y];return dr*dr+dg*dg+db*db<.0049};
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!cand(i,y))continue;
      // composante connexe de candidats, ajoutée telle quelle
      let tp=0;const list=[];stack[tp++]=i;mask[i]=2;
      while(tp>0){const p=stack[--tp];list.push(p);const px=p%W,py=(p-px)/W;
        if(px>0&&cand(p-1,py)){mask[p-1]=2;stack[tp++]=p-1}if(px<W-1&&cand(p+1,py)){mask[p+1]=2;stack[tp++]=p+1}
        if(py>0&&cand(p-W,py-1)){mask[p-W]=2;stack[tp++]=p-W}if(py<H-1&&cand(p+W,py+1)){mask[p+W]=2;stack[tp++]=p+W}}}
    for(let i=0;i<n;i++)if(mask[i]===2)mask[i]=1}
  // récupération du bord : 3 pas de dilatation par similarité de couleur
  for(let it=0;it<3;it++){const add=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(mask[p])continue;
      let nb=-1;if(x>0&&mask[p-1])nb=p-1;else if(x<W-1&&mask[p+1])nb=p+1;else if(y>0&&mask[p-W])nb=p-W;else if(y<H-1&&mask[p+W])nb=p+W;
      if(nb>=0&&fam[p]>0&&dist(nb,p)<tStep*1.5)add.push(p)}
    for(const p of add)mask[p]=1}
  // trous entourés de ciel (soleil, oiseaux, avion)
  {const maxHole=Math.round(n*.005),seen=new Uint8Array(n),st=new Int32Array(n);
    for(let s0=0;s0<n;s0++){if(mask[s0]||seen[s0])continue;let c=0,touch=false,tp=0;st[tp++]=s0;seen[s0]=1;const list=[];
      while(tp>0){const p=st[--tp];c++;if(c<=maxHole)list.push(p);const x=p%W,y=(p-x)/W;if(x===0||y===0||x===W-1||y===H-1)touch=true;
        if(x>0&&!mask[p-1]&&!seen[p-1]){seen[p-1]=1;st[tp++]=p-1}if(x<W-1&&!mask[p+1]&&!seen[p+1]){seen[p+1]=1;st[tp++]=p+1}
        if(y>0&&!mask[p-W]&&!seen[p-W]){seen[p-W]=1;st[tp++]=p-W}if(y<H-1&&!mask[p+W]&&!seen[p+W]){seen[p+W]=1;st[tp++]=p+W}}
      if(!touch&&c<=maxHole)for(const p of list)mask[p]=1}}
  // horizon : dernière ligne couverte à >= 35 % du maximum ; on coupe nettement en dessous (reflets, poches)
  {const cov=new Float32Array(H);let mxC=0;for(let y=0;y<H;y++){let c=0;for(let x=0;x<W;x++)c+=mask[y*W+x];cov[y]=c/W;if(cov[y]>mxC)mxC=cov[y]}
    let yH=0;for(let y=0;y<H;y++)if(cov[y]>=.35*mxC)yH=y;info.horizon=yH/H;
    const cut=Math.min(H,yH+Math.round(H*.05)+1);for(let y=cut;y<H;y++)mask.fill(0,y*W,y*W+W);
  }
  let c2=0;for(let i=0;i<n;i++)c2+=mask[i];info.cov=c2/n;
  if(c2/n<.015)return{mask:null,cov:c2/n,info};
  return{mask,cov:c2/n,info}};

// dilatation/érosion séparables (carré de rayon r) sur Float32
SKY.morph=(src,w,h,r,isMax)=>{const out=new Float32Array(w*h),tmp=new Float32Array(w*h);
  for(let y=0;y<h;y++){const o=y*w;for(let x=0;x<w;x++){let m=src[o+x];const a=Math.max(0,x-r),b=Math.min(w-1,x+r);for(let k=a;k<=b;k++){const v=src[o+k];if(isMax?v>m:v<m)m=v}tmp[o+x]=m}}
  for(let x=0;x<w;x++){for(let y=0;y<h;y++){let m=tmp[y*w+x];const a=Math.max(0,y-r),b=Math.min(h-1,y+r);for(let k=a;k<=b;k++){const v=tmp[k*w+x];if(isMax?v>m:v<m)m=v}out[y*w+x]=m}}
  return out};

SKY.mask=async(onP)=>{const d=S.doc;if(!d)return null;
  const long=Math.max(d.w,d.h),s1=Math.min(1,800/long),W=Math.max(8,Math.round(d.w*s1)),H=Math.max(8,Math.round(d.h*s1));
  const flat=flatSync();
  const c1=mk(W,H),g1=rx(c1);g1.imageSmoothingQuality='high';g1.drawImage(flat,0,0,W,H);
  onP&&onP(.05);await tick();
  const t0=performance.now();
  const res=SKY.analyze(g1.getImageData(0,0,W,H).data,W,H);SKY.last={...res.info,cov:res.cov,msAnalyze:Math.round(performance.now()-t0)};
  // with the scene model: it decides what is sky; the colour analysis above only settles the uncertain band along the horizon
  if(AI.skyPrior){let P=null;try{P=await AI.skyPrior(W,H)}catch(e){console.warn(e)}if(S.doc!==d)return null;
    if(P){const n=W*H,m=new Uint8Array(n),Hm=res.mask;let cov=0;for(let i=0;i<n;i++){const p=P[i];const v=p>0.8?255:p<0.2?0:(Hm&&Hm[i]?Math.max(p,0.6)*255:Math.min(p,0.4)*255);m[i]=v;cov+=v}
      res.mask=cov>n*255*0.002?m:null;res.soft=true;SKY.last.model=true}}
  if(!res.mask)return null;
  onP&&onP(.35);await tick();
  // masque grossier -> canvas alpha, puis remontée à ~1600 px
  const ps=Math.min(1,1600/long),RW=Math.max(1,Math.round(d.w*ps)),RH=Math.max(1,Math.round(d.h*ps));
  const mc=mk(W,H),mg=rx(mc),im=mg.createImageData(W,H),md=im.data;for(let i=0;i<W*H;i++){md[i*4]=md[i*4+1]=md[i*4+2]=255;md[i*4+3]=res.soft?res.mask[i]:(res.mask[i]?255:0)}mg.putImageData(im,0,0);
  const up=mk(RW,RH),ug=rx(up);ug.imageSmoothingQuality='high';ug.drawImage(mc,0,0,RW,RH);
  const gc=mk(RW,RH),gg=rx(gc);gg.imageSmoothingQuality='high';gg.drawImage(flat,0,0,RW,RH);
  const n=RW*RH,gd=gg.getImageData(0,0,RW,RH).data,ud=ug.getImageData(0,0,RW,RH);
  const Lh=new Float32Array(n);for(let i=0;i<n;i++)Lh[i]=(.299*gd[i*4]+.587*gd[i*4+1]+.114*gd[i*4+2])/255;
  // structures fines et sombres (branches, fils, antennes) : chapeau haut-de-forme noir de la luminance
  const rb=Math.max(3,Math.round(Math.max(RW,RH)/260));
  const closed=SKY.morph(SKY.morph(Lh,RW,RH,rb,true),RW,RH,rb,false);
  const u=ud.data;for(let i=0;i<n;i++){const th=closed[i]-Lh[i];let k=(th-.06)/.1;k=k<0?0:k>1?1:k;k=k*k*(3-2*k);u[i*4+3]=Math.round(u[i*4+3]*(1-k))}
  ug.putImageData(ud,0,0);
  onP&&onP(.55);await tick();
  const out=await refineMask(up,{radius:clamp(Math.round(long*ps/220),3,24),eps:.0007,contrast:25,shift:0},ps,p=>onP&&onP(.55+.4*p));
  SKY.last.msTotal=Math.round(performance.now()-t0);
  return out};

SKY.select=async()=>{const d=S.doc;if(!d){toast('Ouvrez d’abord une photo');return}
  busy(true,'Recherche du ciel…',0);let m=null;
  try{await tick();m=await SKY.mask(p=>busy(true,'Recherche du ciel…',p))}
  catch(e){console.error(e);busy(false);toast('Sélection du ciel impossible : '+(e.message||e),5000);return}
  busy(false);if(S.doc!==d)return;
  if(!m||!maskBBox(m)){toast('Aucun ciel trouvé dans cette photo',4000);return}
  combineSel(m,'new','Sélectionner le ciel');toast('Ciel sélectionné. Contour progressif ou Affiner le contour pour ajuster.',4500)};
AI.selectSky=SKY.select;AI.skyMask=SKY.mask;

(()=>{const mi=MENU2.select.items;MENU2.select.items=()=>{const a=mi();let i=a.findIndex(x=>x&&x.label&&/Détourer le sujet/.test(x.label));if(i<0)i=a.findIndex(x=>x&&x.label&&/Sélectionner le sujet/.test(x.label));
  a.splice(i<0?a.length:i+1,0,MI('Sélectionner le ciel',{icon:'subject',fn:()=>SKY.select(),dis:docDis()}));return a}})();
