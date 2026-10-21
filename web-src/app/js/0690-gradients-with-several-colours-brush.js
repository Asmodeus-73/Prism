/* ================= v18: gradients with several colours, brush dynamics and tips, clone overlay, tonal range for dodge/burn ================= */
(()=>{
S.bg=PREF.get('bgColor','#ffffff');
// ---------- gradients ----------
const GN={fgt:'Premier plan vers transparent',fgb:'Premier plan vers arrière-plan',bw:'Noir vers blanc',sun:'Coucher de soleil',rainbow:'Arc-en-ciel',duo:'Bleu vers orange',steel:'Acier',custom:'Personnalisé'};
const GPS={bw:[{t:0,c:'#000000',a:1},{t:1,c:'#ffffff',a:1}],
 sun:[{t:0,c:'#1b1b3a',a:1},{t:.4,c:'#b3446c',a:1},{t:.75,c:'#f7931e',a:1},{t:1,c:'#ffe29a',a:1}],
 rainbow:[{t:0,c:'#ff4d4d',a:1},{t:.2,c:'#ffb648',a:1},{t:.4,c:'#5fe39b',a:1},{t:.6,c:'#46b3ff',a:1},{t:.8,c:'#9a78ff',a:1},{t:1,c:'#ff6bd6',a:1}],
 duo:[{t:0,c:'#1f6fff',a:1},{t:1,c:'#ff8a2b',a:1}],steel:[{t:0,c:'#2b3340',a:1},{t:.5,c:'#8f9aab',a:1},{t:1,c:'#e7ecf3',a:1}]};
const GO=S.opts.gradient;GO.preset=PREF.get('gradPreset','fgt');GO.stops=PREF.get('gradStops',[{t:0,c:'#ff4d4d',a:1},{t:1,c:'#3d8bff',a:1}]);GO.reverse=false;
const saveG=()=>{PREF.set('gradPreset',GO.preset);PREF.set('gradStops',GO.stops)};
function stopsFor(color){let st;const p=GO.preset;
 if(p==='fgt')st=[{t:0,c:color,a:1},{t:1,c:color,a:0}];else if(p==='fgb')st=[{t:0,c:color,a:1},{t:1,c:S.bg,a:1}];else if(p==='custom')st=GO.stops.map(s=>({...s}));else st=(GPS[p]||GPS.bw).map(s=>({...s}));
 st.sort((a,b)=>a.t-b.t);if(GO.reverse)st=st.map(s=>({...s,t:1-s.t})).reverse();return st}
function paint(g,shape,dr,st,W,H){let gr;const dx=dr.x1-dr.x0,dy=dr.y1-dr.y0,r=Math.max(1,Math.hypot(dx,dy));
 const add=(arr,f)=>arr.forEach(s=>gr.addColorStop(clamp(f?f(s.t):s.t,0,1),hexA(s.c,s.a)));
 if(shape==='radial'){gr=g.createRadialGradient(dr.x0,dr.y0,0,dr.x0,dr.y0,r);const ar=st.length===2&&st[0].c===st[1].c&&st[0].a===1&&st[1].a===0;if(ar){gr.addColorStop(0,hexA(st[0].c,1));gr.addColorStop(.45,hexA(st[0].c,1));gr.addColorStop(1,hexA(st[0].c,0))}else add(st)}
 else if(shape==='angular'&&g.createConicGradient){gr=g.createConicGradient(Math.atan2(dy,dx),dr.x0,dr.y0);add(st)}
 else if(shape==='reflect'){gr=g.createLinearGradient(dr.x0-dx,dr.y0-dy,dr.x1,dr.y1);add(st,t=>.5+t/2);add(st,t=>.5-t/2)}
 else{gr=g.createLinearGradient(dr.x0,dr.y0,dr.x1,dr.y1);add(st)}
 g.fillStyle=gr;g.fillRect(0,0,W,H)}
const _gc=gradientCanvas;gradientCanvas=function(dr,color){const d=S.doc;
 if(GO.preset==='fgt'&&!GO.reverse&&(dr.shape==='linear'||dr.shape==='radial'))return _gc.apply(this,arguments);
 const m=mk(d.w,d.h),g=cx(m);let st;
 if(color===undefined){st=[{t:0,c:'#ffffff',a:1},{t:1,c:'#ffffff',a:0}];if(GO.reverse)st=[{t:0,c:'#ffffff',a:0},{t:1,c:'#ffffff',a:1}]}else st=stopsFor(color);
 paint(g,dr.shape,dr,st,d.w,d.h);return m};
// 16-bit painting: the same gradient in float, fill(x,y,w,h,o) writes straight colour 0..255 and alpha 0..1 for the pixel centres of a rectangle
window.gradF=function(dr,color){let st=stopsFor(color);const dx=dr.x1-dr.x0,dy=dr.y1-dr.y0,r=Math.max(1,Math.hypot(dx,dy)),L2=Math.max(1e-9,dx*dx+dy*dy),a0=Math.atan2(dy,dx),sh=dr.shape,N=65535;
 if(sh==='radial'&&st.length===2&&st[0].c===st[1].c&&st[0].a===1&&st[1].a===0)st=[st[0],{...st[0],t:.45},st[1]];
 const T=st.map(s=>clamp(s.t,0,1)),C=st.map(s=>{const n=parseInt(s.c.slice(1),16);return[n>>16&255,n>>8&255,n&255,s.a]}),n=st.length,lut=new Float32Array((N+1)*4);
 for(let i=0,k=0;i<=N;i++){const t=i/N;while(k<n-1&&T[k+1]<t)k++;const A=C[k],B=C[Math.min(n-1,k+1)],f=k>=n-1||t<=T[k]?0:T[k+1]>T[k]?(t-T[k])/(T[k+1]-T[k]):1;for(let c=0;c<4;c++)lut[i*4+c]=A[c]+(B[c]-A[c])*f}
 return{fill(x0,y0,w,h,o){for(let y=0;y<h;y++){const py=y0+y+.5-dr.y0;for(let x=0;x<w;x++){const px=x0+x+.5-dr.x0;let t;
   if(sh==='radial')t=Math.sqrt(px*px+py*py)/r;else if(sh==='angular'){t=(Math.atan2(py,px)-a0)/(2*Math.PI);t-=Math.floor(t)}else{t=(px*dx+py*dy)/L2;if(sh==='reflect'&&t<0)t=-t}
   const i=(t<=0?0:t>=1?N:(t*N+.5)|0)*4,j=(y*w+x)*4;o[j]=lut[i];o[j+1]=lut[i+1];o[j+2]=lut[i+2];o[j+3]=lut[i+3]}}}}};
const gradCss=st=>'linear-gradient(90deg,'+st.map(s=>`${hexA(s.c,s.a)} ${Math.round(s.t*100)}%`).join(',')+')';
function gradEditor(){const prev=JSON.parse(JSON.stringify(GO.stops));let sel=0;
 dialog({title:'Dégradé',body:`<label class="field">Modèle<select id="gdP">${Object.keys(GN).map(k=>`<option value="${k}" ${GO.preset===k?'selected':''}>${GN[k]}</option>`).join('')}</select></label>
 <div id="gdBar" style="position:relative;height:30px;border-radius:6px;border:1px solid var(--line-2);background:repeating-conic-gradient(#8884 0 25%,transparent 0 50%) 0 0/10px 10px"><div id="gdFill" style="position:absolute;inset:0;border-radius:5px"></div></div>
 <div id="gdHandles" style="position:relative;height:22px;margin-top:2px"></div>
 <div id="gdCtl" style="display:grid;grid-template-columns:auto 1fr auto;gap:8px 10px;align-items:center"><span>Couleur</span><input type="color" id="gdC" style="width:44px;height:28px"><span></span><span>Opacité</span><input type="range" id="gdA" min="0" max="100"><output id="gdAo">100 %</output><span>Position</span><input type="range" id="gdT" min="0" max="100"><output id="gdTo">0 %</output></div>
 <div class="muted" style="font-size:12px">Cliquez sur la barre pour ajouter une couleur, faites glisser les repères pour les déplacer. Pour une couleur propre, choisissez « Personnalisé ».</div>
 <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="gdR" ${GO.reverse?'checked':''}>Inverser</label>`,
 onOpen:el=>{const P=$('#gdP',el),fill=$('#gdFill',el),bar=$('#gdBar',el),hd=$('#gdHandles',el);
  const cur=()=>GO.preset==='custom'?GO.stops:(GO.preset==='fgt'||GO.preset==='fgb')?stopsFor(S.color).map(s=>({...s})):(GPS[GO.preset]||[]);
  const editable=()=>GO.preset==='custom';
  const draw=()=>{const st=cur().slice().sort((a,b)=>a.t-b.t);fill.style.background=gradCss(st.length?st:[{t:0,c:'#000',a:0},{t:1,c:'#000',a:0}]);hd.innerHTML='';
   if(editable())GO.stops.forEach((s,i)=>{const h=document.createElement('button');h.style.cssText=`position:absolute;left:calc(${s.t*100}% - 8px);top:0;width:16px;height:20px;border-radius:4px;border:2px solid ${i===sel?'var(--accent-fg)':'var(--line-2)'};background:${s.c};padding:0;cursor:grab`;h.dataset.i=i;hd.appendChild(h)});
   const s=GO.stops[sel]||{c:'#000000',a:1,t:0};$('#gdC',el).value=s.c;$('#gdA',el).value=Math.round(s.a*100);$('#gdAo',el).textContent=Math.round(s.a*100)+' %';$('#gdT',el).value=Math.round(s.t*100);$('#gdTo',el).textContent=Math.round(s.t*100)+' %';
   $('#gdCtl',el).style.opacity=editable()?1:.4;$('#gdCtl',el).style.pointerEvents=editable()?'auto':'none'};
  P.onchange=()=>{GO.preset=P.value;if(P.value==='custom'&&!GO.stops.length)GO.stops=JSON.parse(JSON.stringify(prev));sel=0;draw();saveG()};
  $('#gdR',el).onchange=e=>{GO.reverse=e.target.checked;draw()};
  $('#gdC',el).oninput=e=>{GO.stops[sel].c=e.target.value;draw();saveG()};
  $('#gdA',el).oninput=e=>{GO.stops[sel].a=+e.target.value/100;draw();saveG()};
  $('#gdT',el).oninput=e=>{GO.stops[sel].t=+e.target.value/100;draw();saveG()};
  bar.onpointerdown=e=>{if(!editable())return;const r=bar.getBoundingClientRect(),t=clamp((e.clientX-r.left)/r.width,0,1);const st=cur().slice().sort((a,b)=>a.t-b.t);let c='#808080',a=1;for(let i=0;i<st.length-1;i++)if(t>=st[i].t&&t<=st[i+1].t){c=st[i].c;a=st[i].a;break}GO.stops.push({t,c,a});sel=GO.stops.length-1;draw();saveG()};
  hd.onpointerdown=e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();sel=+b.dataset.i;draw();const r=bar.getBoundingClientRect();const mv=ev=>{GO.stops[sel].t=clamp((ev.clientX-r.left)/r.width,0,1);draw()};const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);saveG()};addEventListener('pointermove',mv);addEventListener('pointerup',up)};
  hd.ondblclick=e=>{if(GO.stops.length>2&&e.target.closest('button')){GO.stops.splice(sel,1);sel=0;draw();saveG()}};
  draw()},buttons:[{label:'Fermer',primary:true,onClick:()=>{saveG();renderPill()}}]})}
