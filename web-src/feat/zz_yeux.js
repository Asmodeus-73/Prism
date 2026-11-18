/* ===== Ouvrir les yeux (Filtre > Profondeur et visages > Ouvrir les yeux…, onglet IA) =====
   Quelqu'un a cligné des yeux : Prism prend ses yeux ouverts sur une autre photo de la même rafale et les pose sur celle-ci.
   - Les autres photos : celles de la photothèque prises à moins de 90 s (date EXIF), celles qui y sont choisies, ou une photo ajoutée depuis le disque.
   - Visages et yeux : YuNet (le même modèle que « Visages », 0,2 Mo), sur l'appareil. Aucun nouveau modèle.
   - Même personne : le visage au même endroit de l'image et de même taille (une rafale bouge peu).
   - Ouverture d'un œil : hauteur de la partie sombre (iris, pupille) au milieu de l'œil, comparée à sa largeur.
   - Greffe : alignement sur les deux yeux (taille, angle), recalage fin sur la peau autour de l'œil, couleur ajustée sur cette peau, bord fondu.
   - Le résultat est un calque « Yeux ouverts » posé juste au-dessus de la photo : les réglages au-dessus s'y appliquent, on peut le masquer ou le gommer. ===== */
const EY={};
const BURST_MS=90e3,MAXSRC=12;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
/* géométrie des yeux d'un visage YuNet : a = œil à gauche de l'image, b = à droite ; u le long des yeux, n vers le bas du visage */
function geo(f){if(!f||!f.kp)return null;let a=f.kp[0],b=f.kp[1];if(a[0]>b[0])[a,b]=[b,a];const dx=b[0]-a[0],dy=b[1]-a[1],ed=Math.hypot(dx,dy);if(ed<6)return null;
  const u=[dx/ed,dy/ed],n=[-u[1],u[0]];return{a,b,ed,u,n,m:[(a[0]+b[0])/2,(a[1]+b[1])/2],ang:Math.atan2(dy,dx)}}
/* l'œil, redressé, en petite image grise 40 × 28 */
const PW=40,PH=28;
function eyePatch(src,c,G){const k=PW/(0.5*G.ed),t=mk(PW,PH),g=rx(t),{u,n}=G;g.fillStyle='#808080';g.fillRect(0,0,PW,PH);
  g.setTransform(k*u[0],k*n[0],k*u[1],k*n[1],PW/2-k*(u[0]*c[0]+u[1]*c[1]),PH/2-k*(n[0]*c[0]+n[1]*c[1]));g.imageSmoothingQuality='high';g.drawImage(src,0,0);
  const D=g.getImageData(0,0,PW,PH).data,L=new Float32Array(PW*PH);for(let i=0;i<PW*PH;i++)L[i]=0.3*D[i*4]+0.59*D[i*4+1]+0.11*D[i*4+2];return L}
/* 0 = fermé, ~0,5 et plus = grand ouvert : hauteur de la partie sombre au milieu de l'œil */
function openness(L){const s=Float32Array.from(L).sort(),lo=s[Math.floor(s.length*0.08)],hi=s[Math.floor(s.length*0.85)],ct=hi-lo;if(ct<18)return 0;const thr=lo+0.45*ct;let sum=0,nc=0;
  for(let x=13;x<27;x++){let run=0,best=0;for(let y=2;y<PH-2;y++){if(L[y*PW+x]<thr){run++;if(run>best)best=run}else run=0}sum+=best;nc++}
  return clamp(sum/nc/(PH-4)*Math.min(1,ct/50),0,1)}
function measure(src,f){const G=geo(f);if(!G)return null;const oa=openness(eyePatch(src,G.a,G)),ob=openness(eyePatch(src,G.b,G));return{f,G,oa,ob,open:(oa+ob)/2}}
/* le même visage sur une autre photo : même endroit (à l'échelle de l'image), même taille */
function match(t,list,kx,ky){let best=null,bd=1e9;for(const s of list){const G=s.G,dx=G.m[0]/kx-t.G.m[0],dy=G.m[1]/ky-t.G.m[1],d=Math.hypot(dx,dy)/t.G.ed,r=G.ed/kx/t.G.ed;
    if(d<1.4&&r>0.75&&r<1.33&&d<bd){bd=d;best=s}}return best}

/* ---------- les autres photos de la rafale ---------- */
async function baseCanvasOf(it){const m=it.local;if(!m||!m.layers)return null;const e=m.layers.find(x=>x.kind==='pixel'&&x.canvas);if(!e)return null;
  const o={kind:'pixel'};await loadLayerCanvas(o,e,m.w,m.h,t=>IDB.get('blobs',t.key));return o.canvas||null}
