/* ================= formats: metadata, extra decoders (TIFF, HEIC, PDF, TGA, SVG) ================= */
const FMT={info:new WeakMap(),heif:null,pdf:null,avif:null,webpOK:null};
/* TIFF structure reader, shared by TIFF files and EXIF blocks */
function tiffRead(u8,base=0){const v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),le=u8[base]===0x49;
  const g16=o=>v.getUint16(base+o,le),g32=o=>v.getUint32(base+o,le);if(g16(2)!==42)throw new Error('TIFF invalide');
  const SZ={1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8,13:4};
  const readIFD=off=>{const n=g16(off),tags=new Map();for(let i=0;i<n;i++){const e=off+2+i*12,id=g16(e),type=g16(e+2),cnt=g32(e+4),sz=(SZ[type]||1)*cnt;tags.set(id,{type,cnt,vo:sz<=4?e+8:g32(e+8),eo:e})}return{tags,next:g32(off+2+n*12),off}};
  const one=(t,i=0)=>{const o=t.vo;switch(t.type){case 1:case 7:return u8[base+o+i];case 6:return v.getInt8(base+o+i);case 3:return g16(o+i*2);case 8:return v.getInt16(base+o+i*2,le);case 4:case 13:return g32(o+i*4);case 9:return v.getInt32(base+o+i*4,le);
    case 5:{const a=g32(o+i*8),b=g32(o+i*8+4);return b?a/b:0}case 10:{const a=v.getInt32(base+o+i*8,le),b=v.getInt32(base+o+i*8+4,le);return b?a/b:0}case 11:return v.getFloat32(base+o+i*4,le);case 12:return v.getFloat64(base+o+i*8,le);default:return u8[base+o+i]}};
  const R={le,base,u8,readIFD,ifds:[],
    val:(ifd,id)=>{const t=ifd.tags.get(id);return t?one(t):undefined},
    arr:(ifd,id)=>{const t=ifd.tags.get(id);if(!t)return undefined;const a=new Array(t.cnt);for(let i=0;i<t.cnt;i++)a[i]=one(t,i);return a},
    str:(ifd,id)=>{const t=ifd.tags.get(id);if(!t)return '';let s='';for(let i=0;i<t.cnt;i++){const c=u8[base+t.vo+i];if(!c)break;s+=String.fromCharCode(c)}return s.trim()},
    bytes:(ifd,id)=>{const t=ifd.tags.get(id);if(!t)return null;const n=t.cnt*(SZ[t.type]||1);return u8.subarray(base+t.vo,base+t.vo+n)}};
  let off=g32(4),guard=0;const seen=new Set();while(off&&off<u8.length-base&&!seen.has(off)&&guard++<64){seen.add(off);const f=readIFD(off);R.ifds.push(f);off=f.next}
  return R}
/* "Canon EOS R5 · ISO 100 · 1/250 s · f/8 · 35 mm" plus the parsed fields */
function exifSummary(T){try{const i0=T.ifds[0];if(!i0)return null;const o={};o.make=T.str(i0,0x010F);o.model=T.str(i0,0x0110);o.orient=T.val(i0,0x0112)||1;o.soft=T.str(i0,0x0131);
    const ep=T.val(i0,0x8769);if(ep){const e=T.readIFD(ep);o.exp=T.val(e,0x829A);o.fn=T.val(e,0x829D);o.iso=T.val(e,0x8827);o.date=T.str(e,0x9003);o.focal=T.val(e,0x920A);o.lens=T.str(e,0xA434)}
    let cam=o.model||'';if(o.make&&cam&&!cam.toLowerCase().startsWith(o.make.split(' ')[0].toLowerCase()))cam=o.make.split(' ')[0].replace(/^NIKON$/,'Nikon').replace(/^SONY$/,'Sony').replace(/^CANON$/,'Canon')+' '+cam;
    const p=[];if(cam)p.push(cam);if(o.iso)p.push('ISO '+o.iso);if(o.exp)p.push(o.exp>=1?o.exp.toFixed(o.exp%1?1:0)+' s':'1/'+Math.round(1/o.exp)+' s');if(o.fn)p.push('f/'+(+o.fn.toFixed(1)));if(o.focal)p.push(Math.round(o.focal)+' mm');o.line=p.join(' · ');return o}catch(e){return null}}
