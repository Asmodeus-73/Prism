/* ===== Fond vert (incrustation), couleur vers transparence, remplacer une couleur, photos d'identité ===== */
/* Image > Couleur et transparence ; Fichier > Photos d'identité. Écrits pour Prism d'après les méthodes publiées
   (clé chromatique en YCbCr avec retrait du débordement, « Color to Alpha » de GIMP, écart de couleur en Lab). */
const px=s=>rx(s).getImageData(0,0,s.width,s.height);
const put=(w,h,im)=>{const c=mk(w,h);rx(c).putImageData(im,0,0);return c};
const hex=c=>{const n=parseInt(c.slice(1),16);return[n>>16&255,n>>8&255,n&255]};
const toHex=a=>'#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const sstep=(a,b,x)=>{if(b<=a)return x<a?0:1;const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const mixSel=(o,r,sel)=>{const out=cloneC(o),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(sel,0,0);const t=cloneC(r),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(sel,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};

/* ---------- Lab (D65), pour mesurer l'écart entre deux couleurs comme l'œil ---------- */
const LIN=new Float32Array(256);for(let i=0;i<256;i++){const v=i/255;LIN[i]=v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
const gam=v=>255*(v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055);
const fl=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116,fi=t=>{const c=t*t*t;return c>0.008856?c:(t-16/116)/7.787};
function lab(r,g,b,o){const R=LIN[r&255],G=LIN[g&255],B=LIN[b&255],x=fl((R*.4124+G*.3576+B*.1805)/.95047),y=fl(R*.2126+G*.7152+B*.0722),z=fl((R*.0193+G*.1192+B*.9505)/1.08883);o[0]=116*y-16;o[1]=500*(x-y);o[2]=200*(y-z);return o}
function rgbOf(L,a,b,o){const y=(L+16)/116,x=fi(a/500+y)*.95047,Y=fi(y),z=fi(y-b/200)*1.08883;
  o[0]=gam(x*3.2406-Y*1.5372-z*.4986);o[1]=gam(-x*.9689+Y*1.8758+z*.0415);o[2]=gam(x*.0557-Y*.2040+z*1.0570);return o}

/* ---------- fond vert : clé chromatique ---------- */
/* couleur du fond devinée sur les bords de la photo : la teinte saturée la plus fréquente */
function guessKey(c){const w=c.width,h=c.height,a=px(c).data,b=Math.max(2,Math.round(Math.min(w,h)*.04)),bins=new Map(),st=Math.max(1,Math.round((w+h)/1500));
  const add=(x,y)=>{const i=(y*w+x)*4,r=a[i],g=a[i+1],bl=a[i+2],mx=Math.max(r,g,bl),mn=Math.min(r,g,bl);if(a[i+3]<200||mx<40||(mx-mn)<mx*.25)return;
    const k=(g>=r&&g>=bl?1:bl>=r?2:0)+'',e=bins.get(k)||{n:0,r:0,g:0,b:0};e.n++;e.r+=r;e.g+=g;e.b+=bl;bins.set(k,e)};
  for(let y=0;y<h;y+=st)for(let x=0;x<w;x+=st)if(x<b||y<b||x>=w-b||y>=h-b)add(x,y);
  let best=null;for(const e of bins.values())if(!best||e.n>best.n)best=e;
  return best&&best.n>20?[best.r/best.n,best.g/best.n,best.b/best.n]:[0,177,64]}
function alphaOnly(w,h,A){const c=mk(w,h),im=new ImageData(w,h),d=im.data;for(let i=0,j=0;i<A.length;i++,j+=4){d[j]=d[j+1]=d[j+2]=255;d[j+3]=A[i]}rx(c).putImageData(im,0,0);return c}
/* rétrécit le bord (minimum sur r px), puis l'adoucit (flou du seul canal alpha) */
function shrinkA(A,w,h,r){if(r<1)return A;const t=new Uint8Array(A.length),o=new Uint8Array(A.length);
  for(let y=0;y<h;y++){const b=y*w;for(let x=0;x<w;x++){let m=255;for(let k=Math.max(0,x-r),e=Math.min(w-1,x+r);k<=e;k++)if(A[b+k]<m)m=A[b+k];t[b+x]=m}}
  for(let x=0;x<w;x++)for(let y=0;y<h;y++){let m=255;for(let k=Math.max(0,y-r),e=Math.min(h-1,y+r);k<=e;k++)if(t[k*w+x]<m)m=t[k*w+x];o[y*w+x]=m}
  return o}
function chromaKey(s,p){const w=s.width,h=s.height,im=px(s),a=im.data,K=p.key||guessKey(s),ch=K[1]>=K[0]&&K[1]>=K[2]?1:K[2]>=K[0]?2:0,o1=(ch+1)%3,o2=(ch+2)%3;
  const kcb=-.1687*K[0]-.3313*K[1]+.5*K[2],kcr=.5*K[0]-.4187*K[1]-.0813*K[2],km=Math.max(20,Math.hypot(kcb,kcr)),t0=km*p.tol/100,t1=t0+km*Math.max(.01,p.soft/100),sp=p.spill/100;
  const A=new Uint8Array(w*h);
  for(let i=0,j=0;i<a.length;i+=4,j++){const r=a[i],g=a[i+1],b=a[i+2],cb=-.1687*r-.3313*g+.5*b,cr=.5*r-.4187*g-.0813*b;
    let al=sstep(t0,t1,Math.hypot(cb-kcb,cr-kcr));
    /* une couleur bien plus sombre ou plus claire que le fond reste opaque, même de teinte voisine */
    const dy=Math.abs((.299*r+.587*g+.114*b)-(.299*K[0]+.587*K[1]+.114*K[2]));if(dy>110)al=Math.max(al,sstep(110,170,dy));
    A[j]=Math.round(al*a[i+3]);
    if(sp>0){const v=a[i+ch],lim=(a[i+o1]+a[i+o2])/2;if(v>lim)a[i+ch]=v-(v-lim)*sp}}
  let M=shrinkA(A,w,h,Math.round(p.shrink));
  if(p.feather>0){const f=px(blurCanvas(alphaOnly(w,h,M),p.feather)).data;M=new Uint8Array(w*h);for(let j=0;j<M.length;j++)M[j]=f[j*4+3]}
  for(let j=0;j<M.length;j++)a[j*4+3]=M[j];
  return put(w,h,im)}

/* ---------- couleur vers transparence (méthode de GIMP) ---------- */
function colorToAlpha(s,p){const im=px(s),a=im.data,C=p.color.map(v=>v/255),th=p.th/100;
  for(let i=0;i<a.length;i+=4){let al=0;const v=[a[i]/255,a[i+1]/255,a[i+2]/255];
    for(let k=0;k<3;k++){const c=C[k],x=v[k];let t=0;if(x>c)t=c<1?(x-c)/(1-c):0;else if(x<c)t=c>0?(c-x)/c:0;if(t>al)al=t}
    if(th>0)al=al<=th?0:(al-th)/(1-th);
    if(al<=0){a[i+3]=0;continue}
    for(let k=0;k<3;k++)a[i+k]=Math.max(0,Math.min(255,((v[k]-C[k])/al+C[k])*255));
    a[i+3]=Math.round(a[i+3]*al)}
  return put(s.width,s.height,im)}

/* ---------- remplacer une couleur : décalage en Lab, pondéré par l'écart à la couleur choisie ---------- */
function replaceColor(s,p){const im=px(s),a=im.data,S0=lab(...p.from,[0,0,0]),T=lab(...p.to,[0,0,0]),dL=(T[0]-S0[0])*p.light/100,da=T[1]-S0[1],db=T[2]-S0[2],q=[0,0,0],o=[0,0,0],t0=p.tol,t1=p.tol+Math.max(1,p.soft);
  for(let i=0;i<a.length;i+=4){if(!a[i+3])continue;lab(a[i],a[i+1],a[i+2],q);const w=1-sstep(t0,t1,Math.hypot(q[0]-S0[0],(q[1]-S0[1]),(q[2]-S0[2])));if(!(w>0))continue;
    rgbOf(q[0]+dL*w,q[1]+da*w,q[2]+db*w,o);a[i]=Math.max(0,Math.min(255,o[0]));a[i+1]=Math.max(0,Math.min(255,o[1]));a[i+2]=Math.max(0,Math.min(255,o[2]))}
  return put(s.width,s.height,im)}

/* ---------- pipette : un clic sur la photo prend la couleur du calque (sans l'aperçu en cours) ---------- */
function pickOnce(L,cb){toast('Cliquez sur la photo pour prendre la couleur',3000);document.body.classList.add('fv-pick');
  const h=e=>{if(e.target!==view)return;e.preventDefault();e.stopImmediatePropagation();removeEventListener('pointerdown',h,true);document.body.classList.remove('fv-pick');
    const d=S.doc;if(!d)return;const c=L.canvas,p=evPos(e),x=Math.max(0,Math.min(c.width-1,Math.floor(p.x-(L.x|0)))),y=Math.max(0,Math.min(c.height-1,Math.floor(p.y-(L.y|0)))),r=Math.max(1,Math.round(Math.max(d.w,d.h)/800));
    const q=rx(c).getImageData(Math.max(0,x-r),Math.max(0,y-r),2*r+1,2*r+1).data;let R=0,G=0,B=0,n=0;for(let i=0;i<q.length;i+=4)if(q[i+3]){R+=q[i];G+=q[i+1];B+=q[i+2];n++}
    if(n)cb([R/n,G/n,B/n])};
  addEventListener('pointerdown',h,true)}

/* ---------- boîte commune : réglages, couleurs, aperçu en direct, appliquer au calque ---------- */
function fxDialog(o){const d=S.doc;if(!d)return;const L=pixelTarget();if(!L){toast('Aucun calque de pixels');return}
  if(L.visible===false){toast('Ce calque est masqué : affichez-le d’abord');return}
  const p={...o.init(L)};let tmr=null;const alive=()=>S.doc===d&&d.layers.includes(L);
  const clear=()=>{clearTimeout(tmr);delete L.preview};
  const run=()=>{let r=o.run(L.canvas,p);if(d.sel)r=mixSel(L.canvas,r,d.sel);return r};
  const prev=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(!alive())return;try{L.preview=run();markComp()}catch(e){console.error(e);toast('Aperçu impossible : '+(e.message||e),3000)}},140)};
  const colRow=c=>`<div class="row"><label for="fv-${c[0]}">${c[1]}</label><input type="color" id="fv-${c[0]}" value="${toHex(p[c[0]]||[0,0,0])}" style="width:44px;height:26px;padding:0;border:0;background:none"><button class="btn sm" data-pick="${c[0]}" title="Prendre la couleur sur la photo">Pipette</button></div>`;
  dialog({title:o.title,light:true,
    body:(o.note?`<p class="muted" style="margin:0 0 8px">${o.note}</p>`:'')+(o.colors||[]).map(colRow).join('')+o.params.map(q=>rangeRow('fv-'+q[0],q[1],q[2],q[3],q[4],p[q[0]],q[6])).join('')+(o.extra||'')+(d.sel?'<p class="muted">Appliqué uniquement à la sélection.</p>':''),
    onOpen:el=>{o.params.forEach(q=>{const i=$('#fv-'+q[0],el);i.oninput=()=>{p[q[0]]=+i.value;$('#fv-'+q[0]+'-o',el).textContent=fmtN(+i.value,q[4])+q[6];prev()}});
      (o.colors||[]).forEach(c=>{const i=$('#fv-'+c[0],el);i.oninput=()=>{p[c[0]]=hex(i.value);prev()};
        $(`[data-pick="${c[0]}"]`,el).onclick=()=>pickOnce(L,v=>{p[c[0]]=v;i.value=toHex(v);prev()})});
      o.onOpen&&o.onOpen(el,p,prev);prev()},
    buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
      {label:'Appliquer',primary:true,onClick:el=>{clear();if(!alive()){toast('Le calque n’existe plus');return}
        try{applyMasked(L,run(),o.title);syncAll();o.after&&o.after(el,p,L)}catch(e){console.error(e);markComp();toast(o.title+' impossible : '+(e.message||e),4000);return false}}}]})}

