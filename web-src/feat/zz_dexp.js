/* ===== Double exposition: a second photo laid over the first and worked directly on the canvas, like the free transform.
   Drag to move it, drag a corner to resize it; the options bar holds the modes of a Fujifilm camera (Addition, Moyenne, Éclaircir,
   Obscurcir) plus Superposition, and Silhouette IA: the second photo fills the subject, the background goes light, the face stays readable.
   Entrée applies, Échap cancels. The result is ordinary layers (the photo with its mode and mask, and the light background). ===== */

const DX={s:null};
const DX_MODES=[['screen','Superposition','Le rendu film classique : les lumières de la seconde photo s’ajoutent'],['average','Moyenne','Les deux photos à parts égales (Fujifilm : Moyenne)'],['lighter','Addition','Les deux expositions s’additionnent, comme sur pellicule (Fujifilm : Additif)'],['lighten','Éclaircir','Garde le plus clair des deux (Fujifilm : Clair)'],['darken','Obscurcir','Garde le plus sombre des deux (Fujifilm : Sombre)'],['silhouette','Silhouette IA','La seconde photo remplit le sujet, le fond devient clair']];
const pick1=()=>new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept='image/*,.heic,.heif,.tif,.tiff,'+RAW_ACCEPT;i.onchange=()=>res(i.files[0]||null);i.oncancel=()=>res(null);i.click()});
const pick2=()=>new Promise(res=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='image/*,.heic,.heif,.tif,.tiff,'+RAW_ACCEPT;i.onchange=()=>res([...i.files]);i.oncancel=()=>res([]);i.click()});
async function decode(f){let bm=null;if(!RAW_EXT.test(f.name||'')&&!/\.(heic|heif|tiff?)$/i.test(f.name||'')){try{bm=await createImageBitmap(f)}catch(e){}}
  const src=bm||await styleFromFile(f);const d=S.doc,lim=d?Math.max(d.w,d.h)*1.5:6000,s=Math.min(1,lim/Math.max(src.width,src.height));
  const c=mk(Math.max(1,Math.round(src.width*s)),Math.max(1,Math.round(src.height*s)));const g=rx(c);g.imageSmoothingQuality='high';g.drawImage(src,0,0,c.width,c.height);bm&&bm.close&&bm.close();return c}
function grayOf(c){const o=mk(c.width,c.height),g=rx(o);g.drawImage(c,0,0);for(let y0=0;y0<c.height;y0+=512){const h=Math.min(512,c.height-y0),im=g.getImageData(0,y0,c.width,h),a=im.data;for(let i=0;i<a.length;i+=4){const l=0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2];a[i]=a[i+1]=a[i+2]=l}g.putImageData(im,0,y0)}return o}

// placement of the second photo: centre (document pixels) and scale relative to "covers the whole document"
const k0=st=>Math.max(st.d.w/st.src.width,st.d.h/st.src.height);
const rectOf=st=>{const k=k0(st)*st.s,w=st.src.width*k,h=st.src.height*k;return{x0:st.cx-w/2,y0:st.cy-h/2,x1:st.cx+w/2,y1:st.cy+h/2,w,h}};
let raf=0;
function draw(){const st=DX.s;if(!st||raf)return;raf=requestAnimationFrame(()=>{raf=0;drawNow()})}
function drawNow(){const st=DX.s;if(!st)return;const d=st.d,c=st.c,g=cx(c),r=rectOf(st),src=st.bw?(st.gray||(st.gray=grayOf(st.src))):st.src;
  g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,d.w,d.h);g.imageSmoothingQuality='high';
  g.save();g.translate(st.cx,st.cy);if(st.flip)g.scale(-1,1);g.drawImage(src,-r.w/2,-r.h/2,r.w,r.h);g.restore();
  st.Lb.canvas=c;markComp()}
// the subject mask, faded towards the top of the subject so the face stays readable (the "keep" slider)
function silMask(st){const d=st.d,b=st.bb,m=cloneC(st.subj);if(st.keep>0){const top=st.head!=null?st.head:b.y0,g=cx(m),gr=g.createLinearGradient(0,top,0,top+(b.y1-top)*0.5);
    gr.addColorStop(0,`rgba(0,0,0,${st.keep/100})`);gr.addColorStop(1,'rgba(0,0,0,0)');g.globalCompositeOperation='destination-out';g.fillStyle=gr;g.fillRect(0,0,d.w,d.h)}
  return m}
