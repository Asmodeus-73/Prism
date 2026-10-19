/* ===== lutxmp: import of colour LUTs (.cube) and Lightroom / Camera Raw presets (.xmp) =====
   Design
   - A LUT is applied by a normal adjust layer: L.dev.lut = {id, name, k}. k = Intensité 0..100. The key only exists when a LUT is set, so devIsId(dev) is false
     for such layers and the renderers do not skip them. Everything else of dev (sliders) keeps working and runs BEFORE the LUT.
   - Rendering: applyAdjust (8-bit stack) and devFloat (16-bit / float stack) are wrapped. The LUT stage runs on the CPU (tetrahedral interpolation,
     1D shaper first when a file has both), respecting the layer mask and opacity. No GPU stage: a 3D texture stage in the develop shader was judged too
     invasive; the CPU stage is exact and costs about 30-60 ms per Mpx.
   - Library: IndexedDB 'prism-looks' (own database, does not touch the project DB). Items: {id, kind:'cube'|'xmp', name, ...}. Projects embed the LUTs
     they use (manifest.luts, 16-bit quantised, base64) and import them back on load, so a project opens identically on another machine.
   - XMP mapping (Lightroom crs: -> Prism dev), ranges in brackets:
       Exposure2012 [-5,5 EV] -> exposure (same unit)            Contrast2012/Highlights2012/Shadows2012/Whites2012/Blacks2012 [-100,100] -> same names
       Texture, Clarity2012, Dehaze, Vibrance, Saturation [-100,100] -> texture, clarity, dehaze, vibrance, saturation
       Temperature: |v|<=100 taken as relative; otherwise Kelvin: (K-5500)/50 clamped to [-100,100] (approximate, Prism has no Kelvin scale)
       Tint [-150,150] -> tint * 100/150            ConvertToGrayscale=True -> saturation -100
       Sharpness [0,150] -> sharpen, SharpenRadius [0.5,3] -> sharpRadius, LuminanceSmoothing [0,100] -> noise
       ToneCurvePV2012 / Red / Green / Blue (points "x, y" on 0..255) -> curve.rgb / r / g / b (0..1)
       HueAdjustment/SaturationAdjustment/LuminanceAdjustment + Red,Orange,Yellow,Green,Aqua,Blue,Purple,Magenta [-100,100] -> hslH/hslS/hslL[0..7]
       SplitToningShadowHue/Saturation, SplitToningHighlightHue/Saturation, SplitToningBalance -> shH/shS, hiH/hiS, balance
       ColorGradeMidtoneHue/Sat -> midH/midS
       PostCropVignetteAmount/Midpoint/Feather -> vignette, vigMid, vigFeather      GrainAmount/GrainSize -> grain, grainSize
     Everything else (parametric curve, colour-grade luminance/global/blending, lens, calibration, masks, embedded RGBTable looks...) is counted as ignored. */
