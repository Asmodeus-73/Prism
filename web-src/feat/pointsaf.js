/* ===== Points AF : où l'appareil a fait la mise au point, et si c'est net à cet endroit =====
   Affichage > Points AF. Lu dans les données du fabricant enregistrées dans la photo (MakerNote), sans rien envoyer :
   - Canon : AFInfo2 (0x26) ou AFInfo3 (0x3c) : cadres de tous les collimateurs, ceux qui ont fait le point en évidence ; JPEG, CR2 et CR3.
   - Sony : FocusLocation (0x2027) ; JPEG et ARW.
   - Nikon : AFInfo2 (0xb7) des hybrides Z et de la visée écran des reflex (versions 0100, 0300, 0400) ; JPEG et NEF.
   - Fujifilm : FocusPixel (0x1031) ; JPEG et RAF.   - Panasonic : AFPointPosition (0x4d) ; JPEG et RW2.
   Les positions sont ramenées à la photo telle qu'elle s'affiche (orientation de l'appareil comprise).
   Netteté au point AF : variance du laplacien dans le cadre, comparée aux zones les plus nettes du reste de la photo. ===== */
{
const AF={files:new Map(),on:!!PREF.get('afPoints',false),cache:new WeakMap()};
/* le fichier d'origine de chaque photo ouverte (pour les RAW, l'EXIF n'est pas gardé dans le projet) */
{const _ob=openBlob;openBlob=async function(file,asLayer){if(file&&file.name&&!asLayer){AF.files.set(file.name,file);if(AF.files.size>8)AF.files.delete(AF.files.keys().next().value)}return _ob.apply(this,arguments)}}
const str=(u8,o,n)=>{let s='';for(let i=0;i<n&&o+i<u8.length;i++){const c=u8[o+i];if(!c)break;s+=String.fromCharCode(c)}return s};
/* trouve le bloc TIFF (EXIF) d'un fichier : JPEG, TIFF/RAW, RAF (JPEG intégré), CR3 (boîtes CMT1..3) */
function containers(u8){const out=[];
  if(u8[0]===0xFF&&u8[1]===0xD8){let p=2;while(p+4<u8.length){if(u8[p]!==0xFF){p++;continue}const mk=u8[p+1];if(mk===0xD8||mk===0x01||(mk>=0xD0&&mk<=0xD7)){p+=2;continue}if(mk===0xDA||mk===0xD9)break;const len=(u8[p+2]<<8)|u8[p+3],s=p+4;
      if(mk===0xE1&&str(u8,s,4)==='Exif'){out.push({kind:'tiff',base:s+6});break}p+=2+len}}
  else if((u8[0]===0x49&&u8[1]===0x49)||(u8[0]===0x4D&&u8[1]===0x4D))out.push({kind:'tiff',base:0});
  else if(str(u8,0,15)==='FUJIFILMCCD-RAW'){const v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),jo=v.getUint32(84);if(jo<u8.length)return containers(u8.subarray(jo)).map(c=>({...c,sub:jo}))}
  else if(str(u8,4,4)==='ftyp'){/* CR3 : chercher les boîtes CMT1 (IFD0), CMT2 (EXIF), CMT3 (MakerNote Canon) */
    const find=t=>{for(let i=8;i<Math.min(u8.length-8,4e6);i++)if(u8[i]===t.charCodeAt(0)&&str(u8,i,4)===t){const v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);return{start:i+4,size:v.getUint32(i-4)-8}}return null};
    const c1=find('CMT1'),c3=find('CMT3');if(c3)out.push({kind:'cr3',ifd0:c1&&c1.start,mn:c3.start})}
  return out}