/* metadata from a JPEG / PNG / WebP / TIFF header: EXIF (TIFF payload) and ICC profile */
async function readMeta(u8){const out={exif:null,icc:null};try{
  if(u8[0]===0xFF&&u8[1]===0xD8){let p=2;const icc=[];while(p+4<u8.length){if(u8[p]!==0xFF){p++;continue}const mk=u8[p+1];if(mk===0xD8||mk===0x01||(mk>=0xD0&&mk<=0xD7)){p+=2;continue}if(mk===0xDA||mk===0xD9)break;const len=(u8[p+2]<<8)|u8[p+3],s=p+4;
      if(mk===0xE1&&u8[s]===0x45&&u8[s+1]===0x78&&u8[s+2]===0x69&&u8[s+3]===0x66&&!out.exif)out.exif=u8.slice(s+6,p+2+len);
      if(mk===0xE2&&String.fromCharCode(...u8.subarray(s,s+11))==='ICC_PROFILE')icc.push({n:u8[s+12],d:u8.subarray(s+14,p+2+len)});p+=2+len}
    if(icc.length){icc.sort((a,b)=>a.n-b.n);const n=icc.reduce((a,b)=>a+b.d.length,0),r=new Uint8Array(n);let o=0;for(const c of icc){r.set(c.d,o);o+=c.d.length}out.icc=r}}
  else if(u8[0]===137&&u8[1]===80&&u8[2]===78){const v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);let p=8;while(p+8<=u8.length){const len=v.getUint32(p),ty=String.fromCharCode(...u8.subarray(p+4,p+8));
      if(ty==='iCCP'){let q=p+8;while(u8[q])q++;try{out.icc=await unzlib(u8.subarray(q+2,p+8+len))}catch(e){}}if(ty==='eXIf')out.exif=u8.slice(p+8,p+8+len);if(ty==='IDAT'||ty==='IEND')break;p+=12+len}}
  else if(String.fromCharCode(...u8.subarray(0,4))==='RIFF'&&String.fromCharCode(...u8.subarray(8,12))==='WEBP'){const v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);let p=12;while(p+8<=u8.length){const ty=String.fromCharCode(...u8.subarray(p,p+4)),len=v.getUint32(p+4,true);
      if(ty==='ICCP')out.icc=u8.slice(p+8,p+8+len);if(ty==='EXIF'){let d=u8.subarray(p+8,p+8+len);if(d[0]===0x45&&d[1]===0x78)d=d.subarray(6);out.exif=d.slice()}p+=8+len+(len&1)}}
  else if((u8[0]===0x49&&u8[1]===0x49)||(u8[0]===0x4D&&u8[1]===0x4D)){const T=tiffRead(u8);const i0=T.ifds[0];out.icc=T.bytes(i0,34675);out.tiff=T}
  }catch(e){console.warn('meta',e)}return out}
/* ICC header helpers */
function iccInfo(icc){try{if(!icc||icc.length<132)return null;const v=new DataView(icc.buffer,icc.byteOffset,icc.byteLength);const cs=String.fromCharCode(...icc.subarray(16,20));const n=v.getUint32(128);let wide=false,desc='';
    for(let i=0;i<n;i++){const e=132+i*12,sig=String.fromCharCode(...icc.subarray(e,e+4)),off=v.getUint32(e+4);
      if(sig==='gXYZ'){const X=v.getInt32(off+8)/65536,Y=v.getInt32(off+12)/65536,Z=v.getInt32(off+16)/65536;if(Y/(X+Y+Z)>0.63)wide=true}
      if(sig==='desc'){const t=String.fromCharCode(...icc.subarray(off,off+4));if(t==='desc'){const l=v.getUint32(off+8);desc=String.fromCharCode(...icc.subarray(off+12,off+12+Math.max(0,l-1)))}else if(t==='mluc'){const l=v.getUint32(off+20),o=v.getUint32(off+24);let s='';for(let k=0;k<l;k+=2)s+=String.fromCharCode(v.getUint16(off+o+k));desc=s}}}
    return{cs,wide,desc:desc.replace(/\0/g,'').trim()}}catch(e){return null}}
const wantP3=icc=>{const i=iccInfo(icc);return!!(P3_OK&&i&&i.cs==='RGB '&&i.wide)};

