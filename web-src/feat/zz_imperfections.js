/* ===== Retouche des imperfections (Filtre > Profondeur et visages > Retouche des imperfections…, onglet IA) =====
   Trouve et efface les boutons, rougeurs et petites taches de la peau des visages, sans rien envoyer : tout tourne sur l'appareil.
   - Visages : YuNet (déjà utilisé pour anonymiser), avec ses cinq repères pour tenir à l'écart les yeux, les sourcils, les narines et la bouche.
   - Peau du visage : le modèle de personnes (MediaPipe) ; à défaut, une ellipse dans le cadre du visage.
   - Taches : à la taille de travail (visage ramené à 360 px), différence de flous à quatre échelles, sur la luminance (taches sombres)
     et sur le rouge (rougeurs). Chaque tache a une force et un type : « imperfection » (rouge) ou « marque naturelle » (grain de beauté, tache de rousseur : brune, sans rouge).
   - Effacement à pleine définition : le fond est interpolé depuis le tour de la tache, et le grain de la peau est repris à côté, sur une zone saine.
   - Deux curseurs comme dans Lightroom (Imperfections, Marques naturelles), plus l'intensité ; un clic sur la photo retire une tache oubliée,
     Alt + clic (ou le mode « Garder ») rend une tache effacée à tort ; un clic sur un visage avec le mode « Visages » l'exclut.
   - Le résultat est un effet modifiable du calque : on peut rouvrir la fenêtre et changer les réglages plus tard. ===== */
{
const BL={det:new WeakMap()};
const WK=360;/* largeur de travail d'un visage */
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
/* repères par défaut quand le modèle n'en donne pas (proportions moyennes du cadre YuNet) */
function kpOf(f){if(f.kp&&f.kp.length===5)return f.kp;return[[f.x+f.w*0.3,f.y+f.h*0.42],[f.x+f.w*0.7,f.y+f.h*0.42],[f.x+f.w*0.5,f.y+f.h*0.62],[f.x+f.w*0.35,f.y+f.h*0.8],[f.x+f.w*0.65,f.y+f.h*0.8]]}
/* zone de travail d'un visage, en coordonnées du calque */
function regionOf(f,L){const ox=L.x|0,oy=L.y|0,c=L.canvas,X=Math.max(0,Math.floor(f.x-f.w*0.18-ox)),Y=Math.max(0,Math.floor(f.y-f.h*0.3-oy)),X1=Math.min(c.width,Math.ceil(f.x+f.w*1.18-ox)),Y1=Math.min(c.height,Math.ceil(f.y+f.h*1.12-oy));
  return X1-X<8||Y1-Y<8?null:{X,Y,W:X1-X,H:Y1-Y}}
/* la peau utilisable d'un visage, à la taille de travail : peau (IA ou ellipse), moins les yeux et sourcils, les narines et la bouche, resserrée */
function validMask(f,L,R,k,skin){const w=Math.max(1,Math.round(R.W*k)),h=Math.max(1,Math.round(R.H*k)),c=mk(w,h),g=rx(c),ox=L.x|0,oy=L.y|0;
  const tx=x=>(x-ox-R.X)*k,ty=y=>(y-oy-R.Y)*k,fw=f.w*k;
  g.fillStyle='#fff';g.beginPath();g.ellipse(tx(f.x+f.w/2),ty(f.y+f.h*0.52),f.w*0.5*k,f.h*0.5*k,0,0,Math.PI*2);g.fill();
  if(skin){g.globalCompositeOperation='destination-in';g.drawImage(skin,R.X+ox,R.Y+oy,R.W,R.H,0,0,w,h)}
  g.globalCompositeOperation='destination-out';g.fillStyle='#000';const kp=kpOf(f),[e1,e2,n,m1,m2]=kp;
  const eye=Math.hypot(e2[0]-e1[0],e2[1]-e1[1])*k||fw*0.4,ang=Math.atan2(e2[1]-e1[1],e2[0]-e1[0]);
  for(const e of [e1,e2]){g.beginPath();g.ellipse(tx(e[0])+Math.sin(ang)*eye*0.12,ty(e[1])-Math.cos(ang)*eye*0.12,eye*0.42,eye*0.36,ang,0,Math.PI*2);g.fill()}
  g.beginPath();g.ellipse(tx(n[0]),ty(n[1])+eye*0.1,eye*0.34,eye*0.24,ang,0,Math.PI*2);g.fill();
  const mx=(m1[0]+m2[0])/2,my=(m1[1]+m2[1])/2,mw=Math.hypot(m2[0]-m1[0],m2[1]-m1[1])*k||eye*0.9;g.beginPath();g.ellipse(tx(mx),ty(my),mw*0.62+eye*0.08,eye*0.3,ang,0,Math.PI*2);g.fill();
  const a=g.getImageData(0,0,w,h).data,M=new Float32Array(w*h);for(let i=0;i<w*h;i++)M[i]=a[i*4+3]/255;
  /* resserrée : on reste loin des bords de la peau (cheveux, barbe, contour) */
  const B=gaussF(M,w,h,Math.max(1,fw*0.025));for(let i=0;i<w*h;i++)M[i]=sstep(0.86,0.98,B[i])*M[i];return{M,w,h}}
/* détection des taches d'un visage : liste {x,y (calque), r (px), s (force), red, kind} */
function detect(L,f,skin){const R=regionOf(f,L);if(!R)return[];const k=Math.min(1,WK/(f.w*1.36));const V=validMask(f,L,R,k,skin),w=V.w,h=V.h,N=w*h;
  const t=mk(w,h),g=rx(t);g.imageSmoothingQuality='high';g.drawImage(L.canvas,R.X,R.Y,R.W,R.H,0,0,w,h);const a=g.getImageData(0,0,w,h).data;
  const Y=new Float32Array(N),Rd=new Float32Array(N);for(let i=0,j=0;i<N;i++,j+=4){const r=a[j]/255,gg=a[j+1]/255,b=a[j+2]/255;Y[i]=0.2126*r+0.7152*gg+0.0722*b;Rd[i]=r-0.5*(gg+b)}
  const fw=f.w*k,SG=[0.0045,0.008,0.013,0.019].map(q=>Math.max(0.8,q*fw));
  const best=new Float32Array(N),bs=new Uint8Array(N),dk=new Float32Array(N),rd=new Float32Array(N);
  const YS=[],RS=[];
  SG.forEach((sg,si)=>{const ys=gaussF(Y,w,h,sg),yb=gaussF(Y,w,h,sg*3),rs=gaussF(Rd,w,h,sg),rb=gaussF(Rd,w,h,sg*3);YS.push(ys);RS.push(rs);
    for(let i=0;i<N;i++){if(V.M[i]<0.5)continue;const d=(yb[i]-ys[i])/(yb[i]+0.08),r=rs[i]-rb[i],sc=d+1.4*Math.max(0,r);if(sc>best[i]){best[i]=sc;bs[i]=si;dk[i]=d;rd[i]=r}}});
  const C=[];for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const i=y*w+x,v=best[i];if(v<0.02)continue;let mx=true;
    for(let dy=-2;dy<=2&&mx;dy++)for(let dx=-2;dx<=2;dx++){if((dx||dy)&&best[i+dy*w+dx]>v){mx=false;break}}if(mx)C.push(i)}
  C.sort((p,q)=>best[q]-best[p]);const out=[];
  for(const i of C){const x=i%w,y=(i/w)|0,r=SG[bs[i]]*1.9;if(out.some(o=>Math.hypot(o.wx-x,o.wy-y)<(o.wr+r)*0.7))continue;
    /* une vraie tache est entourée d'une peau à peu près uniforme ; un bord (cheveux, ombre du menton, lèvre) ne l'est pas */
    {const sg=SG[bs[i]],ys=YS[bs[i]],rs=RS[bs[i]],rr=sg*3.2,c0=ys[i],r0=rs[i];let mn=9,mx=-9,sm=0,rm=0,n=0;for(let q=0;q<12;q++){const t=q/12*Math.PI*2,xx=Math.round(x+Math.cos(t)*rr),yy=Math.round(y+Math.sin(t)*rr);if(xx<0||yy<0||xx>=w||yy>=h)continue;const v=ys[yy*w+xx];mn=Math.min(mn,v);mx=Math.max(mx,v);sm+=v;rm+=rs[yy*w+xx];n++}
      if(n<9)continue;const depth=sm/n-c0,rdep=r0-rm/n;if(mx-mn>0.8*Math.max(depth,2*rdep)+0.012)continue}
    const red=rd[i],dark=dk[i],kind=red>0.012&&red>dark*0.22?'imp':'nat';
    out.push({wx:x,wy:y,wr:r,x:R.X+(x+0.5)/k,y:R.Y+(y+0.5)/k,r:r/k,s:best[i],red,dark,kind});if(out.length>400)break}
  return out.map(({wx,wy,wr,...o})=>o)}
