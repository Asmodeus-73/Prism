/* ===== 0.4: AI masks for retouching.
   1. "Retouche IA avec masques" (IA tab, Image menu, Ctrl+K): finds the subject and the sky, refines the subject edge on the photo itself,
      then creates local adjustments (Sujet, Ciel, Arrière-plan) whose settings are measured on each region. Everything stays editable.
   2. AI masks on any local adjustment: Masque section and Calque > Masque IA: Sujet, Ciel, Arrière-plan, to replace, add, remove or intersect. ===== */

const AIM={};
const covOf=m=>{if(!m)return 0;const s=Math.min(1,256/Math.max(m.width,m.height)),w=Math.max(1,m.width*s|0),h=Math.max(1,m.height*s|0),t=mk(w,h),g=rx(t);g.drawImage(m,0,0,w,h);const a=g.getImageData(0,0,w,h).data;let n=0;for(let i=3;i<a.length;i+=4)n+=a[i];return n/(255*w*h)};
const invOf=m=>{const o=fullMask(),g=cx(o);g.globalCompositeOperation='destination-out';g.drawImage(m,0,0);return o};
const minus=(a,b)=>{const o=cloneC(a),g=cx(o);g.globalCompositeOperation='destination-out';g.drawImage(b,0,0);return o};
// statistics of the photo inside a mask, on a small proxy: median and percentiles of luminance, clipping, mean saturation
function stats(m){const d=S.doc,s=Math.min(1,384/Math.max(d.w,d.h)),w=Math.max(1,d.w*s|0),h=Math.max(1,d.h*s|0),t=mk(w,h),g=rx(t);g.drawImage(flatSync(),0,0,w,h);const a=g.getImageData(0,0,w,h).data;
  let ma=null;if(m){const u=mk(w,h),ug=rx(u);ug.drawImage(m,0,0,w,h);ma=ug.getImageData(0,0,w,h).data}
  const L=[];let sat=0,ws=0,clip=0,dark=0,gs=0,gn=0,pl=-1;
  for(let i=0;i<a.length;i+=4){const wt=ma?ma[i+3]/255:1;if(wt<0.5||a[i+3]<10){pl=-1;continue}const r=a[i]/255,gg=a[i+1]/255,b=a[i+2]/255,l=0.2126*r+0.7152*gg+0.0722*b,mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);L.push(l);sat+=mx>0?(mx-mn)/mx:0;ws++;if(mx>0.985)clip++;if(l<0.1)dark++;if(pl>=0&&(i/4)%w){gs+=Math.abs(l-pl);gn++}pl=l}
  if(!L.length)return null;L.sort((x,y)=>x-y);const q=f=>L[Math.min(L.length-1,Math.floor(f*L.length))];
  return{n:L.length,med:q(.5),lo:q(.02),hi:q(.98),spread:q(.9)-q(.1),sat:sat/ws,clip:clip/ws,dark:dark/ws,grad:gn?gs/gn:0}}
async function masks(onP){const d=S.doc;let subj=null,sky=null;
  try{subj=await AI.subjectMask()}catch(e){console.warn(e)}if(S.doc!==d)return null;
  const cs=covOf(subj);if(cs<0.02||cs>0.9)subj=null;
  onP&&onP(.35,'Recherche du ciel…');
  try{if(AI.skyMask)sky=await AI.skyMask(p=>onP&&onP(.35+.3*p,'Recherche du ciel…'))}catch(e){console.warn(e)}if(S.doc!==d)return null;
  if(covOf(sky)<0.03)sky=null;
  // the subject mask comes back already snapped to the photo's edges
  if(subj)subj=mainBlobs(subj);
  if(subj&&sky)sky=minus(sky,subj);
  let bg=null;if(subj){bg=invOf(subj);if(sky)bg=minus(bg,sky)}
  return{subj,sky,bg}}