function applyMode(){const st=DX.s;if(!st)return;const L=st.Lb,m=st.mode;
  L.blend=m==='silhouette'?(st.lum>0.55?'multiply':'screen'):m==='average'?'source-over':m;
  L.opacity=m==='average'?st.mix/200:st.mix/100;// Moyenne: 100 % on the slider = an exact 50/50 average
  L.mask=m==='silhouette'&&st.subj?silMask(st):null;
  if(st.Lw){st.Lw.visible=m==='silhouette';st.Lw.opacity=st.bg/100}
  markComp();syncLayers()}

async function subject(){const st=DX.s;if(st.subj!==undefined)return st.subj;const d=st.d;
  // detected on the first photo alone: the second one is hidden while the model looks
  const vis=[st.Lb,st.Lw].filter(Boolean).map(L=>[L,L.visible]);vis.forEach(([L])=>L.visible=false);markComp();
  let m=null;try{m=await AI.subjectMask();if(m){st.lum=lumIn(flatSync(),m);st.head=headTop(m)}}catch(e){console.warn(e)}finally{vis.forEach(([L,v])=>L.visible=v);markComp()}
  if(DX.s!==st||S.doc!==d)return null;let bb=m?maskBBox(m):null;if(bb&&(bb.x1-bb.x0)*(bb.y1-bb.y0)<d.w*d.h*0.02)bb=null;
  st.subj=bb?m:null;st.bb=bb;
  if(st.subj&&!st.Lw){const wc=mk(d.w,d.h),wg=cx(wc);wg.fillStyle='#ffffff';wg.fillRect(0,0,d.w,d.h);
    st.Lw=newPixel('Fond clair',wc);const inv=fullMask(),g=cx(inv);g.globalCompositeOperation='destination-out';g.drawImage(st.subj,0,0);st.Lw.mask=inv;st.Lw.visible=false;
    d.layers.splice(d.layers.indexOf(st.Lb),0,st.Lw);d.active=d.layers.indexOf(st.Lb)}
  return st.subj}
// median brightness of the photo inside a mask (small proxy)
function lumIn(src,m){const W=128,H=Math.max(1,Math.round(128*src.height/src.width)),a=mk(W,H),b=mk(W,H),ga=rx(a),gb=rx(b);ga.drawImage(src,0,0,W,H);gb.drawImage(m,0,0,W,H);
  const p=ga.getImageData(0,0,W,H).data,q=gb.getImageData(0,0,W,H).data,L=[];for(let i=0;i<p.length;i+=4)if(q[i+3]>128)L.push((0.2126*p[i]+0.7152*p[i+1]+0.0722*p[i+2])/255);
  if(!L.length)return 0.5;L.sort((x,y)=>x-y);return L[L.length>>1]}
// top of the head: first row of the mask in a narrow band around its centre (raised arms and loose hair at the sides don't count)
function headTop(m){const W=160,H=Math.max(1,Math.round(160*m.height/m.width)),c=mk(W,H),g=rx(c);g.drawImage(m,0,0,W,H);const a=g.getImageData(0,0,W,H).data;
  let sx=0,n=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=a[(y*W+x)*4+3];if(v>128){sx+=x;n++}}if(!n)return null;const cx0=sx/n;
  let x0=W,x1=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(a[(y*W+x)*4+3]>128){if(x<x0)x0=x;if(x>x1)x1=x}const half=Math.max(2,(x1-x0)*0.12);
  for(let y=0;y<H;y++)for(let x=Math.max(0,Math.round(cx0-half));x<=Math.min(W-1,Math.round(cx0+half));x++)if(a[(y*W+x)*4+3]>128)return y/H*m.height;return null}
// where the sky of the second photo ends (largest drop of brightness going down), as a fraction of its height
function horizon(src){const W=48,H=96,t=mk(W,H),g=rx(t);g.drawImage(src,0,0,W,H);const a=g.getImageData(0,0,W,H).data,row=new Float32Array(H);
  for(let y=0;y<H;y++){let s=0;for(let x=0;x<W;x++){const i=(y*W+x)*4;s+=0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2]}row[y]=s/W/255}
  let best=-1,at=-1;for(let y=Math.round(H*.15);y<H*.85;y++){let u=0,v=0;for(let i=0;i<y;i++)u+=row[i];for(let i=y;i<H;i++)v+=row[i];const c=u/y-v/(H-y);if(c>best){best=c;at=y}}
  return best>0.08?at/H:null}