/* force minimale pour un réglage de curseur 0..100 (0 : rien n'est retiré) */
const thr=v=>v<=0?Infinity:0.022*(1+16*Math.pow(1-v/100,2));
function chosen(spots,p){const ti=thr(p.imp),tn=thr(p.nat);return spots.filter(o=>o.s>=(o.kind==='imp'?ti:tn)||(o.kind==='nat'&&o.s>=ti*2.2&&o.red>0.006))}
/* effacement d'une tache dans le tableau RVBA de la zone (pleine définition) */
function heal(A,B,W,H,cx0,cy0,R,amt,donor){const R2=R*1.25,x0=Math.max(0,Math.floor(cx0-R2-1)),y0=Math.max(0,Math.floor(cy0-R2-1)),x1=Math.min(W-1,Math.ceil(cx0+R2+1)),y1=Math.min(H-1,Math.ceil(cy0+R2+1));
  /* points sur le tour de la tache (dans la copie floutée : le fond, sans le grain) */
  const n=Math.max(16,Math.min(72,Math.round(R*3))),ring=[];for(let q=0;q<n;q++){const t=q/n*Math.PI*2,px=clamp(Math.round(cx0+Math.cos(t)*(R2+1.5)),0,W-1),py=clamp(Math.round(cy0+Math.sin(t)*(R2+1.5)),0,H-1),j=(py*W+px)*4;ring.push([px,py,B[j],B[j+1],B[j+2]])}
  const [dx,dy]=donor;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x-cx0,y-cy0),al=(1-sstep(R*0.8,R2,d))*amt;if(al<=0.003)continue;
    let ws=0,r=0,g=0,b=0;for(const q of ring){const ww=1/((x-q[0])**2+(y-q[1])**2+1);ws+=ww;r+=q[2]*ww;g+=q[3]*ww;b+=q[4]*ww}r/=ws;g/=ws;b/=ws;
    const sx=clamp(x+dx,0,W-1),sy=clamp(y+dy,0,H-1),js=(sy*W+sx)*4,j=(y*W+x)*4;
    const nr=r+(A[js]-B[js]),ng=g+(A[js+1]-B[js+1]),nb=b+(A[js+2]-B[js+2]);
    A[j]+= (nr-A[j])*al;A[j+1]+=(ng-A[j+1])*al;A[j+2]+=(nb-A[j+2])*al}}
