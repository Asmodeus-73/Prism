/* ===== fx_develop: audit of the Réglages / Développer panel ===== */

/* ---- A. tone LUT: pure white stays white when exposure goes up, negative contrast no longer posterises the shadows ---- */
lutMap.clear();
getLUTs=function(dv){const key=JSON.stringify([dv.temp,dv.tint,dv.exposure,dv.contrast,dv.highlights,dv.shadows,dv.whites,dv.blacks,dv.dehaze,dv.curve]);let r=lutMap.get(key);if(r)return r;
  const t=dv.temp/100,ti=dv.tint/100;let g=[1+0.3*t,1-0.22*ti,1-0.3*t];const nrm=0.2126*g[0]+0.7152*g[1]+0.0722*g[2];g=g.map(v=>v/nrm);
  const ev=Math.pow(2,dv.exposure),hl=dv.highlights/100,sh=dv.shadows/100,wh=dv.whites/100,bl=dv.blacks/100,dh=dv.dehaze/100,c=dv.contrast/100+dh*0.35,k=c>=0?1+c*1.5:1+c*0.65;
  const mf=isIdCurve(dv.curve.rgb)?null:curveFn(dv.curve.rgb),TWO_PI=Math.PI*2;
  r=['r','g','b'].map((ch,ci)=>{const L=new Float32Array(4096),gain=g[ci]*ev,knee=gain>1?1-Math.min(0.3,(gain-1)*0.35):1,cf=isIdCurve(dv.curve[ch])?null:curveFn(dv.curve[ch]);
    /* roll-off normalised so that the source white (x=1 before the gain) lands exactly on 1 instead of 0.99 */
    const xw=Math.pow(gain,1/2.2),den=knee<1?1-Math.exp(-(xw-knee)/(1-knee)):1;
    for(let i=0;i<4096;i++){let x=i/4095;if(dh>0)x=(x-0.1*dh)/(1-0.1*dh);else if(dh<0)x=x+(0.78-x)*(-dh)*0.35;if(x<0)x=0;x=Math.pow(Math.pow(x,2.2)*gain,1/2.2);
      if(x>knee&&knee<1)x=knee+(1-knee)*(1-Math.exp(-(x-knee)/(1-knee)))/den;if(x>1)x=1;
      x+=sh*1.35*x*(1-x)*(1-x);x+=hl*1.35*x*x*(1-x);x+=wh*0.25*x*x*x;x+=bl*0.2*(1-x)*(1-x)*(1-x);x=clamp(x,0,1);
      if(k>1)x=x<0.5?0.5*Math.pow(2*x,k):1-0.5*Math.pow(2-2*x,k);
      else if(k<1)x=x+(1-k)*Math.sin(TWO_PI*x)/TWO_PI;/* same slope in the middle, bounded slope at both ends: no 20-level jump between codes 0 and 1 */
      if(mf)x=mf(x);if(cf)x=cf(x);L[i]=x}return L});
  if(lutMap.size>24)lutMap.delete(lutMap.keys().next().value);lutMap.set(key,r);return r};

/* ---- B. history hygiene: no empty steps, keyboard repeat on a slider is one step ---- */
(()=>{
const pane=$('#pane-develop');
const GRADE_LBL={shH:'Teinte des ombres',shS:'Saturation des ombres',midH:'Teinte des tons moyens',midS:'Saturation des tons moyens',hiH:'Teinte des hautes lumières',hiS:'Saturation des hautes lumières',balance:'Équilibre des tons'};
const _lf=labelFor;labelFor=function(k){return GRADE_LBL[k]||_lf.apply(this,arguments)};
const DEVLBL=new Set([...Object.values(LABELS),...Object.values(GRADE_LBL),'Courbe des tonalités','Balance des blancs','Réglages automatiques']);
const isDevLabel=l=>typeof l==='string'&&(DEVLBL.has(l)||/^(Réinitialiser |Préréglage : )/.test(l)||/^(Teinte|Saturation|Luminance) (rouges|oranges|jaunes|verts|turquoises|bleus|violets|magentas)$/.test(l));
const ids=new WeakMap();let idN=0;const ref=o=>{if(!o)return 0;let v=ids.get(o);if(!v){v=++idN;ids.set(o,v)}return v};
const sig=L=>[L.id,L.kind,L.name,L.visible,L.opacity,L.blend,ref(L.canvas),ref(L.mask),L.editMask?1:0,L.dev?JSON.stringify(L.dev):''].join('~');
function sameAsHead(){const d=S.doc,h=S.history[S.hi];if(!d||!h||h.w!==d.w||h.h!==d.h||h.active!==d.active||h.sel!==d.sel||h.layers.length!==d.layers.length)return false;
  for(let i=0;i<d.layers.length;i++)if(sig(d.layers[i])!==sig(h.layers[i]))return false;return true}
const KB={t:0};let LASTP=null;
pane.addEventListener('keydown',e=>{const t=e.target;if(t&&t.matches&&(t.matches('input[type=range]')||t.id==='curve')&&/^(Arrow|Page|Home|End)/.test(e.key))KB.t=performance.now()},true);
const _ph=pushHistory;
pushHistory=function(label){
  if(isDevLabel(label)){try{clearMutes()}catch(e){}
    if(sameAsHead())return;
    const now=performance.now();
    if(LASTP&&LASTP.label===label&&now-KB.t<500&&now-LASTP.t<2500&&S.hi>0&&S.hi===S.history.length-1&&S.history[S.hi]===LASTP.snap){S.history.pop();S.hi--}
    const r=_ph.apply(this,arguments);LASTP={snap:S.history[S.hi],label,t:now};return r}
  return _ph.apply(this,arguments)};
window.__devHist={isDevLabel,sameAsHead};
})();