async function auto(){const st=DX.s;if(!st)return;const m=await subject();if(DX.s!==st)return;
  if(!m){st.mode='screen';st.s=1;st.cx=st.d.w/2;st.cy=st.d.h/2;st.mix=100;applyMode();drawNow();renderPill();toast('Pas de sujet net dans la photo : fondu en Superposition',4000);return}
  const b=st.bb,bw=b.x1-b.x0,bh=b.y1-b.y0,K=k0(st);
  // covers the subject with some margin, the sky of the second photo across the top of the head
  st.s=Math.max(bw/st.src.width,bh/st.src.height)*1.12/K;let r=rectOf(st);st.cx=(b.x0+b.x1)/2;
  const hz=horizon(st.src);const top=st.head!=null?st.head:b.y0;st.cy=hz==null?(b.y0+b.y1)/2:top+(b.y1-top)*0.3-(hz-0.5)*r.h;
  st.cy=clamp(st.cy,b.y1-r.h/2,b.y0+r.h/2);// still covers the subject from top to bottom
  Object.assign(st,{mode:'silhouette',mix:100,keep:85,bg:100});applyMode();drawNow();renderPill();toast('Silhouette composée. Glissez la seconde photo pour la placer, tirez un coin pour la taille.',4500)}
async function setMode(m){const st=DX.s;if(!st)return;
  if(m==='silhouette'&&!(await subject())){toast('Aucun sujet net trouvé : le mode Superposition est gardé',4500);m='screen'}
  if(DX.s!==st)return;st.mode=m;applyMode();renderPill()}

let prevTool='move';
async function start(file){const d=S.doc;if(!d){toast('Ouvrez d’abord une photo');return}
  if(DX.s)finish(false);if(S.tf&&window.tfApply)tfApply();
  if(!file)file=await pick1();if(!file)return;
  busy(true,'Lecture de la seconde photo…',null);let src;try{await tick();src=await decode(file)}catch(e){busy(false);console.error(e);toast('Cette photo ne s’ouvre pas : '+(e.message||e),5000);return}busy(false);
  if(S.doc!==d)return;
  const st={d,src,gray:null,bw:false,flip:false,mode:'screen',mix:100,keep:85,bg:100,lum:0.4,s:1,cx:d.w/2,cy:d.h/2,subj:undefined,bb:null,Lw:null,c:mk(d.w,d.h),h0:S.history[S.hi],a0:d.active};
  st.Lb=newPixel('Double exposition · '+(file.name||'photo').replace(/\.[^.]+$/,''),st.c);d.layers.push(st.Lb);d.active=d.layers.length-1;
  DX.s=st;if(S.tool!=='dexp')prevTool=S.tool;
  drawNow();applyMode();syncAll();_st.call(window,'dexp');
  toast('Glissez la seconde photo pour la placer. Entrée pour valider, Échap pour annuler.',4000)}
function finish(keep){const st=DX.s;if(!st)return;DX.s=null;if(raf){cancelAnimationFrame(raf);raf=0}const d=st.d;
  if(keep&&S.doc===d&&d.layers.includes(st.Lb)){
    if(st.Lw&&!st.Lw.visible){const i=d.layers.indexOf(st.Lw);if(i>=0)d.layers.splice(i,1)}
    d.active=d.layers.indexOf(st.Lb);markComp();pushHistory('Double exposition');syncAll();toast('Double exposition ajoutée en calques, modifiables ensuite')}
  else{for(const L of [st.Lb,st.Lw]){const i=L?d.layers.indexOf(L):-1;if(i>=0)d.layers.splice(i,1)}d.active=Math.min(st.a0,d.layers.length-1);markComp();syncAll()}
  if(S.tool==='dexp')_st.call(window,prevTool==='dexp'?'move':prevTool);else renderPill()}
// with no photo open: two photos at once
async function begin(){if(S.doc){start();return}
  const fs=await pick2();if(!fs.length)return;let a=fs[0],b=fs[1];
  await openBlob(a);if(!S.doc)return;if(!b)b=await pick1();if(b)start(b)}