const LBL={canon:'Canon',sony:'Sony',nikon:'Nikon',fuji:'Fujifilm',pana:'Panasonic'};
/* rectangles AF en coordonnées normalisées (0..1) de l'image du capteur, avant orientation */
function parse(u8){for(const C of containers(u8)){const U=C.sub?u8.subarray(C.sub):u8;try{
    if(C.kind==='cr3'){const T=tiffRead(U,C.mn),mn=T.ifds[0];let model='';if(C.ifd0){try{const T0=tiffRead(U,C.ifd0);model=T0.str(T0.ifds[0],0x0110)}catch(e){}}const r=canon(T,mn,model);if(r)return{...r,make:'canon',orient:1,cr3:true};continue}
    const T=tiffRead(U,C.base),i0=T.ifds[0];if(!i0)continue;const make=(T.str(i0,0x010F)||'').toLowerCase(),model=T.str(i0,0x0110)||'',orient=T.val(i0,0x0112)||1;
    const ep=T.val(i0,0x8769);if(!ep)continue;const E=T.readIFD(ep),mt=E.tags.get(0x927C);if(!mt)continue;const mo=mt.vo,dims=[T.val(E,0xA002),T.val(E,0xA003)];
    let r=null;
    if(make.startsWith('canon'))r=canon(T,T.readIFD(mo),model);
    else if(make.startsWith('sony')){const h=str(U,C.base+mo,8);const off=h.startsWith('SONY')?mo+12:mo;r=sony(T,T.readIFD(off))}
    else if(make.startsWith('nikon')){if(str(U,C.base+mo,5)==='Nikon'){const N=tiffRead(U,C.base+mo+10);r=nikon(N,N.ifds[0])}}
    else if(make.startsWith('fuji')){const fb=C.base+mo;if(str(U,fb,8)==='FUJIFILM'){const v=new DataView(U.buffer,U.byteOffset,U.byteLength),io=v.getUint32(fb+8,true);r=fuji(U,fb,io,dims)}}
    else if(make.startsWith('panasonic')){const off=str(U,C.base+mo,9)==='Panasonic'?mo+12:mo;r=pana(T,T.readIFD(off))}
    if(r)return{...r,make:make.startsWith('fuji')?'fuji':make.startsWith('panasonic')?'pana':make.split(' ')[0],orient};
  }catch(e){console.warn('AF',e)}}return null}
function canon(T,mn,model){const tg=mn.tags.get(0x26)||mn.tags.get(0x3c);if(!tg)return canonOld(T,mn,model);const a=T.arr(mn,tg===mn.tags.get(0x26)?0x26:0x3c).map(v=>v&0xffff),s=v=>v>32767?v-65536:v;
  const N=a[2],aw=a[6],ah=a[7];if(!N||!aw||!ah||a.length<8+N*4)return null;const W=a.slice(8,8+N),H=a.slice(8+N,8+2*N),X=a.slice(8+2*N,8+3*N).map(s),Y=a.slice(8+3*N,8+4*N).map(s);
  const fb=a.slice(8+4*N,8+4*N+Math.ceil(N/16)),bit=i=>!!(fb[i>>4]>>(i&15)&1),up=/EOS/i.test(model)||!model;
  const pts=[];for(let i=0;i<N;i++){if(!W[i]||!H[i])continue;pts.push({x:(aw/2+X[i])/aw,y:(up?ah/2-Y[i]:ah/2+Y[i])/ah,w:W[i]/aw,h:H[i]/ah,on:bit(i)})}
  if(!pts.length)return null;if(!pts.some(p=>p.on)&&pts.length===1)pts[0].on=true;return{pts}}
/* anciens boîtiers : AFInfo (0x12), un seul format de cadre pour tous les collimateurs */
function canonOld(T,mn,model){if(!mn.tags.get(0x12))return null;const a=T.arr(mn,0x12).map(v=>v&0xffff),s=v=>v>32767?v-65536:v,N=a[0],aw=a[4],ah=a[5],w=a[6],h=a[7];if(!N||!aw||!ah||a.length<8+2*N)return null;
  const X=a.slice(8,8+N).map(s),Y=a.slice(8+N,8+2*N).map(s),fb=a.slice(8+2*N,8+2*N+Math.ceil(N/16)),bit=i=>!!(fb[i>>4]>>(i&15)&1),up=/EOS/i.test(model)||!model;
  const pts=[];for(let i=0;i<N;i++)pts.push({x:(aw/2+X[i])/aw,y:(up?ah/2-Y[i]:ah/2+Y[i])/ah,w:(w||aw*0.03)/aw,h:(h||ah*0.04)/ah,on:bit(i)});if(!pts.some(p=>p.on)&&pts.length===1)pts[0].on=true;return{pts}}
function sony(T,mn){const a=T.arr(mn,0x2027);if(!a||a.length<4||!a[0]||!a[1])return null;const[w,h,x,y]=a;if(x===w/2&&y===h/2&&!x)return null;
  return{pts:[{x:x/w,y:y/h,w:0.05,h:0.05*w/h,on:true,guess:true}]}}