/* ---- C. curve editor: grab instead of stacking a second point on the same x, no empty history step,
        the point keeps its offset under the pointer, arrow keys nudge the selected point, numeric read-out ---- */
(()=>{
const old=$('#curve');if(!old)return;const c=old.cloneNode(false);old.replaceWith(c);c.tabIndex=0;c.setAttribute('role','application');c.setAttribute('aria-label','Courbe des tonalités : flèches pour déplacer le point sélectionné, Suppr pour le retirer');
let SEL=null;
const pos=e=>{const r=c.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp(1-(e.clientY-r.top)/r.height,0,1),ry:1-(e.clientY-r.top)/r.height}};
const snapshot=()=>JSON.stringify(ADJ()?ADJ().dev.curve:null);
const commit=()=>{drawCurve();markContent();markSecs();pushHistory('Courbe des tonalités');scheduleThumbs()};
c.addEventListener('pointerdown',e=>{if(e.button!==0||!ADJ())return;e.preventDefault();c.setPointerCapture(e.pointerId);try{c.focus({preventScroll:true})}catch(_){}
  const p=pos(e),pts=curvePts(),before=snapshot();let i=pts.findIndex(q=>Math.hypot(q[0]-p.x,q[1]-p.y)<0.045),added=false;
  if(i<0){let bd=0.03;pts.forEach((q,j)=>{const dx=Math.abs(q[0]-p.x);if(dx<bd){bd=dx;i=j}})}
  if(i<0){pts.push([p.x,curveFn(pts)(p.x)]);pts.sort((a,b)=>a[0]-b[0]);i=pts.findIndex(q=>q[0]===p.x);added=true;markContent();markSecs()}
  SEL=pts[i];curveDrag={pt:pts[i],before,added,ox:added?0:pts[i][0]-p.x,oy:added?0:pts[i][1]-p.y};drawCurve()});
c.addEventListener('pointermove',e=>{if(!curveDrag)return;const p=pos(e),pts=curvePts(),i=pts.indexOf(curveDrag.pt);if(i<0)return;
  const lo=i>0?pts[i-1][0]+0.01:0,hi=i<pts.length-1?pts[i+1][0]-0.01:1,end=i===0||i===pts.length-1;
  if(!end&&(p.ry<-0.12||p.ry>1.12)){pts.splice(i,1);SEL=null;curveDrag=null;commit();return}
  curveDrag.pt[0]=clamp(p.x+curveDrag.ox,lo,hi);curveDrag.pt[1]=clamp(p.y+curveDrag.oy,0,1);drawCurve();markContent();markSecs()});
const up=()=>{if(!curveDrag)return;const d=curveDrag;curveDrag=null;if(d.added||snapshot()!==d.before){pushHistory('Courbe des tonalités');scheduleThumbs()}drawCurve()};
c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
c.addEventListener('dblclick',e=>{if(!ADJ())return;const p=pos(e),pts=curvePts(),i=pts.findIndex(q=>Math.hypot(q[0]-p.x,q[1]-p.y)<0.05);if(i>0&&i<pts.length-1){pts.splice(i,1);SEL=null;commit()}});
const delSel=()=>{const pts=curvePts(),i=SEL?pts.indexOf(SEL):-1;if(i>0&&i<pts.length-1){pts.splice(i,1);SEL=pts[Math.min(i,pts.length-2)]||null;commit()}};
/* Delete / Backspace on a develop slider or on the curve must never reach the global "delete the active layer" shortcut (it lets range inputs through) */
window.addEventListener('keydown',e=>{if(e.key!=='Delete'&&e.key!=='Backspace')return;if(e.shiftKey||e.metaKey||e.ctrlKey||e.altKey)return;const t=e.target;if(!t||!t.closest)return;
  if(t.id==='curve'){e.preventDefault();e.stopImmediatePropagation();if(ADJ())delSel()}else if(t.matches('input[type=range]')){e.preventDefault();e.stopImmediatePropagation()}},true);/* any slider of the app (layer opacity, options bar...), not only the develop ones */
c.addEventListener('keydown',e=>{if(!ADJ()||e.metaKey||e.ctrlKey||e.altKey)return;const pts=curvePts();let i=SEL?pts.indexOf(SEL):-1;
  if(!/^Arrow/.test(e.key))return;e.preventDefault();e.stopPropagation();
  if(i<0){i=pts.length>2?1:0;SEL=pts[i];drawCurve();return}
  const st=(e.shiftKey?10:1)/255,pt=pts[i],lo=i>0?pts[i-1][0]+0.01:0,hi=i<pts.length-1?pts[i+1][0]-0.01:1;
  if(e.key==='ArrowLeft')pt[0]=clamp(pt[0]-st,lo,hi);else if(e.key==='ArrowRight')pt[0]=clamp(pt[0]+st,lo,hi);else if(e.key==='ArrowUp')pt[1]=clamp(pt[1]+st,0,1);else pt[1]=clamp(pt[1]-st,0,1);
  commit()});
c.addEventListener('blur',()=>{SEL=null;drawCurve()});
document.addEventListener('click',e=>{if(SEL&&!e.target.closest('#curve')&&!e.target.closest('#curveCh')){SEL=null;drawCurve()}},true);
/* the selected point and its input -> output values are drawn on the canvas */
const _dc=drawCurve;drawCurve=function(){_dc.apply(this,arguments);try{
  const cv=$('#curve');if(!cv||!ADJ())return;const pt=(curveDrag&&curveDrag.pt)||SEL;if(!pt||curvePts().indexOf(pt)<0)return;
  const g=cx(cv),W=cv.width,H=cv.height,x=pt[0]*W,y=H-pt[1]*H;g.save();g.lineWidth=3;g.strokeStyle='#fff';g.beginPath();g.arc(x,y,13,0,7);g.stroke();g.lineWidth=1.5;g.strokeStyle='rgba(0,0,0,.6)';g.beginPath();g.arc(x,y,14.5,0,7);g.stroke();
  const txt=`${Math.round(pt[0]*255)} → ${Math.round(pt[1]*255)}`;g.font='600 22px '+getComputedStyle(document.body).fontFamily;const w=g.measureText(txt).width+20,h=34;
  let bx=x+16,by=y-h-14;if(bx+w>W-4)bx=x-16-w;if(by<4)by=y+16;bx=Math.max(4,bx);by=Math.min(H-h-4,by);
  g.fillStyle='rgba(18,18,22,.86)';g.beginPath();if(g.roundRect)g.roundRect(bx,by,w,h,8);else g.rect(bx,by,w,h);g.fill();g.fillStyle='#fff';g.textBaseline='middle';g.fillText(txt,bx+10,by+h/2+1);g.restore()}catch(e){}};
drawCurve();
})();