/* l'effet : la photo du calque avec les taches choisies effacées */
function run(L,dets,p){const out=cloneC(L.canvas),g=rx(out),ox=L.x|0,oy=L.y|0,amt=p.k/100;
  for(const D of dets){if(D.f.off)continue;const list=chosen(D.spots,p).filter(o=>!(p.keep||[]).some(q=>Math.hypot(q.x-ox-o.x,q.y-oy-o.y)<q.r+o.r*0.5));
    for(const m of p.add||[]){const x=m.x-ox,y=m.y-oy;if(x>=D.f.x-ox-D.f.w*0.2&&x<=D.f.x-ox+D.f.w*1.2&&y>=D.f.y-oy-D.f.h*0.35&&y<=D.f.y-oy+D.f.h*1.15)list.push({x,y,r:m.r})}
    if(!list.length)continue;const R=regionOf(D.f,L);if(!R)continue;const im=g.getImageData(R.X,R.Y,R.W,R.H),A=im.data,W=R.W,H=R.H;
    /* copie floutée (le fond) : rayon de quelques pixels, à l'échelle du visage */
    const sg=Math.max(1.2,D.f.w*0.004),B=new Float32Array(A.length);{const P=new Float32Array(W*H);for(let c=0;c<3;c++){for(let i=0;i<W*H;i++)P[i]=A[i*4+c];const Q=gaussF(P,W,H,sg);for(let i=0;i<W*H;i++)B[i*4+c]=Q[i]}}
    const base=D.spots;
    for(const o of list){const cx0=o.x-R.X,cy0=o.y-R.Y,Rr=o.r*1.55+1.5;
      /* grain repris à côté, du côté le plus sain (le moins de taches) */
      let bestD=[Math.round(Rr*2.6),0],bs=-1;for(let q=0;q<8;q++){const t=q/8*Math.PI*2,dx=Math.round(Math.cos(t)*Rr*2.6),dy=Math.round(Math.sin(t)*Rr*2.6),X=cx0+dx,Y=cy0+dy;if(X<Rr||Y<Rr||X>W-Rr||Y>H-Rr)continue;
        let sc=1;for(const s of base){const dd=Math.hypot(s.x-R.X-X,s.y-R.Y-Y);if(dd<s.r+Rr)sc-=s.s*4}if(sc>bs){bs=sc;bestD=[dx,dy]}}
      heal(A,B,W,H,cx0,cy0,Rr,amt,bestD)}
    g.putImageData(im,R.X,R.Y)}
  return out}