(function(){
'use strict';
const LK={items:new Map(),loaded:false,_p:null,warned:new Set()};
window.LUTX=LK;
const CRS='http://ns.adobe.com/camera-raw-settings/1.0/';

/* ---------------------------------------------------------------- .cube parser */
function parseCube(text,fname){
  const bad=m=>{throw new Error('Fichier .cube invalide : '+m)};
  const lines=String(text).replace(/^﻿/,'').split(/\r\n|\r|\n/);
  let title=(fname||'LUT').replace(/\.cube$/i,''),n1=0,n3=0,dmin=[0,0,0],dmax=[1,1,1],r1=null,r3=null;const rows=[];
  const num=s=>{const v=parseFloat(s);return v};
  for(let raw of lines){const h=raw.indexOf('#');if(h>=0)raw=raw.slice(0,h);const s=raw.trim();if(!s)continue;
    const c=s.charCodeAt(0);
    if((c>=48&&c<=57)||c===45||c===43||c===46){const t=s.split(/\s+/);if(t.length<3)bad('ligne de données incomplète');const a=num(t[0]),b=num(t[1]),d=num(t[2]);if(!isFinite(a)||!isFinite(b)||!isFinite(d))bad('valeur non numérique');rows.push(a,b,d);continue}
    const t=s.split(/\s+/),k=t[0].toUpperCase();
    if(k==='TITLE'){const m=/"([^"]*)"/.exec(s);const v=(m?m[1]:t.slice(1).join(' ')).trim();if(v)title=v}
    else if(k==='DOMAIN_MIN'){dmin=[num(t[1]),num(t[2]),num(t[3])];if(dmin.some(v=>!isFinite(v)))bad('DOMAIN_MIN')}
    else if(k==='DOMAIN_MAX'){dmax=[num(t[1]),num(t[2]),num(t[3])];if(dmax.some(v=>!isFinite(v)))bad('DOMAIN_MAX')}
    else if(k==='LUT_1D_SIZE'){n1=parseInt(t[1],10)}
    else if(k==='LUT_3D_SIZE'){n3=parseInt(t[1],10)}
    else if(k==='LUT_1D_INPUT_RANGE'){r1=[num(t[1]),num(t[2])]}
    else if(k==='LUT_3D_INPUT_RANGE'){r3=[num(t[1]),num(t[2])]}
    /* unknown keywords (LUT_IN_VIDEO_RANGE, etc.) are ignored */
  }
  if(!(n1>=2)&&!(n3>=2))bad('ni LUT_1D_SIZE ni LUT_3D_SIZE');
  if(n1&&(n1<2||n1>65536))bad('LUT_1D_SIZE hors limites');
  if(n3&&(n3<2||n3>129))bad('LUT_3D_SIZE hors limites (2 à 129)');
  const need=(n1>=2?n1:0)+(n3>=2?n3*n3*n3:0);
  if(rows.length/3!==need)bad(`${rows.length/3} lignes de données au lieu de ${need}`);
  for(let i=0;i<3;i++)if(!(dmax[i]>dmin[i]))bad('DOMAIN_MAX doit dépasser DOMAIN_MIN');
  const rec={kind:'cube',name:title,dmin,dmax,n1:0,n3:0,t1:null,t3:null};
  let o=0;
  if(n1>=2){rec.n1=n1;rec.t1=Float32Array.from(rows.slice(0,n1*3));o=n1*3;if(r1){rec.dmin1=[r1[0],r1[0],r1[0]];rec.dmax1=[r1[1],r1[1],r1[1]]}}
  if(n3>=2){rec.n3=n3;rec.t3=Float32Array.from(rows.slice(o));if(r3){rec.dmin=[r3[0],r3[0],r3[0]];rec.dmax=[r3[1],r3[1],r3[1]]}}
  return rec}

/* ---------------------------------------------------------------- LUT evaluation */
/* a: Uint8ClampedArray (mx=255) or Float32Array (mx=1) RGBA, W x H. flip: rows are bottom-up (float stack).
   amt: 0..1 (intensity x layer opacity). mask: top-down RGBA bytes or null. */
function lutRun(a,W,H,flip,mx,lu,amt,mask){
  if(amt<=0)return;
  const n1=lu.n1,t1=lu.t1,n3=lu.n3,t3=lu.t3,inv=1/mx;
  const d0=lu.dmin,d1=lu.dmax,e0=lu.dmin1||d0,e1=lu.dmax1||d1;
  const s1=[0,1,2].map(i=>1/(e1[i]-e0[i])),s3=[0,1,2].map(i=>1/(d1[i]-d0[i]));
  const m1=n1-1,m3=n3-1,sG=n3,sB=n3*n3;
  const mix=new Float32Array(3);
  for(let y=0;y<H;y++){const ry=flip?(H-1-y):y;
    for(let x=0;x<W;x++){const j=(ry*W+x)*4;
      let m=amt;if(mask)m*=mask[(y*W+x)*4+3]/255;if(m<=0)continue;
      let r=a[j]*inv,g=a[j+1]*inv,b=a[j+2]*inv;const r0=r,g0=g,b0=b;
      if(n1>=2){
        let p;
        p=(r-e0[0])*s1[0];p=p<0?0:p>1?1:p;p*=m1;let i=p|0;if(i>=m1)i=m1-1;let f=p-i;r=t1[i*3]+(t1[(i+1)*3]-t1[i*3])*f;
        p=(g-e0[1])*s1[1];p=p<0?0:p>1?1:p;p*=m1;i=p|0;if(i>=m1)i=m1-1;f=p-i;g=t1[i*3+1]+(t1[(i+1)*3+1]-t1[i*3+1])*f;
        p=(b-e0[2])*s1[2];p=p<0?0:p>1?1:p;p*=m1;i=p|0;if(i>=m1)i=m1-1;f=p-i;b=t1[i*3+2]+(t1[(i+1)*3+2]-t1[i*3+2])*f}
      if(n3>=2){
        let px=(r-d0[0])*s3[0],py=(g-d0[1])*s3[1],pz=(b-d0[2])*s3[2];
        px=px<0?0:px>1?1:px;py=py<0?0:py>1?1:py;pz=pz<0?0:pz>1?1:pz;px*=m3;py*=m3;pz*=m3;
        let ix=px|0,iy=py|0,iz=pz|0;if(ix>=m3)ix=m3-1;if(iy>=m3)iy=m3-1;if(iz>=m3)iz=m3-1;
        const fx=px-ix,fy=py-iy,fz=pz-iz,o=(ix+iy*sG+iz*sB)*3;
        const o100=o+3,o010=o+sG*3,o001=o+sB*3,o110=o010+3,o101=o001+3,o011=o001+sG*3,o111=o011+3;
        for(let c=0;c<3;c++){const c000=t3[o+c],c100=t3[o100+c],c010=t3[o010+c],c001=t3[o001+c],c110=t3[o110+c],c101=t3[o101+c],c011=t3[o011+c],c111=t3[o111+c];let v;
          if(fx>=fy){if(fy>=fz)v=c000+fx*(c100-c000)+fy*(c110-c100)+fz*(c111-c110);else if(fx>=fz)v=c000+fx*(c100-c000)+fz*(c101-c100)+fy*(c111-c101);else v=c000+fz*(c001-c000)+fx*(c101-c001)+fy*(c111-c101)}
          else{if(fz>=fy)v=c000+fz*(c001-c000)+fy*(c011-c001)+fx*(c111-c011);else if(fz>=fx)v=c000+fy*(c010-c000)+fz*(c011-c010)+fx*(c111-c011);else v=c000+fy*(c010-c000)+fx*(c110-c010)+fz*(c111-c110)}
          mix[c]=v}
        r=mix[0];g=mix[1];b=mix[2]}
      r=r<0?0:r>1?1:r;g=g<0?0:g>1?1:g;b=b<0?0:b>1?1:b;
      a[j]=(r0+(r-r0)*m)*mx;a[j+1]=(g0+(g-g0)*m)*mx;a[j+2]=(b0+(b-b0)*m)*mx}}}
LK.lutRun=lutRun;LK.parseCube=parseCube;

/* ---------------------------------------------------------------- renderer hooks */
const stripLut=dv=>{const o={...dv};delete o.lut;return o};
function getLut(lt){const r=LK.items.get(lt.id);if(r&&r.kind==='cube')return r;
  if(!LK.loaded){LK.load().then(()=>{try{markComp()}catch(e){}})}
  else if(!LK.warned.has(lt.id)){LK.warned.add(lt.id);try{toast('La LUT « '+(lt.name||'?')+' » n’est plus dans la bibliothèque : réimportez-la.',5000)}catch(e){}}
  return null}
{const _aa=applyAdjust;
 applyAdjust=function(tc,W,H,L,mc,o){const lt=L.dev&&L.dev.lut;if(!lt)return _aa.apply(this,arguments);
  const rest=stripLut(L.dev);if(!devIsId(rest))_aa(tc,W,H,{...L,dev:rest},mc,o);
  const lu=getLut(lt);if(!lu)return;
  const img=tc.getImageData(0,0,W,H);
  lutRun(img.data,W,H,false,255,lu,(lt.k==null?100:lt.k)/100*L.opacity,mc?rx(mc).getImageData(0,0,W,H).data:null);
  tc.putImageData(img,0,0)};
 const _df=devFloat;
 devFloat=function(F,W,H,L,mc,o){const lt=L.dev&&L.dev.lut;if(!lt)return _df.apply(this,arguments);
  const rest=stripLut(L.dev);if(!devIsId(rest))F=_df(F,W,H,{...L,dev:rest},mc,o);
  const lu=getLut(lt);if(!lu)return F;
  lutRun(F,W,H,true,1,lu,(lt.k==null?100:lt.k)/100*L.opacity,mc?rx(mc).getImageData(0,0,W,H).data:null);return F}}

/* ---------------------------------------------------------------- library (IndexedDB 'prism-looks') */
const DB={db:null,open(){if(this.db)return this.db;this.db=new Promise((res,rej)=>{let r;try{r=indexedDB.open('prism-looks',1)}catch(e){rej(e);return}
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('items'))r.result.createObjectStore('items',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});this.db.catch(()=>{});return this.db},
  async tx(mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('items',mode);let out;const q=fn(t.objectStore('items'));if(q)q.onsuccess=()=>out=q.result;t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
  put(rec){return this.tx('readwrite',s=>s.put(rec))},del(id){return this.tx('readwrite',s=>s.delete(id))},all(){return this.tx('readonly',s=>s.getAll())}};
LK.load=function(){if(this._p)return this._p;this._p=DB.all().then(a=>{for(const r of a||[])if(!LK.items.has(r.id))LK.items.set(r.id,r);LK.loaded=true;return LK.items}).catch(e=>{LK.loaded=true;console.warn('bibliothèque de looks indisponible',e);return LK.items});return this._p};
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};
function fpCube(rec){let h=2166136261;const mix=t=>{if(!t)return;const st=Math.max(1,(t.length/4096)|0);for(let i=0;i<t.length;i+=st){h^=Math.round(t[i]*65535);h=Math.imul(h,16777619)}};mix(rec.t1);mix(rec.t3);return (h>>>0).toString(36)+'_'+rec.n1+'_'+rec.n3}
async function addItem(rec){await LK.load();LK.items.set(rec.id,rec);try{await DB.put(rec)}catch(e){console.warn(e)}return rec}
LK.remove=async function(id){LK.items.delete(id);try{await DB.del(id)}catch(e){console.warn(e)}};

LK.packLut=null;LK.unpackLut=null;
/* embed / restore in projects */
const b64=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
const q16=t=>{if(!t)return null;const u=new Uint16Array(t.length);for(let i=0;i<t.length;i++){const v=t[i];u[i]=v<=0?0:v>=1?65535:Math.round(v*65535)}return b64(new Uint8Array(u.buffer))};
const dq16=s=>{if(!s)return null;const u8=unb64(s),u=new Uint16Array(u8.buffer,u8.byteOffset,u8.length>>1),t=new Float32Array(u.length);for(let i=0;i<u.length;i++)t[i]=u[i]/65535;return t};
function packLut(r){return{id:r.id,name:r.name,dmin:r.dmin,dmax:r.dmax,dmin1:r.dmin1,dmax1:r.dmax1,n1:r.n1,n3:r.n3,t1:q16(r.t1),t3:q16(r.t3)}}
function unpackLut(p){return{id:p.id,kind:'cube',name:p.name,dmin:p.dmin,dmax:p.dmax,dmin1:p.dmin1,dmax1:p.dmax1,n1:p.n1,n3:p.n3,t1:dq16(p.t1),t3:dq16(p.t3),t:Date.now()}}
LK.packLut=packLut;LK.unpackLut=unpackLut;
{const _bm=buildManifest;
 buildManifest=async function(d){const m=await _bm.apply(this,arguments);
  try{const D=d||S.doc;if(m&&D&&!(typeof noThumb!=='undefined'&&noThumb)){const ids=new Set();D.layers.forEach(l=>{if(l.kind==='adjust'&&l.dev&&l.dev.lut)ids.add(l.dev.lut.id)});
    if(ids.size){const o={};ids.forEach(id=>{const r=LK.items.get(id);if(r&&r.kind==='cube')o[id]=packLut(r)});if(Object.keys(o).length)m.luts=o}}}catch(e){console.warn('luts',e)}
  return m};
 const _lm=loadManifest;
 loadManifest=async function(m){try{if(m&&m.luts){await LK.load();for(const id in m.luts){if(!LK.items.has(id)){const r=unpackLut(m.luts[id]);LK.items.set(id,r);DB.put(r).catch(()=>{})}}}}catch(e){console.warn('luts',e)}
  return _lm.apply(this,arguments)}}

/* ---------------------------------------------------------------- .xmp parser + mapping */
const META=new Set(['Version','ProcessVersion','PresetType','Cluster','UUID','SupportsAmount','SupportsAmount2','SupportsColor','SupportsMonochrome','SupportsHighDynamicRange','SupportsNormalDynamicRange','SupportsSceneReferred','SupportsOutputReferred','RequiresRGBTables','ShowInPresets','ShowInQuickActions','CameraModelRestriction','Copyright','ContactInfo','Name','Group','HasSettings','Description','Title','Look','CompatibleVersion']);
const BANDS=['Red','Orange','Yellow','Green','Aqua','Blue','Purple','Magenta'];
function parseXmp(text,fname){
  const doc=new DOMParser().parseFromString(String(text).replace(/^﻿/,''),'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('Fichier .xmp illisible');
  const kv=new Map();
  const descs=doc.getElementsByTagNameNS('*','Description');
  if(!descs.length)throw new Error('Fichier .xmp sans réglages');
  for(const ds of descs){
    for(const a of ds.attributes)if(a.namespaceURI===CRS)kv.set(a.localName,a.value);
    for(const c of ds.children)if(c.namespaceURI===CRS){const li=c.getElementsByTagNameNS('*','li');kv.set(c.localName,li.length?[...li].map(x=>x.textContent.trim()):c.textContent.trim())}}
  if(!kv.size)throw new Error('Aucun réglage Camera Raw dans ce fichier');
  let name=(fname||'Préréglage').replace(/\.xmp$/i,'');const nm=kv.get('Name');if(nm){const s=Array.isArray(nm)?nm[0]:nm;if(s)name=s}
  const dv=DEV0(),done=new Set();let applied=0,ignored=0;const unk=[];
  const f=k=>{const v=kv.get(k);if(v==null||Array.isArray(v))return null;const x=parseFloat(v);return isFinite(x)?x:null};
  const set=(key,prop,scale=1,lo=-100,hi=100)=>{const x=f(key);if(x==null)return;dv[prop]=clamp(x*scale,lo,hi);done.add(key)};
  set('Exposure2012','exposure',1,-5,5);
  ['Contrast','Highlights','Shadows','Whites','Blacks'].forEach(n=>set(n+'2012',n.toLowerCase()));
  set('Texture','texture');set('Clarity2012','clarity');set('Dehaze','dehaze');set('Vibrance','vibrance');set('Saturation','saturation');
  {const t=f('Temperature');if(t!=null){dv.temp=clamp(Math.abs(t)<=100?t:(t-5500)/50,-100,100);done.add('Temperature')}}
  set('Tint','tint',100/150);
  /* JPEG/TIFF presets carry relative values (-100..100) under other names */
  if(!done.has('Temperature'))set('IncrementalTemperature','temp');if(!done.has('Tint'))set('IncrementalTint','tint');
  if(/^true$/i.test(String(kv.get('ConvertToGrayscale')))){dv.saturation=-100;done.add('ConvertToGrayscale')}else if(kv.has('ConvertToGrayscale'))done.add('ConvertToGrayscale');
  set('Sharpness','sharpen',1,0,150);set('SharpenRadius','sharpRadius',1,0.5,3);set('LuminanceSmoothing','noise',1,0,100);
  const curve=(key,ch)=>{const v=kv.get(key);if(!Array.isArray(v))return;const pts=v.map(s=>s.split(/[,\s]+/).map(Number)).filter(p=>p.length>=2&&isFinite(p[0])&&isFinite(p[1])).map(p=>[clamp(p[0]/255,0,1),clamp(p[1]/255,0,1)]).sort((a,b)=>a[0]-b[0]);
    const u=[];for(const p of pts)if(!u.length||p[0]>u[u.length-1][0]+1e-4)u.push(p);if(u.length>=2){dv.curve[ch]=u;done.add(key)}};
  curve('ToneCurvePV2012','rgb');curve('ToneCurvePV2012Red','r');curve('ToneCurvePV2012Green','g');curve('ToneCurvePV2012Blue','b');
  BANDS.forEach((b,i)=>{[['HueAdjustment','hslH'],['SaturationAdjustment','hslS'],['LuminanceAdjustment','hslL']].forEach(([p,a])=>{const k=p+b,x=f(k);if(x!=null){dv[a][i]=clamp(x,-100,100);done.add(k)}})});
  set('SplitToningShadowHue','shH',1,0,360);set('SplitToningShadowSaturation','shS',1,0,100);set('SplitToningHighlightHue','hiH',1,0,360);set('SplitToningHighlightSaturation','hiS',1,0,100);set('SplitToningBalance','balance');
  set('ColorGradeMidtoneHue','midH',1,0,360);set('ColorGradeMidtoneSat','midS',1,0,100);
  set('PostCropVignetteAmount','vignette');set('PostCropVignetteMidpoint','vigMid',1,0,100);set('PostCropVignetteFeather','vigFeather',1,0,100);
  set('GrainAmount','grain',1,0,100);set('GrainSize','grainSize',1,0,100);
  for(const k of kv.keys()){if(META.has(k))continue;if(done.has(k))applied++;else{ignored++;if(unk.length<12)unk.push(k)}}
  return{kind:'xmp',name,dev:dv,applied,ignored,ignoredKeys:unk}}
LK.parseXmp=parseXmp;

/* ---------------------------------------------------------------- applying */
function nameLayer(p,n){return p+' · '+n}
function newLutLayer(rec){const L=newAdjust(nameLayer('LUT',rec.name));L.dev.lut={id:rec.id,name:rec.name,k:100};return L}
function newXmpLayer(rec){const L=newAdjust(nameLayer('Préréglage',rec.name));L.dev=Object.assign(DEV0(),JSON.parse(JSON.stringify(rec.dev)));return L}
LK.applyNew=function(id){const rec=LK.items.get(id);if(!rec)return false;if(!S.doc){toast(NODOC);return false}
  if(rec.kind==='cube'){insertLayer(newLutLayer(rec),'LUT : '+rec.name,true);switchTab('develop');toast('LUT « '+rec.name+' » ajoutée en calque de réglage. Réglez l’intensité dans Développer.',3600)}
  else{insertLayer(newXmpLayer(rec),'Préréglage : '+rec.name,true);switchTab('develop');toast('Préréglage « '+rec.name+' » ajouté en calque de réglage.')}
  return true};
/* from the presets popover: reuse the active adjust layer when there is one */
LK.applyHere=function(id){const rec=LK.items.get(id);if(!rec)return;const A=S.doc&&ADJ();if(!A)return LK.applyNew(id);
  if(rec.kind==='cube'){A.dev.lut={id:rec.id,name:rec.name,k:100};pushHistory('LUT : '+rec.name)}
  else{A.dev=Object.assign(DEV0(),JSON.parse(JSON.stringify(rec.dev)));pushHistory('Préréglage : '+rec.name)}
  syncDev();markContent();scheduleThumbs&&scheduleThumbs()};

/* ---------------------------------------------------------------- import */
async function importFiles(files,opts={}){
  files=[...files];const res={lut:0,xmp:0,applied:0,ignored:0,failed:[],added:[]};
  await LK.load();
  for(const f of files){try{
    if(/\.cube$/i.test(f.name)){const rec=parseCube(await f.text(),f.name);rec.id='cube_'+fpCube(rec);rec.t=Date.now();await addItem(rec);res.lut++;res.added.push(rec)}
    else if(/\.xmp$/i.test(f.name)){const rec=parseXmp(await f.text(),f.name);res.applied+=rec.applied;res.ignored+=rec.ignored;
      const id='xmp_'+fnv(rec.name+JSON.stringify(rec.dev));const r2={id,kind:'xmp',name:rec.name,dev:rec.dev,applied:rec.applied,ignored:rec.ignored,t:Date.now()};await addItem(r2);res.xmp++;res.added.push(r2)}
    else res.failed.push(f.name+' : format non pris en charge')}
   catch(e){res.failed.push(f.name+' : '+(e&&e.message||e))}}
  /* apply to the photo: every xmp becomes a layer; a single .cube is applied too */
  const apply=opts.apply!==false&&S.doc;let layers=0;
  if(apply){const cubes=res.added.filter(r=>r.kind==='cube');
    for(const r of res.added){if(r.kind==='xmp'){insertLayer(newXmpLayer(r),'Préréglage : '+r.name,true);layers++}}
    if(cubes.length===1){insertLayer(newLutLayer(cubes[0]),'LUT : '+cubes[0].name,true);layers++}
    if(layers)switchTab('develop')}
  refreshPop();
  const parts=[];
  if(res.lut)parts.push(res.lut+(res.lut>1?' LUT importées':' LUT importée'));
  if(res.xmp)parts.push(res.xmp+(res.xmp>1?' préréglages importés':' préréglage importé')+' : '+res.applied+' réglage'+(res.applied>1?'s':'')+' appliqué'+(res.applied>1?'s':'')+', '+res.ignored+' ignoré'+(res.ignored>1?'s':''));
  let msg=parts.join(' · ');
  if(msg&&!apply)msg+=(res.lut||res.xmp)?'. Ouvrez une photo pour les appliquer.':'';
  else if(msg&&res.lut>1&&!layers)msg+='. Choisissez-les dans Image > Looks et LUT.';
  if(res.failed.length)msg=(msg?msg+' · ':'')+res.failed.length+' fichier'+(res.failed.length>1?'s':'')+' refusé'+(res.failed.length>1?'s':'')+' ('+res.failed[0]+')';
  if(!msg)msg='Aucun fichier .cube ou .xmp';
  toast(msg,6000);return res}
LK.importFiles=importFiles;
async function importDialog(){const fs=await pickFile('.cube,.xmp',true);if(fs&&fs.length)importFiles(fs)}

/* ---------------------------------------------------------------- library dialog */
function libDialog(){
  const list=()=>[...LK.items.values()].sort((a,b)=>(a.kind===b.kind?0:a.kind==='cube'?-1:1)||a.name.localeCompare(b.name));
  const rows=()=>{const a=list();return a.length?a.map(r=>`<div class="lkrow" data-id="${esc(r.id)}"><div class="lkn"><b>${esc(r.name)}</b><span class="muted">${r.kind==='cube'?('LUT '+(r.n3?r.n3+'³':'1D '+r.n1)):'Préréglage Lightroom'}</span></div><button class="btn sm" data-a="apply" ${S.doc?'':'disabled'}>Appliquer</button><button class="btn sm" data-a="del" aria-label="Supprimer ${esc(r.name)}">Supprimer</button></div>`).join(''):'<p class="muted">Aucun look importé. Importez des fichiers .cube (LUT) ou .xmp (préréglages Lightroom), ou glissez-les sur la fenêtre.</p>'};
  dialog({title:'Looks et LUT',body:`<div id="lkList" class="lklist">${rows()}</div>`,buttons:[{label:'Fermer'},{label:'Importer…',primary:true,onClick:()=>{importDialog()}}],
    onOpen:dl=>{dl.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b)return;const id=b.closest('.lkrow').dataset.id;
      if(b.dataset.a==='apply'){closeDialog();LK.applyNew(id)}
      else{await LK.remove(id);$('#lkList',dl).innerHTML=rows();refreshPop()}})}})}