/* ---- D. assistant: hues and settings whose neutral value is not 0 were clamped to 0..144 / 0..40 ---- */
(()=>{
const INTENSE=/beaucoup|tr[eè]s|fort(?:ement)?|vraiment|extr[eê]me|[àa] fond|maximum|\bmax\b|[ée]norm[ée]ment|nettement|radical|intense|bien plus|bien moins/i;
let TXT='';
const _ap=assistPrompt;
assistPrompt=function(text){TXT=text||'';return _ap.apply(this,arguments).replace(/^(tint|temp|shH|shS|midH|midS|hiH|hiS|vignette|balance): [^\[\n]*\[/gm,(m,k)=>k+': '+({tint:'Teinte (vert - magenta)',temp:'Température (bleu - jaune)',shH:'Teinte des ombres',shS:'Saturation des ombres',midH:'Teinte des tons moyens',midS:'Saturation des tons moyens',hiH:'Teinte des hautes lumières',hiS:'Saturation des hautes lumières',vignette:'Vignetage (négatif = assombrit les bords)',balance:'Équilibre des tons (ombres - hautes lumières)'})[k]+' [').replace('0 = neutre)','0 = neutre, sauf shH 215, midH 30, hiH 45, sharpRadius 1, vigMid 50, vigFeather 50, grainSize 25)')};
cleanParams=function(p){const out={};if(!p||typeof p!=='object')return out;const intense=INTENSE.test(TXT),Z=DEV0();
  for(const {k,min,max} of ASSIST_KEYS){let v=p[k];if(typeof v!=='number'||!isFinite(v))continue;v=clamp(v,min,max);
    /* the "stay modest" cap only makes sense where 0 is neutral (not for hues, vignette midpoint, grain size, radius) */
    if(!intense&&Z[k]===0){const lim=k==='exposure'?1:Math.max(Math.abs(min),Math.abs(max))*.4;v=clamp(v,Math.max(min,-lim),Math.min(max,lim))}out[k]=v}
  for(const k of ['hslH','hslS','hslL'])if(Array.isArray(p[k])&&p[k].length===8)out[k]=p[k].map(v=>clamp(+v||0,-100,100));
  const HUE={shH:1,midH:1,hiH:1},keys=Object.keys(out).filter(k=>typeof out[k]==='number'&&!HUE[k]);
  if(keys.length>8){const rank=keys.map(k=>{const K=ASSIST_KEYS.find(x=>x.k===k);return[k,K?Math.abs(out[k]-Z[k])/Math.max(Math.abs(K.max-Z[k]),Math.abs(K.min-Z[k]),1e-6):0]}).sort((a,b)=>b[1]-a[1]);rank.slice(8).forEach(([k])=>delete out[k])}
  return out};
if(window.PrismAssist){const _st=PrismAssist.setText;PrismAssist.setText=t=>{TXT=t||'';if(_st)_st(t)};PrismAssist.clean=cleanParams}
})();

/* ---- E. preset thumbnails: the highlighted one is only the one that is still exactly applied ---- */
(()=>{
const mark=()=>{const A=ADJ();const on=A&&A._pn!=null&&A._pj===JSON.stringify(A.dev)?A._pn:-1;$$('#presets .preset').forEach(b=>b.classList.toggle('on',+b.dataset.p===on))};
const _ph2=pushHistory;pushHistory=function(label){const head=S.history[S.hi],r=_ph2.apply(this,arguments);
  if(typeof label==='string'&&label.startsWith('Préréglage : ')){const A=ADJ(),b=PRESETS.findIndex(x=>'Préréglage : '+x[0]===label);if(A&&b>=0){A._pn=b;A._pj=JSON.stringify(A.dev);const sn=S.history[S.hi];if(sn!==head&&sn.layers[S.doc.active]){sn.layers[S.doc.active]._pn=b;sn.layers[S.doc.active]._pj=A._pj}}}
  mark();return r};
const _sd=syncDev;syncDev=function(){_sd.apply(this,arguments);mark()};
const _ms=markSecs;markSecs=function(){_ms.apply(this,arguments);mark()};
mark();
})();

/* ---- F. histogram: the whole photo whatever the zoom, French decimals, amber when real clipping ---- */
(()=>{
const _h=histogram;let hx=null;
function inView(){const d=S.doc,v=view;if(!d)return true;const M=new DOMMatrix(viewMatrix(0,0));return[[0,0],[d.w,0],[0,d.h],[d.w,d.h]].every(([x,y])=>{const p=M.transformPoint(new DOMPoint(x,y));return p.x>=-1&&p.y>=-1&&p.x<=v.width+1&&p.y<=v.height+1})}
function wholeDoc(){const d=S.doc,s=Math.min(1,512/Math.max(d.w,d.h)),W=Math.max(1,Math.round(d.w*s)),H=Math.max(1,Math.round(d.h*s));
  if(!hx||hx.width!==W||hx.height!==H)hx=mk(W,H);const g=rx(hx);renderStack(g,W,H,[s,0,0,s,0,0],{scale:s,ox:0,oy:0,before:S.holdBefore});if(PROOF.on)proofApply(g,W,H);return g.getImageData(0,0,W,H)}
histogram=function(img){let im=img;try{if(S.doc&&!inView())im=wholeDoc()}catch(e){console.warn(e);im=img}
  const r=_h.call(this,im);
  for(const id of ['hmL','hmR']){const el=$('#'+id);if(!el)continue;const m=/(\d+)\.(\d) %/.exec(el.textContent);if(m){el.textContent=el.textContent.replace(m[0],m[1]+','+m[2]+' %');el.style.color=(+m[1])>=1?'var(--warn)':''}else el.style.color=''}
  return r};
histogram.t=_h.t;
})();

/* ---- G. Auto without any global adjustment: create it instead of doing nothing silently ---- */
(()=>{const _at=autoTone;autoTone=function(){const d=S.doc;if(d&&!ADJ()&&!d.layers.some(l=>l.kind==='adjust'&&!l.mask)){const L=newAdjust('Réglages');d.layers.push(L);d.active=d.layers.length-1}return _at.apply(this,arguments)}})();

/* ---- H. white balance pipette: cross-hair cursor, Escape cancels, sample scaled to the photo ---- */
(()=>{
wbFromPoint=function(p){const L=AL();if(!L||L.kind!=='adjust'){toast('Sélectionnez un réglage');return}const d=S.doc,c=flatSync(),R=clamp(Math.round(Math.min(d.w,d.h)/400),2,12),n=2*R+1,x=clamp(Math.floor(p.x)-R,0,Math.max(0,d.w-n)),y=clamp(Math.floor(p.y)-R,0,Math.max(0,d.h-n)),w=Math.min(n,d.w),h=Math.min(n,d.h),a=rx(c).getImageData(x,y,w,h).data;
  let r=0,g=0,b=0,m=0;for(let i=0;i<a.length;i+=4){if(a[i+3]<10)continue;r+=a[i];g+=a[i+1];b+=a[i+2];m++}if(!m){toast('Zone transparente : choisissez un point de la photo');return}
  const lin=v=>Math.pow(Math.max(1,v/m)/255,2.2);r=lin(r);g=lin(g);b=lin(b);const q=b/r;const t=clamp((q-1)/(0.3*(1+q)),-1,1),gr=1+0.3*t,ti=clamp((1-r*gr/g)/0.22,-1,1);L.dev.temp=Math.round(t*100);L.dev.tint=Math.round(ti*100);syncDev();markContent();pushHistory('Balance des blancs');toast('Balance des blancs appliquée')};
const _odw=onDown;onDown=function(e,p){if(S.wbPick&&(e.button!==0||S.spaceDown)){if(e.button!==0&&e.button!==1)return;S.wbPick=false;try{return _odw.apply(this,arguments)}finally{S.wbPick=true}}return _odw.apply(this,arguments)};/* pan with space / middle button keeps the pipette armed */
const _sc=setCursor;setCursor=function(){_sc.apply(this,arguments);if(S.wbPick)view.style.cursor='crosshair'};
$('#pane-develop').addEventListener('click',e=>{if(e.target&&e.target.id==='btnWB'){setCursor();requestRender()}});/* registered after the panel's own handler, so S.wbPick is already toggled */
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.wbPick){S.wbPick=false;const b=$('#btnWB');b&&b.classList.remove('on');setCursor();requestRender();toast('Pipette annulée')}},true);
const _dov=drawOverlays;drawOverlays=function(c,pr){const p=S.pointer;if(S.wbPick&&p&&p.inside){p.inside=false;try{return _dov.apply(this,arguments)}finally{p.inside=true}}return _dov.apply(this,arguments)};
})();