/* calque placé juste sous le calque détouré */
function layerBelow(L,canvas,name){const d=S.doc,i=d.layers.indexOf(L);if(i<0)return;const N=newPixel(name,canvas);d.layers.splice(i,0,N);d.active=d.layers.indexOf(L);markComp();pushHistory(name);syncAll()}
function pickImage(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept='image/*,.heic,.heif,.avif';i.onchange=()=>res(i.files[0]||null);i.click()})}
async function coverWith(file,w,h){const im=await loadImageFile(file),iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,k=Math.max(w/iw,h/ih),c=mk(w,h),g=cx(c);
  g.imageSmoothingQuality='high';g.drawImage(im,(w-iw*k)/2,(h-ih*k)/2,iw*k,ih*k);return c}

function greenDialog(){fxDialog({title:'Fond vert (incrustation)',
  note:'Rend transparent le fond uni (vert ou bleu) et retire le reflet coloré sur les bords. La couleur du fond est devinée sur les bords de la photo.',
  colors:[['key','Couleur du fond']],
  params:[['tol','Tolérance',0,90,1,0,' %'],['soft','Douceur du bord',1,100,1,0,' %'],['spill','Retrait du reflet',0,100,1,0,' %'],['shrink','Rétrécir le bord',0,8,1,0,' px'],['feather','Adoucir le bord',0,6,0.5,0,' px']],
  extra:`<div class="row"><label for="fv-bg">Nouveau fond</label><select id="fv-bg"><option value="none">Transparent</option><option value="color">Couleur unie</option><option value="image">Une image…</option></select><input type="color" id="fv-bgc" value="#ffffff" style="width:44px;height:26px;padding:0;border:0;background:none"></div>`,
  init:L=>({key:guessKey(L.canvas),tol:22,soft:18,spill:80,shrink:0,feather:1}),
  run:chromaKey,
  after:async(el,p,L)=>{const m=$('#fv-bg',el).value,d=S.doc;if(m==='color'){const c=mk(d.w,d.h),g=cx(c);g.fillStyle=$('#fv-bgc',el).value;g.fillRect(0,0,d.w,d.h);layerBelow(L,c,'Fond')}
    else if(m==='image'){const f=await pickImage();if(!f||S.doc!==d)return;try{busy(true,'Pose du nouveau fond…',null);layerBelow(L,await coverWith(f,d.w,d.h),'Fond')}catch(e){console.error(e);toast('Image illisible',4000)}finally{busy(false)}}}})}