PILL_ACT.gradEdit=gradEditor;
const _pe2=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe2.apply(this,arguments)||'';
 if(t==='gradient'){const onMask=(()=>{const A=AL();return A&&(A.kind==='adjust'||(A.mask&&A.editMask))})();
  if(!onMask)h+=`<label>Couleurs<select data-sel="gradient.preset" id="gdPill">${Object.keys(GN).map(k=>`<option value="${k}" ${GO.preset===k?'selected':''}>${GN[k]}</option>`).join('')}</select></label><button class="btn sm" data-act="gradEdit" title="Modifier les couleurs du dégradé">Modifier…</button><label>Arrière-plan<input type="color" class="swatch" id="optBg" value="${esc(S.bg)}" aria-label="Couleur d’arrière-plan"></label>`;
  h+=`<label><input type="checkbox" data-chk="gradient.reverse" ${GO.reverse?'checked':''}>Inverser</label>`}
 return h};
document.addEventListener('input',e=>{if(e.target&&e.target.id==='optBg'){S.bg=e.target.value;PREF.set('bgColor',S.bg)}});
document.addEventListener('change',e=>{if(e.target&&e.target.id==='gdPill'){GO.preset=e.target.value;saveG();renderPill()}});
// X swaps the foreground and background colours
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()!=='x'||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;const t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable))return;if(!S.doc||(typeof LIB!=='undefined'&&LIB.open)||$('#scrim'))return;
 e.preventDefault();e.stopImmediatePropagation();const a=S.color;S.color=S.bg;S.bg=a;PREF.set('bgColor',S.bg);const f=$('#fg');if(f)f.value=S.color;const oc=$('#optColor');if(oc)oc.value=S.color;const ob=$('#optBg');if(ob)ob.value=S.bg;toast('Couleurs inversées')},true);
