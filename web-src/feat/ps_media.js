/* ===== Photos animées et formats en plus.
   - Motion Photos (Google Pixel, Samsung et autres Android : la vidéo est rangée à la fin du JPEG ou du HEIC),
     Live Photos d'iPhone (photo + .MOV du même nom ouverts ensemble), GIF et PNG animés :
     Image > Photo animée… pour lire, garder une autre image, tout mettre en calques, enregistrer la vidéo ou un GIF.
   - JPEG XL (décodeur jxl-oxide quand le navigateur ne le lit pas), JPEG 2000 (décodeur de pdf.js), QOI, PPM / PGM / PBM / PAM.
   Écrit d'après les spécifications publiques : format Motion Photo de Google (XMP Container), QOI, APNG, ISO BMFF. ===== */
const PSX=window.PSX;
const MOT={files:[]};
const ascii=(u8,o,n)=>{let s='';for(let i=0;i<n&&o+i<u8.length;i++)s+=String.fromCharCode(u8[o+i]);return s};
const be32=(u8,o)=>((u8[o]<<24)>>>0)+(u8[o+1]<<16)+(u8[o+2]<<8)+u8[o+3];
const base=n=>String(n||'').replace(/\.[^.]+$/,'').toLowerCase();
const isVideoFile=f=>/^video\//.test(f.type)||/\.(mov|mp4|m4v|qt)$/i.test(f.name||'');

/* ---------- formats ---------- */
function sniffMore(u8,name){const n=(name||'').toLowerCase();
  if(ascii(u8,0,4)==='qoif')return'qoi';
  if((u8[0]===0xFF&&u8[1]===0x0A)||(be32(u8,0)===12&&ascii(u8,4,4)==='JXL '))return'jxl';
  if((be32(u8,0)===12&&ascii(u8,4,4)==='jP  ')||(u8[0]===0xFF&&u8[1]===0x4F&&u8[2]===0xFF&&u8[3]===0x51))return'jpx';
  if(u8[0]===0x50&&u8[1]>=0x31&&u8[1]<=0x37&&(u8[2]===10||u8[2]===13||u8[2]===32||u8[2]===9)&&/\.(p[bgpn]m|pam)$/.test(n))return'pnm';
  return''}
/* QOI (qoiformat.org) : en-tête de 14 octets, puis six codes d'une couleur à la suivante */
function decodeQOI(u8){if(ascii(u8,0,4)!=='qoif')throw new Error('QOI invalide');const w=be32(u8,4),h=be32(u8,8);if(!w||!h||w*h>MAX_PX)throw new Error('taille QOI invalide');
  const out=new Uint8ClampedArray(w*h*4),idx=new Uint8Array(256);let r=0,g=0,b=0,a=255,p=14,run=0;const end=u8.length-8;
  for(let o=0;o<out.length;o+=4){
    if(run>0)run--;
    else if(p<end){const c=u8[p++];
      if(c===0xFE){r=u8[p++];g=u8[p++];b=u8[p++]}
      else if(c===0xFF){r=u8[p++];g=u8[p++];b=u8[p++];a=u8[p++]}
      else if((c>>6)===0){const k=(c&63)*4;r=idx[k];g=idx[k+1];b=idx[k+2];a=idx[k+3]}
      else if((c>>6)===1){r=(r+((c>>4)&3)-2)&255;g=(g+((c>>2)&3)-2)&255;b=(b+(c&3)-2)&255}
      else if((c>>6)===2){const c2=u8[p++],dg=(c&63)-32;r=(r+dg-8+((c2>>4)&15))&255;g=(g+dg)&255;b=(b+dg-8+(c2&15))&255}
      else run=c&63}
    const k=((r*3+g*5+b*7+a*11)%64)*4;idx[k]=r;idx[k+1]=g;idx[k+2]=b;idx[k+3]=a;
    out[o]=r;out[o+1]=g;out[o+2]=b;out[o+3]=a}
  const c=mk(w,h);rx(c).putImageData(new ImageData(out,w,h),0,0);return c}
