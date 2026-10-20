/* ================= fx_paint: brush, eraser, gradient, bucket, eyedropper (audit fixes) ================= */
(()=>{
const PT=['brush','eraser'],PAINT_TOOLS=['brush','eraser','gradient','bucket','eyedropper'],num=(v,lo,hi,d)=>{v=+v;return isFinite(v)?clamp(v,lo,hi):d};
const GO=S.opts.gradient;if(GO.opacity==null)GO.opacity=1;
S.opts.eyedropper=Object.assign({sample:'3',all:true},S.opts.eyedropper||{});
const toPixels=L=>{if(L&&MEDIT(L)){delete L.txt;delete L.shp;toast('Ce calque devient un calque de pixels : le texte ou la forme ne sera plus modifiable',4000)}};

/* ---------- tool options and colour remembered between sessions (size follows each photo) ---------- */
const PK={hardness:[0,1],opacity:[.01,1],flow:[.01,1],smooth:[0,100],angle:[-180,180],round:[8,100],scatter:[0,300],scatterN:[1,6],grain:[0,1]};
try{const sv=PREF.get('paintOpts',null);if(sv&&typeof sv==='object'){
 for(const t of PT){const s=sv[t],o=S.opts[t];if(!s||!o)continue;for(const k in PK)if(s[k]!=null)o[k]=num(s[k],PK[k][0],PK[k][1],o[k]);if(typeof s.pressSize==='boolean')o.pressSize=s.pressSize}
 if(sv.gradient){if(['linear','radial','angular','reflect'].includes(sv.gradient.shape))GO.shape=sv.gradient.shape;if(sv.gradient.opacity!=null)GO.opacity=num(sv.gradient.opacity,.01,1,1)}
 if(sv.eyedropper){const e=sv.eyedropper;if(['1','3','5','11','31'].includes(String(e.sample)))S.opts.eyedropper.sample=String(e.sample);if(typeof e.all==='boolean')S.opts.eyedropper.all=e.all}}}catch(e){}
let svT=0;
function writePaint(){svT=0;try{const o={};for(const t of PT){o[t]={};for(const k of [...Object.keys(PK),'pressSize'])if(S.opts[t][k]!=null)o[t][k]=S.opts[t][k]}
 o.gradient={shape:GO.shape,opacity:GO.opacity};o.eyedropper={...S.opts.eyedropper};PREF.set('paintOpts',o)}catch(e){}}
function savePaint(){clearTimeout(svT);svT=setTimeout(writePaint,500)}
document.addEventListener('change',savePaint,true);document.addEventListener('input',e=>{if(e.target&&e.target.closest&&e.target.closest('#pill,#scrim'))savePaint()},true);
// leaving the page writes what is pending at once (a timer would never fire)
const flushPaint=()=>{if(svT){clearTimeout(svT);writePaint()}};
addEventListener('pagehide',flushPaint);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushPaint()});
(()=>{let col=PREF.get('fgColor',S.color);if(!/^#[0-9a-f]{6}$/i.test(col||''))col=S.color;let t=0;
 const flush=()=>{if(t){clearTimeout(t);t=0;PREF.set('fgColor',col)}};
 Object.defineProperty(S,'color',{get:()=>col,set:v=>{col=v;clearTimeout(t);t=setTimeout(()=>{t=0;PREF.set('fgColor',col)},400)},enumerable:true,configurable:true});
 addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
 const f=$('#fg');if(f)f.value=col})();

/* ---------- brush and eraser ---------- */
// under a global adjustment the stroke goes to the pixel layer below: a text or shape layer becomes pixels first
const _bsP=beginStroke;beginStroke=function(p,e){const A=AL(),t=S.tool;
 if(A&&A.kind==='adjust'&&!A.mask&&PT.includes(t)){const T=pixelTarget();if(T&&T.visible!==false)toPixels(T)}
 return _bsP.apply(this,arguments)};
// "Lissage": the end of the stroke catches up with the pointer (it stopped short of the release point)
const _msP=moveStroke;moveStroke=function(p,e){const st=S.stroke;if(st&&p)st.raw={x:p.x,y:p.y};return _msP.apply(this,arguments)};
const _esP=endStroke;endStroke=function(){const st=S.stroke;
 try{if(st&&PT.includes(st.tool)&&st.sm&&!st.noSm&&st.raw&&st.live){st.noSm=true;moveStroke(st.raw)}}catch(e){}
 if(st&&PT.includes(st.tool))savePaint();
 return _esP.apply(this,arguments)};

/* ---------- [ ] size, Maj+[ ] hardness on every keyboard (AZERTY: ^ $ or AltGr) ---------- */
const sizeLim=t=>{const sl=$(`#pill [data-opt="${t}.size"]`),ls=S.doc?Math.max(S.doc.w,S.doc.h):1800;return sl?[+sl.min||1,+sl.max||600]:[1,Math.max(600,Math.round(ls/4))]};
window.PAINTKEY=e=>{const k=e.key,c=e.code,ag=!!(e.getModifierState&&e.getModifierState('AltGraph'));if((e.ctrlKey||e.metaKey)&&!ag)return false;
 let dir=0,hard=false;
 if(k==='['||k===']'){dir=k===']'?1:-1;hard=!!(e.shiftKey&&!e.altKey&&!ag)}
 else if(k==='{'||k==='}'){dir=k==='}'?1:-1;hard=true}
 else if((c==='BracketLeft'||c==='BracketRight')&&!e.altKey&&!ag){dir=c==='BracketRight'?1:-1;hard=e.shiftKey}
 else return false;
 const tg=e.target;if(tg&&(/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)||tg.isContentEditable)&&tg.type!=='range')return true;
 if(!S.doc||(typeof LIB!=='undefined'&&LIB.open))return true;const sc=$('#scrim');if(sc&&!sc.classList.contains('light'))return true;
 const o=S.opts[S.tool];if(!o||o.size==null)return true;
 e.preventDefault();e.stopImmediatePropagation();
 if(hard){if(o.hardness==null)return true;o.hardness=clamp(Math.round((o.hardness+dir*.1)*10)/10,0,1)}
 else{const[lo,hi]=sizeLim(S.tool);o.size=clamp(Math.round(dir>0?o.size*1.12+1:o.size/1.12-1),lo,Math.max(hi,lo))}
 renderPill();requestRender();savePaint();return true};