function nikon(N,mn){const t=mn.tags.get(0xB7);if(!t)return null;const n=t.cnt,o=N.base+t.vo,u8=N.u8,v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),le=N.le,ver=str(u8,o,4),g=k=>k+2<=n?v.getUint16(o+k,le):0;
  let k=null;if(/^010[01]/.test(ver)&&u8[o+4]===1)k=0x10;else if(/^030[01]/.test(ver))k=0x2a;else if(/^040[012]/.test(ver))k=0x3e;if(k==null)return null;
  const W=g(k),H=g(k+2),X=g(k+4),Y=g(k+6),aw=g(k+8),ah=g(k+10);if(!W||!H||!X||!Y)return null;return{pts:[{x:X/W,y:Y/H,w:(aw||W*0.04)/W,h:(ah||W*0.04)/H,on:true}]}}
function fuji(U,fb,io,dims){const v=new DataView(U.buffer,U.byteOffset,U.byteLength),n=v.getUint16(fb+io,true);for(let i=0;i<n;i++){const e=fb+io+2+i*12;if(v.getUint16(e,true)!==0x1031)continue;
    const x=v.getUint16(e+8,true),y=v.getUint16(e+10,true),W=dims[0]||0,H=dims[1]||0;if(!W||!H||!x||!y)return null;return{pts:[{x:x/W,y:y/H,w:0.05,h:0.05*W/H,on:true,guess:true}]}}return null}
function pana(T,mn){const a=T.arr(mn,0x4d);if(!a||a.length<2)return null;const[x,y]=a;if(!(x>0&&x<1&&y>0&&y<1))return null;return{pts:[{x,y,w:0.05,h:0.075,on:true,guess:true}]}}
/* orientation EXIF : du capteur à l'image affichée */
function orientPt(p,o){const{x,y,w,h}=p;switch(o){case 3:return{...p,x:1-x,y:1-y};case 6:return{...p,x:1-y,y:x,w:h,h:w};case 8:return{...p,x:y,y:1-x,w:h,h:w};case 2:return{...p,x:1-x};case 4:return{...p,y:1-y};case 5:return{...p,x:y,y:x,w:h,h:w};case 7:return{...p,x:1-y,y:1-x,w:h,h:w};default:return p}}
async function afOf(d){if(!d)return null;const c=AF.cache.get(d);if(c!==undefined)return c;let u8=null;
  const f=AF.files.get(d.name);if(f){try{u8=new Uint8Array(await f.slice(0,Math.min(f.size,8e6)).arrayBuffer())}catch(e){}}
  let r=u8?parse(u8):null;
  if(!r&&d.exif){try{const ex=d.exif instanceof Uint8Array?d.exif:new Uint8Array(d.exif);const L=Math.min(65535,ex.length+8),j=new Uint8Array(ex.length+12);j.set([0xFF,0xD8,0xFF,0xE1,L>>8,L&255,0x45,0x78,0x69,0x66,0,0],0);j.set(ex,12);r=parse(j)}catch(e){}}
  /* la photo RAW est déjà redressée par le décodeur : son orientation est appliquée de la même façon */
  if(r){r.pts=r.pts.map(p=>orientPt(p,r.orient));r.w=d.w;r.h=d.h;r.sharp=null}
  AF.cache.set(d,r);return r}
/* netteté au point AF, comparée au reste de la photo (sur une copie de 1600 px au plus) */
function sharpness(d,r){try{const src=flatSync(),k=Math.min(1,1600/Math.max(d.w,d.h)),W=Math.max(8,Math.round(d.w*k)),H=Math.max(8,Math.round(d.h*k)),c=mk(W,H),g=rx(c);g.drawImage(src,0,0,W,H);const a=g.getImageData(0,0,W,H).data;
  const Y=new Float32Array(W*H);for(let i=0,j=0;i<W*H;i++,j+=4)Y[i]=0.2126*a[j]+0.7152*a[j+1]+0.0722*a[j+2];
  const lapVar=(x0,y0,x1,y1)=>{x0=Math.max(1,x0|0);y0=Math.max(1,y0|0);x1=Math.min(W-2,x1|0);y1=Math.min(H-2,y1|0);let s=0,s2=0,n=0;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x,l=4*Y[i]-Y[i-1]-Y[i+1]-Y[i-W]-Y[i+W];s+=l;s2+=l*l;n++}return n>8?s2/n-(s/n)**2:0};
  /* référence : les tuiles les plus nettes de la photo (90e centile) */
  const T=Math.max(16,Math.round(Math.min(W,H)/12)),tv=[];for(let y=0;y+T<H;y+=T)for(let x=0;x+T<W;x+=T)tv.push(lapVar(x,y,x+T,y+T));tv.sort((p,q)=>p-q);const ref=tv[Math.floor(tv.length*0.9)]||1;
  const on=r.pts.filter(p=>p.on);if(!on.length)return null;let best=0;for(const p of on){const hw=Math.max(T/2,p.w*W/2),hh=Math.max(T/2,p.h*H/2);best=Math.max(best,lapVar(p.x*W-hw,p.y*H-hh,p.x*W+hw,p.y*H+hh))}
  return Math.min(1.5,Math.sqrt(best/ref))}catch(e){console.warn(e);return null}}