// ---------- on the canvas ----------
const toS=p=>({x:S.panX+p.x*S.zoom,y:S.panY+p.y*S.zoom});
const corners=r=>[[r.x0,r.y0],[r.x1,r.y0],[r.x1,r.y1],[r.x0,r.y1]];
function hit(p){const st=DX.s,r=rectOf(st),sp=toS(p);const i=corners(r).findIndex(([x,y])=>{const q=toS({x,y});return Math.hypot(q.x-sp.x,q.y-sp.y)<=12});return i>=0?'c'+i:'move'}
let drag=null;
// no toolbar button: the mode is entered from the menus or the IA tab and left by applying or cancelling
TOOL_NAMES.dexp='Double exposition';
const _st=setTool;setTool=function(t){if(DX.s&&t!=='dexp'){finish(true)}if(t==='dexp'&&!DX.s)return;return _st.apply(this,arguments)};
// another step pushed meanwhile: the session's layers are not in the history yet, so drop them before it is recorded (cancel used to leave them in that step)
const _phX=pushHistory;pushHistory=function(){if(DX.s){finish(false);toast('Double exposition annulée')}return _phX.apply(this,arguments)};
const _od=onDown;onDown=function(e,p){if(S.tool==='dexp'&&DX.s&&e.button!==1&&!S.spaceDown){const st=DX.s,k=hit(p);drag={k,p0:{x:p.x,y:p.y},cx:st.cx,cy:st.cy,s:st.s,r:rectOf(st)};S.drag={type:'dexp'};return}_od(e,p)};
const _om=onMove;onMove=function(e,p){if(S.drag&&S.drag.type==='dexp'&&drag&&DX.s){const st=DX.s;
    if(drag.k==='move'){st.cx=drag.cx+p.x-drag.p0.x;st.cy=drag.cy+p.y-drag.p0.y}
    else{// scales about the centre: the corner follows the pointer
      const d0=Math.hypot(drag.p0.x-drag.cx,drag.p0.y-drag.cy)||1,d1=Math.hypot(p.x-drag.cx,p.y-drag.cy);st.s=clamp(drag.s*d1/d0,0.2,6)}
    draw();syncNums();return}_om(e,p)};