/* ---- TIFF decoder: strips or tiles, none / LZW / Deflate / PackBits, predictors 2 and 3, 8/16/32-bit, gray, RGB, palette, CMYK, alpha, ICC ---- */
function lzwTIFF(src,outLen){const out=new Uint8Array(outLen),pre=new Int32Array(4096),suf=new Uint8Array(4096),len=new Int32Array(4096),fst=new Uint8Array(4096);for(let i=0;i<256;i++){pre[i]=-1;suf[i]=i;len[i]=1;fst[i]=i}
  const n=src.length,pad=new Uint8Array(n+4);pad.set(src);let bit=0,width=9,next=258,old=-1,op=0;const total=n*8;
  const read=()=>{if(bit+width>total)return 257;const p=bit>>3,v=(pad[p]<<16)|(pad[p+1]<<8)|pad[p+2],sh=24-(bit&7)-width;bit+=width;return(v>>>sh)&((1<<width)-1)};
  const emit=c=>{const l=len[c];let x=c;for(let k=op+l-1;k>=op;k--){if(k<outLen)out[k]=suf[x];x=pre[x]}op+=l};
  while(op<outLen){let c=read();if(c===257)break;if(c===256){next=258;width=9;c=read();if(c===257)break;if(c>255)break;emit(c);old=c;continue}
    if(old<0){emit(c);old=c;continue}
    if(c<next){emit(c);if(next<4096){pre[next]=old;suf[next]=fst[c];len[next]=len[old]+1;fst[next]=fst[old];next++}}
    else{if(next<4096){pre[next]=old;suf[next]=fst[old];len[next]=len[old]+1;fst[next]=fst[old];next++}emit(c<next?c:next-1)}
    old=c;if(next+1>=(1<<width)&&width<12)width++}
  return out}