// 1 to 0 set the opacity (10 % to 100 %, two quick digits = exact value), Maj+digit the flow, like other photo editors
const DG={t:0,v:'',k:''};
window.addEventListener('keydown',e=>{const m=/^(?:Digit|Numpad)([0-9])$/.exec(e.code||'');if(!m||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
 const tg=e.target;if(tg&&(tg.isContentEditable||(/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)&&!/^(range|checkbox|color|radio|button)$/.test(tg.type))))return;
 if(!S.doc||(typeof LIB!=='undefined'&&LIB.open)||S.stroke||S.drag)return;const sc=$('#scrim');if(sc&&!sc.classList.contains('light'))return;
 const t=S.tool;if(!['brush','eraser','gradient','bucket'].includes(t))return;const k=e.shiftKey?'flow':'opacity',o=S.opts[t];if(!o||o[k]==null)return;
 e.preventDefault();e.stopImmediatePropagation();const d=m[1],now=performance.now();let v;
 if(now-DG.t<700&&DG.v.length===1&&DG.k===t+k){v=+(DG.v+d);DG.v=''}else{v=d==='0'?100:+d*10;DG.v=d}DG.t=now;DG.k=t+k;
 o[k]=clamp(v,1,100)/100;renderPill();savePaint()},true);

/* ---------- brush ring: follows the tip shape and angle, a cross when it gets tiny ---------- */
// Alt held with the brush: the click picks a colour, so the ring gives way to a small cross
let altOn=false;const altSet=v=>{if(altOn!==v){altOn=v;if(S.tool==='brush')requestRender()}};
window.addEventListener('keydown',e=>{if(e.key==='Alt')altSet(true)},true);window.addEventListener('keyup',e=>{if(e.key==='Alt')altSet(false)},true);window.addEventListener('blur',()=>altSet(false));
view.addEventListener('pointermove',e=>altSet(!!e.altKey),{passive:true});
window.PAINTRING=(c,p,t,o,r)=>{const R=Math.max(r,1.5),tip=String(o.tip||'round');
 if(altOn&&t==='brush'&&!S.stroke){const x=p.cx,y=p.cy;c.moveTo(x-8,y);c.lineTo(x-3,y);c.moveTo(x+3,y);c.lineTo(x+8,y);c.moveTo(x,y-8);c.lineTo(x,y-3);c.moveTo(x,y+3);c.lineTo(x,y+8);return}
 if(PT.includes(t)&&(tip==='round'||tip==='square'||tip==='line')&&(tip!=='round'||o.angle||(o.round||100)<100)){
  const f=Math.max(.08,(o.round||100)/100),m=new DOMMatrix().translate(p.cx,p.cy).rotate(o.angle||0).scale(1,f),P=(x,y)=>{const q=m.transformPoint({x,y});return[q.x,q.y]};
  const pts=[];if(tip==='square'){const h=r*.88;for(const[x,y]of[[-h,-h],[h,-h],[h,h],[-h,h]])pts.push(P(x,y))}else{const ry=tip==='line'?r*.24:r,rx=tip==='line'?r*.92:r;for(let i=0;i<48;i++){const a=i/48*Math.PI*2;pts.push(P(Math.cos(a)*rx,Math.sin(a)*ry))}}
  pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath()}
 else c.arc(p.cx,p.cy,R,0,7);
 if(r<4){c.moveTo(p.cx-6,p.cy);c.lineTo(p.cx-2.5,p.cy);c.moveTo(p.cx+2.5,p.cy);c.lineTo(p.cx+6,p.cy);c.moveTo(p.cx,p.cy-6);c.lineTo(p.cx,p.cy-2.5);c.moveTo(p.cx,p.cy+2.5);c.lineTo(p.cx,p.cy+6)}};