const _ou=onUp;onUp=function(e){if(S.drag&&S.drag.type==='dexp'){S.drag=null;drag=null;return}_ou(e)};
view.addEventListener('pointermove',e=>{if(S.tool!=='dexp'||!DX.s||S.drag)return;const p=S.pointer;if(!p)return;const k=hit({x:p.dx,y:p.dy});view.style.cursor=k==='move'?'move':(k==='c0'||k==='c2')?'nwse-resize':'nesw-resize'});
view.addEventListener('wheel',e=>{if(S.tool!=='dexp'||!DX.s||!e.altKey)return;e.preventDefault();e.stopImmediatePropagation();DX.s.s=clamp(DX.s.s*Math.exp(-e.deltaY*0.0015),0.2,6);draw();syncNums()},{capture:true,passive:false});
window.addEventListener('keydown',e=>{if(!DX.s)return;const t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&t.type!=='range'&&t.type!=='checkbox'))return;
  if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();finish(true)}
  else if(e.key==='Escape'||((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z'))){e.preventDefault();e.stopImmediatePropagation();finish(false)}},true);
const _dov=drawOverlays;drawOverlays=function(c,pr){_dov.apply(this,arguments);const st=DX.s;if(!st||S.tool!=='dexp')return;const r=rectOf(st);
  c.save();c.setTransform(pr,0,0,pr,0,0);const q=corners(r).map(([x,y])=>toS({x,y}));
  c.beginPath();q.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.45)';c.stroke();c.lineWidth=1.2;c.strokeStyle='#fff';c.stroke();
  for(const a of q){c.beginPath();c.rect(a.x-4.5,a.y-4.5,9,9);c.fillStyle='#fff';c.fill();c.lineWidth=1;c.strokeStyle='#000';c.stroke()}c.restore()};

// ---------- options bar ----------
const rng=(id,label,min,max,v,tip)=>`<label${tip?` title="${esc(tip)}"`:''}>${label}<input type="range" id="${id}" min="${min}" max="${max}" step="1" value="${Math.round(v)}"><span class="val" id="${id}V">${Math.round(v)} %</span></label>`;
function syncNums(){const st=DX.s,r=$('#dxS'),o=$('#dxSV');if(st&&r){r.value=Math.round(st.s*100);if(o)o.textContent=Math.round(st.s*100)+' %'}}
const _pe=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe.apply(this,arguments)||'';const st=DX.s;if(t!=='dexp'||!st)return h;
  h+=`<label title="${esc((DX_MODES.find(x=>x[0]===st.mode)||[])[2]||'')}">Mode<select id="dxMode">${DX_MODES.map(([v,l])=>`<option value="${v}" ${st.mode===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
  h+=rng('dxMix','Intensité',0,100,st.mix)+rng('dxS','Taille',20,600,st.s*100);
  if(st.mode==='silhouette')h+=rng('dxKeep','Visage',0,100,st.keep,'Garde le haut du sujet lisible')+rng('dxBg','Fond clair',0,100,st.bg);
  h+=`<label><input type="checkbox" id="dxBW" ${st.bw?'checked':''}>Noir et blanc</label><button class="btn sm" data-act="dxFlip" title="Retourner la seconde photo">⇄</button>`;
  h+=`<button class="btn sm" data-act="dxAuto" data-pin title="L’IA détoure le sujet, place la seconde photo dedans et éclaircit le fond">Auto (IA)</button><button class="btn sm" data-act="dxCancel" data-pin>Annuler</button><button class="btn sm primary" data-act="dxApply" data-pin>Appliquer</button>`;
  return h};
Object.assign(PILL_ACT,{dxApply:()=>finish(true),dxCancel:()=>finish(false),dxAuto:auto,dxFlip:()=>{if(DX.s){DX.s.flip=!DX.s.flip;draw()}}});
if(window.W47&&W47.NAMES)W47.NAMES.dexp='Double exposition';
const _rp=renderPill;renderPill=function(){_rp.apply(this,arguments);if(S.tool!=='dexp')return;const n=document.querySelector('#pill .tname');if(n)n.textContent='Double exposition';
  const ot=document.getElementById('optTool');if(ot)ot.innerHTML='<svg viewBox="0 0 20 20"><circle cx="7.5" cy="10" r="5"/><circle cx="12.5" cy="10" r="5"/></svg><b>Double exposition</b>'};

document.addEventListener('input',e=>{const st=DX.s,t=e.target;if(!st||!t||!t.id||!/^dx/.test(t.id))return;const v=+t.value,o=$('#'+t.id+'V');if(o&&t.type==='range')o.textContent=v+' %';
  if(t.id==='dxMix'){st.mix=v;applyMode()}else if(t.id==='dxS'){st.s=v/100;draw()}else if(t.id==='dxKeep'){st.keep=v;applyMode()}else if(t.id==='dxBg'){st.bg=v;applyMode()}});
document.addEventListener('change',e=>{const st=DX.s,t=e.target;if(!st||!t)return;if(t.id==='dxBW'){st.bw=t.checked;draw()}else if(t.id==='dxMode')setMode(t.value)});

DX.start=start;DX.begin=begin;DX.auto=auto;DX.finish=finish;window.PrismDexp=DX;

// ---------- where it is offered: Fichier > Photos multiples, and the IA tab ----------
const _mfDX=MENU2.file.items;
MENU2.file.items=()=>{const a=_mfDX();const g=a.find(x=>x&&x.label==='Photos multiples'&&typeof x.sub==='function');const it=MI('Double exposition…',{fn:begin});
  if(g){const s0=g.sub;if(!g.__dx){g.__dx=1;g.sub=()=>{const b=s0();return b.some(x=>x&&x.label===it.label)?b:[it,...b]}}}
  else if(!a.some(x=>x&&x.label===it.label))a.push(SEP,it);
  return a};
const CARD=`<div class="card dx-card"><h4><svg viewBox="0 0 20 20"><circle cx="7.5" cy="10" r="5"/><circle cx="12.5" cy="10" r="5"/></svg>Double exposition</h4><p>Une seconde photo fondue dans la vôtre, comme sur un appareil Fujifilm. En mode Silhouette, l’IA la place dans le sujet et éclaircit le fond. Vous la placez ensuite à la souris, directement sur la photo.</p><div class="acts"><button class="btn sm primary" data-dx-go="1">Choisir la seconde photo…</button></div></div>`;
function injectCard(){const p=document.getElementById('pane-ai');if(!p||p.querySelector('.dx-card'))return;const ref=p.querySelector('.aim-card');const t=document.createElement('div');t.innerHTML=CARD;const c=t.firstChild;
  if(ref&&ref.nextSibling)ref.parentNode.insertBefore(c,ref.nextSibling);else p.appendChild(c)}
{const p=document.getElementById('pane-ai');if(p){p.addEventListener('click',e=>{if(e.target.closest('[data-dx-go]')){e.stopPropagation();begin()}},true);new MutationObserver(()=>injectCard()).observe(p,{childList:true});injectCard()}}