async function skinMask(){try{const m=await AI.categoryMask('face');return m}catch(e){console.warn(e);return null}}
async function detectAll(L,faces){const skin=await skinMask();return faces.map(f=>({f,spots:detect(L,f,skin)}))}
async function blemDialog(p0){const d=S.doc;if(!d)return;const L=pixelTarget();if(!L){toast('Aucun calque de pixels');return}if(L.visible===false){toast('Ce calque est masqué : affichez-le d’abord');return}
  if(!window.PrismDepth){toast('La recherche des visages n’est pas disponible');return}
  const F0=p0&&p0.faces?p0.faces:await PrismDepth.detectFaces();if(!F0||S.doc!==d||!d.layers.includes(L))return;
  if(!F0.length){toast('Aucun visage trouvé sur cette photo',4500);return}
  busy(true,'Recherche des imperfections…',null);await tick();let dets;try{dets=await detectAll(L,F0.map(f=>({off:false,...f})))}finally{busy(false)}if(S.doc!==d)return;
  const p={imp:70,nat:0,k:100,add:[],keep:[],...(p0||{})};delete p.faces;p.add=(p.add||[]).slice();p.keep=(p.keep||[]).slice();let tmr=null,off=null,mode='add';
  const med=()=>{const s=dets.map(D=>D.f.w).sort((a,b)=>a-b);return s.length?s[s.length>>1]:Math.max(d.w,d.h)/10};
  const count=el=>{let n=0;for(const D of dets)if(!D.f.off)n+=chosen(D.spots,p).length;n+=p.add.length;const on=dets.filter(D=>!D.f.off).length;
    $('#bl-n',el).textContent=`${n} tache${n>1?'s':''} effacée${n>1?'s':''} sur ${on} visage${on>1?'s':''}`+(dets.length>on?` (${dets.length-on} laissé${dets.length-on>1?'s':''} tel${dets.length-on>1?'s':''} quel${dets.length-on>1?'s':''})`:'')};
  const go=()=>{let r=run(L,dets,p);if(d.sel)r=mixSelB(L.canvas,r,d.sel);return r};
  const prev=(ms=90)=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(S.doc!==d)return;L.preview=go();markComp()},ms)};
  const clear=()=>{clearTimeout(tmr);delete L.preview;off&&off();off=null};
  const save=()=>({...p,faces:dets.map(D=>({x:D.f.x,y:D.f.y,w:D.f.w,h:D.f.h,kp:D.f.kp,off:!!D.f.off}))});
  dialog({title:'Retouche des imperfections',light:true,
    body:`<p class="muted" style="margin:0 0 8px">L’IA repère les boutons, rougeurs et petites taches de la peau des visages et les efface en gardant le grain de la peau. Tout se calcule sur votre appareil.</p>
      <p id="bl-n" style="margin:0 0 8px;font-weight:600"></p>`
      +rangeRow('bl-imp','Imperfections',0,100,1,p.imp,'')+rangeRow('bl-nat','Grains de beauté',0,100,1,p.nat,'')+rangeRow('bl-k','Intensité',0,100,1,p.k,' %')
      +`<div class="row"><label for="bl-mode">Clic sur la photo</label><select id="bl-mode"><option value="add">Effacer une tache oubliée</option><option value="keep">Garder une tache (restaurer)</option><option value="face">Inclure ou exclure un visage</option></select></div>
      <p class="muted" style="margin:6px 0 0;font-size:11.5px">« Grains de beauté » : aussi les taches de rousseur, laissés par défaut. Alt + clic : garder une tache.</p>`,
    onOpen:el=>{count(el);const ms=$('#bl-mode',el);ms.onchange=()=>{mode=ms.value};
      [['imp','bl-imp',''],['nat','bl-nat',''],['k','bl-k',' %']].forEach(([k,id,u])=>{const i=$('#'+id,el);i.oninput=()=>{p[k]=+i.value;$('#'+id+'-o',el).textContent=i.value+u;count(el);prev()}});
      off=PrismDepth.onPhoto((kd,pt,e)=>{if(kd!=='down')return;const alt=!!(window.event&&window.event.altKey);const m=alt?'keep':mode,r=med()*0.025;
        if(m==='face'){const hit=dets.find(D=>pt.x>=D.f.x&&pt.x<=D.f.x+D.f.w&&pt.y>=D.f.y-D.f.h*0.1&&pt.y<=D.f.y+D.f.h*1.1);if(hit)hit.f.off=!hit.f.off;else{toast('Pas de visage ici');return}}
        else if(m==='keep'){const i=p.add.findIndex(q=>Math.hypot(q.x-pt.x,q.y-pt.y)<q.r*1.5);if(i>=0)p.add.splice(i,1);else p.keep.push({x:pt.x,y:pt.y,r:r*1.2})}
        else{const i=p.keep.findIndex(q=>Math.hypot(q.x-pt.x,q.y-pt.y)<q.r);if(i>=0)p.keep.splice(i,1);else p.add.push({x:pt.x,y:pt.y,r})}
        count(el);prev(0)});
      prev(0)},
    buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
      {label:'Appliquer',primary:true,onClick:()=>{clear();if(S.doc!==d||!d.layers.includes(L)){toast('Le calque n’existe plus');return}
        const r=go();window.PrismEffects&&PrismEffects.note('blem',save());applyMasked(L,r,'Retouche des imperfections');syncAll()}}]})}