function packBits(src,outLen){const out=new Uint8Array(outLen);let i=0,o=0;while(i<src.length&&o<outLen){const n=(src[i]<<24)>>24;i++;if(n>=0){for(let k=0;k<=n&&o<outLen;k++)out[o++]=src[i++]}else if(n!==-128){const b=src[i++];for(let k=0;k<1-n&&o<outLen;k++)out[o++]=b}}return out}
async function decodeTIFF(u8){const T=tiffRead(u8);if(!T.ifds.length)throw new Error('TIFF vide');
  let ifd=T.ifds[0],best=0;for(const f of T.ifds){const w=T.val(f,256)||0,h=T.val(f,257)||0,sub=T.val(f,254)||0;if(!(sub&1)&&w*h>best){best=w*h;ifd=f}}
  const W=T.val(ifd,256),H=T.val(ifd,257),bps=T.arr(ifd,258)||[1],spp=T.val(ifd,277)||1,comp=T.val(ifd,259)||1,photo=T.val(ifd,262)??2,planar=T.val(ifd,284)||1,pred=T.val(ifd,317)||1,sfmt=(T.arr(ifd,339)||[1])[0],extra=T.arr(ifd,338)||[];
  const bits=bps[0];if(![8,16,32].includes(bits)||(bits===32&&sfmt!==3))throw new Error(`profondeur ${bits} bits non prise en charge`);if(![1,5,8,32946,32773].includes(comp))throw new Error('compression TIFF non prise en charge ('+comp+')');
  if(![0,1,2,3,5].includes(photo))throw new Error('espace couleur TIFF non pris en charge');if(W*H>MAX_PX*1.6)throw new Error(`image trop grande (${W} × ${H})`);
  const B=bits/8,cps=planar===2?1:spp,tiled=ifd.tags.has(322),tw=tiled?T.val(ifd,322):W,th=tiled?T.val(ifd,323):(T.val(ifd,278)||H),offs=T.arr(ifd,tiled?324:273),cnts=T.arr(ifd,tiled?325:279);
  const raw=bits===8?new Uint8Array(W*H*spp):bits===16?new Uint16Array(W*H*spp):new Float32Array(W*H*spp);const le=T.le;
  const across=Math.ceil(W/tw),down=Math.ceil(H/th),perPlane=across*down;
  for(let k=0;k<offs.length;k++){const pl=planar===2?Math.floor(k/perPlane):0,kk=k%perPlane,x0=(kk%across)*tw,y0=Math.floor(kk/across)*th;if(y0>=H)continue;
    const rows=tiled?th:Math.min(th,H-y0),need=tw*rows*cps*B,src=u8.subarray(offs[k],offs[k]+cnts[k]);let buf;
    if(comp===1)buf=src;else if(comp===5)buf=lzwTIFF(src,need);else if(comp===32773)buf=packBits(src,need);else buf=await unzlib(src);
    if(buf.length<need){const b=new Uint8Array(need);b.set(buf);buf=b}
    if(pred===3){const wc=tw*cps,row=wc*B,tmp=new Uint8Array(row);buf=buf===src?buf.slice():buf;for(let r=0;r<rows;r++){const o=r*row;for(let i=cps;i<row;i++)buf[o+i]=(buf[o+i]+buf[o+i-cps])&255;tmp.set(buf.subarray(o,o+row));for(let c=0;c<wc;c++)for(let b=0;b<B;b++)buf[o+c*B+b]=tmp[(B-b-1)*wc+c]}}
    const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength),fle=pred===3?true:le;
    for(let r=0;r<rows;r++){const y=y0+r;if(y>=H)break;for(let x=0;x<tw;x++){const X=x0+x;if(X>=W)break;const si=(r*tw+x)*cps,di=(y*W+X)*spp+pl;
        for(let c=0;c<cps;c++){let v=bits===8?buf[si+c]:bits===16?dv.getUint16((si+c)*2,fle):dv.getFloat32((si+c)*4,fle);
          if(pred===2&&x>0)v=bits===8?(v+raw[di+c-spp])&255:(v+raw[di+c-spp])&65535;raw[di+c]=v}}}
    if(k%8===7)await tick()}
  /* to RGBA 16-bit */
  const N=W*H,rgba=new Uint16Array(N*4),hasA=(photo===2&&spp>=4)||(photo<=1&&spp>=2)||(photo===5&&spp>=5),aIdx=photo===2?3:photo===5?4:1,assoc=extra[0]===1;
  const to16=bits===8?(v=>v*257):bits===16?(v=>v):(v=>{v=v<=0?0:v>=1?1:v;return Math.round(v*65535)});
  let icc=T.bytes(ifd,34675);icc=icc&&icc.slice();let space='srgb',linear=false;
  if(photo===3){const cm=T.arr(ifd,320),nc=1<<bits;for(let i=0;i<N;i++){const ix=raw[i*spp];rgba[i*4]=cm[ix];rgba[i*4+1]=cm[nc+ix];rgba[i*4+2]=cm[2*nc+ix];rgba[i*4+3]=65535}}
  else if(photo<=1){for(let i=0;i<N;i++){let g=to16(raw[i*spp]);if(photo===0)g=65535-g;rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=g;rgba[i*4+3]=hasA?to16(raw[i*spp+1]):65535}icc=null}
  else if(photo===2){for(let i=0;i<N;i++){const s=i*spp,d=i*4;rgba[d]=to16(raw[s]);rgba[d+1]=to16(raw[s+1]);rgba[d+2]=to16(raw[s+2]);rgba[d+3]=hasA?to16(raw[s+3]):65535}}
  if(linear&&photo===2){const L=new Uint16Array(65536);for(let i=0;i<65536;i++){const x=i/65535;L[i]=Math.round(65535*(x<=0.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-0.055))}for(let i=0;i<N;i++){const d=i*4;rgba[d]=L[rgba[d]];rgba[d+1]=L[rgba[d+1]];rgba[d+2]=L[rgba[d+2]]}}
  if(hasA&&assoc){for(let i=0;i<N;i++){const d=i*4,a=rgba[d+3];if(a&&a<65535){const f=65535/a;rgba[d]=Math.min(65535,rgba[d]*f);rgba[d+1]=Math.min(65535,rgba[d+1]*f);rgba[d+2]=Math.min(65535,rgba[d+2]*f)}}}
  if(photo===5){/* CMYK: through the embedded profile when there is one */
    let done=false;if(icc){try{const m=await CMS.load(),h=CMS.open(icc);if(h){const xf=m.cmsCreateTransform(h,CMS.ns.TYPE_CMYK_16,CMS.srgb,CMS.ns.TYPE_RGB_16,0,0x2000);if(xf){const CH=1<<20,tmp=new Uint16Array(CH*4);
          for(let s=0;s<N;s+=CH){const n=Math.min(CH,N-s);for(let i=0;i<n;i++)for(let c=0;c<4;c++)tmp[i*4+c]=to16(raw[(s+i)*spp+c]);const o=m.cmsDoTransform(xf,tmp.subarray(0,n*4),n);for(let i=0;i<n;i++){const d=(s+i)*4;rgba[d]=o[i*3];rgba[d+1]=o[i*3+1];rgba[d+2]=o[i*3+2];rgba[d+3]=hasA?to16(raw[(s+i)*spp+4]):65535}await tick()}
          m.cmsDeleteTransform(xf);done=true}m.cmsCloseProfile(h)}}catch(e){console.warn('cmyk icc',e)}}
    if(!done)for(let i=0;i<N;i++){const s=i*spp,d=i*4,k=1-to16(raw[s+3])/65535;rgba[d]=(65535-to16(raw[s]))*k;rgba[d+1]=(65535-to16(raw[s+1]))*k;rgba[d+2]=(65535-to16(raw[s+2]))*k;rgba[d+3]=hasA?to16(raw[s+4]):65535}
    icc=null}
  if(icc){const inf=iccInfo(icc);const sRGBish=inf&&/^sRGB/i.test(inf.desc);if(inf&&inf.cs==='RGB '&&!sRGBish){space=wantP3(icc)?'display-p3':'srgb';
      try{const m=await CMS.load(),h=CMS.open(icc);if(h){const xf=m.cmsCreateTransform(h,CMS.ns.TYPE_RGBA_16,space==='display-p3'?CMS.p3:CMS.srgb,CMS.ns.TYPE_RGBA_16,1,0x2000|0x04000000);if(xf){const CH=1<<20;
          for(let s=0;s<N;s+=CH){const n=Math.min(CH,N-s),o=m.cmsDoTransform(xf,rgba.subarray(s*4,(s+n)*4),n);rgba.set(o.subarray(0,n*4),s*4);await tick()}m.cmsDeleteTransform(xf)}m.cmsCloseProfile(h)}}catch(e){console.warn('icc',e);space='srgb'}}}
  const sum=exifSummary(T)||{};
  return{w:W,h:H,data:rgba,hi:bits>8,space,sum,icc:iccInfo(icc)}}
