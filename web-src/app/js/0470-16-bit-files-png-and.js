/* ================= 16-bit files: PNG and TIFF ================= */
function iccRGB(name,r,g,b){/* generalised from iccP3 */const p=iccP3();if(name==='Display P3')return p;
  const out=p.slice(),dv=new DataView(out.buffer),n=dv.getUint32(128),s15=v=>Math.round(v*65536)|0;
  for(let i=0;i<n;i++){const o=132+i*12,sig=String.fromCharCode(out[o],out[o+1],out[o+2],out[o+3]),off=dv.getUint32(o+4);const set=v=>{dv.setInt32(off+8,s15(v[0]));dv.setInt32(off+12,s15(v[1]));dv.setInt32(off+16,s15(v[2]))};
    if(sig==='rXYZ')set(r);if(sig==='gXYZ')set(g);if(sig==='bXYZ')set(b);
    if(sig==='desc'){const len=dv.getUint32(off+20),so=off+dv.getUint32(off+24),t=name.padEnd(len/2,' ').slice(0,len/2);for(let k=0;k<len/2;k++)dv.setUint16(so+k*2,t.charCodeAt(k))}}return out}
const ICC={srgb:()=>ICC._s||(ICC._s=iccRGB('sRGB IEC61966-2.1',[0.4360747,0.2225045,0.0139322],[0.3850649,0.7168786,0.0971045],[0.1430804,0.0606169,0.7141733])),p3:()=>ICC._p||(ICC._p=iccP3())};
async function zlib(u8){const s=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(s).arrayBuffer())}
async function unzlib(u8){const s=new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'));return new Uint8Array(await new Response(s).arrayBuffer())}
function pngChunk(type,data){const b=new Uint8Array(12+data.length),v=new DataView(b.buffer);v.setUint32(0,data.length);for(let i=0;i<4;i++)b[4+i]=type.charCodeAt(i);b.set(data,8);v.setUint32(8+data.length,CRC(b.subarray(4,8+data.length)));return b}
async function encodePNG16(img,space,alpha){const{data,w,h}=img,ch=alpha?4:3,bpp=ch*2,stride=w*bpp+1,raw=new Uint8Array(stride*h);
  for(let y=0;y<h;y++){const o=y*stride;raw[o]=1;/* Sub filter */let p=o+1;for(let x=0;x<w;x++){const s=(y*w+x)*4;for(let c=0;c<ch;c++){const v=data[s+c];raw[p++]=v>>8;raw[p++]=v&255}}
    for(let i=o+stride-1;i>o+bpp;i--)raw[i]=(raw[i]-raw[i-bpp])&255}
  const ih=new Uint8Array(13),iv=new DataView(ih.buffer);iv.setUint32(0,w);iv.setUint32(4,h);ih[8]=16;ih[9]=alpha?6:2;
  const enc=new TextEncoder(),parts=[new Uint8Array([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ih)];
  if(space==='display-p3'){const nm=enc.encode('Display P3'),z=await zlib(ICC.p3()),c=new Uint8Array(nm.length+2+z.length);c.set(nm);c.set(z,nm.length+2);parts.push(pngChunk('iCCP',c))}else parts.push(pngChunk('sRGB',new Uint8Array([0])));
  const z=await zlib(raw);for(let i=0;i<z.length;i+=1<<20)parts.push(pngChunk('IDAT',z.subarray(i,Math.min(z.length,i+(1<<20)))));parts.push(pngChunk('IEND',new Uint8Array(0)));return new Blob(parts,{type:'image/png'})}
async function decodePNG(u8){/* any bit depth 8/16, colour types 0,2,4,6, non-interlaced; returns {data:Uint16Array RGBA,w,h} */const v=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);let p=8,w=0,h=0,bd=8,ct=6,il=0;const idat=[];
  while(p<u8.length){const len=v.getUint32(p),type=String.fromCharCode(u8[p+4],u8[p+5],u8[p+6],u8[p+7]);if(type==='IHDR'){w=v.getUint32(p+8);h=v.getUint32(p+12);bd=u8[p+16];ct=u8[p+17];il=u8[p+20]}else if(type==='IDAT')idat.push(u8.subarray(p+8,p+8+len));else if(type==='IEND')break;p+=12+len}
  if(il||![0,2,4,6].includes(ct)||![8,16].includes(bd))throw new Error('PNG non pris en charge');const ch={0:1,2:3,4:2,6:4}[ct],B=bd/8,bpp=ch*B,stride=w*bpp;
  const raw=await unzlib(new Uint8Array(await new Blob(idat).arrayBuffer())),cur=new Uint8Array(stride),prev=new Uint8Array(stride),out=new Uint16Array(w*h*4);
  for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));for(let i=0;i<stride;i++){const a=i>=bpp?cur[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;let x=s[i];
      if(f===1)x+=a;else if(f===2)x+=b;else if(f===3)x+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);x+=pa<=pb&&pa<=pc?a:pb<=pc?b:c}cur[i]=x&255}
    for(let x=0;x<w;x++){const q=(y*w+x)*4,val=c=>B===2?(cur[x*bpp+c*2]<<8)|cur[x*bpp+c*2+1]:cur[x*bpp+c]*257;if(ch>=3){out[q]=val(0);out[q+1]=val(1);out[q+2]=val(2);out[q+3]=ch===4?val(3):65535}else{const g=val(0);out[q]=out[q+1]=out[q+2]=g;out[q+3]=ch===2?val(1):65535}}prev.set(cur)}
  return{data:out,w,h,bits:bd}}