// ---------- brush dynamics and tips ----------
for(const k of['brush','eraser']){const o=S.opts[k];if(o.spacing==null)o.spacing=PREF.get('spacing_'+k,12);if(o.pressSize==null)o.pressSize=true;if(o.tip==null)o.tip=PREF.get('tip_'+k,'round');if(o.angle==null)o.angle=0;if(o.round==null)o.round=100}
for(const k of['clone'])if(S.opts[k].spacing==null)S.opts[k].spacing=12;
const TIPS={round:'Rond',square:'Carré',chalk:'Craie',splat:'Éclaboussure',line:'Calligraphie'};let CUSTOM=PREF.get('brushTips',[]);const TIPIMG=new Map();
function tipLoad(i){const t=CUSTOM[i];if(!t)return null;let r=TIPIMG.get(t.id);if(!r){r=new Image();r.src=t.url;TIPIMG.set(t.id,r)}return r.complete&&r.naturalWidth?r:null}
function rnd(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646}}
const _sf=stampFor;stampFor=function(size,hard,color){const t=S.tool;if(t!=='brush'&&t!=='eraser')return _sf.apply(this,arguments);const o=S.opts[t],tip=o.tip||'round';if(tip==='round'&&!o.angle&&(o.round||100)>=100)return _sf.apply(this,arguments);
 const s=Math.max(2,Math.ceil(size)),c=mk(s,s),g=cx(c),col=color||'#000000';g.save();g.translate(s/2,s/2);g.rotate((o.angle||0)*Math.PI/180);g.scale(1,Math.max(.08,(o.round||100)/100));g.translate(-s/2,-s/2);
 if(tip==='square'){g.fillStyle='#000';g.fillRect(s*.06,s*.06,s*.88,s*.88)}
 else if(tip==='line'){g.fillStyle='#000';g.beginPath();g.ellipse(s/2,s/2,s*.46,s*.12,0,0,7);g.fill()}
 else if(tip==='chalk'||tip==='splat'){const R=rnd(tip==='chalk'?11:5);g.fillStyle='#000';const n=tip==='chalk'?Math.round(s*s*.5):14;for(let i=0;i<n;i++){const a=R()*6.283,rr=Math.sqrt(R())*s*.45,r=tip==='chalk'?Math.max(.6,s*.012):s*(.04+R()*.1);g.globalAlpha=tip==='chalk'?.25+R()*.75:1;g.beginPath();g.arc(s/2+Math.cos(a)*rr,s/2+Math.sin(a)*rr,r,0,7);g.fill()}}
 else if(String(tip).startsWith('c:')){const im=tipLoad(+tip.slice(2));if(im)g.drawImage(im,0,0,s,s);else{g.fillStyle='#000';g.beginPath();g.arc(s/2,s/2,s/2,0,7);g.fill()}}
 else{g.fillStyle='#000';g.beginPath();g.arc(s/2,s/2,s/2,0,7);g.fill()}
 g.restore();if(hard<.95&&!String(tip).startsWith('c:')&&'filter'in g&&tip!=='chalk'&&tip!=='splat'){const t2=mk(s,s),g2=cx(t2);g2.filter=`blur(${Math.round((1-hard)*s*.12)}px)`;g2.drawImage(c,0,0);g.clearRect(0,0,s,s);g.drawImage(t2,0,0)}
 g.globalCompositeOperation='source-in';g.fillStyle=col;g.fillRect(0,0,s,s);return c};
