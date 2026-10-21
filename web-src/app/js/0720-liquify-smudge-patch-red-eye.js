/* ================= v19: liquify, smudge, patch, red-eye ================= */
(()=>{
const OB=S.opts;OB.liquify={mode:'push',size:120,strength:0.6};OB.smudge={size:60,hardness:0.5,strength:0.6};OB.redeye={size:40,dark:0.7,mode:'human'};
const fct=()=>S.doc?clamp(Math.max(S.doc.w,S.doc.h)/1800,1,6):1;
const lazy=(k,base)=>{const o=OB[k];if(!o._init||o._doc!==S.doc){if(!o._init||(o._doc!==S.doc&&o.size===o._auto)){o.size=Math.round(base*fct());o._auto=o.size}o._init=1;o._doc=S.doc}};
addTool('smudge','Doigt','N',IC.smudge,'dodge','étale la matière');
addTool('liquify','Fluidité','',IC.liquify,'smudge','pousse, gonfle, pince, tourbillon');
addTool('patch','Pièce','A',IC.patch,'clone','remplace une zone');
addTool('redeye','Yeux rouges','D',IC.redeye,'patch','corrige les yeux');
const bil=(a,w,h,x,y,out)=>{x=clamp(x,0,w-1.001);y=clamp(y,0,h-1.001);const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,i=(y0*w+x0)*4,j=i+w*4;for(let c=0;c<4;c++){const t=a[i+c]*(1-fx)+a[i+4+c]*fx,b=a[j+c]*(1-fx)+a[j+4+c]*fx;out[c]=t*(1-fy)+b*fy}};
const falloff=(dist,hard)=>{const t=Math.min(1,dist);const h=clamp(hard,0,1);return t<=h?1:Math.pow(1-(t-h)/(1-h+1e-6),2)};
// ---------- in-place stroke engine ----------
let LQ={layer:null,orig:null};
function ipBegin(tool,p,e){const d=S.doc,A=rtPixelTarget();if(!A)return false;
 lazy(tool==='liquify'?'liquify':'smudge',tool==='liquify'?120:60);
 const hl=tool==='smudge'?hiTake(A):null;editCanvas(A);const ctx=rx(A.canvas),st={type:'ip',tool,L:A,ctx,hw:hl?hiWork(A):null,last:{x:p.x,y:p.y},sel:d.sel?rx(d.sel):null,carry:null,pressure:(e&&e.pointerType==='pen')?(e.pressure||1):1};S.drag=st;if(tool==='smudge')smudgeStep(st,p,true);markComp();return true}
function regionOf(st,p,r){const d=S.doc,x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(d.w,Math.ceil(p.x+r)),y1=Math.min(d.h,Math.ceil(p.y+r));if(x1<=x0||y1<=y0)return null;return{x0,y0,w:x1-x0,h:y1-y0}}
function liqStep(st,p,dx,dy){const o=OB.liquify,r=o.size/2,R=regionOf(st,p,r);if(!R)return;const img=st.ctx.getImageData(R.x0,R.y0,R.w,R.h),src=new Uint8ClampedArray(img.data),a=img.data,w=R.w,h=R.h,S0=o.strength*st.pressure;
 let sel=null;if(st.sel)sel=st.sel.getImageData(R.x0,R.y0,w,h).data;let orig=null;if(o.mode==='reconstruct'&&LQ.orig)orig=rx(LQ.orig).getImageData(R.x0,R.y0,w,h).data;
 const out=[0,0,0,0],cxp=p.x-R.x0,cyp=p.y-R.y0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ddx=x+.5-cxp,ddy=y+.5-cyp,dist=Math.hypot(ddx,ddy)/r;if(dist>=1)continue;const f=falloff(dist,.15);if(f<=.002)continue;let sx=x,sy=y;const j=(y*w+x)*4;let wsel=sel?sel[j+3]/255:1;if(wsel<=0)continue;
  if(o.mode==='push'){sx=x-dx*f*S0*1.1;sy=y-dy*f*S0*1.1}
  else if(o.mode==='bloat'){const k=1-f*S0*.14;sx=cxp+ddx*k;sy=cyp+ddy*k}
  else if(o.mode==='pinch'){const k=1+f*S0*.14;sx=cxp+ddx*k;sy=cyp+ddy*k}
  else if(o.mode==='twirl'){const ang=f*S0*.22*(S.altDown?-1:1),cs=Math.cos(ang),sn=Math.sin(ang);sx=cxp+ddx*cs-ddy*sn;sy=cyp+ddx*sn+ddy*cs}
  else if(o.mode==='reconstruct'){if(orig){const k=f*S0*.35*wsel;for(let c=0;c<4;c++)a[j+c]=a[j+c]+(orig[j+c]-a[j+c])*k}continue}
  bil(src,w,h,sx-.5,sy-.5,out);for(let c=0;c<4;c++)a[j+c]=a[j+c]+(out[c]-a[j+c])*wsel}
 st.ctx.putImageData(img,R.x0,R.y0)}
function smudgeStep(st,p,first){const o=OB.smudge,r=o.size/2,R=regionOf(st,p,r);if(!R)return;const img=st.ctx.getImageData(R.x0,R.y0,R.w,R.h),a=img.data,w=R.w,h=R.h,S0=clamp(o.strength*st.pressure,.02,1);
 let sel=null;if(st.sel)sel=st.sel.getImageData(R.x0,R.y0,w,h).data;
 if(!st.carry){st.carry={x:R.x0,y:R.y0,w,h,data:new Float32Array(a)};return}
 // carry buffer is expressed in the coordinates of the previous dab: resample it at the new position
 const C=st.carry,cd=C.data,nc=new Float32Array(w*h*4),cxp=p.x-R.x0,cyp=p.y-R.y0,tmp=[0,0,0,0];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4;const sxx=R.x0+x-C.x,syy=R.y0+y-C.y;if(sxx<0||syy<0||sxx>=C.w-1||syy>=C.h-1){for(let c=0;c<4;c++)nc[j+c]=a[j+c];continue}const i=(syy*C.w+sxx)*4;for(let c=0;c<4;c++)nc[j+c]=cd[i+c]}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ddx=x+.5-cxp,ddy=y+.5-cyp,dist=Math.hypot(ddx,ddy)/r;if(dist>=1)continue;const f=falloff(dist,o.hardness);const j=(y*w+x)*4,wsel=sel?sel[j+3]/255:1;const k=f*S0*wsel;if(k>0)for(let c=0;c<4;c++){const cur=a[j+c];a[j+c]=cur+(nc[j+c]-cur)*k;nc[j+c]=nc[j+c]*S0*.55+cur*(1-S0*.55)}}
 st.ctx.putImageData(img,R.x0,R.y0);st.carry={x:R.x0,y:R.y0,w,h,data:nc}}