/* ---------- gradient: selection, opacity, Maj = multiples of 45° ---------- */
const onMaskOf=L=>L.kind==='adjust'||(L.mask&&L.editMask);
const fullWhite=()=>{const d=S.doc,m=mk(d.w,d.h),g=cx(m);g.fillStyle='#fff';g.fillRect(0,0,d.w,d.h);return m};
// gradient over the target: a new mask (mask target) or the gradient layer to draw over the pixels
function gradBuild(dr){const d=S.doc,L=dr.target,sel=d.sel,op=num(GO.opacity??1,0,1,1),om=onMaskOf(L);
 const gc=om?gradientCanvas(dr):gradientCanvas(dr,S.color);
 if(sel){const g=cx(gc);g.globalCompositeOperation='destination-in';g.drawImage(sel,0,0);g.globalCompositeOperation='source-over'}
 if(!om)return{gc,op};
 if(!sel&&op>=1)return{mask:gc};
 const out=L.mask?cloneC(L.mask):fullWhite(),g=cx(out);g.globalAlpha=op;g.globalCompositeOperation='destination-out';
 if(sel)g.drawImage(sel,0,0);else{g.fillStyle='#fff';g.fillRect(0,0,d.w,d.h)}
 g.globalCompositeOperation='lighter';g.drawImage(gc,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';free(gc);return{mask:out}}
// every pointer move builds document-size canvases: give the memory back at once instead of waiting for the garbage collector (24 Mpx = 96 MB each)
const free=c=>{if(c){c.width=c.height=0}};
gradientPreview=function(dr){const L=dr.target;if(!L||Math.hypot(dr.x1-dr.x0,dr.y1-dr.y0)*S.zoom<4)return;
 const oldP=L.preview,oldM=L.maskPreview;
 const r=gradBuild(dr);if(r.mask){L.maskPreview=r.mask}else if(L.kind==='pixel'){const c=cloneC(L.canvas),g=cx(c);g.globalAlpha=r.op;g.drawImage(r.gc,0,0);g.globalAlpha=1;L.preview=c;free(r.gc)}
 if(oldP&&oldP!==L.preview&&oldP!==L.canvas)free(oldP);if(oldM&&oldM!==L.maskPreview&&oldM!==L.mask)free(oldM);markComp()};
gradientCommit=function(dr){const L=dr.target;if(!L)return;{const oP=L.preview,oM=L.maskPreview;delete L.maskPreview;delete L.preview;if(oP&&oP!==L.canvas)free(oP);if(oM&&oM!==L.mask)free(oM)}if(!S.doc.layers.includes(L)||Math.hypot(dr.x1-dr.x0,dr.y1-dr.y0)*S.zoom<4){markComp();return}
 if(onMaskOf(L)){const r=gradBuild(dr);L.mask=r.mask;markComp();pushHistory(dr.shape==='radial'?'Masque radial':'Masque dégradé');syncLayers();savePaint();return}
 if(L.kind!=='pixel'){markComp();return}
 toPixels(L);const r=gradBuild(dr),H=hiTake(L),g=editCanvas(L);g.globalAlpha=r.op;g.drawImage(r.gc,0,0);g.globalAlpha=1;free(r.gc);
 // 16-bit layer: the gradient is computed in float (the 8-bit one would band); the selection is applied twice, as on the canvas (gradientCanvas, then gradBuild)
 if(H&&window.gradF){const d=S.doc,f=gradF(dr,S.color),sg=d.sel?rx(d.sel):null;hiComp(L,{x0:0,y0:0,x1:d.w,y1:d.h},(x,y,w,h)=>{const o=new Float32Array(w*h*4);f.fill(x,y,w,h,o);if(sg){const sa=sg.getImageData(x,y,w,h).data;for(let j=3;j<o.length;j+=4){const k=sa[j]/255;o[j]*=k*k}}return o},r.op)}
 markComp();pushHistory('Dégradé');syncLayers();savePaint()};
const _omP=onMove;onMove=function(e,p){const dr=S.drag;
 // the button went up somewhere we were not told about (window lost focus, menu...): finish instead of painting without a button
 if(dr&&(dr.type==='stroke'||dr.type==='gradient')&&PAINT_TOOLS.includes(S.tool)&&e&&e.type==='pointermove'&&e.buttons===0){onUp(e);return}
 if(dr&&dr.type==='gradient'&&e&&e.shiftKey&&p){const dx=p.x-dr.x0,dy=p.y-dr.y0,r=Math.hypot(dx,dy),a=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4);p={...p,x:dr.x0+r*Math.cos(a),y:dr.y0+r*Math.sin(a)}}
 return _omP.call(this,e,p)};

/* ---------- eyedropper: sample size, active layer or all layers; Alt+click also in gradient and bucket ---------- */
// a Display-P3 document hands back P3 numbers: ask for sRGB ones, which is what the swatch and the brush colour mean
const sRGBData=(g,x,y,w,h)=>{try{return g.getImageData(x,y,w,h,{colorSpace:'srgb'}).data}catch(e){return g.getImageData(x,y,w,h).data}};
pickColor=function(p){const d=S.doc;if(!d)return;const x=Math.floor(p.x),y=Math.floor(p.y);if(x<0||y<0||x>=d.w||y>=d.h)return;
 const o=S.opts.eyedropper,n=Math.max(1,parseInt(o.sample,10)||1),h=n>>1;let src;
 if(o.all!==false)src=flatSync();else{const L=pixelTarget();if(!L)return;src=L.canvas}
 const x0=Math.max(0,x-h),y0=Math.max(0,y-h),x1=Math.min(d.w,x+h+1),y1=Math.min(d.h,y+h+1),a=sRGBData(rx(src),x0,y0,x1-x0,y1-y0);
 let r=0,g=0,b=0,w=0;for(let i=0;i<a.length;i+=4){const al=a[i+3];r+=a[i]*al;g+=a[i+1]*al;b+=a[i+2]*al;w+=al}if(!w)return;
 S.color='#'+[r,g,b].map(v=>clamp(Math.round(v/w),0,255).toString(16).padStart(2,'0')).join('');const f=$('#fg');if(f)f.value=S.color;const oc=$('#optColor');if(oc)oc.value=S.color};
const _odP=onDown;onDown=function(e,p){const t=S.tool,d=S.doc;
 // right button (or a pen barrel button): the context menu, never a dab, a gradient, a fill or a colour pick
 if(e&&e.button===2&&PAINT_TOOLS.includes(t))return;
 if(d&&e.button!==1&&!S.spaceDown&&!S.wbPick&&!S.rangePick&&(t==='gradient'||t==='bucket')){
  if(e.altKey){pickColor(p);S.drag={type:'pick'};return}
  const A=AL();
  if(t==='gradient'&&A&&A.visible===false){toast('Ce calque est masqué');return}
  if(t==='bucket'&&A&&!A.editMask){const T=A.kind==='pixel'?A:(A.kind==='adjust'&&!A.mask?pixelTarget():null);const x=Math.floor(p.x),y=Math.floor(p.y);if(T&&T.visible!==false&&x>=0&&y>=0&&x<d.w&&y<d.h)toPixels(T)}}
 return _odP.apply(this,arguments)};

/* ---------- options bar: what matters stays visible on laptop screens ---------- */
const _pxP=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pxP.apply(this,arguments)||'';
 if(t==='eyedropper'){const e=S.opts.eyedropper;h+=`<label title="Moyenne des pixels autour du clic">Échantillon<select data-sel="eyedropper.sample">${[['1','1 pixel'],['3','3 × 3'],['5','5 × 5'],['11','11 × 11'],['31','31 × 31']].map(([v,l])=>`<option value="${v}" ${String(e.sample)===v?'selected':''}>${l}</option>`).join('')}</select></label><label title="Décoché : prélève seulement le calque actif"><input type="checkbox" data-chk="eyedropper.all" ${e.all!==false?'checked':''}>Tous les calques</label>`}
 return h};
