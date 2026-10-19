/* ================= refine edge (hair) : colour guided filter ================= */
function boxMean(src,w,h,r,out,tmp){for(let y=0;y<h;y++){const o=y*w;let s=0;const lim=Math.min(r,w-1);for(let x=0;x<=lim;x++)s+=src[o+x];
    for(let x=0;x<w;x++){if(x>0){const x1=x+r,x0=x-r-1;if(x1<w)s+=src[o+x1];if(x0>=0)s-=src[o+x0]}tmp[o+x]=s/(Math.min(w-1,x+r)-Math.max(0,x-r)+1)}}
  for(let x=0;x<w;x++){let s=0;const lim=Math.min(r,h-1);for(let y=0;y<=lim;y++)s+=tmp[y*w+x];
    for(let y=0;y<h;y++){if(y>0){const y1=y+r,y0=y-r-1;if(y1<h)s+=tmp[y1*w+x];if(y0>=0)s-=tmp[y0*w+x]}out[y*w+x]=s/(Math.min(h-1,y+r)-Math.max(0,y-r)+1)}}}
function guidedFilter(Ir,Ig,Ib,p,w,h,r,eps){const n=w*h,T=new Float32Array(n),F=()=>new Float32Array(n),box=(s,o=F())=>{boxMean(s,w,h,r,o,T);return o},prod=(a,b,o=F())=>{for(let i=0;i<n;i++)o[i]=a[i]*b[i];return o};
  const mr=box(Ir),mg=box(Ig),mb=box(Ib),mp=box(p),tmp=F();
  const crp=box(prod(Ir,p,tmp)),cgp=box(prod(Ig,p,tmp)),cbp=box(prod(Ib,p,tmp));
  const rr=box(prod(Ir,Ir,tmp)),rg=box(prod(Ir,Ig,tmp)),rb=box(prod(Ir,Ib,tmp)),gg=box(prod(Ig,Ig,tmp)),gb=box(prod(Ig,Ib,tmp)),bb=box(prod(Ib,Ib,tmp));
  for(let i=0;i<n;i++){const ar=mr[i],ag=mg[i],ab=mb[i],P=mp[i];const vr=crp[i]-ar*P,vg=cgp[i]-ag*P,vb=cbp[i]-ab*P;
    const a11=rr[i]-ar*ar+eps,a12=rg[i]-ar*ag,a13=rb[i]-ar*ab,a22=gg[i]-ag*ag+eps,a23=gb[i]-ag*ab,a33=bb[i]-ab*ab+eps;
    const c11=a22*a33-a23*a23,c12=a13*a23-a12*a33,c13=a12*a23-a13*a22,c22=a11*a33-a13*a13,c23=a13*a12-a11*a23,c33=a11*a22-a12*a12,det=a11*c11+a12*c12+a13*c13||1e-12;
    const x=(c11*vr+c12*vg+c13*vb)/det,y=(c12*vr+c22*vg+c23*vb)/det,z=(c13*vr+c23*vg+c33*vb)/det;crp[i]=x;cgp[i]=y;cbp[i]=z;mp[i]=P-x*ar-y*ag-z*ab}
  const qa=box(crp,rr),qb=box(cgp,rg),qc=box(cbp,rb),qd=box(mp,gg),q=F();for(let i=0;i<n;i++)q[i]=qa[i]*Ir[i]+qb[i]*Ig[i]+qc[i]*Ib[i]+qd[i];return q}
async function refineMask(maskC,prm,s,onP){const d=S.doc,W=Math.max(1,Math.round(d.w*s)),H=Math.max(1,Math.round(d.h*s)),guide=mk(W,H),gg=rx(guide);gg.imageSmoothingQuality='high';gg.drawImage(flatSync(),0,0,W,H);
  const mc=mk(W,H),mg=rx(mc);mg.imageSmoothingQuality='high';mg.drawImage(maskC,0,0,W,H);const r=Math.max(1,Math.round(prm.radius*s)),eps=prm.eps,pad=2*r+2,T0=384;
  const out=mk(W,H),og=rx(out),k=1+prm.contrast/100*5,sh=prm.shift/100;let done=0;const nT=Math.ceil(W/T0)*Math.ceil(H/T0);
  for(let ty=0;ty<H;ty+=T0)for(let tx=0;tx<W;tx+=T0){const tw=Math.min(T0,W-tx),th=Math.min(T0,H-ty),x0=Math.max(0,tx-pad),y0=Math.max(0,ty-pad),x1=Math.min(W,tx+tw+pad),y1=Math.min(H,ty+th+pad),w=x1-x0,h=y1-y0,n=w*h;
    const M=mg.getImageData(x0,y0,w,h),md=M.data;let lo=255,hi=0;for(let i=3;i<md.length;i+=4){const v=md[i];if(v<lo)lo=v;if(v>hi)hi=v}
    const res=og.createImageData(tw,th),rd=res.data;
    if(hi<=8||lo>=247){const v=hi<=8?0:255;for(let i=0;i<tw*th;i++){rd[i*4]=rd[i*4+1]=rd[i*4+2]=255;rd[i*4+3]=v}}
    else{const G=gg.getImageData(x0,y0,w,h).data,Ir=new Float32Array(n),Ig=new Float32Array(n),Ib=new Float32Array(n),p=new Float32Array(n);for(let i=0;i<n;i++){Ir[i]=G[i*4]/255;Ig[i]=G[i*4+1]/255;Ib[i]=G[i*4+2]/255;p[i]=md[i*4+3]/255}
      const q=guidedFilter(Ir,Ig,Ib,p,w,h,r,eps);for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const qi=(y+ty-y0)*w+(x+tx-x0);let v=q[qi];v=(v-0.5+sh)*k+0.5;const j=(y*tw+x)*4;rd[j]=rd[j+1]=rd[j+2]=255;rd[j+3]=v<=0?0:v>=1?255:Math.round(v*255)}}
    og.putImageData(res,tx,ty);done++;if(nT>1&&done%4===0){onP&&onP(done/nT);await tick()}}
  if(s<1){const f=mk(d.w,d.h),fg=cx(f);fg.imageSmoothingQuality='high';fg.drawImage(out,0,0,d.w,d.h);return f}return out}