function ipMove(st,p){const o=OB[st.tool],sp=Math.max(1.5,o.size*(st.tool==='liquify'?.07:.06)),dx=p.x-st.last.x,dy=p.y-st.last.y,dist=Math.hypot(dx,dy);if(dist<sp)return;const n=Math.floor(dist/sp),sx=dx/dist*sp,sy=dy/dist*sp;
 let q={x:st.last.x,y:st.last.y};for(let k=1;k<=n;k++){q={x:q.x+sx,y:q.y+sy};if(st.tool==='liquify')liqStep(st,q,sx,sy);else smudgeStep(st,q,false)}st.last=q;markComp()}
// ---------- patch ----------
S.patch=null;
const polyMask=pts=>{const d=S.doc,m=mk(d.w,d.h),g=cx(m);g.fillStyle='#fff';g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();return m};
const inPoly=(p,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c};
async function patchApply(){const P=S.patch;if(!P||P.phase!=='drag')return;const off=P.off;if(Math.hypot(off.x,off.y)<2){S.patch=null;requestRender();return}
 const d=S.doc,L=pixelTarget();if(!L||L.visible===false){if(L)toast('Ce calque est masqué');S.patch=null;requestRender();return}busy(true,'Correction…');await new Promise(r=>setTimeout(r,20));let ok=true;const prev=L.canvas;try{const H=hiTake(L);editCanvas(L);const bx={x0:P.bb.x0,y0:P.bb.y0,x1:P.bb.x1,y1:P.bb.y1};ok=healRegion(L,P.mask,bx,off,H)!==false}finally{busy(false)}
 S.patch=null;if(!ok){L.canvas=prev;markComp();return}markComp();pushHistory('Pièce');syncLayers()}