function c2aDialog(){fxDialog({title:'Couleur vers transparence',
  note:'Retire une couleur en gardant les nuances : un fond blanc derrière un logo ou une signature devient transparent, les bords restent doux.',
  colors:[['color','Couleur à retirer']],params:[['th','Seuil',0,90,1,0,' %']],
  init:()=>({color:[255,255,255],th:0}),run:colorToAlpha})}
function replaceDialog(){fxDialog({title:'Remplacer une couleur',
  note:'Change une couleur de la photo en une autre, en gardant les ombres et les reliefs. Prenez la couleur d’origine à la pipette.',
  colors:[['from','Couleur d’origine'],['to','Nouvelle couleur']],
  params:[['tol','Tolérance',1,80,1,0,''],['soft','Douceur',1,60,1,0,''],['light','Suivre la luminosité',0,100,1,0,' %']],
  init:()=>({from:[200,40,40],to:[40,90,200],tol:18,soft:14,light:60}),run:replaceColor})}

/* ---------- photos d'identité : recadrage au format officiel, planche à imprimer à 300 ppp ---------- */
/* [id, nom, largeur mm, hauteur mm, hauteur du visage min/max (menton → haut du crâne), mm] */
const IDF=[['fr','France, Union européenne, Royaume-Uni, Suisse (35 × 45 mm)',35,45,32,36],['us','États-Unis, Inde (51 × 51 mm, 2 × 2 pouces)',51,51,25,35],
  ['ca','Canada (50 × 70 mm)',50,70,31,36],['cn','Chine (33 × 48 mm)',33,48,28,33],['jp','Japon, Australie (35 × 45 mm)',35,45,32,36]];