/* Photoshop brushes (.abr, versions 1, 2, 6 and later): the sampled tips, as grey levels (255 = paint). Computed round tips are skipped. */
function parseABR(u8){const v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),out=[];let p=0,px=0;const room=(w,h)=>out.length<12&&(px+=w*h)<=64e6;const u16=()=>{const x=v.getUint16(p);p+=2;return x},u32=()=>{const x=v.getUint32(p);p+=4;return x},i32=()=>{const x=v.getInt32(p);p+=4;return x};
  const sample=(w,h,depth,comp)=>{const bpp=depth>>3,n=w*h*bpp,raw=new Uint8Array(n);
    if(!comp){if(p+n>u8.length)throw new Error('pointe tronquée');raw.set(u8.subarray(p,p+n));p+=n}
    else{if(p+2*h>u8.length)throw new Error('pointe tronquée');const rows=[];for(let y=0;y<h;y++)rows.push(u16());let o=0;for(const len of rows){const end=p+len;while(p<end&&o<n){const c=(u8[p++]<<24)>>24;if(c>=0){for(let k=0;k<=c&&o<n;k++)raw[o++]=u8[p++]}else if(c!==-128){const b=u8[p++];for(let k=0;k<1-c&&o<n;k++)raw[o++]=b}}p=end}}
    if(bpp===1)return raw;const g=new Uint8Array(w*h);for(let i=0;i<w*h;i++)g[i]=raw[i*2];return g};
  const ver=u16();
  if(ver===1||ver===2){const count=u16();for(let i=0;i<count;i++){const type=u16(),size=u32(),next=p+size;
      if(type===2){p+=4;p+=2;let name='';if(ver===2){const L=u32();for(let k=0;k<L;k++){const c=u16();if(c)name+=String.fromCharCode(c)}}p+=1+8;const t=i32(),l=i32(),b=i32(),r=i32(),depth=u16(),comp=u8[p++];
        const w=r-l,h=b-t;if(w>0&&h>0&&w*h<=16e6&&(depth===8||depth===16)&&room(w,h))out.push({name,w,h,data:sample(w,h,depth,comp)})}
      p=next}return out}
  if(ver<6||ver>10)throw new Error('version '+ver);const sub=u16();
  while(p+12<=u8.length){if(String.fromCharCode(u8[p],u8[p+1],u8[p+2],u8[p+3])!=='8BIM')break;const key=String.fromCharCode(u8[p+4],u8[p+5],u8[p+6],u8[p+7]);p+=8;const len=u32(),end=p+len;
    if(key==='samp'){while(p+4<end){let size=u32();while(size%4)size++;const next=p+size;p+=sub===1?47:301;const t=i32(),l=i32(),b=i32(),r=i32(),depth=u16(),comp=u8[p++],w=r-l,h=b-t;
        if(w>0&&h>0&&w*h<=16e6&&(depth===8||depth===16)&&room(w,h)){try{out.push({name:'',w,h,data:sample(w,h,depth,comp)})}catch(e){}}p=next}}
    p=end+(len&1?1:0)}
  return out}