// keeps the main blobs of a mask (drops islands the detector left in textured areas: they would turn into blotches once adjusted)
function mainBlobs(m){const R=512,s=Math.min(1,R/Math.max(m.width,m.height)),w=Math.max(1,Math.round(m.width*s)),h=Math.max(1,Math.round(m.height*s)),t=mk(w,h),g=rx(t);g.imageSmoothingQuality='high';g.drawImage(m,0,0,w,h);
  const a=g.getImageData(0,0,w,h).data,n=w*h,lab=new Int32Array(n).fill(-1),areas=[];const st=new Int32Array(n);
  for(let i=0;i<n;i++){if(lab[i]>=0||a[i*4+3]<128)continue;const id=areas.length;let top=0,ar=0;st[top++]=i;lab[i]=id;
    while(top){const j=st[--top];ar++;const x=j%w,y=(j/w)|0;for(const k of [x>0?j-1:-1,x<w-1?j+1:-1,y>0?j-w:-1,y<h-1?j+w:-1]){if(k>=0&&lab[k]<0&&a[k*4+3]>=128){lab[k]=id;st[top++]=k}}}areas.push(ar)}
  if(!areas.length)return m;const big=Math.max(...areas),keep=areas.map(v=>v>=big*0.12);
  // keep map, grown by a few pixels so the soft edge of a kept blob survives
  const km=new Uint8Array(n);for(let i=0;i<n;i++)if(lab[i]>=0&&keep[lab[i]])km[i]=1;
  const rr=3,gm=new Uint8Array(n);for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!km[y*w+x])continue;for(let dy=-rr;dy<=rr;dy++){const Y=y+dy;if(Y<0||Y>=h)continue;for(let dx=-rr;dx<=rr;dx++){const X=x+dx;if(X>=0&&X<w)gm[Y*w+X]=1}}}
  const kc=mk(w,h),kg=rx(kc),im=kg.createImageData(w,h);for(let i=0;i<n;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=gm[i]?255:0}kg.putImageData(im,0,0);
  // holes inside the subject (dark plumage, shadows the detector was unsure about): filled when small next to the subject
  const out=new Uint8Array(n),q=new Int32Array(n);let top=0;const push=k=>{if(!km[k]&&!out[k]){out[k]=1;q[top++]=k}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
  while(top){const j=q[--top],x=j%w,y=(j/w)|0;if(x>0)push(j-1);if(x<w-1)push(j+1);if(y>0)push(j-w);if(y<h-1)push(j+w)}
  let holeA=0;for(let i=0;i<n;i++)if(!km[i]&&!out[i])holeA++;
  // interior specks the detector was unsure about (even when they reach the border): closing then erosion of the kept map gives a solid core
  const dil=(A,r)=>{const t=new Uint8Array(n),o=new Uint8Array(n);for(let y=0;y<h;y++){let c=0;for(let x=-r;x<w+r;x++){if(x+r<w&&A[y*w+x+r])c++;if(x-r-1>=0&&A[y*w+x-r-1])c--;if(x>=0&&x<w)t[y*w+x]=c>0?1:0}}
    for(let x=0;x<w;x++){let c=0;for(let y=-r;y<h+r;y++){if(y+r<h&&t[(y+r)*w+x])c++;if(y-r-1>=0&&t[(y-r-1)*w+x])c--;if(y>=0&&y<h)o[y*w+x]=c>0?1:0}}return o};
  const inv=A=>{const o=new Uint8Array(n);for(let i=0;i<n;i++)o[i]=A[i]?0:1;return o};
  const cr=Math.max(2,Math.round(Math.max(w,h)/90)),core=inv(dil(inv(inv(dil(inv(dil(km,cr)),cr))),cr+2));
  const hc=mk(w,h);if(holeA&&holeA<big*0.25){const hg=rx(hc),hi=hg.createImageData(w,h);for(let i=0;i<n;i++){hi.data[i*4]=hi.data[i*4+1]=hi.data[i*4+2]=255;hi.data[i*4+3]=(!km[i]&&!out[i])?255:0}hg.putImageData(hi,0,0)}
  const o=cloneC(m),og=cx(o);og.globalCompositeOperation='destination-in';og.imageSmoothingQuality='high';og.drawImage(kc,0,0,m.width,m.height);og.globalCompositeOperation='source-over';if(holeA&&holeA<big*0.25)og.drawImage(hc,0,0,m.width,m.height);
  {const cc=mk(w,h),cg=rx(cc),ci=cg.createImageData(w,h);for(let i=0;i<n;i++){ci.data[i*4]=ci.data[i*4+1]=ci.data[i*4+2]=255;ci.data[i*4+3]=core[i]?255:0}cg.putImageData(ci,0,0);og.imageSmoothingQuality='high';og.drawImage(cc,0,0,m.width,m.height)}
  return o}