/* ---------------------------------------------------------------- menu + palette */
{const _mi=MENU2.image.items;
 MENU2.image.items=()=>{const a=_mi();
  const items=[...LK.items.values()].sort((x,y)=>(x.kind===y.kind?0:x.kind==='cube'?-1:1)||x.name.localeCompare(y.name));
  a.push(MI('Looks et LUT',{sub:()=>{const s=[MI('Importer des LUT et préréglages Lightroom…',{fn:importDialog})];
    if(items.length){s.push(SEP);items.slice(0,14).forEach(r=>s.push(MI((r.kind==='cube'?'LUT : ':'Préréglage : ')+r.name,{fn:()=>LK.applyNew(r.id),dis:S.doc?false:NODOC})));s.push(SEP);s.push(MI('Gérer les looks…',{fn:libDialog}))}
    return s}}));return a}}

/* ---------------------------------------------------------------- develop pane: Intensité row + popover list */
const css=document.createElement('style');
css.textContent=`#lutRow{padding:6px 12px 4px}#lutRow .lt{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px;font-size:12px}#lutRow .lt b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#lutRow .lt button{flex:none}
#lutRow .row{padding:0}
#lutBox{padding:0 10px 12px}#lutBox .lkh{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.65;margin:4px 0 6px}#lutBox .chips{display:flex;flex-wrap:wrap;gap:6px}
.lklist{display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow:auto}.lkrow{display:flex;align-items:center;gap:8px}.lkrow .lkn{flex:1;min-width:0;display:flex;flex-direction:column}.lkrow .lkn b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;
document.body.appendChild(css);
function lutRow(){const body=$('#devBody');if(!body)return;let row=$('#lutRow');const A=S.doc&&ADJ(),lt=A&&A.dev&&A.dev.lut;
  if(!lt){if(row)row.remove();return}
  if(!row){row=document.createElement('div');row.id='lutRow';
    row.innerHTML=`<div class="lt"><b></b><button class="btn sm" type="button" id="lutDel">Retirer</button></div><div class="row"><label for="lutK" title="Double-clic pour réinitialiser">Intensité</label><input type="range" id="lutK" min="0" max="100" step="1"><output></output></div>`;
    body.insertBefore(row,body.firstChild);
    const k=$('#lutK',row);
    k.addEventListener('input',()=>{const A=ADJ();if(!A||!A.dev.lut)return;A.dev.lut={...A.dev.lut,k:+k.value};row.querySelector('output').textContent=k.value+' %';markContent()});
    k.addEventListener('change',()=>{if(ADJ()&&ADJ().dev.lut)pushHistory('Intensité de la LUT')});
    k.addEventListener('dblclick',()=>{const A=ADJ();if(!A||!A.dev.lut)return;A.dev.lut={...A.dev.lut,k:100};k.value=100;row.querySelector('output').textContent='100 %';markContent();pushHistory('Intensité de la LUT')});
    $('#lutDel',row).addEventListener('click',()=>{const A=ADJ();if(!A||!A.dev.lut)return;const d={...A.dev};delete d.lut;A.dev=d;pushHistory('Retirer la LUT');syncDev();markContent()})}
  else if(row.parentNode!==body||body.firstChild!==row)body.insertBefore(row,body.firstChild);
  row.querySelector('b').textContent='LUT : '+(lt.name||'');const k=$('#lutK',row);if(document.activeElement!==k)k.value=lt.k==null?100:lt.k;row.querySelector('output').textContent=k.value+' %'}
{const _rt=renderTarget;renderTarget=function(){const r=_rt.apply(this,arguments);try{lutRow()}catch(e){console.warn(e)}return r}}
function refreshPop(){const d=document.querySelector('#pane-develop details[data-sec=presets]');if(!d)return;let box=$('#lutBox',d);
  const a=[...LK.items.values()].sort((x,y)=>(x.kind===y.kind?0:x.kind==='cube'?-1:1)||x.name.localeCompare(y.name));
  if(!box){box=document.createElement('div');box.id='lutBox';d.appendChild(box);
    box.addEventListener('click',e=>{const b=e.target.closest('[data-lk]');if(!b)return;e.stopPropagation();if(b.dataset.lk==='import'){importDialog();return}LK.applyHere(b.dataset.lk)})}
  box.innerHTML=`<div class="lkh">Looks importés</div><div class="chips">${a.map(r=>`<button class="btn sm" type="button" data-lk="${esc(r.id)}" title="${r.kind==='cube'?'LUT':'Préréglage Lightroom'}">${esc(r.name)}</button>`).join('')}<button class="btn sm" type="button" data-lk="import">Importer…</button></div>`}
{const pane=$('#pane-develop');if(pane)pane.addEventListener('toggle',e=>{const d=e.target;if(d&&d.matches&&d.matches('details[data-sec=presets]')&&d.open){LK.load().then(refreshPop)}},true)}

/* palette: Ctrl+K already lists every leaf of the Image > Looks et LUT submenu (import, each look, manage) */

/* ---------------------------------------------------------------- drag and drop (.cube / .xmp), capture phase so other drops stay untouched */
document.addEventListener('drop',e=>{const fl=[...(e.dataTransfer&&e.dataTransfer.files||[])];if(!fl.length)return;
  const mine=fl.filter(f=>/\.(cube|xmp)$/i.test(f.name));if(!mine.length)return;
  const bz=$('#busy');if(bz&&!bz.hidden)return;
  if(mine.length===fl.length){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();try{dragN=0;$('#drop').hidden=true}catch(_){}}
  importFiles(mine)},true);

/* load the library once the page is idle (never at startup critical path) */
setTimeout(()=>{LK.load().then(refreshPop)},1500);
})();