function burstItems(d){const cur=LIB.items.find(i=>i.id===d.pid),t0=cur&&typeof exifInfo==='function'?exifInfo(cur).taken:0,ar=d.w/d.h;
  const ok=it=>it.id!==d.pid&&it.local&&it.w&&it.h&&Math.abs(it.w/it.h-ar)<0.03;
  const near=t0?LIB.items.filter(it=>ok(it)&&(()=>{const t=exifInfo(it).taken;return t&&Math.abs(t-t0)<=BURST_MS})()):[];
  const sel=LIB.items.filter(it=>ok(it)&&LIB.sel.has(it.id)&&!near.includes(it));
  return[...near.sort((x,y)=>Math.abs(exifInfo(x).taken-t0)-Math.abs(exifInfo(y).taken-t0)),...sel].slice(0,MAXSRC)}
function baseLayer(d){const i=d.layers.findIndex(L=>L.kind==='pixel'&&L.canvas&&L.visible!==false);return i<0?null:{L:d.layers[i],i}}

/* ---------- la greffe ---------- */
/* la photo source, posée sur la photo cible (similitude qui amène ses deux yeux sur ceux de la cible), dans la boîte bx */
function warpBox(src,s,t,bx,dx,dy){const k=t.G.ed/s.G.ed,th=t.G.ang-s.G.ang,co=k*Math.cos(th),si=k*Math.sin(th),c=mk(bx.w,bx.h),g=cx(c);
  g.setTransform(co,si,-si,co,t.G.m[0]-(co*s.G.m[0]-si*s.G.m[1])-bx.x+dx,t.G.m[1]-(si*s.G.m[0]+co*s.G.m[1])-bx.y+dy);g.imageSmoothingQuality='high';g.drawImage(src.c,src.x,src.y);return c}
/* la zone d'un œil : ellipse un peu remontée (la paupière), rx le long des yeux */
function eyeZone(G,c){const up=0.03*G.ed;return{c:[c[0]-G.n[0]*up,c[1]-G.n[1]*up],rx:0.34*G.ed,ry:0.23*G.ed}}
function zoneR(Z,G,x,y){const X=(x-Z.c[0])*G.u[0]+(y-Z.c[1])*G.u[1],Y=(x-Z.c[0])*G.n[0]+(y-Z.c[1])*G.n[1];return Math.hypot(X/Z.rx,Y/Z.ry)}
function box(G,c,W,H){const h=Math.ceil(0.66*G.ed),x=Math.max(0,Math.floor(c[0]-h)),y=Math.max(0,Math.floor(c[1]-h)),x1=Math.min(W,Math.ceil(c[0]+h)),y1=Math.min(H,Math.ceil(c[1]+h));return x1-x<4||y1-y<4?null:{x,y,w:x1-x,h:y1-y}}
const lumA=D=>{const n=D.length/4,L=new Float32Array(n);for(let i=0;i<n;i++)L[i]=0.3*D[i*4]+0.59*D[i*4+1]+0.11*D[i*4+2];return L};
/* un œil : renvoie {bx, img} (pixels de la greffe, alpha = fondu) ou null */
function graftEye(tgt,src,t,s,c){const G=t.G,bx=box(G,c,tgt.width,tgt.height);if(!bx)return null;const Z=eyeZone(G,c);
  const T=rx(mk(bx.w,bx.h));T.drawImage(tgt,bx.x,bx.y,bx.w,bx.h,0,0,bx.w,bx.h);const TD=T.getImageData(0,0,bx.w,bx.h).data;
  /* recalage fin : on cherche le petit décalage qui fait le mieux coïncider la peau autour de l'œil */
  const ka=Math.min(1,96/bx.w),aw=Math.max(8,Math.round(bx.w*ka)),ah=Math.max(8,Math.round(bx.h*ka)),R=Math.max(2,Math.round(0.07*G.ed*ka));
  const small=c=>{const m=mk(aw,ah),g=rx(m);g.imageSmoothingQuality='high';g.drawImage(c,0,0,aw,ah);return lumA(g.getImageData(0,0,aw,ah).data)};
  const tL=small(T.canvas),pad=Math.ceil(R/ka)+1,big={x:bx.x-pad,y:bx.y-pad,w:bx.w+2*pad,h:bx.h+2*pad};
  const Wc=warpBox(src,s,t,big,0,0),bw=Math.round(big.w*ka),bh=Math.round(big.h*ka),wm=mk(bw,bh),wg=rx(wm);wg.imageSmoothingQuality='high';wg.drawImage(Wc,0,0,bw,bh);const wL=lumA(wg.getImageData(0,0,bw,bh).data);
  const ring=[];for(let y=0;y<ah;y++)for(let x=0;x<aw;x++){const r=zoneR(Z,G,bx.x+(x+0.5)/ka,bx.y+(y+0.5)/ka);if(r>1.12&&r<1.8)ring.push(y*aw+x)}
  if(ring.length<20)return null;const o=Math.round(pad*ka);let bdx=0,bdy=0,be=Infinity;
  const err=(dx,dy)=>{let e=0,mt=0,mw=0;for(const i of ring){const x=i%aw,y=(i/aw)|0,j=(y+o-dy)*bw+(x+o-dx);mt+=tL[i];mw+=wL[j]}const off=(mt-mw)/ring.length;
    for(const i of ring){const x=i%aw,y=(i/aw)|0,j=(y+o-dy)*bw+(x+o-dx),q=tL[i]-wL[j]-off;e+=q*q}return e};
  for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const e=err(dx,dy)*(1+0.02*(dx*dx+dy*dy));if(e<be){be=e;bdx=dx;bdy=dy}}
  const W=warpBox(src,s,t,bx,bdx/ka,bdy/ka),WD=rx(W).getImageData(0,0,bx.w,bx.h),D=WD.data;
  /* couleur : gain par canal mesuré sur la peau autour de l'œil */
  const sT=[0,0,0],sW=[0,0,0];let nr=0;const A=new Float32Array(bx.w*bx.h);
  for(let y=0;y<bx.h;y++)for(let x=0;x<bx.w;x++){const r=zoneR(Z,G,bx.x+x+0.5,bx.y+y+0.5),i=y*bx.w+x;A[i]=1-sstep(0.8,1.05,r);
    if(r>1.1&&r<1.6&&D[i*4+3]>250){for(let k=0;k<3;k++){sT[k]+=TD[i*4+k];sW[k]+=D[i*4+k]}nr++}}
  const gain=[0,1,2].map(k=>nr&&sW[k]>0?clamp(sT[k]/sW[k],0.75,1.33):1);
  for(let i=0;i<A.length;i++){const j=i*4;if(D[j+3]<250){D[j+3]=0;continue}for(let k=0;k<3;k++)D[j+k]=clamp(Math.round(D[j+k]*gain[k]),0,255);D[j+3]=Math.round(255*A[i])}
  const P=mk(bx.w,bx.h);rx(P).putImageData(WD,0,0);return{bx,img:P,shift:[bdx/ka,bdy/ka]}}