window.PrismABR=parseABR;
/* an ABR tip as a black image whose opacity is the tip, ready for importTip */
async function abrTipFile(t,i,base){const c=mk(t.w,t.h),g=cx(c),im=g.createImageData(t.w,t.h);for(let k=0;k<t.w*t.h;k++)im.data[k*4+3]=t.data[k];g.putImageData(im,0,0);
  const b=await new Promise(r=>c.toBlob(r,'image/png'));return new File([b],(t.name||base+' '+(i+1))+'.png',{type:'image/png'})}
function importTip(file){return new Promise(res=>{const im=new Image();im.onload=()=>{const N=128,c=mk(N,N),g=cx(c);const sc=Math.min(N/im.width,N/im.height);g.drawImage(im,(N-im.width*sc)/2,(N-im.height*sc)/2,im.width*sc,im.height*sc);const a=rx(c).getImageData(0,0,N,N),d=a.data;let hasAlpha=false;for(let i=3;i<d.length;i+=4)if(d[i]<250){hasAlpha=true;break}
  for(let i=0;i<d.length;i+=4){const al=hasAlpha?d[i+3]:255-(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]);d[i]=d[i+1]=d[i+2]=0;d[i+3]=al}g.putImageData(a,0,0);done(c.toDataURL('image/png'))};const u=URL.createObjectURL(file),done=r=>{URL.revokeObjectURL(u);res(r)};im.onerror=()=>done(null);im.src=u})}