function canvasFrom16(im){const c=document.createElement('canvas');c.width=im.w;c.height=im.h;if(im.space==='display-p3')c._cs='display-p3';const g=rx(c),id=g.createImageData(im.w,im.h),s=im.data,d=id.data;for(let i=0;i<s.length;i++)d[i]=s[i]>>8;g.putImageData(id,0,0);if(im.hi)c._hi=im.data;return c}
/* ---- TGA ---- */
function decodeTGA(u8){const idl=u8[0],cmt=u8[1],type=u8[2],cmFirst=u8[3]|(u8[4]<<8),cmLen=u8[5]|(u8[6]<<8),cmBits=u8[7],W=u8[12]|(u8[13]<<8),H=u8[14]|(u8[15]<<8),bpp=u8[16],desc=u8[17];
  if(![1,2,3,9,10,11].includes(type)||!W||!H)throw new Error('TGA non pris en charge');const rle=type>8,base=type&7,B=bpp>>3;let p=18+idl;let cmap=null;
  if(cmt){const cb=cmBits>>3;cmap=[];for(let i=0;i<cmLen;i++){const o=p+i*cb;cmap[cmFirst+i]=cb===2?(()=>{const v=u8[o]|(u8[o+1]<<8);return[((v>>10)&31)*255/31,((v>>5)&31)*255/31,(v&31)*255/31,255]})():[u8[o+2],u8[o+1],u8[o],cb===4?u8[o+3]:255]}p+=cmLen*cb}
  const N=W*H,px=new Uint8Array(N*B);if(!rle)px.set(u8.subarray(p,p+N*B));else{let o=0;while(o<N*B&&p<u8.length){const h=u8[p++],n=(h&127)+1;if(h&128){const v=u8.subarray(p,p+B);p+=B;for(let k=0;k<n;k++){px.set(v,o);o+=B}}else{px.set(u8.subarray(p,p+n*B),o);p+=n*B;o+=n*B}}}
  const c=mk(W,H),g=rx(c),id=g.createImageData(W,H),d=id.data,top=desc&32,right=desc&16,abits=desc&15;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sy=top?y:H-1-y,sx=right?W-1-x:x,s=(sy*W+sx)*B,o=(y*W+x)*4;let r,gg,b,a=255;
    if(base===1){const e=cmap[B===2?px[s]|(px[s+1]<<8):px[s]]||[0,0,0,255];[r,gg,b,a]=e}else if(base===3){r=gg=b=px[s];if(B===2)a=px[s+1]}
    else if(B===2){const v=px[s]|(px[s+1]<<8);r=((v>>10)&31)*255/31;gg=((v>>5)&31)*255/31;b=(v&31)*255/31}else{b=px[s];gg=px[s+1];r=px[s+2];if(B===4&&abits)a=px[s+3]}
    d[o]=r;d[o+1]=gg;d[o+2]=b;d[o+3]=a}
  g.putImageData(id,0,0);return c}