const verdict=s=>s==null?'':s>=0.75?'net':s>=0.45?'un peu flou':'flou';
/* dessin sur la photo */
{const _dov=drawOverlays;drawOverlays=function(c,pr){_dov.apply(this,arguments);if(!AF.on||!S.doc)return;const d=S.doc,r=AF.cache.get(d);if(!r)return;if(r.w!==d.w||r.h!==d.h)return;
  try{const M=new DOMMatrix(viewMatrix(0,0)),st=rootStyle();c.save();c.setTransform(1,0,0,1,0,0);const sv=r.sharp,col=sv==null?'#3fd27a':sv>=0.75?'#3fd27a':sv>=0.45?'#f0b429':'#ef5350';
    for(const p of r.pts){const a=M.transformPoint(new DOMPoint((p.x-p.w/2)*d.w,(p.y-p.h/2)*d.h)),b=M.transformPoint(new DOMPoint((p.x+p.w/2)*d.w,(p.y+p.h/2)*d.h)),x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.max(6*pr,Math.abs(b.x-a.x)),h=Math.max(6*pr,Math.abs(b.y-a.y));
      if(p.on){c.lineWidth=2*pr;c.strokeStyle='rgba(0,0,0,.55)';c.strokeRect(x-pr,y-pr,w+2*pr,h+2*pr);c.strokeStyle=col;c.strokeRect(x,y,w,h)}
      else if(r.pts.length<=80){c.lineWidth=1*pr;c.strokeStyle='rgba(255,255,255,.35)';c.strokeRect(x,y,w,h)}}
    const on=r.pts.find(p=>p.on);if(on&&sv!=null){const q=M.transformPoint(new DOMPoint((on.x-on.w/2)*d.w,(on.y+on.h/2)*d.h)),t=`Point AF : ${verdict(sv)} (${Math.round(Math.min(1,sv)*100)} %)`;
      c.font=`600 ${12*pr}px system-ui,sans-serif`;const tw=c.measureText(t).width;c.fillStyle='rgba(0,0,0,.65)';c.fillRect(q.x,q.y+4*pr,tw+12*pr,20*pr);c.fillStyle=col;c.fillText(t,q.x+6*pr,q.y+18*pr)}
    c.restore()}catch(e){}}}
async function refresh(){const d=S.doc;if(!AF.on||!d)return;const r=await afOf(d);if(S.doc!==d)return;
  if(!r){toast('Pas de point AF dans cette photo (appareil non reconnu, ou mise au point manuelle)',4500);return}
  if(r.w!==d.w||r.h!==d.h){toast('La photo a été recadrée ou redimensionnée : les points AF ne correspondent plus',4500);return}
  if(r.sharp==null){r.sharp=sharpness(d,r)}requestRender()}
function setOn(on){AF.on=on;PREF.set('afPoints',on);if(on)refresh();else requestRender()}
window.PrismAF={parse,afOf,set:setOn,get on(){return AF.on},sharpness:d=>afOf(d).then(r=>r&&(r.sharp=sharpness(d,r)))};
/* menu Affichage */
{const _mv=MENU2.view.items;MENU2.view.items=function(){const a=_mv.apply(this,arguments);if(!a.some(x=>x&&x.label==='Points AF'))a.push(MI('Points AF',{check:AF.on,fn:()=>setOn(!AF.on),dis:S.doc?false:NODOC}));return a}}
/* à chaque photo ouverte, si l'affichage est actif */
{const _sd=setDoc;setDoc=function(){const r=_sd.apply(this,arguments);if(AF.on)setTimeout(refresh,300);return r}}
}