/* fx_files: audit fixes for files and persistence */
(()=>{
/* 1. A save in flight (or a late one) must never leave a parked document's last edits unsaved */
const reqAt=new Map(),bAt=new WeakMap(),thumbFor=new WeakMap();
/* 0. While the quick mask is on, autosave used to do nothing at all (a closed tab or a switch lost the edits made before it). The temporary quick mask layer is now simply left out of what is saved. */
const _bmq=buildManifest;
buildManifest=function(d){const dd=d||S.doc;
  if(dd&&dd.layers&&dd.layers.some(l=>l.qmask)){const ls=dd.layers.filter(l=>!l.qmask),cur=dd.layers[dd.active];let a=ls.indexOf(cur);if(a<0)a=Math.min(dd.active,ls.length-1);
    return _bmq.call(this,Object.create(dd,{layers:{value:ls},active:{value:Math.max(0,a)}}))}
  return _bmq.apply(this,arguments)};
const _bm=buildManifest;buildManifest=function(d){const dd=d||S.doc;if(dd)bAt.set(dd,performance.now());return _bm.apply(this,arguments)};
let thumbHold=null;
const _pt=projectThumb;projectThumb=async function(){if(thumbHold){const b=thumbHold;return b}return _pt.apply(this,arguments)};
const inTabs=d=>{try{return PrismTabs.tabs.some(t=>t.doc===d)}catch(e){return false}};
async function saveParked(d){
  while(SAVE.running)await new Promise(r=>setTimeout(r,60));
  if(!inTabs(d)||d===S.doc)return;
  SAVE.running=true;let m;
  try{const tab=PrismTabs.tabs.find(t=>t.doc===d);const old=await IDB.get('projects',d.pid).catch(()=>null);
    let tb=thumbFor.get(d);tb=tb?await tb.catch(()=>null):null;thumbFor.delete(d);
    if(!tb)tb=old&&old.thumb?await IDB.get('blobs',old.thumb).catch(()=>null):null;
    const sm=S.meta;S.meta=(tab&&tab.meta)||'';thumbHold=tb||await toBlob(mk(2,2),'image/jpeg',.5);let p;
    try{p=buildManifest(d)}finally{S.meta=sm;thumbHold=null}
    m=await p;await IDB.put('projects',m.id,m);manifestKeys(m).forEach(k=>PIN.delete(k));d.saved=true;gcBlobs().catch(()=>{})}
  catch(e){console.error(e);if(m)manifestKeys(m).forEach(k=>PIN.delete(k))}
  finally{SAVE.running=false;if(SAVE.again){SAVE.again=false;scheduleSave(400)}}}
const _sv=saveNow;
saveNow=async function(){
  const d=S.doc;if(d&&!d.nosave){reqAt.set(d,performance.now());
    if(SAVE.running){try{thumbFor.set(d,projectThumb().catch(()=>null))}catch(e){}}} // rendered now, while d is still the open document
  const r=await _sv.apply(this,arguments);
  if(SAVE.running)return r;
  for(const [k,t] of [...reqAt]){
    if(k===S.doc||!inTabs(k)||k.nosave){reqAt.delete(k);continue}
    if((bAt.get(k)||0)>t){reqAt.delete(k);continue}
    reqAt.delete(k);await saveParked(k)}
  return r};

/* 2. Importing a project zip / restoring a library backup lost smart-object sources and smart filters (tiles never copied) */
async function takeProject(m,take){
  for(const L of m.layers||[]){
    if(L.canvas)L.canvas=await Promise.all(L.canvas.map(take));
    if(L.mask)L.mask=await Promise.all(L.mask.map(take));
    for(const f of ['hi','fbase']){if(L[f]){try{L[f]=await Promise.all(L[f].map(take))}catch(e){L[f]=null;if(f==='fbase')L.filters=null}}}
    if(L.so&&L.so.t){try{L.so={...L.so,t:await Promise.all(L.so.t.map(take))}}catch(e){L.so=null}}}
  if(m.raw&&m.raw.key){try{m.raw={...m.raw,key:(await take({key:m.raw.key})).key}}catch(e){m.raw=null}}
  if(m.thumb)m.thumb=(await take({key:m.thumb})).key}
const zext=(m,k)=>k===m.thumb?'.jpg':'.png';
importZip=async function(file){const z=await readZip(file);
  if(z.names.includes('revelateur.json')){const m=checkDims(JSON.parse(new TextDecoder().decode(await z.get('revelateur.json'))));const id=uid8(),remap=new Map();
    const take=async t=>{if(remap.has(t.key))return{...t,key:remap.get(t.key)};const nk='t_'+uid8(),ext=zext(m,t.key);const data=await z.get('tiles/'+t.key+ext);if(!data)throw new Error('fichier manquant dans l’archive');
      PIN.add(nk);await IDB.put('blobs',nk,new Blob([data],{type:ext==='.jpg'?'image/jpeg':'image/png'}));remap.set(t.key,nk);return{...t,key:nk}};
    await takeProject(m,take);
    Object.assign(m,{id,sync:Cloud.ok&&PREF.get('autoSync',true),updatedAt:Date.now(),device:DEVICE});await IDB.put('projects',id,m);manifestKeys(m).forEach(k=>PIN.delete(k));await loadManifest(m,t=>IDB.get('blobs',t.key));toast('Projet importé avec ses calques');if(m.sync)scheduleSave(300);return}
  const psd=z.names.find(n=>/\.psd$/i.test(n));if(psd){await importPSD(new Blob([await z.get(psd)]),psd.split('/').pop());return}
  const img=z.names.find(n=>/\.(jpe?g|png|webp|tiff?|dng|cr2|cr3|nef|arw|raf)$/i.test(n));if(img){await openBlob(new File([await z.get(img)],img.split('/').pop()),false);return}
  throw new Error('aucun projet, PSD ni photo dans cette archive')};
async function restoreLibrary2(file){
  busy(true,'Restauration…',0);
  try{
    const z=await readZip(file);
    if(!z.names.includes('prism-library.json'))throw new Error('ce fichier n’est pas une sauvegarde de photothèque');
    const ids=[...new Set(z.names.map(n=>(n.match(/^p\/([^/]+)\/revelateur\.json$/)||[])[1]).filter(Boolean))];
    const have=new Set((await IDB.keys('projects')).map(String));let added=0,skipped=0,failed=0,i=0;
    for(const id of ids){
      busy(true,'Restauration… '+(++i)+' / '+ids.length,i/ids.length);
      if(have.has(id)){skipped++;continue}
      try{const m=checkDims(JSON.parse(new TextDecoder().decode(await z.get('p/'+id+'/revelateur.json'))));
        const take=async t=>{const ext=zext(m,t.key);const data=await z.get('p/'+id+'/tiles/'+t.key+ext);if(!data)throw new Error('tuile manquante');PIN.add(t.key);await IDB.put('blobs',t.key,new Blob([data],{type:ext==='.jpg'?'image/jpeg':'image/png'}));return t};
        await takeProject(m,take);m.sync=false;await IDB.put('projects',id,m);manifestKeys(m).forEach(k=>PIN.delete(k));added++}
      catch(e){failed++;console.warn('restauration',id,e)}
      await tick()}
    busy(false);
    toast(added+' projet'+(added>1?'s':'')+' restauré'+(added>1?'s':'')+(skipped?' ('+skipped+' déjà présent'+(skipped>1?'s':'')+')':'')+(failed?' · '+failed+' illisible'+(failed>1?'s':''):''));
    try{if(typeof libLoad==='function'&&document.getElementById('library'))libLoad().then(()=>renderLibrary())}catch(e){}
  }catch(e){busy(false);console.error(e);toast('Restauration impossible : '+(e.message||e),5000)}}
const _fi2=MENU2.file.items;
MENU2.file.items=()=>{const a=_fi2();for(const it of a)if(it&&it.label==='Restaurer une sauvegarde…')it.fn=()=>{const i=document.createElement('input');i.type='file';i.accept='.zip';i.onchange=()=>{if(i.files[0])restoreLibrary2(i.files[0])};i.click()};return a};
if(window.PrismBackup)window.PrismBackup.restore=restoreLibrary2;

/* 3. Several photos dropped or picked at once: open them all (one tab each) instead of silently keeping the first */
const DROPOK=f=>f.type.startsWith('image/')||RAW_EXT.test(f.name)||/\.(heic|heif|psd|psb|zip|tiff?|pdf|tga|svg|jxl)$/i.test(f.name);
async function openMany(fs,asLayer){
  if(fs.length>10){toast('Seules les 10 premières photos sont ouvertes (les autres peuvent être ajoutées à la photothèque)',5000);fs=fs.slice(0,10)}
  for(const f of fs){await openBlob(f,asLayer)}}
stage.addEventListener('drop',e=>{const bz=$('#busy');if(bz&&!bz.hidden)return;const fs=[...(e.dataTransfer&&e.dataTransfer.files||[])].filter(DROPOK);if(fs.length<2)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();dragN=0;$('#drop').hidden=true;openMany(fs,e.shiftKey)},true);
const fo=$('#fileOpen');if(fo){fo.multiple=true;fo.onchange=e=>{const fs=[...e.target.files];e.target.value='';if(fs.length)openMany(fs,false)}}
window.PrismOpenMany=openMany;

/* 4. The watermark of the export dialog was never applied (exportAs does not go through doExport) */
const PX=window.PrismExport;
if(PX&&PX.WM){
  let inExport=0;
  const _r3=renderDoc;
  renderDoc=async function(sc,o){const c=await _r3.apply(this,arguments);
    if(!inExport||PX.WM.active||!(o&&o.progress)||!PX.WM.cur.on||!(PX.WM.cur.text||'').trim())return c;
    try{return PX.stamp(c)}catch(e){console.warn('filigrane',e);return c}};
  const _ea=exportAs;
  exportAs=async function(st){
    const f=EXF.find(x=>x.id===(st&&st.fmt));
    if(PX.WM.cur.on&&(PX.WM.cur.text||'').trim()&&f&&((f.id==='png'&&st.depth.png===16)||(f.id==='tiff'&&st.depth.tiff===16)||(f.id==='avif'&&st.depth.avif===10&&(S.doc.space!=='display-p3'))||f.id==='psd'))
      toast('Le filigrane n’est pas appliqué à ce format (16 bits, 10 bits ou PSD).',4500);
    inExport++;try{return await _ea.apply(this,arguments)}finally{inExport--}}}

/* 5. A failed autosave (storage full, private window...) must be visible, and storage should be persistent */
let errShown=false,persistAsked=false;
const _sv2=saveNow;
saveNow=async function(){const r=await _sv2.apply(this,arguments);
  try{if(SAVE.state==='error'){if(!errShown){errShown=true;toast('Votre travail n’a pas pu être enregistré sur cet appareil : '+(/quota|space|full|exceed|storage/i.test(SAVE.err||'')?'espace de stockage insuffisant':'stockage du navigateur indisponible')+'. Exportez la photo pour ne rien perdre.',8000)}}
    else if(SAVE.state==='saved'){errShown=false;
      if(!persistAsked){persistAsked=true;if(navigator.storage&&navigator.storage.persist&&!/Firefox/.test(navigator.userAgent))navigator.storage.persisted().then(v=>v||navigator.storage.persist()).catch(()=>{})}}}catch(e){}
  return r};
/* deleting a snapshot must also reach the saved history, or it comes back after a reload */
document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('#snList [data-x]');if(b)setTimeout(()=>{try{PrismHist.schedule()}catch(err){}},50)},true);