/* ---- HEIC / HEIF through libheif when the browser cannot ---- */
async function decodeHEIF(u8){busy(true,'Décodage HEIC…',null);try{if(!FMT.heif){const ns=await import(asset('heic/libheif.js'));let m=ns.default();if(m&&m.then)m=await m;else if(m&&m.ready)await m.ready;FMT.heif=m}
    const lib=FMT.heif,dec=new lib.HeifDecoder(),imgs=dec.decode(u8);if(!imgs||!imgs.length)throw new Error('HEIC illisible');let im=imgs[0];for(const x of imgs)if(x.get_width()*x.get_height()>im.get_width()*im.get_height())im=x;
    const W=im.get_width(),H=im.get_height();const c=document.createElement('canvas');c.width=W;c.height=H;if(P3_OK)c._cs='display-p3';const g=rx(c),id=g.createImageData(W,H);
    await new Promise((res,rej)=>im.display(id,r=>r?res():rej(new Error('HEIC illisible'))));g.putImageData(id,0,0);imgs.forEach(x=>{try{x.free()}catch(e){}});FMT.info.set(c,{space:P3_OK?'display-p3':'srgb',meta:'HEIC'});return c}
  finally{busy(false)}}
/* ---- PDF: one page, rendered at 300 dpi ---- */
function askPage(n){return new Promise(res=>{let done=false;const fin=v=>{if(!done){done=true;res(v)}};dialog({title:'Quelle page ouvrir ?',body:`<p class="muted">Ce PDF contient ${n} pages.</p><label class="field">Page<input type="number" id="pgN" min="1" max="${n}" value="1"></label>`,onOpen:el=>{setTimeout(()=>$('#pgN',el).select(),30)},buttons:[{label:'Annuler',onClick:()=>fin(0)},{label:'Ouvrir',primary:true,onClick:el=>fin(clamp(+$('#pgN',el).value|0,1,n))}]});setTimeout(()=>{const s=$('.scrim');if(s)new MutationObserver((_,o)=>{if(!document.contains(s)){o.disconnect();fin(0)}}).observe(document.body,{childList:true})},50)})}
async function decodePDF(u8){busy(true,'Lecture du PDF…',null);let doc;try{if(!FMT.pdf){FMT.pdf=await import(asset('pdf/pdf.min.js'));FMT.pdf.GlobalWorkerOptions.workerSrc=asset('pdf/pdf.worker.min.js')}
    doc=await FMT.pdf.getDocument({data:u8.slice(),wasmUrl:asset('pdf/wasm/'),isEvalSupported:false,useSystemFonts:true}).promise}finally{busy(false)}
  let pn=1;if(doc.numPages>1){pn=await askPage(doc.numPages);if(!pn){const e=new Error('annulé');e.cancel=true;throw e}}
  busy(true,'Rendu de la page…',null);try{const page=await doc.getPage(pn),v0=page.getViewport({scale:1});let sc=300/72;const lim=Math.min(MAX_PX,40e6);if(v0.width*v0.height*sc*sc>lim)sc=Math.sqrt(lim/(v0.width*v0.height));
    const vp=page.getViewport({scale:sc}),c=mk(Math.floor(vp.width),Math.floor(vp.height)),g=cx(c);g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);await page.render({canvasContext:g,canvas:c,viewport:vp}).promise;try{doc.destroy()}catch(e){}
    FMT.info.set(c,{meta:`PDF · page ${pn} · 300 ppp`});return c}finally{busy(false)}}