// ---------- red eye ----------
function redEyeAt(p){const d=S.doc,A=rtPixelTarget(),o=OB.redeye;lazy('redeye',40);if(!A)return;
 const R=Math.round(o.size),x0=Math.max(0,Math.floor(p.x-R*1.6)),y0=Math.max(0,Math.floor(p.y-R*1.6)),x1=Math.min(d.w,Math.ceil(p.x+R*1.6)),y1=Math.min(d.h,Math.ceil(p.y+R*1.6)),w=x1-x0,h=y1-y0;if(w<4||h<4)return;
 const g0=rx(A.canvas),img=g0.getImageData(x0,y0,w,h),a=img.data,cxp=Math.floor(p.x)-x0,cyp=Math.floor(p.y)-y0;
 const lum=i=>.2126*a[i]+.7152*a[i+1]+.0722*a[i+2];let mask=new Uint8Array(w*h);
 if(o.mode==='human'){const red=i=>a[i+3]>40&&a[i]>60&&a[i]>1.45*a[i+1]&&a[i]>1.45*a[i+2];let seed=-1,bd=1e9;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(red(i)){const dd=Math.hypot(x-cxp,y-cyp);if(dd<bd&&dd<R*1.2){bd=dd;seed=y*w+x}}}
  if(seed<0){toast('Aucun œil rouge trouvé ici. Cliquez au centre de la pupille et ajustez la taille.');return}
  const st=[seed];mask[seed]=1;let n=1;while(st.length&&n<w*h){const k=st.pop(),x=k%w,y=(k/w)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const nk=ny*w+nx;if(mask[nk])continue;if(red(nk*4)&&Math.hypot(nx-cxp,ny-cyp)<R*1.6){mask[nk]=1;st.push(nk);n++}}}}
 else{let s=0,c=0;for(let i=0;i<a.length;i+=4){s+=lum(i);c++}const mean=s/c;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,dd=Math.hypot(x-cxp,y-cyp);if(dd<R*1.1&&lum(i)>Math.max(120,mean*1.25))mask[y*w+x]=1}}
 if(!mask.includes(1)){toast(o.mode==='pet'?'Aucun reflet trouvé ici. Cliquez au centre de l’œil et ajustez la taille.':'Aucun œil rouge trouvé ici. Cliquez au centre de la pupille et ajustez la taille.');return}
 // grow by 2 px, feather the ring
 const grown=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const v=(dx===0&&dy===0)||Math.abs(dx)+Math.abs(dy)<=1?1:Math.abs(dx)+Math.abs(dy)<=2?.7:.35;const k=ny*w+nx;if(v>grown[k])grown[k]=v}}
 let cnt=0;editCanvas(A);const g=rx(A.canvas);const sel=d.sel?rx(d.sel).getImageData(x0,y0,w,h).data:null;
 for(let k=0;k<w*h;k++){const wt=grown[k];if(wt<=0)continue;const i=k*4,L0=lum(i);if(o.mode==='human'&&L0>215&&a[i]-a[i+2]<30)continue;let ws=sel?sel[i+3]/255:1;if(ws<=0)continue;const pet=o.mode==='pet',m=pet?lum(i):Math.max((a[i+1]+a[i+2])/2,a[i]*.2),v=pet?10+m*.35*(1-o.dark):m*(1-.62*o.dark),nr=v*1.04,ng=v,nb=v*1.0;const t=wt*ws;a[i]+=(nr-a[i])*t;a[i+1]+=(ng-a[i+1])*t;a[i+2]+=(nb-a[i+2])*t;cnt++}
 g.putImageData(img,x0,y0);markComp();pushHistory('Yeux rouges');syncLayers()}
// ---------- hooks ----------
const _od=onDown;onDown=function(e,p){if(e.button!==1&&!S.spaceDown&&!S.wbPick){const t=S.tool;
  if(t==='liquify'||t==='smudge'){ipBegin(t,p,e);return}
  if(t==='redeye'){redEyeAt(p);return}
  if(t==='patch'){const P=S.patch;if(P&&P.phase==='drag'&&inPoly(p,P.pts)){S.drag={type:'patchmove',s:{x:p.x,y:p.y},off0:{...P.off}};return}S.patch=null;S.drag={type:'patchdraw',pts:[{x:p.x,y:p.y}]};return}}
 _od(e,p)};
const _om=onMove;onMove=function(e,p){const dr=S.drag;if(dr){if(dr.type==='ip'){if(e&&e.pointerType==='pen')dr.pressure=e.pressure||dr.pressure;ipMove(dr,p);return}
  if(dr.type==='patchdraw'){const l=dr.pts[dr.pts.length-1];if(Math.hypot(p.x-l.x,p.y-l.y)*S.zoom>2)dr.pts.push({x:p.x,y:p.y});return}
  if(dr.type==='patchmove'&&S.patch){S.patch.off={x:dr.off0.x+(p.x-dr.s.x),y:dr.off0.y+(p.y-dr.s.y)};return}}_om(e,p)};