// the colour swatch was squeezed to a 6 px sliver as soon as the options overflowed
(()=>{const st=document.createElement('style');st.textContent='#pill .swatch{flex:none}';document.body.appendChild(st)})();
const KBT='[ et ] : taille · ⇧ [ ] : dureté · 1…0 : opacité · ⇧ + clic : ligne droite';
function fitPill(){const ob=$('#pill');if(!ob)return;const items=[...ob.querySelectorAll('[data-fit]')];items.forEach(x=>x.style.display='');if(!items.length||document.body.classList.contains('compact'))return;
 items.sort((a,b)=>a.dataset.fit-b.dataset.fit);for(const x of items){if(ob.scrollWidth<=ob.clientWidth+1)break;x.style.display='none'}}
const _rpP=renderPill;renderPill=function(){const r=_rpP.apply(this,arguments);try{const t=S.tool,ob=$('#pill'),A=AL();if(!ob)return r;
 if(PT.includes(t)){const kb=ob.querySelector('.kbhint');if(kb){kb.dataset.fit='1';kb.title=KBT;ob.appendChild(kb)}
  const sz=ob.querySelector(`[data-opt="${t}.size"]`);if(sz)sz.closest('label').title=KBT;
  const sm=ob.querySelector(`[data-opt="${t}.smooth"]`);if(sm){const l=sm.closest('label');l.dataset.fit='2';l.title='Lissage du trait (aussi dans Trait…)'}
  const hint=ob.querySelector(':scope > .hint:not(.kbhint)');if(hint&&A&&A.mask&&(A.kind==='adjust'||A.editMask)){hint.textContent=A.qmask?(t==='brush'?'Ajoute à la sélection.':'Retire de la sélection.'):A.kind==='adjust'?(t==='brush'?'Peint la zone du réglage.':'Retire de la zone du réglage.'):(t==='brush'?'Peint le masque : révèle le calque.':'Gomme le masque : cache le calque.');hint.title=hint.textContent}}
 if(t==='gradient'){const seg=ob.querySelector('.seg');const w=document.createElement('span');w.innerHTML=optRange('gradient.opacity','Opacité',1,100,1,' %',100);const lab=w.firstElementChild;if(seg&&lab){seg.after(lab);const i=lab.querySelector('input');i.oninput=()=>{GO.opacity=+i.value/100;lab.querySelector('.val').textContent=fmtN(+i.value,1)+' %'}}
  // the foreground colour was nowhere in this bar (the dock swatch is off screen under 1000 px high): both colours side by side
  const bg=ob.querySelector('#optBg');if(bg&&!ob.querySelector('#optColor')){const l=bg.closest('label'),fg=document.createElement('input');fg.type='color';fg.className='swatch';fg.id='optColor';fg.value=S.color;fg.title='Premier plan';fg.setAttribute('aria-label','Couleur de premier plan');fg.oninput=e=>{S.color=e.target.value;const f=$('#fg');if(f)f.value=S.color};
   bg.title='Arrière-plan';l.textContent='';l.title='Premier plan et arrière-plan · X pour les inverser';l.style.gap='4px';l.append(fg,bg)}}
 if(t==='eyedropper'){const hn=ob.querySelector(':scope > .hint');if(hn){hn.dataset.fit='1';ob.appendChild(hn)}}
 fitPill()}catch(e){console.warn(e)}return r};