/* ---- SVG: rasterise large enough to edit ---- */
async function decodeSVG(file){const url=URL.createObjectURL(new Blob([file],{type:'image/svg+xml'}));try{const im=new Image();await new Promise((r,j)=>{im.onload=r;im.onerror=()=>j(new Error('SVG illisible'));im.src=url});let w=im.naturalWidth||0,h=im.naturalHeight||0;
    if(!w||!h){const t=await file.text(),m=t.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);w=m?+m[1]:1000;h=m?+m[2]:1000}
    const s=Math.max(1,3000/Math.max(w,h)),c=mk(Math.round(w*s),Math.round(h*s));cx(c).drawImage(im,0,0,c.width,c.height);FMT.info.set(c,{meta:'SVG'});return c}finally{URL.revokeObjectURL(url)}}
/* sniff the real type from the first bytes */
function sniff(u8,name){const s4=String.fromCharCode(...u8.subarray(0,4)),n=(name||'').toLowerCase();
  if((u8[0]===0x49&&u8[1]===0x49&&u8[2]===42)||(u8[0]===0x4D&&u8[1]===0x4D&&u8[3]===42))return/\.(tiff?)$/.test(n)||!RAW_EXT.test(n)?'tiff':'raw';
  if(s4==='%PDF')return'pdf';if(String.fromCharCode(...u8.subarray(4,8))==='ftyp'){const b=String.fromCharCode(...u8.subarray(8,12));if(/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(b))return'heic';if(/^avi[fs]$/.test(b))return'avif'}
  if(/\.svg$/.test(n)||/^\s*<(\?xml|svg)/.test(String.fromCharCode(...u8.subarray(0,64))))return'svg';if(/\.tga$/.test(n))return'tga';
  if(u8[0]===0xFF&&u8[1]===0xD8)return'jpeg';if(u8[0]===137&&u8[1]===80)return'png';if(s4==='RIFF')return'webp';return''}
/* loadImageFile now understands every format: returns an <img> or a canvas (canvas._hi for 16-bit sources) */
const _loadImageFile=loadImageFile;
loadImageFile=async function(file){const u8=new Uint8Array(await file.slice(0,Math.min(file.size,1<<20)).arrayBuffer()),kind=sniff(u8,file.name);
  if(kind==='tiff'){busy(true,'Lecture du TIFF…',null);try{const im=await decodeTIFF(new Uint8Array(await file.arrayBuffer())),c=canvasFrom16(im);FMT.info.set(c,{space:im.space,meta:[im.sum.line,'TIFF'+(im.hi?' 16 bits':'')].filter(Boolean).join(' · '),exif:null,sum:im.sum});return c}finally{busy(false)}}
  if(kind==='pdf')return decodePDF(new Uint8Array(await file.arrayBuffer()));
  if(kind==='tga')return decodeTGA(new Uint8Array(await file.arrayBuffer()));
  if(kind==='svg')return decodeSVG(file);
  let im;try{im=await _loadImageFile(file)}catch(e){if(kind==='heic')return decodeHEIF(new Uint8Array(await file.arrayBuffer()));throw e}
  try{const m=await readMeta(u8.length<file.size&&kind==='png'?new Uint8Array(await file.arrayBuffer()):u8);const T=m.exif?(()=>{try{return tiffRead(m.exif)}catch(e){return null}})():null,sum=T?exifSummary(T):null;
    FMT.info.set(im,{space:wantP3(m.icc)?'display-p3':null,exif:m.exif&&m.exif.length<60000?m.exif:null,meta:sum&&sum.line||'',sum})}catch(e){}
  return im};
/* setDoc picks up colour space, EXIF and camera line found while decoding */
const _setDoc=setDoc;
setDoc=function(src,name,opts={}){const inf=FMT.info.get(src);if(inf){opts={...opts};if(inf.space&&!opts.space)opts.space=inf.space;if(inf.meta&&!opts.meta)opts.meta=inf.meta}_setDoc(src,name,opts);if(S.doc)S.doc.shot=inf&&inf.sum||null;if(S.doc)S.doc.exif=inf&&inf.exif||null};