function traitDialog(){const t=S.tool==='eraser'?'eraser':S.tool==='clone'?'clone':'brush',o=S.opts[t];
 const tipOpts=Object.keys(TIPS).map(k=>`<option value="${k}" ${o.tip===k?'selected':''}>${TIPS[k]}</option>`).join('')+CUSTOM.map((c,i)=>`<option value="c:${i}" ${o.tip==='c:'+i?'selected':''}>${esc(c.name)}</option>`).join('');
 dialog({title:t==='eraser'?'Gomme : réglages du trait':t==='clone'?'Tampon : réglages du trait':'Pinceau : réglages du trait',body:`${t==='clone'?'':`<label class="field">Forme de la pointe<select id="trTip">${tipOpts}</select></label><div class="row"><button class="btn sm" id="trImp">Importer une pointe (image ou .abr)…</button><span class="muted" style="font-size:12px">Les zones sombres ou opaques de l’image deviennent la forme du pinceau.</span></div>`}
 ${rangeRow('trSp','Espacement',1,200,1,o.spacing||12,' %')}${t==='clone'?'':rangeRow('trAng','Angle de la pointe',-180,180,1,o.angle||0,'°')+rangeRow('trRd','Aplatissement',8,100,1,o.round||100,' %')}${rangeRow('trSm','Lissage du trait',0,100,1,o.smooth||0,' %')}
 ${t==='clone'?'':`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="trPr" ${o.pressSize!==false?'checked':''}>Le stylet fait varier la taille (pression)</label>`}`,
 onOpen:el=>{const bind=(id,k,f=1)=>{const r=$('#'+id,el);if(!r)return;r.oninput=()=>{o[k]=+r.value*f;$('#'+id+'-o',el).textContent=r.value+(id==='trAng'?'°':' %');if(k==='spacing')PREF.set('spacing_'+t,o.spacing)}};bind('trSp','spacing');bind('trAng','angle');bind('trRd','round');bind('trSm','smooth');
  const pr=$('#trPr',el);if(pr)pr.onchange=()=>{o.pressSize=pr.checked};const tp=$('#trTip',el);if(tp)tp.onchange=()=>{o.tip=tp.value;PREF.set('tip_'+t,o.tip);if(/^(chalk|splat)$/.test(o.tip)||o.tip.startsWith('c:')){o.spacing=o.tip.startsWith('c:')?25:20;$('#trSp',el).value=o.spacing;$('#trSp-o',el).textContent=o.spacing+' %'}};
  const im=$('#trImp',el);if(im)im.onclick=()=>{const f=document.createElement('input');f.type='file';f.accept='image/*,.abr';f.onchange=async()=>{const file=f.files[0];if(!file)return;
    if(/\.abr$/i.test(file.name)){let tips=[];try{tips=parseABR(new Uint8Array(await file.arrayBuffer()))}catch(e){console.error(e)}
      if(!tips.length){toast('Aucune pointe utilisable dans ce fichier de pinceaux (seules les pointes dessinées sont reprises).',5000);return}
      const base=file.name.replace(/\.abr$/i,'').slice(0,18),add=[];for(let i=0;i<tips.length&&add.length<12;i++){const url=await importTip(await abrTipFile(tips[i],i,base));if(url)add.push({id:Date.now()+i,name:(tips[i].name||base+' '+(i+1)).slice(0,24),url})}
      CUSTOM=[...CUSTOM,...add].slice(-12);PREF.set('brushTips',CUSTOM);o.tip='c:'+(CUSTOM.length-add.length);PREF.set('tip_'+t,o.tip);closeDialog();traitDialog();
      toast(add.length+' pointe'+(add.length>1?'s':'')+' Photoshop ajoutée'+(add.length>1?'s':'')+(tips.length>add.length?' (les 12 premières)':'')+'.',4000);return}
    const url=await importTip(file);if(!url){toast('Image illisible.');return}CUSTOM=[...CUSTOM,{id:Date.now(),name:(file.name||'Pointe').replace(/\.[a-z0-9]+$/i,'').slice(0,24),url}].slice(-12);PREF.set('brushTips',CUSTOM);const i=CUSTOM.length-1;o.tip='c:'+i;PREF.set('tip_'+t,o.tip);closeDialog();traitDialog();toast('Pointe ajoutée au pinceau.')};f.click()}},
 buttons:[{label:'Fermer',primary:true,onClick:()=>{renderPill()}}]})}