let rzT=0;const refit=()=>{cancelAnimationFrame(rzT);rzT=requestAnimationFrame(()=>{if($('#pill [data-fit]'))fitPill()})};addEventListener('resize',refit);
// the tool name beside the options is updated after renderPill: measure again once it is there
const _stP=setTool;setTool=function(){const r=_stP.apply(this,arguments);try{if($('#pill [data-fit]'))fitPill()}catch(e){}return r};

/* ---------- Échap during a stroke: cancel it (the stroke stayed open: no undo, no tool change, no commit) ---------- */
const _cdP=cancelDrag;cancelDrag=function(){const dr=S.drag,st=S.stroke;
 if(dr&&dr.type==='stroke'&&st&&PT.includes(st.tool)){S.drag=null;cancelStroke();[st.tmp,st.m,st.canvas].forEach(c=>{if(c&&c!==st.layer.canvas&&c!==st.layer.mask)c.width=c.height=0});requestRender();return}
 return _cdP.apply(this,arguments)};

/* ---------- Maj+clic starts exactly where the last stroke was released (not at its last dab, up to one spacing before) ---------- */
const _es2=endStroke;endStroke=function(){const st=S.stroke,r=_es2.apply(this,arguments);
 try{if(st&&PT.includes(st.tool)&&st.raw&&S.lastPt&&S.lastPt.tool===st.tool){S.lastPt.x=st.raw.x;S.lastPt.y=st.raw.y}
  // the stroke canvas (document size) has been merged: release it now rather than at the next garbage collection
  if(st&&PT.includes(st.tool)&&st.canvas&&st.canvas!==st.layer.canvas&&st.canvas!==st.layer.mask&&!st.live)st.canvas.width=st.canvas.height=0}catch(e){}
 return r};