function qmOverlay(c){if(!S.qm||!S.doc)return;const W=view.width,H=view.height,t=scr('qm',W,H),g=cx(t);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.setTransform(...viewMatrix(0,0));g.fillStyle='rgba(235,60,60,.55)';g.fillRect(0,0,S.doc.w,S.doc.h);g.globalCompositeOperation='destination-out';g.drawImage(S.qm,0,0);g.globalCompositeOperation='source-over';g.setTransform(1,0,0,1,0,0);c.setTransform(1,0,0,1,0,0);c.drawImage(t,0,0)}
function refineDialog(){const d=S.doc;if(!d)return;const mt=maskTarget(),useSel=!!d.sel,L=useSel?null:(mt||(AL()&&AL().mask?AL():null));
  if(!useSel&&!L){toast('Faites d’abord une sélection (par exemple Sélectionner le sujet) ou choisissez un masque',5000);return}
  const src=useSel?d.sel:L.mask,prm={radius:clamp(Math.round(Math.max(d.w,d.h)/300),3,40),eps:0.0016,contrast:0,shift:0},smooth={v:40};const ps=Math.min(1,1000/Math.max(d.w,d.h));let job=0,t=null,closed=false;
  const epsOf=v=>Math.pow(10,-4.5+v/100*3);prm.eps=epsOf(smooth.v);
  const preview=async()=>{const my=++job;$('#rfSt')&&($('#rfSt').textContent='Calcul…');await tick();const m=await refineMask(src,prm,ps);if(my!==job||closed)return;if(useSel)S.qm=m;else L.maskPreview=m;markComp();$('#rfSt')&&($('#rfSt').textContent='')};
  const sched=()=>{clearTimeout(t);t=setTimeout(preview,120)};
  const end=()=>{closed=true;clearTimeout(t);S.qm=null;if(L)delete L.maskPreview;markComp()};
  dialog({title:'Affiner le contour',light:true,body:`<p class="muted">Idéal pour les cheveux, la fourrure et les contours flous : le contour suit les détails de la photo. ${useSel?'Les zones en rouge seront exclues de la sélection.':'Aperçu direct sur le masque de « '+esc(L.name)+' ».'}</p>
    ${rangeRow('rfR','Rayon',1,80,1,prm.radius,' px')}${rangeRow('rfS','Lissage',0,100,1,smooth.v,'')}${rangeRow('rfC','Contraste',0,100,1,0,' %')}${rangeRow('rfH','Décaler le bord',-50,50,1,0,' %')}<p class="muted" id="rfSt" role="status"></p>`,
    onOpen:el=>{const bind=(id,fn,u)=>{const i=$('#'+id,el);i.addEventListener('input',()=>{$('#'+id+'-o',el).textContent=i.value+u;fn(+i.value);sched()})};
      bind('rfR',v=>prm.radius=v,' px');bind('rfS',v=>{smooth.v=v;prm.eps=epsOf(v)},'');bind('rfC',v=>prm.contrast=v,' %');bind('rfH',v=>prm.shift=v,' %');
      const s=$('#scrim');const oc=s._cancel;s._cancel=()=>{end();oc&&oc()};preview()},
    buttons:[{label:'Annuler',onClick:end},{label:'Appliquer',primary:true,onClick:async()=>{closed=true;clearTimeout(t);busy(true,'Affinage du contour…',0);try{const m=await refineMask(src,prm,1,p=>busy(true,'Affinage du contour…',p));
        S.qm=null;if(L)delete L.maskPreview;if(useSel){d.sel=maskBBox(m)?m:null;selChanged();markComp();pushHistory('Affiner le contour')}else{L.mask=m;markComp();pushHistory('Affiner le masque');syncAll()}toast('Contour affiné')}
      catch(e){console.error(e);end();toast('Affinage impossible : '+(e.message||e),5000)}finally{busy(false)}}}]})}