const _ou=onUp;onUp=function(e){const dr=S.drag;if(dr){
  if(dr.type==='ip'){S.drag=null;markComp();pushHistory(dr.tool==='liquify'?'Fluidité':'Doigt');return}
  if(dr.type==='patchdraw'){S.drag=null;if(dr.pts.length<4){return}const m=polyMask(dr.pts),bb=maskBBox(m);if(!bb)return;S.patch={phase:'drag',pts:dr.pts,mask:m,bb,off:{x:0,y:0}};toast('Faites glisser la zone vers une partie propre de la photo.');requestRender();return}
  if(dr.type==='patchmove'){S.drag=null;patchApply();return}}_ou(e)};
window.addEventListener('keydown',e=>{if(e.key==='Alt')S.altDown=true;if(e.key==='Escape'&&S.patch){e.preventDefault();e.stopImmediatePropagation();S.patch=null;requestRender()}},true);window.addEventListener('keyup',e=>{if(e.key==='Alt')S.altDown=false});
const _st=setTool;setTool=function(t){const r=_st.apply(this,arguments);if(t!=='patch')S.patch=null;if(t!=='liquify')LQ={layer:null,orig:null};if(['liquify','smudge','patch','redeye'].includes(t))view.style.cursor=t==='patch'||t==='redeye'?'crosshair':'none';return r};
const _dov=drawOverlays;drawOverlays=function(c,pr){_dov.apply(this,arguments);try{const t=S.tool,p=S.pointer;
 if((t==='liquify'||t==='smudge'||t==='redeye')&&p&&p.inside&&!S.spaceDown){const o=OB[t];lazy(t,t==='liquify'?120:t==='smudge'?60:40);const r=(t==='redeye'?o.size:o.size/2)*S.zoom;c.save();c.setTransform(pr,0,0,pr,0,0);c.beginPath();c.arc(p.cx,p.cy,Math.max(r,2),0,7);c.lineWidth=2.5;c.strokeStyle='rgba(0,0,0,.55)';c.stroke();c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.95)';c.stroke();c.restore()}
 const dr=S.drag;const P=(x,y)=>[S.panX+x*S.zoom,S.panY+y*S.zoom];
 const outline=(pts,dx,dy,col)=>{c.beginPath();pts.forEach((q,i)=>{const[x,y]=P(q.x+dx,q.y+dy);i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();c.lineWidth=1.5;c.setLineDash([5,4]);c.strokeStyle=col;c.stroke();c.setLineDash([])};
 if(dr&&dr.type==='patchdraw'&&dr.pts.length>1){c.save();c.setTransform(pr,0,0,pr,0,0);outline(dr.pts,0,0,'#fff');c.restore()}
 if(S.patch&&S.patch.phase==='drag'){const Q=S.patch,d=S.doc;c.save();c.setTransform(pr,0,0,pr,0,0);c.save();c.beginPath();Q.pts.forEach((q,i)=>{const[x,y]=P(q.x,q.y);i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();c.clip();c.globalAlpha=.85;c.drawImage(flatSync(),S.panX-Q.off.x*S.zoom,S.panY-Q.off.y*S.zoom,d.w*S.zoom,d.h*S.zoom);c.restore();outline(Q.pts,0,0,'#fff');outline(Q.pts,Q.off.x,Q.off.y,'#4fd1ff');c.restore()}}catch(err){}};
// ---------- pills ----------
const _pe=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe.apply(this,arguments)||'';
 if(t==='liquify'){lazy('liquify',120);h=seg('liquify.mode',[['push','Pousser'],['bloat','Gonfler'],['pinch','Pincer'],['twirl','Tourbillon'],['reconstruct','Reconstruire']])+optRange('liquify.size','Taille',10,Math.max(600,Math.round((S.doc?Math.max(S.doc.w,S.doc.h):1800)/3)),1,' px')+optRange('liquify.strength','Intensité',1,100,1,' %',100)+`<span class="hint">${ALT} : tourbillon inversé</span>`}
 if(t==='smudge'){lazy('smudge',60);h=optRange('smudge.size','Taille',4,Math.max(400,Math.round((S.doc?Math.max(S.doc.w,S.doc.h):1800)/4)),1,' px')+optRange('smudge.hardness','Dureté',0,100,1,' %',100)+optRange('smudge.strength','Intensité',1,100,1,' %',100)}
 if(t==='patch')h=`<span class="hint">Entourez la zone à corriger, puis faites-la glisser vers une zone propre. Échap pour annuler.</span>`;
 if(t==='redeye'){lazy('redeye',40);h=seg('redeye.mode',[['human','Humain'],['pet','Animal']])+optRange('redeye.size','Taille de l’œil',6,Math.max(200,Math.round((S.doc?Math.max(S.doc.w,S.doc.h):1800)/10)),1,' px')+optRange('redeye.dark','Assombrir',10,100,1,' %',100)+`<span class="hint">Cliquez au centre de la pupille.</span>`}
 return h};
})();