/* 6. Closing the last document cancelled the pending autosave: the last seconds of work were lost */
/* a photo whose last save failed must not be closed silently: its latest edits would be gone */
const okToClose=async d=>{if(!d||d.nosave||d!==S.doc||SAVE.state!=='error')return true;
  await saveNow().catch(()=>{});if(SAVE.state!=='error')return true;
  return askConfirm('Cette photo n’a pas pu être enregistrée sur cet appareil : en la fermant, vous perdez ses dernières modifications. Exportez-la d’abord si vous voulez les garder.',{title:'Fermer sans enregistrer ?',ok:'Fermer quand même',danger:true})};
const _cd2=closeDoc;
closeDoc=function(){const d=S.doc,a=arguments,self=this;
  if(d&&!d.nosave&&(SAVE.timer||SAVE.again||SAVE.running||SAVE.state==='error')){
    flushSave().catch(()=>{}).then(()=>okToClose(d)).then(ok=>{if(ok&&S.doc===d)_cd2.apply(self,a)});return}
  return _cd2.apply(this,arguments)};

/* 7. TIFF files ignored their orientation tag (photos from scanners and some cameras came out sideways) */
function orientRGBA(im,o){const W=im.w,H=im.h,sw=o>=5,nw=sw?H:W,nh=sw?W:H,src=im.data,out=new Uint16Array(src.length);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let dx,dy;
    switch(o){case 2:dx=W-1-x;dy=y;break;case 3:dx=W-1-x;dy=H-1-y;break;case 4:dx=x;dy=H-1-y;break;case 5:dx=y;dy=x;break;case 6:dx=H-1-y;dy=x;break;case 7:dx=H-1-y;dy=W-1-x;break;default:dx=y;dy=W-1-x}
    const s=(y*W+x)*4,d=(dy*nw+dx)*4;out[d]=src[s];out[d+1]=src[s+1];out[d+2]=src[s+2];out[d+3]=src[s+3]}
  return{...im,w:nw,h:nh,data:out}}