const mixSelB=(o,r,sel)=>{const out=cloneC(o),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(sel,0,0);const t=cloneC(r),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(sel,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};
window.PrismBlem={dialog:blemDialog,detect:detectAll,run,chosen};
/* menus : Filtre > Profondeur et visages, et une carte dans l'onglet IA */
{const _fi=MENU2.filter.items;MENU2.filter.items=function(){const a=_fi.apply(this,arguments),it=a.find(x=>x&&x.label==='Profondeur et visages (IA)');
  if(it&&it.sub){const sub=it.sub;it.sub=()=>{const s=sub();if(!s.some(x=>x&&x.label==='Retouche des imperfections…'))s.push(MI('Retouche des imperfections…',{fn:()=>blemDialog(),dis:S.doc?false:NODOC}));return s}}return a}}
if(window.PrismEffects)PrismEffects.defineX('blem',{name:'Retouche des imperfections',run:async(Lt,p)=>{const dets=await detectAll(Lt,(p.faces||[]).map(f=>({...f})));return run(Lt,dets,p)},edit:p=>blemDialog(p)});
const CARD=`<div class="card blem-card"><h4><svg viewBox="0 0 20 20"><circle cx="10" cy="9" r="6"/><circle cx="8" cy="8" r=".8"/><circle cx="12.5" cy="10.5" r=".8"/><path d="M4 18c1.5-1.6 3.6-2.4 6-2.4s4.5.8 6 2.4"/></svg>Retouche des imperfections</h4><p>Efface boutons et rougeurs des visages en gardant le grain de la peau ; les grains de beauté restent, sauf si vous le demandez.</p><div class="acts"><button class="btn sm" data-blem-go="1">Retoucher les visages</button></div></div>`;
function injectCard(){const pa=document.getElementById('pane-ai');if(!pa||pa.querySelector('.blem-card'))return;const ref=pa.querySelector('.aim-card');const t=document.createElement('div');t.innerHTML=CARD;const c=t.firstChild;if(ref)ref.after(c);else pa.appendChild(c)}
{const pa=document.getElementById('pane-ai');if(pa){pa.addEventListener('click',e=>{if(e.target.closest('[data-blem-go]')){e.stopPropagation();blemDialog()}},true);new MutationObserver(()=>injectCard()).observe(pa,{childList:true});injectCard()}}
}