/* ---------- tips: the stamp is padded, so a rotated square keeps its corners and a soft flat tip its halo (both were cut at the stamp border) ---------- */
const _sfP=stampFor;stampFor=function(size,hard,color){const t=S.tool;
 if(t!=='brush'&&t!=='eraser')return _sfP.apply(this,arguments);
 const o=S.opts[t],tip=String(o.tip||'round'),ang=+o.angle||0,rd=+o.round||100;
 if(!(tip==='round'||tip==='square'||tip==='line')||(tip==='round'&&!ang&&rd>=100))return _sfP.apply(this,arguments);
 const s=Math.max(2,Math.ceil(size)),a=ang*Math.PI/180,f=Math.max(.08,rd/100),ca=Math.abs(Math.cos(a)),sa=Math.abs(Math.sin(a));
 const bl=hard<.95&&'filter' in cx(mk(1,1))?Math.round((1-hard)*s*.12):0;
 const hx=tip==='square'?s*.44:tip==='line'?s*.46:s/2,hy=(tip==='square'?s*.44:tip==='line'?s*.12:s/2)*f;
 const N=Math.max(s,Math.ceil(2*(Math.max(hx*ca+hy*sa,hx*sa+hy*ca)+bl*2.5))+4),c=mk(N,N),g=cx(c);
 g.save();g.translate(N/2,N/2);g.rotate(a);g.scale(1,f);g.fillStyle='#000';
 if(tip==='square')g.fillRect(-s*.44,-s*.44,s*.88,s*.88);else{g.beginPath();if(tip==='line')g.ellipse(0,0,s*.46,s*.12,0,0,7);else g.arc(0,0,s/2,0,7);g.fill()}
 g.restore();
 if(bl){const t2=mk(N,N),g2=cx(t2);g2.filter=`blur(${bl}px)`;g2.drawImage(c,0,0);g.clearRect(0,0,N,N);g.drawImage(t2,0,0)}
 g.globalCompositeOperation='source-in';g.fillStyle=color||'#000000';g.fillRect(0,0,N,N);return c};