async function encodeTIFF16(img,space,alpha){const{data,w,h}=img,ch=alpha?4:3,n=w*h,pix=new Uint8Array(n*ch*2);let p=0;for(let i=0;i<n;i++){const s=i*4;for(let c=0;c<ch;c++){const v=data[s+c];pix[p++]=v&255;pix[p++]=v>>8}}
  const comp=await zlib(pix),icc=space==='display-p3'?ICC.p3():ICC.srgb(),tags=[];const T=(id,type,count,val)=>tags.push({id,type,count,val});
  const nT=alpha?12:11,ifd=8,ifdLen=2+nT*12+4,bpsOff=ifd+ifdLen,iccOff=bpsOff+8,dataOff=iccOff+icc.length+(icc.length&1);
  T(256,4,1,w);T(257,4,1,h);T(258,3,ch,bpsOff);T(259,3,1,8);T(262,3,1,2);T(273,4,1,dataOff);T(277,3,1,ch);T(278,4,1,h);T(279,4,1,comp.length);T(284,3,1,1);if(alpha)T(338,3,1,2);T(34675,7,icc.length,iccOff);
  const head=new Uint8Array(dataOff),v=new DataView(head.buffer);head[0]=73;head[1]=73;v.setUint16(2,42,true);v.setUint32(4,ifd,true);v.setUint16(ifd,nT,true);
  tags.forEach((t,i)=>{const o=ifd+2+i*12;v.setUint16(o,t.id,true);v.setUint16(o+2,t.type,true);v.setUint32(o+4,t.count,true);if(t.type===3&&t.count===1)v.setUint16(o+8,t.val,true);else v.setUint32(o+8,t.val,true)});v.setUint32(ifd+2+nT*12,0,true);
  for(let c=0;c<4;c++)v.setUint16(bpsOff+c*2,16,true);head.set(icc,iccOff);return new Blob([head,comp],{type:'image/tiff'})}
async function doExport16(fmt,scale,name){const d=S.doc;busy(true,'Export 16 bits…',0);await tick();let blob,fname;
  try{const img=await renderDoc16(scale,{progress:p=>busy(true,'Export 16 bits…',p*0.7)});let alpha=false;for(let i=3;i<img.data.length;i+=4)if(img.data[i]<65535){alpha=true;break}
    busy(true,'Compression…',0.8);await tick();const sp=d.space||'srgb';blob=fmt==='tiff'?await encodeTIFF16(img,sp,alpha):await encodePNG16(img,sp,alpha);fname=name+(fmt==='tiff'?'.tif':'.png')}
  catch(e){console.error(e);busy(false);toast('Export impossible : '+(e.message||e),5000);return}busy(false);return saveOut(blob,fname);
  await dlReady;if(dlNS){try{await dlNS.save({filename:fname,data:blob});toast('Photo 16 bits enregistrée : '+fname);return}catch(e){if(e&&e.code==='declined'){toast('Enregistrement annulé');return}}
    try{const z=await makeZip([{name:fname,data:new Uint8Array(await blob.arrayBuffer())}]);await dlNS.save({filename:fname+'.zip',data:z});toast('Photo 16 bits enregistrée (dans un .zip) : '+fname);return}catch(e){if(e&&e.code==='declined'){toast('Enregistrement annulé');return}}}
  await saveFile(blob,fname)}
/* 16-bit PNG import */
async function open16(file){const u8=new Uint8Array(await file.arrayBuffer());if(!(u8[0]===137&&u8[1]===80&&u8[25-1]===16))return false;busy(true,'Lecture du PNG 16 bits…',null);
  try{let im;try{im=await decodePNG(u8)}catch(e){console.warn(e);return false} // interlaced etc.: the browser decoder takes over
    const c=canvasFrom16(im);c._hi=im.data; // pixels are sRGB: no mk(), which tags the canvas with the working space
    setDoc(c,file.name,{meta:'PNG 16 bits'});toast('PNG 16 bits ouvert : '+file.name);return true}
  finally{busy(false)}}
/* hi in projects: 1024 px 16-bit PNG tiles */
const HI_TILE=1024,hiEnc=new WeakMap();
async function encodeHi(L){const a=effHi(L);if(!a)return null;const hit=hiEnc.get(a);if(hit)return hit;const w=L.canvas.width,h=L.canvas.height,tiles=[];
  for(let y=0;y<h;y+=HI_TILE)for(let x=0;x<w;x+=HI_TILE){const tw=Math.min(HI_TILE,w-x),th=Math.min(HI_TILE,h-y),t=new Uint16Array(tw*th*4);for(let r=0;r<th;r++)t.set(a.subarray(((y+r)*w+x)*4,((y+r)*w+x+tw)*4),r*tw*4);
    const key='t_'+uid8();pin(key);await IDB.put('blobs',key,await encodePNG16({data:t,w:tw,h:th},'srgb',true));tiles.push({x,y,w:tw,h:th,key});await tick()}
  hiEnc.set(a,tiles);return tiles}
async function decodeHi(tiles,w,h,getBlob){const out=new Uint16Array(w*h*4);for(const t of tiles){const b=await getBlob(t);if(!b)throw new Error('tuile 16 bits manquante');const im=await decodePNG(new Uint8Array(await b.arrayBuffer()));
    for(let r=0;r<im.h;r++)out.set(im.data.subarray(r*im.w*4,(r+1)*im.w*4),((t.y+r)*w+t.x)*4)}return out}
function precLabel(){const d=S.doc;return d&&docHasHi(d)&&precOK()?'16 bits':''}
function togglePrec(){PREC.on=!PREC.on;PREC.fail=false;PREF.set('hiPrec',PREC.on);FCACHE.key='';markComp();toast(PREC.on?'Rendu haute précision activé (calcul en virgule flottante, 16 bits conservés)':'Rendu haute précision désactivé (8 bits, plus rapide sur les machines modestes)',5000);updateDocName()}
const _markComp4=markComp;markComp=function(){hiForget();FCACHE.key='';_markComp4()};