AIM.masks=masks;
const r2=v=>Math.round(v*100)/100;
// A dose is measured on the region itself: each setting is touched only when the region shows the matching need,
// in proportion to it, and the reason is kept so the user can read why (DOSE.why).
const DOSE={why:[]};
const ramp=(x,a,b)=>clamp((x-a)/(b-a),0,1);
const pct=v=>Math.round(v*100)+' %';
function put(z,k,v,txt){v=k==='exposure'?r2(v):Math.round(v);if(!v)return;z[k]=v;DOSE.why.push(txt)}
function dose(kind,st,sub){const z=DEV0();DOSE.why=[];if(!st)return z;
  const face=kind==='face'||kind==='skin',sky=kind==='sky';
  // brightness: bring the median toward a natural level for this kind of region
  const target=sky?0.72:face?0.52:kind==='bg'?0.4:0.47;let e=Math.log2(target/Math.max(0.03,st.med));
  if(sky)e=Math.min(0,e);                               // a sky is only ever darkened
  if(kind==='bg'&&sub)e=Math.min(0,-0.4*Math.max(0,st.med-sub.med+0.04)*4); // background: only calmed when it competes with the subject
  e*=face?0.7:0.9;if(Math.abs(e)>=0.12)put(z,'exposure',clamp(e,-0.6,0.8),e>0?'trop sombre ('+pct(st.med)+' de luminosité)':'trop lumineux ('+pct(st.med)+' de luminosité)');
  const hl=st.clip>0.004||st.hi>0.97?ramp(st.clip,0.004,0.08)*40+(st.hi>0.97?8:0):0;
  if(hl>=6)put(z,'highlights',-hl,st.clip>0.004?pct(st.clip)+' des pixels brûlés':'hautes lumières très proches du blanc');
  if(st.clip>0.02&&sky)put(z,'whites',-12,'point blanc abaissé');
  const sh=ramp(st.dark,0.05,0.35)*42;if(sh>=5&&kind!=='bg')put(z,'shadows',sh,pct(st.dark)+' de la zone est très sombre');
  // haze: flat and lifted blacks
  const hz=st.spread<0.22&&st.lo>0.1&&!face?ramp(0.22-st.spread,0,0.12)*24:0;if(hz>=4)put(z,'dehaze',hz,'voile (contraste faible dans la zone)');
  // local contrast and texture: only where the region is flat; skin and background are never sharpened
  const flat=ramp(0.03-st.grad,0,0.022);
  if(!face&&kind!=='bg'&&flat>0.2){put(z,'clarity',flat*14,'zone molle (peu de détails)');put(z,'texture',flat*10,'zone molle (peu de détails)')}
  if(face&&st.grad>0.05)put(z,'texture',-ramp(st.grad,0.05,0.1)*14,'texture de peau marquée');
  // colour
  const vib=ramp(0.34-st.sat,0,0.22)*26;if(vib>=4&&!face)put(z,'vibrance',vib,'couleurs ternes ('+pct(st.sat)+' de saturation)');
  if(kind==='bg'&&sub&&st.sat>sub.sat+0.1)put(z,'saturation',-clamp((st.sat-sub.sat)*40,0,15),'fond plus coloré que le sujet');
  return z}
const devSubject=st=>dose('subj',st),devSky=st=>dose('sky',st),devBg=(st,sub)=>dose('bg',st,sub);
// a starting dose for a single AI mask, measured on the region (the user then tunes it)
function devFor(kind,m){const st=stats(m);if(!st)return DEV0();
  return dose(kind==='people'?'subj':kind,st,kind==='bg'?stats(invOf(m)):null)}
const isNeutral=L=>{const z=DEV0(),v=L.dev||{};return Object.keys(z).every(k=>typeof z[k]!=='number'||(v[k]??z[k])===z[k])};