/* JPEG XL : jxl-oxide (MIT / Apache 2.0), chargé seulement quand le navigateur ne lit pas le fichier lui-même */
let jxlMod=null;
async function decodeJXL(file){busy(true,'Lecture du JPEG XL…',null);
  try{if(!jxlMod){const m=await import(asset('jxl/jxl_oxide_wasm.js'));await m.default({module_or_path:asset('jxl/jxl_oxide_wasm_bg.wasm')});jxlMod=m}
    const im=new jxlMod.JxlImage();try{im.feedBytes(new Uint8Array(await file.arrayBuffer()));if(!im.tryInit())throw new Error('fichier JPEG XL incomplet');im.forceSrgb=true;
      const r=im.render();const png=r.encodeToPng();/* encodeToPng libère le résultat */
      const bm=await createImageBitmap(new Blob([png],{type:'image/png'})),c=mk(bm.width,bm.height);cx(c).drawImage(bm,0,0);bm.close&&bm.close();FMT.info.set(c,{meta:'JPEG XL'+(im.animated?' (première image)':'')});return c}
    finally{im.free()}}
  finally{busy(false)}}
/* JPEG 2000 (.jp2, .j2k) : l'image est glissée dans un PDF d'une page que pdf.js (déjà dans Prism) décode avec OpenJPEG */
function jpxSize(u8){for(let i=0;i+20<u8.length&&i<1<<20;i++)if(u8[i]===0xFF&&u8[i+1]===0x4F&&u8[i+2]===0xFF&&u8[i+3]===0x51){const o=i+8;return{w:be32(u8,o)-be32(u8,o+8),h:be32(u8,o+4)-be32(u8,o+12)}}return null}
function jpxPDF(u8,w,h){const enc=new TextEncoder(),parts=[],offs=[];let len=0;const put=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);len+=b.length};
  const obj=(n,s)=>{offs[n]=len;put(n+' 0 obj\n');if(typeof s==='string')put(s+'\nendobj\n');else{s();put('\nendobj\n')}};
  const content=`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  put('%PDF-1.5\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4,()=>{put(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /Filter /JPXDecode /Length ${u8.length} >>\nstream\n`);put(u8);put('\nendstream')});
  obj(5,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const x=len;put('xref\n0 6\n0000000000 65535 f \n'+[1,2,3,4,5].map(n=>String(offs[n]).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+x+'\n%%EOF\n');
  const out=new Uint8Array(len);let o=0;for(const b of parts){out.set(b,o);o+=b.length}return out}
async function decodeJPX(file){const u8=new Uint8Array(await file.arrayBuffer()),sz=jpxSize(u8);if(!sz||!(sz.w>0&&sz.h>0))throw new Error('JPEG 2000 invalide');if(sz.w*sz.h>MAX_PX)throw new Error('image trop grande');
  busy(true,'Lecture du JPEG 2000…',null);let doc;
  try{if(!FMT.pdf){FMT.pdf=await import(asset('pdf/pdf.min.js'));FMT.pdf.GlobalWorkerOptions.workerSrc=asset('pdf/pdf.worker.min.js')}
    doc=await FMT.pdf.getDocument({data:jpxPDF(u8,sz.w,sz.h),wasmUrl:asset('pdf/wasm/'),isEvalSupported:false}).promise;
    const page=await doc.getPage(1),vp=page.getViewport({scale:1}),c=mk(sz.w,sz.h),g=cx(c);g.fillStyle='#fff';g.fillRect(0,0,sz.w,sz.h);
    await page.render({canvasContext:g,canvas:c,viewport:vp}).promise;FMT.info.set(c,{meta:'JPEG 2000'});return c}
  finally{try{doc&&doc.destroy()}catch(e){}busy(false)}}
async function decodePNM(file){await PSX.load();const r=PSI.run('netpbm',{bytes:new Uint8Array(await file.arrayBuffer())});const c=PSX.canvas(r.rgba);FMT.info.set(c,{meta:'Netpbm'});return c}
{const _lif=loadImageFile;
 loadImageFile=async function(file){const u8=new Uint8Array(await file.slice(0,64).arrayBuffer()),k=sniffMore(u8,file.name);
   if(k==='qoi')return decodeQOI(new Uint8Array(await file.arrayBuffer()));
   if(k==='pnm')return decodePNM(file);
   if(k==='jpx')return decodeJPX(file);
   if(k==='jxl'){try{return await _lif.apply(this,arguments)}catch(e){return decodeJXL(file)}}
   return _lif.apply(this,arguments)}}

/* ---------- photos animées : où est la vidéo ? ---------- */
/* boîtes ISO BMFF de premier niveau, à partir de o */
function* boxes(u8,o,end){while(o+8<=end){let n=be32(u8,o),h=8;const t=ascii(u8,o+4,4);if(n===1){n=be32(u8,o+8)*4294967296+be32(u8,o+12);h=16}else if(n===0)n=end-o;if(n<h||o+n>end)return;yield{t,o,h,n};o+=n}}
const isMP4=(u8,o)=>o>=0&&o+12<=u8.length&&(ascii(u8,o+4,4)==='ftyp'||(['free','skip','wide'].includes(ascii(u8,o+4,4))&&be32(u8,o)>=8&&ascii(u8,o+be32(u8,o)+4,4)==='ftyp'));
function jpegXMP(u8){let p=2,out='';while(p+4<u8.length&&u8[p]===0xFF){const mk=u8[p+1];if(mk===0xDA||mk===0xD9)break;const len=(u8[p+2]<<8)|u8[p+3];
    if(mk===0xE1){const id=ascii(u8,p+4,29);if(id==='http://ns.adobe.com/xap/1.0/\0')out+=new TextDecoder().decode(u8.subarray(p+33,p+2+len))}p+=2+len}return out}
const attr=(s,name)=>{const m=s.match(new RegExp('[\\w-]+:'+name+'\\s*=\\s*"([^"]*)"'))||s.match(new RegExp('<[\\w-]+:'+name+'>([^<]*)<'));return m?m[1]:null};
/* -> {start, end, ts (µs, moment de la photo dans la vidéo, ou -1)} ou null */
function findMotion(u8){const N=u8.length;
  if(u8[0]===0xFF&&u8[1]===0xD8){const x=jpegXMP(u8);let ts=-1;
    if(x){const t=attr(x,'MotionPhotoPresentationTimestampUs')||attr(x,'MicroVideoPresentationTimestampUs');if(t!=null&&+t>=0)ts=+t;
      /* format actuel : la liste Container:Directory donne la longueur de chaque élément rangé après le JPEG ; la vidéo est le dernier */
      const items=[...x.matchAll(/<[\w-]+:Item\b([^>]*?)\/?>/g)].map(m=>m[1]).concat([...x.matchAll(/<rdf:li\b[^>]*>\s*<[\w-]+:Item\b([^>]*?)\/?>/g)].map(m=>m[1]));
      const it=items.find(s=>/Semantic\s*=\s*"MotionPhoto"/.test(s));if(it){const L=+attr(it,'Length');if(L>0&&L<N){const s=N-L;if(isMP4(u8,s))return{start:s,end:N,ts}}}
      /* ancien format (MicroVideo) : décalage compté depuis la fin */
      const off=+attr(x,'MicroVideoOffset');if(off>0&&off<N&&isMP4(u8,N-off))return{start:N-off,end:N,ts}}
    /* Samsung : « MotionPhoto_Data » juste avant la vidéo, après la fin du JPEG */
    const tag=new TextEncoder().encode('MotionPhoto_Data');for(let i=N-tag.length;i>2&&i>N-(64<<20);i--){if(u8[i]!==0x4D)continue;let ok=true;for(let k=1;k<tag.length;k++)if(u8[i+k]!==tag[k]){ok=false;break}
      if(ok){const s=i+tag.length;if(isMP4(u8,s))return{start:s,end:N,ts}}}
    return null}
  /* HEIC / AVIF : boîte « mpvd » de premier niveau qui contient la vidéo */
  if(ascii(u8,4,4)==='ftyp'){for(const b of boxes(u8,0,N))if(b.t==='mpvd'&&isMP4(u8,b.o+b.h)){let e=b.o+b.n;for(const c of boxes(u8,b.o+b.h,b.o+b.n)){e=c.o+c.n}return{start:b.o+b.h,end:e,ts:-1}}}
  return null}
const animKind=u8=>{if(ascii(u8,0,6)==='GIF89a'||ascii(u8,0,6)==='GIF87a')return'gif';
  if(u8[0]===137&&ascii(u8,1,3)==='PNG'){for(const b of(function*(){let o=8;while(o+8<=u8.length){const n=be32(u8,o),t=ascii(u8,o+4,4);yield t;if(t==='IDAT'||t==='IEND')return;o+=12+n}})())if(b==='acTL')return'apng'}return''};
async function gifFrames(u8){let n=0,p=13;if(u8[10]&0x80)p+=3*(2<<(u8[10]&7));/* compte les images sans tout décoder */
  while(p<u8.length&&n<3){const c=u8[p];if(c===0x2C){n++;p+=10;if(u8[p-1]&0x80)p+=3*(2<<(u8[p-1]&7));p++;while(p<u8.length&&u8[p])p+=u8[p]+1;p++}else if(c===0x21){p+=2;while(p<u8.length&&u8[p])p+=u8[p]+1;p++}else break}return n}

/* ouverture : la vidéo d'une Motion Photo, le .MOV d'une Live Photo ouvert avec elle, les images d'un GIF ou PNG animé */
async function attach(d,file){if(!d||S.doc!==d)return;const name=file.name||'photo';
  try{const head=new Uint8Array(await file.slice(0,Math.min(file.size,64)).arrayBuffer());
    const sib=MOT.files.find(f=>f!==file&&isVideoFile(f)&&base(f.name)===base(name));
    if(sib){d.motion={blob:sib,type:sib.type||'video/quicktime',ts:-1,from:'Live Photo'};toast('Live Photo : Image > Photo animée… pour la lire ou garder une autre image',4500);return}
    const ak=animKind(new Uint8Array(await file.slice(0,Math.min(file.size,1<<16)).arrayBuffer()));
    if(ak){const u8=new Uint8Array(await file.arrayBuffer());if(ak==='gif'&&await gifFrames(u8)<2)return;d.anim={file,kind:ak};toast((ak==='gif'?'GIF':'PNG')+' animé : Image > Photo animée… pour choisir l’image ou mettre toutes les images en calques',5000);return}
    if(!(head[0]===0xFF&&head[1]===0xD8)&&ascii(head,4,4)!=='ftyp')return;
    const u8=new Uint8Array(await file.arrayBuffer()),m=findMotion(u8);if(!m||S.doc!==d)return;
    d.motion={blob:new Blob([u8.subarray(m.start,m.end)],{type:'video/mp4'}),type:'video/mp4',ts:m.ts,from:'Motion Photo'};
    toast('Photo animée : Image > Photo animée… pour la lire ou garder une autre image',4500)}
  catch(e){console.warn('photo animée',e)}}
{const _ob=openBlob;
 openBlob=async function(file,asLayer){if(file&&!MOT.files.includes(file))MOT.files=[];
   /* Live Photo : la vidéo n'est pas ouverte seule, elle accompagne la photo du même nom (ouverte avant ou après elle) */
   if(file&&isVideoFile(file)){if(!MOT.files.some(f=>f!==file&&!isVideoFile(f)&&base(f.name)===base(file.name)))toast('Ouvrez la photo et sa vidéo ensemble (Live Photo), ou une Motion Photo');return}
   const d0=S.doc,r=await _ob.call(this,file,asLayer);if(!asLayer&&S.doc&&S.doc!==d0)await attach(S.doc,file);return r}}
document.addEventListener('drop',e=>{MOT.files=e.dataTransfer?[...e.dataTransfer.files]:[]},true);
{const fo=$('#fileOpen');if(fo){fo.multiple=true;fo.accept+=',.qoi,.jp2,.j2k,.j2c,.jpf,.jpx,.ppm,.pgm,.pbm,.pam,.pnm,.mov,.mp4';document.addEventListener('change',e=>{if(e.target===fo)MOT.files=[...fo.files]},true)}
 const fl=$('#fileLayer');if(fl)fl.accept+=',.qoi,.jp2,.j2k,.j2c,.jpf,.jpx,.ppm,.pgm,.pbm,.pam,.pnm'}
/* les fichiers glissés ou ouverts que l'ancien filtre ignorait */
document.addEventListener('drop',e=>{const fs=e.dataTransfer?[...e.dataTransfer.files]:[];if(!fs.length)return;
  const known=f=>f.type.startsWith('image/')||RAW_EXT.test(f.name)||/\.(heic|heif|psd|psb|zip|tiff?|pdf|tga|svg|jxl)$/i.test(f.name);
  if(fs.some(known))return;const f=fs.find(f=>/\.(qoi|jp2|j2k|j2c|jpf|jpx|ppm|pgm|pbm|pam|pnm)$/i.test(f.name));if(f&&e.target&&e.target.closest&&e.target.closest('#stage')){setTimeout(()=>openBlob(f,e.shiftKey),0)}},true);

/* ---------- Image > Photo animée… ---------- */
const seekTo=(v,t)=>new Promise(res=>{if(Math.abs(v.currentTime-t)<1e-3&&v.readyState>=2){res();return}const f=()=>{v.removeEventListener('seeked',f);res()};v.addEventListener('seeked',f);v.currentTime=t});
const coverC=(src,w,h)=>{const sw=src.width||src.videoWidth,sh=src.height||src.videoHeight,k=Math.max(w/sw,h/sh),c=mk(w,h),g=cx(c);g.imageSmoothingQuality='high';g.drawImage(src,(w-sw*k)/2,(h-sh*k)/2,sw*k,sh*k);return c};
async function motionDialog(){const d=S.doc;if(!d||!(d.motion||d.anim))return;
  const nm=String(d.name||'photo').replace(/\.[^.]+$/,'');let frames=null,v=null,url=null,timer=null,cur=0;
  if(d.anim){busy(true,'Lecture des images…',null);try{await PSX.load();const u8=new Uint8Array(await d.anim.file.arrayBuffer());
      const r=await PSX.run('animDecode',{bytes:u8,kind:d.anim.kind,max:Math.max(2,Math.min(300,Math.floor(6e8/(d.w*d.h*4))))}).promise;frames=r.frames}
    catch(e){console.error(e);toast('Animation illisible : '+(e.message||e),4000);return}finally{busy(false)}}
  const grab=()=>{if(frames)return PSX.canvas(frames[cur].rgba);const c=mk(v.videoWidth,v.videoHeight);cx(c).drawImage(v,0,0);return c};
  const stop=()=>{clearInterval(timer);timer=null;if(v)v.pause();if(url){URL.revokeObjectURL(url);url=null}};
  const total=frames?frames.length:0;
  const body=`<p class="muted" style="margin:0 0 8px">${frames?`${total} images. Choisissez celle à garder, ou mettez-les toutes en calques.`:`${esc(d.motion.from)} : choisissez le moment à garder. La vidéo est moins définie que la photo.`}</p>
    <div style="display:grid;place-items:center;background:var(--raise);border-radius:6px;margin-bottom:8px">${frames?'<canvas id="mo-c" style="max-width:100%;max-height:300px;display:block"></canvas>':'<video id="mo-v" muted playsinline loop style="max-width:100%;max-height:300px;display:block"></video>'}</div>
    <div class="row"><label for="mo-t">Image</label><input type="range" id="mo-t" min="0" max="${frames?total-1:1000}" step="1" value="0"><output id="mo-t-o"></output></div>
    <div class="inline" style="gap:6px;flex-wrap:wrap"><button class="btn sm" id="mo-play">Lire</button>${frames?'<button class="btn sm" id="mo-all">Toutes en calques</button>':'<button class="btn sm" id="mo-vid">Enregistrer la vidéo</button><button class="btn sm" id="mo-gif">Enregistrer en GIF animé</button>'}</div>
    <p class="muted" id="mo-st" aria-live="polite" style="min-height:1.2em;margin:6px 0 0"></p>`;
  const el=dialog({title:frames?'Images de l’animation':'Photo animée',light:true,body,
    onOpen:el=>{const t=$('#mo-t',el),o=$('#mo-t-o',el),st=$('#mo-st',el);
      if(frames){const c=$('#mo-c',el);c.width=frames[0].rgba.width;c.height=frames[0].rgba.height;const show=i=>{cur=i;rx(c).putImageData(new ImageData(new Uint8ClampedArray(frames[i].rgba.data),c.width,c.height),0,0);t.value=i;o.textContent=(i+1)+' / '+total};show(0);
        t.oninput=()=>show(+t.value);
        $('#mo-play',el).onclick=e=>{if(timer){clearInterval(timer);timer=null;e.target.textContent='Lire';return}e.target.textContent='Pause';const step=()=>{show((cur+1)%total)};timer=setInterval(step,Math.max(20,frames[0].delayMs||100))};
        $('#mo-all',el).onclick=()=>{stop();closeDialog();allLayers(d,frames,nm)}}
      else{v=$('#mo-v',el);url=URL.createObjectURL(d.motion.blob);v.src=url;
        v.onerror=()=>{st.textContent='Cette vidéo ne se lit pas dans ce navigateur (souvent HEVC) : vous pouvez l’enregistrer et l’ouvrir ailleurs.';$('#mo-gif',el).disabled=true};
        v.onloadedmetadata=()=>{const dur=v.duration||0;const ts=d.motion.ts>=0?d.motion.ts/1e6:0;seekTo(v,Math.min(dur,ts));t.value=dur?Math.round(Math.min(dur,ts)/dur*1000):0;o.textContent=fmtT(v.currentTime)+(d.motion.ts>=0?' (moment de la photo)':'')};
        v.ontimeupdate=()=>{if(!v.paused&&v.duration){t.value=Math.round(v.currentTime/v.duration*1000);o.textContent=fmtT(v.currentTime)}};
        t.oninput=()=>{v.pause();$('#mo-play',el).textContent='Lire';if(v.duration){seekTo(v,+t.value/1000*v.duration);o.textContent=fmtT(+t.value/1000*v.duration)}};
        $('#mo-play',el).onclick=e=>{if(v.paused){v.play().catch(()=>{});e.target.textContent='Pause'}else{v.pause();e.target.textContent='Lire'}};
        $('#mo-vid',el).onclick=()=>saveFile(d.motion.blob,nm+(/quicktime/.test(d.motion.type)?'.mov':'.mp4'));
        $('#mo-gif',el).onclick=()=>videoGif(v,nm,st)}},
    buttons:[{label:'Fermer',onClick:stop},
      {label:'Ajouter en calque',onClick:()=>{const c=grab();stop();if(S.doc!==d)return;pasteClip(coverC(c,d.w,d.h),'Image de l’animation')}},
      {label:'Ouvrir cette image',primary:true,onClick:()=>{const c=grab();stop();setDoc(c,nm+'-image.png',{meta:frames?'Image d’une animation':'Image d’une '+(d.motion.from)})}}]});
  return el}
const fmtT=s=>(Math.round(s*100)/100).toFixed(2).replace('.',',')+' s';
function allLayers(d,frames,nm){if(S.doc!==d)return;const n=frames.length;
  const grp={id:'g'+uid8(),name:'Animation ('+n+' images)'};
  /* sous les calques de réglage du haut, comme une photo */
  let at=d.layers.length;while(at>0&&d.layers[at-1].kind==='adjust')at--;
  const Ls=frames.map((f,i)=>{const L=newPixel('Image '+(i+1),coverC(PSX.canvas(f.rgba),d.w,d.h));if(i>0)L.visible=false;L.grp={...grp};return L});
  d.layers.splice(at,0,...Ls);d.active=at;markComp();pushHistory('Images de l’animation en calques');syncAll();toast(n+' calques ajoutés (seul le premier est visible)')}
/* GIF animé : jusqu'à 6 s de la vidéo, 12 images par seconde, 480 px de large au plus */
async function videoGif(v,nm,st){const dur=Math.min(6,v.duration||0);if(!dur){st.textContent='Vidéo vide';return}
  const k=Math.min(1,480/Math.max(v.videoWidth,v.videoHeight)),w=Math.max(2,Math.round(v.videoWidth*k)),h=Math.max(2,Math.round(v.videoHeight*k)),fps=12,n=Math.max(2,Math.round(dur*fps)),frames=[];
  v.pause();const t0=v.currentTime;busy(true,'Préparation du GIF…',0);let j=null;
  try{for(let i=0;i<n;i++){await seekTo(v,i/fps);const c=mk(w,h);cx(c).drawImage(v,0,0,w,h);frames.push({rgba:PSX.img(c),delayMs:Math.round(1000/fps)});busy(true,'Préparation du GIF…',i/n*.4)}
    j=PSX.track(PSX.run('encodeGif',{frames},{onProgress:f=>busy(true,'Préparation du GIF…',.4+f*.6)}));const out=await j.promise;
    saveFile(new Blob([out],{type:'image/gif'}),nm+'.gif');st.textContent='GIF enregistré ('+n+' images, '+w+' × '+h+' px)'}
  catch(e){if(!PSX.cancelled(e)){console.error(e);st.textContent='GIF impossible : '+(e.message||e)}}
  finally{PSX.untrack(j);busy(false);seekTo(v,t0)}}
PSX.motionDialog=motionDialog;PSX.findMotion=findMotion;PSX.decodeQOI=decodeQOI;PSX.jpxPDF=jpxPDF;
PSX.addToMenu('image',null,()=>{const d=S.doc;return[MI(d&&d.anim?'Images de l’animation…':'Photo animée…',{icon:'filter',dis:!d?NODOC:(d.motion||d.anim)?false:'Ouvrez une photo animée (Motion Photo, Live Photo avec sa vidéo), un GIF ou un PNG animé',fn:motionDialog})]},/^Taille de l’image/);