/* tous les visages choisis : le calque « Yeux ouverts » (taille de la photo, transparent hors des yeux) */
function buildLayer(tgt,srcs,plan){const out=mk(tgt.width,tgt.height),g=cx(out);let n=0;
  for(const P of plan){if(P.pick<0)continue;const s=P.cand[P.pick];if(!s||!s.piece)continue;
    for(const c of [P.t.G.a,P.t.G.b]){const r=graftEye(tgt,s.piece,P.t,s,c);if(r){g.drawImage(r.img,r.bx.x,r.bx.y);n++}}}
  return{c:out,n}}

/* ---------- analyse : visages de la photo et des autres photos ---------- */
async function analyse(d,srcs,tgt){busy(true,'Recherche des visages…',0);await tick();
  try{const F=await PrismDepth.facesIn(tgt);if(!F)return null;const T=F.map(f=>measure(tgt,f)).filter(Boolean);
    for(let i=0;i<srcs.length;i++){const S0=srcs[i];if(!S0.m){busy(true,`Visages de ${S0.name} (${i+1} / ${srcs.length})…`,(i+1)/(srcs.length+1));await tick();let c=null;try{c=await S0.load()}catch(e){console.warn(e)}S0.load=null;if(!c){S0.m=[];continue}
      const Fs=await PrismDepth.facesIn(c)||[];S0.m=Fs.map(f=>measure(c,f)).filter(Boolean);
      /* on ne garde de cette photo que les visages (une rafale de photos de 24 Mpx ne tiendrait pas en mémoire) */
      for(const m of S0.m){const h=1.6*Math.max(m.f.w,m.f.h),x=Math.max(0,Math.floor(m.G.m[0]-h)),y=Math.max(0,Math.floor(m.G.m[1]-h)),w=Math.min(c.width,Math.ceil(m.G.m[0]+h))-x,hh=Math.min(c.height,Math.ceil(m.G.m[1]+h))-y,pc=mk(w,hh);cx(pc).drawImage(c,x,y,w,hh,0,0,w,hh);m.piece={x,y,c:pc}}}}
    return T}finally{busy(false)}}