async function aiMaskRetouch(){const d=S.doc;if(!d){toast('Ouvrez d’abord une photo');return}const h0=S.history[S.hi];
  const prog=(p,m)=>busy(true,m||'Analyse de la photo…',p);
  let M=null;try{prog(.02,'Recherche du sujet…');await tick();M=await masks(prog)}catch(e){console.error(e)}finally{busy(false)}
  if(!M||S.doc!==d){return}
  if(S.history[S.hi]!==h0){toast('Retouche IA annulée : la photo a changé pendant l’analyse');return}
  if(!M.subj&&!M.sky){toast('Ni sujet ni ciel nets dans cette photo : rien à masquer. Les réglages automatiques restent possibles.',5000);return}
  const add=[],notes=[],sSub=M.subj?stats(M.subj):null;
  const one=(name,mask,st,fn)=>{if(!st)return;const dev=fn(st),why=DOSE.why.slice(),L=newAdjust(name+' (IA)',mask);L.dev=dev;
    if(isNeutral(L)){notes.push(name+' : rien à corriger');return}add.push(L);notes.push(name+' : '+[...new Set(why)].join(', '))};
  if(M.bg)one('Arrière-plan',M.bg,stats(M.bg),s=>devBg(s,sSub));
  if(M.sky)one('Ciel',M.sky,stats(M.sky),devSky);
  if(M.subj)one('Sujet',M.subj,sSub,devSubject);
  if(!add.length){toast('Photo déjà équilibrée sur les zones détectées ('+notes.join(' ; ')+') : rien ajouté.',7000);return}
  d.layers.push(...add);d.active=d.layers.length-1;markComp();if(typeof markContent==='function')markContent();pushHistory('Retouche IA avec masques');syncAll();try{switchTab('develop')}catch(e){}
  toast(notes.join(' · '),9000)}
AIM.retouch=aiMaskRetouch;

// ---------- AI mask on the active local adjustment (or pixel layer mask) ----------
const OPS=[['layer','Nouveau réglage'],['new','Remplacer'],['add','Ajouter'],['sub','Retirer'],['and','Croiser']];
async function applyAIMask(kind,op){const d=S.doc,A=d&&d.layers[d.active];if(!A){toast('Ouvrez d’abord une photo');return}
  if(A.kind==='adjust'&&!A.mask&&op!=='new'&&op!=='layer'){op='new'}
  const h0=S.history[S.hi];let m=null;try{busy(true,'Masque IA…',null);await tick();m=await AI.categoryMask(kind)}finally{busy(false)}
  if(!m||S.doc!==d||S.history[S.hi]!==h0)return;
  let out;const cur=A.mask;
  if(op==='new'||op==='layer'||!cur)out=cloneC(m);
  else{out=cloneC(cur);const g=cx(out);g.globalCompositeOperation=op==='add'?'source-over':op==='sub'?'destination-out':'destination-in';g.drawImage(m,0,0);g.globalCompositeOperation='source-over'}
  // a new local adjustment: asked for, or the only global adjustment (never masked)
  if(op==='layer'||A.kind==='adjust'&&!A.mask&&d.layers.filter(l=>l.kind==='adjust'&&!l.mask).length<=1){
    const L=newAdjust(AI.categoryLabel(kind)+' (IA)',out);L.dev=devFor(kind,out);const why=[...new Set(DOSE.why)];insertLayer(L,'Masque IA',true);switchTab('develop');toast(AI.categoryLabel(kind)+' : '+(why.length?why.join(', ')+'. Réglages ajustés en conséquence, modifiables à droite.':'rien à corriger sur cette zone, réglage laissé neutre.'),7000);return}
  // a fresh local adjustment gets a starting dose too, so the mask shows its effect right away
  const dosed=A.kind==='adjust'&&op==='new'&&isNeutral(A);let why=[];if(dosed){A.dev=devFor(kind,out);why=[...new Set(DOSE.why)]}
  if(op==='new'&&/ \(IA\)$/.test(A.name||''))A.name=AI.categoryLabel(kind)+' (IA)';
  A.mask=out;markComp();if(typeof markContent==='function')markContent();pushHistory('Masque IA');syncAll();toast(dosed?(why.length?'Masque appliqué : '+why.join(', '):'Masque appliqué : rien à corriger sur cette zone'):'Masque mis à jour')}