const SHEETS=[['10x15','10 × 15 cm',150,100],['13x18','13 × 18 cm',180,130],['a4','A4',297,210]];
const DPI=300,MM=DPI/25.4;
/* place autant de photos que possible, 2 mm d'écart, traits de coupe gris clair */
function sheetOf(photo,F,S0){const W=Math.round(S0[2]*MM),H=Math.round(S0[3]*MM),c=mk(W,H),g=cx(c),pw=Math.round(F[2]*MM),ph=Math.round(F[3]*MM),gap=Math.round(2*MM),mg=Math.round(4*MM);
  g.fillStyle='#fff';g.fillRect(0,0,W,H);const nx=Math.max(1,Math.floor((W-2*mg+gap)/(pw+gap))),ny=Math.max(1,Math.floor((H-2*mg+gap)/(ph+gap))),ox=Math.round((W-nx*pw-(nx-1)*gap)/2),oy=Math.round((H-ny*ph-(ny-1)*gap)/2);
  g.imageSmoothingQuality='high';g.strokeStyle='#c8c8c8';g.lineWidth=1;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=ox+i*(pw+gap),y=oy+j*(ph+gap);g.drawImage(photo,x,y,pw,ph);g.strokeRect(x-.5,y-.5,pw+1,ph+1)}
  return{c,n:nx*ny}}