/* ---------- "Spray…" dialog: the values were only read when closing (lost with Échap) and the numbers beside the sliders never moved ---------- */
if(PILL_ACT.brushx){const _bx=PILL_ACT.brushx;PILL_ACT.brushx=function(){const r=_bx.apply(this,arguments);
 try{const o=S.opts[S.tool==='eraser'?'eraser':'brush'],sc=$('#scrim'),A=$('#bxS',sc),B=$('#bxN',sc),G=$('#bxG',sc);
  if(A)A.oninput=()=>{o.scatter=+A.value;$('#bxS-o',sc).textContent=A.value+' %';savePaint()};
  if(B)B.oninput=()=>{o.scatterN=+B.value;$('#bxN-o',sc).textContent=B.value;savePaint()};
  if(G)G.onchange=()=>{o.grain=G.checked?1:0;savePaint()}}catch(e){console.warn(e)}
 return r}}

/* ---------- gradient editor: a double click on a marker never deleted it (the markers are rebuilt at the first press): detect the second press instead ---------- */
if(PILL_ACT.gradEdit){const _ge=PILL_ACT.gradEdit;PILL_ACT.gradEdit=function(){const r=_ge.apply(this,arguments);
 try{const sc=$('#scrim'),hd=$('#gdHandles',sc),P=$('#gdP',sc);
  if(hd&&P){let last={i:-1,t:0};
   hd.addEventListener('pointerdown',e=>{const b=e.target.closest&&e.target.closest('button');if(!b)return;const i=+b.dataset.i,now=performance.now();
    if(i===last.i&&now-last.t<500&&GO.stops.length>2){last={i:-1,t:0};e.stopImmediatePropagation();e.stopPropagation();GO.stops.splice(i,1);P.dispatchEvent(new Event('change'));return}
    last={i,t:now}},true);
   const m=sc.querySelector('.muted');if(m)m.textContent=m.textContent.replace('pour les déplacer.','pour les déplacer, double-cliquez sur un repère pour le supprimer.')}}catch(e){console.warn(e)}
 return r}}

/* ---------- the options bar has no Flux slider on a mask, so mask strokes ignore the Flux set for pixels (a low flow made masks come out patchy and weak) ---------- */
const _dabF=dab;dab=function(st){const o=st&&st.target==='mask'&&st.tool==='brush'?S.opts.brush:null;
 if(o&&o.flow!=null&&o.flow<1){const f=o.flow;o.flow=1;try{return _dabF.apply(this,arguments)}finally{o.flow=f}}
 return _dabF.apply(this,arguments)};

/* ---------- custom tips: the image was only requested by the first stroke, which therefore painted a plain disc. Ask for it as soon as the tip is chosen ---------- */
const primed=new Set();
const primeTip=()=>{try{for(const t of PT){const tip=String(S.opts[t].tip||'');if(!tip.startsWith('c:')||primed.has(t+tip))continue;primed.add(t+tip);const t0=S.tool;S.tool=t;try{_sfP.call(null,8,1,'#000000')}finally{S.tool=t0}}}catch(e){}};
const _rpT=renderPill;renderPill=function(){primeTip();return _rpT.apply(this,arguments)};
view.addEventListener('pointermove',primeTip,{passive:true});primeTip();
if(S.doc)try{renderPill()}catch(e){}
})();