const _dt=decodeTIFF;
decodeTIFF=async function(u8){const im=await _dt.apply(this,arguments);
  try{const T=tiffRead(u8);let ifd=T.ifds[0],best=0;for(const f of T.ifds){const w=T.val(f,256)||0,h=T.val(f,257)||0,sub=T.val(f,254)||0;if(!(sub&1)&&w*h>best){best=w*h;ifd=f}}
    const o=T.val(ifd,274);if(o>=2&&o<=8)return orientRGBA(im,o)}catch(e){console.warn('orientation TIFF',e)}
  return im};

/* 8. A project that cannot be opened (missing tile...) said nothing: explain, and leave the current work untouched */
const _olp2=openLocalProject;
openLocalProject=async function(id){try{return await _olp2.apply(this,arguments)}catch(e){console.error(e);busy(false);toast('Ce projet n’a pas pu être ouvert ('+(e&&e.message||e)+'). Vos autres projets ne sont pas touchés.',6000);return false}};

/* 9. Importing into the library reloaded the open photo from disk: its undo history and its tab were lost */
const _itl=importToLibrary;
importToLibrary=async function(){const d0=S.doc,st=d0?{history:S.history,hi:S.hi,meta:S.meta,sample:S.sample,maxHist:S.maxHist,zoom:S.zoom,panX:S.panX,panY:S.panY,fitted:S.fitted}:null;
  const r=await _itl.apply(this,arguments);
  try{if(d0&&S.doc&&S.doc!==d0&&S.doc.pid&&S.doc.pid===d0.pid&&inTabs(d0)&&!d0.nosave&&d0.saved){
      const t=PrismTabs.tabs.find(t=>t.doc===d0);await PrismTabs.activate(t);Object.assign(S,st);selChanged();markComp();renderHistory();updateUndo();requestRender()}}catch(e){console.warn('import',e)}
  return r};