function makePlan(T,srcs,W,H){return T.map(t=>{const cand=srcs.map(S0=>match(t,S0.m||[],S0.W/W,S0.H/H));let pick=-1,bo=0;
    cand.forEach((s,i)=>{if(s&&s.open>bo){bo=s.open;pick=i}});
    /* on ne remplace que si les yeux d'ici sont nettement moins ouverts qu'ailleurs */
    const want=pick>=0&&bo>0.22&&t.open<bo*0.6;return{t,cand,pick:want?pick:-1,best:pick}})}

/* ---------- fenêtre ---------- */
const css=document.createElement('style');css.textContent=`
.ey-list{display:flex;flex-direction:column;gap:8px;max-height:300px;overflow:auto;margin:6px 0}
.ey-row{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;padding:6px;border-radius:8px;background:var(--bg-2,rgba(127,127,127,.08))}
.ey-row canvas{width:132px;height:44px;border-radius:4px;display:block;background:#222}
.ey-row .ey-c{display:flex;flex-direction:column;gap:3px}
.ey-row .ey-t{font-size:12px;opacity:.8}
.ey-row select{width:100%;min-width:0}.ey-row .ey-c{min-width:0}`;document.head.appendChild(css);
function crop(c,t,shiftFrom){const G=t.G,w=2*G.ed,h=0.66*G.ed,o=mk(264,88),g=cx(o);g.fillStyle='#222';g.fillRect(0,0,264,88);const k=264/w,{u,n,m}=G;
  g.setTransform(k*u[0],k*n[0],k*u[1],k*n[1],132-k*(u[0]*m[0]+u[1]*m[1]),44-k*(n[0]*m[0]+n[1]*m[1]));g.imageSmoothingQuality='high';g.drawImage(c,0,0);if(shiftFrom)g.drawImage(shiftFrom,0,0);return o}
const pct=v=>Math.round(v*100)+' %';
async function eyesDialog(){const d=S.doc;if(!d){toast(NODOC);return}const B=baseLayer(d);if(!B){toast('Pas de calque photo à retoucher');return}
  if(!window.PrismDepth||!PrismDepth.facesIn){toast('Détection des visages indisponible');return}
  try{if(!LIB.items.length)await libLoad()}catch(e){}
  const tgt=B.L.canvas,srcs=[];let T=null,plan=[],layer=null,tmr=null,closed=false;
  const addSrc=(name,W,H,load,id)=>{if(srcs.some(x=>id&&x.id===id))return;if(Math.abs(W/H-tgt.width/tgt.height)>0.03){toast(`« ${name} » n’a pas le même cadrage, elle est laissée de côté`);return}srcs.push({name,W,H,load,id,m:null})};
  for(const it of burstItems(d))addSrc(it.name,it.w,it.h,()=>baseCanvasOf(it),it.id);
  const preview=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(closed||S.doc!==d)return;layer=buildLayer(tgt,srcs,plan);const p=cloneC(tgt);cx(p).drawImage(layer.c,0,0);B.L.preview=p;markComp();draw()},60)};
  const clear=()=>{closed=true;clearTimeout(tmr);delete B.L.preview;markComp()};
  let el0=null;
  const draw=()=>{const el=el0;if(!el)return;const st=$('#ey-s',el),li=$('#ey-l',el);
    if(!srcs.length){st.innerHTML='Aucune autre photo de cette rafale dans la photothèque (prise à moins de 90 secondes, même cadrage). Ajoutez-en une ci-dessous, ou choisissez-les dans la photothèque avant d’ouvrir cette fenêtre.';li.innerHTML='';return}
    if(!T){st.textContent='Analyse…';return}
    if(!T.length){st.textContent='Aucun visage trouvé sur cette photo.';li.innerHTML='';return}
    const on=plan.filter(P=>P.pick>=0).length;st.textContent=`${srcs.length} autre${srcs.length>1?'s':''} photo${srcs.length>1?'s':''} de la rafale · ${T.length} visage${T.length>1?'s':''} · ${on} à rouvrir`;
    li.innerHTML='';plan.forEach((P,k)=>{const r=document.createElement('div');r.className='ey-row';const cv=document.createElement('canvas');cv.width=264;cv.height=88;
      const lc=layer&&P.pick>=0?layer.c:null;cx(cv).drawImage(crop(tgt,P.t,lc),0,0);
      const opts=['<option value="-1">Laisser tel quel</option>'].concat(P.cand.map((s,i)=>s?`<option value="${i}" ${i===P.pick?'selected':''}>${esc(srcs[i].name)} · ouverts ${pct(s.open)}</option>`:'')).join('');
      const has=P.cand.some(Boolean);
      r.innerHTML=`<div></div><div class="ey-c"><span class="ey-t">Visage ${k+1} · yeux ouverts ${pct(P.t.open)}${has?'':' · introuvable sur les autres photos'}</span>${has?`<select data-ey="${k}">${opts}</select>`:''}</div>`;r.firstChild.appendChild(cv);li.appendChild(r)})};
  const run=async()=>{T=await analyse(d,srcs,tgt);if(closed)return;if(!T){T=[];draw();return}plan=makePlan(T,srcs,tgt.width,tgt.height);draw();preview()};
  dialog({title:'Ouvrir les yeux',light:true,
    body:`<p class="muted" style="margin:0 0 8px">Pour un visage aux yeux fermés, Prism prend les yeux ouverts de la même personne sur une autre photo de la rafale et les pose ici, à la bonne taille et dans la bonne lumière. Tout se calcule sur votre appareil.</p>
      <p id="ey-s" style="margin:0 0 4px;font-weight:600"></p><div id="ey-l" class="ey-list"></div>
      <div style="margin-top:4px"><button type="button" class="btn sm" id="ey-add">Ajouter une photo de la rafale…</button></div>`,
    onOpen:el=>{el0=el;draw();
      el.addEventListener('change',e=>{const s=e.target.closest('[data-ey]');if(!s)return;plan[+s.dataset.ey].pick=+s.value;preview()});
      $('#ey-add',el).onclick=async()=>{const fs=await pickFiles('image/*');for(const f of fs){try{const im=await loadImageFile(f),c=mk(im.width,im.height);cx(c).drawImage(im,0,0);addSrc(f.name,c.width,c.height,async()=>c)}catch(e){toast('Lecture impossible : '+f.name)}}if(fs.length)run()};
      if(srcs.length)run()},
    buttons:[{label:'Annuler',onClick:()=>clear()},
      {label:'Appliquer',primary:true,onClick:()=>{clear();if(S.doc!==d||!d.layers.includes(B.L)){toast('La photo a changé');return}
        const r=buildLayer(tgt,srcs,plan);if(!r.n){toast('Aucun œil à remplacer');return}
        const L=newPixel('Yeux ouverts',r.c);d.active=d.layers.indexOf(B.L);insertLayer(L,'Ouvrir les yeux');toast(`Yeux rouverts sur ${plan.filter(P=>P.pick>=0).length} visage(s), dans le calque « Yeux ouverts »`)}}]})}