AIM.apply=applyAIMask;window.PrismAIMask=AIM;

// Masque section (local adjustments): a row of AI buttons with the combination mode
{const st=document.createElement('style');st.textContent='.aim-row{display:grid;gap:6px;margin:2px 0 10px}.aim-row .aim-t{font-size:11.5px;color:var(--fg-2)}.aim-row .aim-b{display:flex;gap:6px;flex-wrap:wrap}.aim-row select{font:inherit;font-size:12px}';document.body.appendChild(st)}
function injectRow(){const root=document.querySelector('#zmSec .zm-root');if(!root||root.querySelector('.aim-row'))return;
  const r=document.createElement('div');r.className='aim-row';
  r.innerHTML=`<span class="aim-t">Masque IA</span><div class="aim-b"><button type="button" class="btn sm" data-aim="subj">Sujet</button><button type="button" class="btn sm" data-aim="sky">Ciel</button><button type="button" class="btn sm" data-aim="people">Personnes</button><button type="button" class="btn sm" data-aim="bg">Arrière-plan</button><select class="aim-more" aria-label="Autres masques IA"><option value="">Autre…</option>${AI.categories().filter(k=>!['subj','sky','people','bg'].includes(k)).map(k=>`<option value="${k}">${AI.categoryLabel(k)}</option>`).join('')}</select><select class="aim-op" aria-label="Combinaison">${OPS.slice(1).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>`;
  r.addEventListener('click',e=>{const b=e.target.closest('[data-aim]');if(!b)return;e.preventDefault();e.stopPropagation();applyAIMask(b.dataset.aim,r.querySelector('.aim-op').value)});
  r.addEventListener('change',e=>{const t=e.target.closest('.aim-more');if(!t||!t.value)return;const k=t.value;t.value='';applyAIMask(k,r.querySelector('.aim-op').value)});
  root.insertBefore(r,root.firstChild)}
{const body=document.getElementById('devBody');if(body)new MutationObserver(()=>injectRow()).observe(body,{childList:true,subtree:true})}

// IA tab card
const CARD=`<div class="card aim-card"><h4><svg viewBox="0 0 20 20"><circle cx="8" cy="8" r="3"/><path d="M3 17c.6-2.6 2.6-4 5-4"/><path d="M11 3.5h6M11 7h6M13 10.5h4"/><path d="M12 14.5l2 2 3.5-4"/></svg>Retouche IA avec masques</h4><p>L’IA repère le sujet et le ciel, affine leur contour, puis crée un réglage masqué pour chacun, dosé selon la photo. Tout reste modifiable.</p><div class="acts"><button class="btn sm primary" data-aim-go="1">Retoucher avec masques</button></div></div>`;
function injectCard(){const p=document.getElementById('pane-ai');if(!p||p.querySelector('.aim-card'))return;const cards=p.querySelectorAll('.card');const ref=cards[1]||null;
  const t=document.createElement('div');t.innerHTML=CARD;const c=t.firstChild;if(ref)ref.parentNode.insertBefore(c,ref);else p.appendChild(c)}
{const p=document.getElementById('pane-ai');if(p){p.addEventListener('click',e=>{if(e.target.closest('[data-aim-go]')){e.stopPropagation();aiMaskRetouch()}},true);new MutationObserver(()=>injectCard()).observe(p,{childList:true});injectCard()}}

// menus
const _miAM=MENU2.image.items;MENU2.image.items=()=>{const a=_miAM();if(!a.some(x=>x&&x.label==='Retouche IA avec masques'))a.push(MI('Retouche IA avec masques',{icon:'subject',fn:aiMaskRetouch,dis:docDis()}));return a};
const _mlAM=MENU2.layer.items;MENU2.layer.items=()=>{const a=_mlAM();if(a.some(x=>x&&x.label==='Masque IA'))return a;
  const sub=()=>AI.categories().map(k=>MI(AI.categoryLabel(k),{sub:()=>OPS.map(([o,ol])=>MI(ol,{fn:()=>applyAIMask(k,o)}))}));
  a.push(SEP,MI('Masque IA',{icon:'subject',sub,dis:docDis()}));return a};