/* 10. A virtual copy is intentional: the duplicate finder (and "supprimer les doublons") must never propose it for deletion */
const _fi3=MENU2.file.items;
MENU2.file.items=()=>{const a=_fi3();for(const it of a)if(it&&it.label==='Créer une copie virtuelle'&&!it.__fx){const f=it.fn;it.__fx=1;
  it.fn=async()=>{const o=S.doc&&S.doc.pid;await f();try{if(o&&S.doc&&S.doc.pid!==o){S.doc.lib=Object.assign(libOf(S.doc),{vc:o,at:Date.now()});scheduleSave(300)}}catch(e){}}}return a};
const _scan=scanDups;
scanDups=async function(){await _scan.apply(this,arguments);
  try{const vc=new Map(LIB.items.filter(i=>i.lib&&i.lib.vc).map(i=>[i.id,i.lib.vc]));
    if(vc.size&&LIB.dupGroups){LIB.dupGroups=LIB.dupGroups.map(g=>g.filter(id=>!(vc.has(id)&&g.includes(vc.get(id))))).filter(g=>g.length>1);LIB.dupSet=new Set(LIB.dupGroups.flat());if(LIB.open)renderLibrary()}}catch(e){}};

/* 11. A photo deleted from the library stayed open in its tab (and could silently come back when saved) */
const _ld=libDelete;
libDelete=async function(ids){const r=await _ld.apply(this,arguments);
  try{for(const t of [...PrismTabs.tabs]){if(t.doc!==S.doc&&t.doc.pid&&ids.includes(t.doc.pid)&&!(await IDB.get('projects',t.doc.pid))){t.doc.nosave=true;await PrismTabs.closeTab(t)}}}catch(e){console.warn('tabs',e)}
  return r};