window.PrismEyes={dialog:eyesDialog,openness,eyePatch,geo,measure,match,graftEye,buildLayer,makePlan,burstItems};
/* menus : Filtre > Profondeur et visages, et une carte dans l'onglet IA */
{const _fi=MENU2.filter.items;MENU2.filter.items=function(){const a=_fi.apply(this,arguments),it=a.find(x=>x&&x.label==='Profondeur et visages (IA)');
  if(it&&it.sub){const sub=it.sub;it.sub=()=>{const s=sub();if(!s.some(x=>x&&x.label==='Ouvrir les yeux…'))s.push(MI('Ouvrir les yeux…',{fn:()=>eyesDialog(),dis:S.doc?false:NODOC}));return s}}return a}}
const CARD=`<div class="card eyes-card"><h4><svg viewBox="0 0 20 20"><path d="M2 10c2.2-3.6 5-5.4 8-5.4s5.8 1.8 8 5.4c-2.2 3.6-5 5.4-8 5.4S4.2 13.6 2 10z"/><circle cx="10" cy="10" r="2.6"/></svg>Ouvrir les yeux</h4><p>Quelqu’un a cligné des yeux ? Prism reprend ses yeux ouverts sur une autre photo de la même rafale.</p><div class="acts"><button class="btn sm" data-eyes-go="1">Ouvrir les yeux</button></div></div>`;
function injectCard(){const pa=document.getElementById('pane-ai');if(!pa||pa.querySelector('.eyes-card'))return;const ref=pa.querySelector('.blem-card')||pa.querySelector('.aim-card');const t=document.createElement('div');t.innerHTML=CARD;const c=t.firstChild;if(ref)ref.after(c);else pa.appendChild(c)}
{const pa=document.getElementById('pane-ai');if(pa){pa.addEventListener('click',e=>{if(e.target.closest('[data-eyes-go]')){e.stopPropagation();eyesDialog()}},true);new MutationObserver(()=>injectCard()).observe(pa,{childList:true});injectCard()}}