async function idDialog(){const d=S.doc;if(!d)return;const base=await renderDoc(1);if(S.doc!==d)return;
  let src=base,F=IDF.find(f=>f[0]===PREF.get('idFmt','fr'))||IDF[0];const st={z:1,x:.5,y:.42};
  const PW=180;let cv=null,drag=null;
  const crop=()=>{const ar=F[2]/F[3];let h=src.height/st.z,w=h*ar;if(w>src.width/st.z){w=src.width/st.z;h=w/ar}return{w,h,x:st.x*src.width-w/2,y:st.y*src.height-h/2}};
  const draw=()=>{if(!cv)return;const ph=Math.round(PW*F[3]/F[2]);cv.width=PW;cv.height=ph;const g=cx(cv),r=crop();g.fillStyle='#fff';g.fillRect(0,0,PW,ph);g.imageSmoothingQuality='high';
    g.drawImage(src,r.x,r.y,r.w,r.h,0,0,PW,ph);const k=ph/F[3],top=(F[3]-F[5])/2*k*.75,lo=top+F[4]*k,hi=top+F[5]*k;
    g.strokeStyle='rgba(255,80,80,.9)';g.setLineDash([4,3]);g.lineWidth=1;[top,lo,hi].forEach(y=>{g.beginPath();g.moveTo(0,y);g.lineTo(PW,y);g.stroke()});g.setLineDash([]);
    g.fillStyle='rgba(255,80,80,.9)';g.font='10px sans-serif';g.fillText('haut du crâne',4,top-3);g.fillText('menton entre ces deux lignes',4,hi+11)};
  const make=async el=>{const r=crop(),pw=Math.round(F[2]*MM),ph=Math.round(F[3]*MM),one=mk(pw,ph),g=cx(one);g.fillStyle='#fff';g.fillRect(0,0,pw,ph);g.imageSmoothingQuality='high';g.drawImage(src,r.x,r.y,r.w,r.h,0,0,pw,ph);
    const SH=SHEETS.find(s=>s[0]===$('#id-sheet',el).value)||SHEETS[0];PREF.set('idFmt',F[0]);PREF.set('idSheet',SH[0]);
    const {c,n}=sheetOf(one,F,SH);setDoc(c,'photos-identite-'+F[0]+'.jpg',{});toast(`${n} photos ${F[2]} × ${F[3]} mm prêtes à imprimer en ${SH[1]} à 300 ppp. Vérifiez les règles officielles du pays.`,7000)};
  dialog({title:'Photos d’identité',
    body:`<label class="field">Format<select id="id-fmt">${IDF.map(f=>`<option value="${f[0]}"${f===F?' selected':''}>${f[1]}</option>`).join('')}</select></label>
      <div style="display:flex;gap:12px;align-items:flex-start;margin-top:8px"><canvas id="id-prev" style="border:1px solid var(--line,#444);cursor:grab;touch-action:none;flex:none"></canvas>
      <div style="flex:1;min-width:0">${rangeRow('id-z','Zoom',1,6,0.01,1,' ×')}<p class="muted" style="font-size:12px;margin:6px 0">Glissez l’aperçu pour placer le visage : le haut du crâne sur la première ligne, le menton entre les deux autres. La molette zoome.</p>
      <label class="field" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="id-white"> Fond blanc uni (IA)</label>
      <label class="field">Planche<select id="id-sheet">${SHEETS.map(s=>`<option value="${s[0]}"${s[0]===PREF.get('idSheet','10x15')?' selected':''}>${s[1]}</option>`).join('')}</select></label></div></div>`,
    onOpen:el=>{cv=$('#id-prev',el);const z=$('#id-z',el);
      z.oninput=()=>{st.z=+z.value;$('#id-z-o',el).textContent=fmtN(st.z,.01)+' ×';draw()};
      $('#id-fmt',el).onchange=e=>{F=IDF.find(f=>f[0]===e.target.value)||IDF[0];draw()};
      $('#id-white',el).onchange=async e=>{if(!e.target.checked){src=base;draw();return}
        const m=AI.subjectMask&&await AI.subjectMask();if(!m||S.doc!==d){e.target.checked=false;return}
        const w=mk(base.width,base.height),g=cx(w),t=cloneC(base),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(m,0,0);g.fillStyle='#fff';g.fillRect(0,0,w.width,w.height);g.drawImage(t,0,0);src=w;draw()};
      cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,sx:st.x,sy:st.y};cv.style.cursor='grabbing'};
      cv.onpointermove=e=>{if(!drag)return;const r=crop(),k=r.w/PW;st.x=drag.sx-(e.clientX-drag.x)*k/src.width;st.y=drag.sy-(e.clientY-drag.y)*k/src.height;draw()};
      cv.onpointerup=cv.onpointercancel=()=>{drag=null;cv.style.cursor='grab'};
      cv.onwheel=e=>{e.preventDefault();st.z=Math.max(1,Math.min(6,st.z*(e.deltaY<0?1.08:1/1.08)));z.value=st.z;$('#id-z-o',el).textContent=fmtN(st.z,.01)+' ×';draw()};
      draw()},
    buttons:[{label:'Annuler'},{label:'Créer la planche',primary:true,onClick:el=>{make(el).catch(e=>{console.error(e);toast('Planche impossible : '+(e.message||e),5000)})}}]})}

/* ---------- menus ---------- */
{const st=document.createElement('style');st.textContent='body.fv-pick #view{cursor:crosshair!important}';document.head.appendChild(st)}
const _ii=MENU2.image.items;
MENU2.image.items=function(){const a=_ii.apply(this,arguments),dis=S.doc?false:NODOC;
  a.push(SEP,MI('Couleur et transparence',{icon:'mask',dis,sub:()=>[MI('Fond vert (incrustation)…',{fn:greenDialog,dis}),MI('Couleur vers transparence…',{fn:c2aDialog,dis}),MI('Remplacer une couleur…',{fn:replaceDialog,dis})]}));return a};
const _fi=MENU2.file.items;
MENU2.file.items=function(){const a=_fi.apply(this,arguments),it=MI('Photos d’identité…',{icon:'crop',fn:idDialog,dis:S.doc?false:NODOC});
  const k=a.findIndex(x=>x&&x.label==='Exporter…');a.splice(k<0?a.length:k+1,0,it);return a};
window.PrismFV={chromaKey,colorToAlpha,replaceColor,guessKey,sheetOf,IDF,SHEETS,green:greenDialog,c2a:c2aDialog,replace:replaceDialog,id:idDialog};