/* 12. Renaming a photo from the library while it is open in another tab: the tab kept the old name and wrote it back on its next save */
const _lr=libRename;
libRename=async function(it,n){const r=await _lr.apply(this,arguments);
  try{n=(n||'').trim();if(n)for(const t of PrismTabs.tabs)if(t.doc!==S.doc&&t.doc.pid===it.id){t.doc.name=n;PrismTabs.draw()}}catch(e){}
  return r};

/* 13. In a long dialog (Exporter with presets and watermark on a 800 px screen) the buttons were below the fold: keep the footer in view */
{const st=document.createElement('style');st.textContent='.dlg .foot{position:sticky;bottom:0;z-index:3;background:var(--chrome)}';document.head.appendChild(st)}

/* 14. Rating or labelling a photo with the keyboard redrew the grid and dropped the focus: the next key (or arrow) did nothing */
const _rl3=renderLibrary;
renderLibrary=function(){let id=null,grid=false;
  try{const r=$('#library'),ae=document.activeElement;if(r&&ae&&r.contains(ae)&&!ae.matches('input,select,textarea')){const c=ae.closest('.lb-card');if(c)id=c.dataset.id;else if(ae.closest('#lbGrid'))grid=true}}catch(e){}
  const out=_rl3.apply(this,arguments);
  try{if((id||grid)&&(!document.activeElement||document.activeElement===document.body)){const r=$('#library'),t=(id&&r.querySelector('.lb-card[data-id="'+CSS.escape(id)+'"]'))||(grid&&r.querySelector('#lbGrid'));if(t)t.focus({preventScroll:true})}}catch(e){}
  return out};

/* 15. Garbage collection listed the blobs AFTER reading the manifests: a save finishing in between lost its thumbnail (or history record) to a gc started by the previous save.
   Now the blob list is taken first, only listed keys can be deleted, gc runs one at a time, and pinned keys are re-checked at delete time. */
let gcRun=null,gcAgain=false;
async function gcOnce(){
  const all=await IDB.keys('blobs');
  const ms=await IDB.all('projects'),keep=new Set();ms.forEach(m=>manifestKeys(m).forEach(k=>keep.add(k)));PIN.forEach(k=>keep.add(k));
  if(S.doc){if(S.doc.raw&&S.doc.raw.key)keep.add(S.doc.raw.key);for(const L of S.doc.layers)for(const c of [lcv(L),L.mask,L.fbase,L.so&&L.so.src]){const t=c&&encCache.get(c);t&&t.forEach(x=>keep.add(x.key))}}
  const hk=await (window.PrismHist?PrismHist.keep(keep,ms):[]);
  for(const k of all)if(!keep.has(k)&&!PIN.has(k)&&!String(k).startsWith('icc_')&&!hk.includes(k)){await IDB.del('blobs',k);await IDB.del('amap',k).catch(()=>{})}}
gcBlobs=function(){gcAgain=true;if(gcRun)return gcRun;
  gcRun=(async()=>{try{while(gcAgain){gcAgain=false;await gcOnce()}}finally{gcRun=null}})();return gcRun};

/* 16. "Exporter avec un profil ICC": the browser's own profile stayed in the JPEG, so the chosen one was never embedded (wrong colours). Also the EXIF was dropped
   and profiles larger than 64 KB were lost. The segments are rebuilt here: browser ICC removed, EXIF kept, chosen profile in as many APP2 segments as needed. */
async function jpegMetaICC(blob,exif,icc){const u=new Uint8Array(await blob.arrayBuffer());if(u[0]!==0xFF||u[1]!==0xD8)return blob;
  const keep=[u.subarray(0,2)];let p=2,ins=false;
  const add=()=>{if(ins)return;ins=true;if(exif&&exif.length<65000)keep.push(new Uint8Array([0xFF,0xE1,...be16(exif.length+8),0x45,0x78,0x69,0x66,0,0]),exif);
    const N=Math.ceil(icc.length/65000);for(let i=0;i<N;i++){const part=icc.subarray(i*65000,(i+1)*65000);keep.push(new Uint8Array([0xFF,0xE2,...be16(part.length+16),...[...'ICC_PROFILE'].map(c=>c.charCodeAt(0)),0,i+1,N]),part)}};
  while(p+4<u.length&&u[p]===0xFF){const mk=u[p+1];if(mk===0xDA)break;const len=(u[p+2]<<8)|u[p+3],seg=u.subarray(p,p+2+len);
    const isICC=mk===0xE2&&String.fromCharCode(...u.subarray(p+4,p+15))==='ICC_PROFILE',isExif=mk===0xE1&&String.fromCharCode(...u.subarray(p+4,p+8))==='Exif';
    if(!isICC&&!(isExif&&exif)){keep.push(seg);if(mk===0xE0)add()}p+=2+len}
  add();keep.push(u.subarray(p));return new Blob(keep,{type:'image/jpeg'})}
/* 17. "Garder la meilleure de chaque groupe" kept the OLDEST of two near-identical photos: an edited version (layers, adjustments, text) was deleted in favour of the untouched original */
const editScore=it=>{try{const m=it&&it.local;if(!m||!m.layers)return 0;let n=0;for(const L of m.layers){if(L.kind==='adjust'){if(!devIsId(L.dev))n+=2}else n+=1}return n}catch(e){return 0}};
window.PrismFx={jpegMetaICC,okToClose,editScore,saveParked};
})();