PILL_ACT.trait=traitDialog;
const _pe3=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe3.apply(this,arguments)||'';if(t==='brush'||t==='eraser'||t==='clone')h+=`<button class="btn sm" data-act="trait" title="Pointe, espacement, angle, lissage, pression du stylet">Trait…</button>`;return h};
// smoothing also for the clone stamp
const _ms2=moveStroke;moveStroke=function(p,e){const st=S.stroke;if(st&&st.tool==='clone'){const k=(S.opts.clone.smooth||0)/100;if(k>0){const q=st.sm||(st.sm={x:st.last.x,y:st.last.y}),a=1-k*.93;q.x+=(p.x-q.x)*a;q.y+=(p.y-q.y)*a;p={x:q.x,y:q.y}}}return _ms2.call(this,p,e)};
// ---------- clone overlay: shows the source pixels inside the brush ring ----------
S.opts.clone.overlay=PREF.get('cloneOverlay',true);
const _pe4=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe4.apply(this,arguments)||'';if(t==='clone'||(t==='heal'&&o.heal.mode==='source'))h+=`<label title="Aperçu de la source dans le pinceau"><input type="checkbox" data-chk="clone.overlay" ${S.opts.clone.overlay?'checked':''}>Aperçu</label>`;return h};
document.addEventListener('change',e=>{if(e.target&&e.target.dataset&&e.target.dataset.chk==='clone.overlay')PREF.set('cloneOverlay',e.target.checked)});
const _dov=drawOverlays;drawOverlays=function(c,pr){_dov.apply(this,arguments);try{const t=S.tool,p=S.pointer;if(!S.opts.clone.overlay||!p||!p.inside||S.spaceDown||S.stroke||!S.doc||!S.cloneSrc)return;if(!(t==='clone'||(t==='heal'&&S.opts.heal.mode==='source')))return;
 let sx,sy;if(S.cloneOff&&S.opts.clone.aligned&&t==='clone'){sx=p.dx+S.cloneOff.x;sy=p.dy+S.cloneOff.y}else{sx=S.cloneSrc.x;sy=S.cloneSrc.y}
 const o=S.opts[t],r=o.size/2,rs=r*S.zoom;c.save();c.setTransform(pr,0,0,pr,0,0);c.beginPath();c.arc(p.cx,p.cy,Math.max(rs,2),0,7);c.clip();c.globalAlpha=.55;c.drawImage(flatSync(),sx-r,sy-r,o.size,o.size,p.cx-rs,p.cy-rs,rs*2,rs*2);c.restore()}catch(e){}};
// ---------- dodge/burn: tonal range ----------
S.opts.dodge.range=PREF.get('dodgeRange','all');
window.toneW=function(r,g,b){const rg=S.opts.dodge.range;if(!rg||rg==='all')return 1;const l=(0.2126*r+0.7152*g+0.0722*b)/255;return rg==='shadows'?Math.pow(1-l,2):rg==='high'?l*l:Math.max(0,1-Math.pow((l-.5)*2,2))};
const _pe5=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe5.apply(this,arguments)||'';if(t==='dodge'){const m=o.dodge.mode;if(m==='dodge'||m==='burn'||m==='saturate'||m==='desaturate')h+=`<label>Tons<select data-sel="dodge.range" id="dgRange">${[['all','Tous'],['shadows','Foncés'],['mid','Moyens'],['high','Clairs']].map(([v,l])=>`<option value="${v}" ${o.dodge.range===v?'selected':''}>${l}</option>`).join('')}</select></label>`}return h};
document.addEventListener('change',e=>{if(e.target&&e.target.id==='dgRange')PREF.set('dodgeRange',e.target.value)});
})();

