/* ================= formats: encoders ================= */
const be16=v=>[v>>8&255,v&255],le16=v=>[v&255,v>>8&255],le32=v=>[v&255,v>>8&255,v>>16&255,v>>>24&255];
/* EXIF copy for an exported file: orientation reset (pixels are already upright), size updated, embedded thumbnail dropped */
function exifForExport(ex,w,h){try{const u=ex.slice(),T=tiffRead(u),i0=T.ifds[0];if(!i0)return null;const v=new DataView(u.buffer),le=T.le;
    const setTag=(ifd,id,val)=>{const t=ifd.tags.get(id);if(!t)return;if(t.type===3&&val<65536)v.setUint16(t.eo+8,val,le);else if(t.type===4)v.setUint32(t.eo+8,val,le)};
    setTag(i0,0x0112,1);v.setUint32(i0.off+2+i0.tags.size*12,0,le);const ep=T.val(i0,0x8769);if(ep){const e=T.readIFD(ep);setTag(e,0xA002,w);setTag(e,0xA003,h)}return u}catch(e){return null}}
async function jpegWithMeta(blob,exif,icc){let u=new Uint8Array(await blob.arrayBuffer());if(!(u[0]===0xFF&&u[1]===0xD8))return blob;let p=2,hasICC=false,ins=2;
  while(p+4<u.length&&u[p]===0xFF){const mk=u[p+1];if(mk===0xDA)break;const len=(u[p+2]<<8)|u[p+3];if(mk===0xE0)ins=p+2+len;if(mk===0xE2&&String.fromCharCode(...u.subarray(p+4,p+15))==='ICC_PROFILE')hasICC=true;p+=2+len}
  const seg=[];if(exif&&exif.length<65000){seg.push(new Uint8Array([0xFF,0xE1,...be16(exif.length+8),0x45,0x78,0x69,0x66,0,0]),exif)}
  if(icc&&!hasICC&&icc.length<65000)seg.push(new Uint8Array([0xFF,0xE2,...be16(icc.length+16),...[...'ICC_PROFILE'].map(c=>c.charCodeAt(0)),0,1,1]),icc);
  if(!seg.length)return blob;return new Blob([u.subarray(0,ins),...seg,u.subarray(ins)],{type:'image/jpeg'})}
async function pngWithExif(blob,exif){if(!exif)return blob;const u=new Uint8Array(await blob.arrayBuffer());const v=new DataView(u.buffer);const ihdrEnd=8+12+v.getUint32(8);return new Blob([u.subarray(0,ihdrEnd),pngChunk('eXIf',exif),u.subarray(ihdrEnd)],{type:'image/png'})}

/* ---- baseline JPEG encoder with 4:4:4 chroma (browsers only offer 4:2:0 below quality 100) ---- */
const JPG=(()=>{const ZZ=[0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63];
  const YQ=[16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];
  const CQ=[17,18,24,47,99,99,99,99,18,21,26,66,99,99,99,99,24,26,56,99,99,99,99,99,47,66,99,99,99,99,99,99].concat(new Array(32).fill(99));
  const DCL=[[0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0],[0,1,2,3,4,5,6,7,8,9,10,11]],DCC=[[0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0],[0,1,2,3,4,5,6,7,8,9,10,11]];
  const ACL=[[0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d],[0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa]];
  const ACC=[[0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,0x77],[0x00,0x01,0x02,0x03,0x11,0x04,0x05,0x21,0x31,0x06,0x12,0x41,0x51,0x07,0x61,0x71,0x13,0x22,0x32,0x81,0x08,0x14,0x42,0x91,0xa1,0xb1,0xc1,0x09,0x23,0x33,0x52,0xf0,0x15,0x62,0x72,0xd1,0x0a,0x16,0x24,0x34,0xe1,0x25,0xf1,0x17,0x18,0x19,0x1a,0x26,0x27,0x28,0x29,0x2a,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x82,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa]];
  const codes=([n,v])=>{const c=new Int32Array(256),l=new Int32Array(256);let code=0,k=0;for(let i=0;i<16;i++){for(let j=0;j<n[i];j++){c[v[k]]=code;l[v[k]]=i+1;code++;k++}code<<=1}return{c,l}};
  const AAN=[1,1.387039845,1.306562965,1.175875602,1,0.785694958,0.5411961,0.275899379];
  function fdct(d){for(let o=0;o<64;o+=8)dct1(d,o,1);for(let o=0;o<8;o++)dct1(d,o,8)}
  function dct1(d,o,s){const d0=d[o],d1=d[o+s],d2=d[o+2*s],d3=d[o+3*s],d4=d[o+4*s],d5=d[o+5*s],d6=d[o+6*s],d7=d[o+7*s];
    const t0=d0+d7,t7=d0-d7,t1=d1+d6,t6=d1-d6,t2=d2+d5,t5=d2-d5,t3=d3+d4,t4=d3-d4;let t10=t0+t3,t13=t0-t3,t11=t1+t2,t12=t1-t2;
    d[o]=t10+t11;d[o+4*s]=t10-t11;const z1=(t12+t13)*0.707106781;d[o+2*s]=t13+z1;d[o+6*s]=t13-z1;
    t10=t4+t5;t11=t5+t6;t12=t6+t7;const z5=(t10-t12)*0.382683433,z2=0.5411961*t10+z5,z4=1.306562965*t12+z5,z3=t11*0.707106781,z11=t7+z3,z13=t7-z3;
    d[o+5*s]=z13+z2;d[o+3*s]=z13-z2;d[o+s]=z11+z4;d[o+7*s]=z11-z4}
  async function encode(img,quality,o={}){const W=img.width,H=img.height,px=img.data,q=clamp(Math.round(quality*100),1,100),sf=q<50?5000/q:200-q*2;
    const qt=b=>b.map(x=>clamp(Math.floor((x*sf+50)/100),1,255)),yq=qt(YQ),cq=qt(CQ),fy=new Float32Array(64),fc=new Float32Array(64);
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){const i=r*8+c;fy[i]=1/(yq[i]*AAN[r]*AAN[c]*8);fc[i]=1/(cq[i]*AAN[r]*AAN[c]*8)}
    const hDL=codes(DCL),hDC=codes(DCC),hAL=codes(ACL),hAC=codes(ACC);
    let buf=new Uint8Array(Math.max(1<<16,W*H*0.6|0)),bp=0,acc=0,nb=0;const grow=()=>{const b=new Uint8Array(buf.length*2);b.set(buf);buf=b};
    const wb=b=>{if(bp>=buf.length)grow();buf[bp++]=b};const bits=(code,len)=>{acc=(acc<<len)|code;nb+=len;while(nb>=8){const b=(acc>>(nb-8))&255;wb(b);if(b===255)wb(0);nb-=8}acc&=(1<<nb)-1};
    const head=[0xFF,0xD8,0xFF,0xE0,0,16,0x4A,0x46,0x49,0x46,0,1,1,1,0,72,0,72,0,0];
    const dqt=[0xFF,0xDB,0,132,0,...ZZ.map(i=>yq[i]),1,...ZZ.map(i=>cq[i])];
    const sof=[0xFF,0xC0,0,17,8,...be16(H),...be16(W),3,1,0x11,0,2,0x11,1,3,0x11,1];
    const dht=t=>[...t[0],...t[1]],dh=[0x00,...dht(DCL),0x10,...dht(ACL),0x01,...dht(DCC),0x11,...dht(ACC)],dhtS=[0xFF,0xC4,...be16(dh.length+2),...dh];
    const sos=[0xFF,0xDA,0,12,3,1,0x00,2,0x11,3,0x11,0,0x3F,0];
    const Y=new Float32Array(64),U=new Float32Array(64),V=new Float32Array(64),out=new Int32Array(64);let pY=0,pU=0,pV=0;
    const blk=(d,ft,prev,DC,AC)=>{fdct(d);for(let i=0;i<64;i++){const v=d[ZZ[i]]*ft[ZZ[i]];out[i]=v>0?(v+0.5)|0:(v-0.5)|0}
      const diff=out[0]-prev;if(!diff)bits(DC.c[0],DC.l[0]);else{const a=Math.abs(diff),n=32-Math.clz32(a);bits(DC.c[n],DC.l[n]);bits(diff<0?diff+(1<<n)-1:diff,n)}
      let end=63;while(end>0&&!out[end])end--;if(!end){bits(AC.c[0],AC.l[0]);return out[0]}
      for(let i=1;i<=end;){let run=0;while(!out[i]){run++;i++}while(run>=16){bits(AC.c[0xF0],AC.l[0xF0]);run-=16}const v=out[i],a=Math.abs(v),n=32-Math.clz32(a),sym=(run<<4)|n;bits(AC.c[sym],AC.l[sym]);bits(v<0?v+(1<<n)-1:v,n);i++}
      if(end<63)bits(AC.c[0],AC.l[0]);return out[0]};
    for(let by=0;by<H;by+=8){for(let bx=0;bx<W;bx+=8){for(let r=0;r<8;r++){const y=Math.min(by+r,H-1);for(let c=0;c<8;c++){const x=Math.min(bx+c,W-1),p=(y*W+x)*4,R=px[p],G=px[p+1],B=px[p+2],k=r*8+c;
          Y[k]=0.299*R+0.587*G+0.114*B-128;U[k]=-0.168736*R-0.331264*G+0.5*B;V[k]=0.5*R-0.418688*G-0.081312*B}}
        pY=blk(Y,fy,pY,hDL,hAL);pU=blk(U,fc,pU,hDC,hAC);pV=blk(V,fc,pV,hDC,hAC)}
      if((by&127)===120){o.progress&&o.progress(by/H);await tick()}}
    if(nb>0)bits((1<<(8-nb))-1,8-nb);
    return new Blob([new Uint8Array([...head,...dqt,...sof,...dhtS,...sos]),buf.subarray(0,bp),new Uint8Array([0xFF,0xD9])],{type:'image/jpeg'})}
  return{encode}})();

/* ---- 8-bit TIFF (zip) ---- */
async function encodeTIFF8(img,space,alpha){const{data,width:w,height:h}=img,ch=alpha?4:3,n=w*h,pix=new Uint8Array(n*ch);let p=0;for(let i=0;i<n;i++){const s=i*4;pix[p++]=data[s];pix[p++]=data[s+1];pix[p++]=data[s+2];if(alpha)pix[p++]=data[s+3]}
  const comp=await zlib(pix),icc=space==='display-p3'?ICC.p3():ICC.srgb(),tags=[];const T=(id,type,count,val)=>tags.push({id,type,count,val});
  const nT=alpha?12:11,ifd=8,ifdLen=2+nT*12+4,bpsOff=ifd+ifdLen,iccOff=bpsOff+8,dataOff=iccOff+icc.length+(icc.length&1);
  T(256,4,1,w);T(257,4,1,h);T(258,3,ch,bpsOff);T(259,3,1,8);T(262,3,1,2);T(273,4,1,dataOff);T(277,3,1,ch);T(278,4,1,h);T(279,4,1,comp.length);T(284,3,1,1);if(alpha)T(338,3,1,2);T(34675,7,icc.length,iccOff);
  const head=new Uint8Array(dataOff),v=new DataView(head.buffer);head[0]=73;head[1]=73;v.setUint16(2,42,true);v.setUint32(4,ifd,true);v.setUint16(ifd,nT,true);
  tags.forEach((t,i)=>{const o=ifd+2+i*12;v.setUint16(o,t.id,true);v.setUint16(o+2,t.type,true);v.setUint32(o+4,t.count,true);if(t.type===3&&t.count===1)v.setUint16(o+8,t.val,true);else v.setUint32(o+8,t.val,true)});v.setUint32(ifd+2+nT*12,0,true);
  for(let c=0;c<4;c++)v.setUint16(bpsOff+c*2,8,true);head.set(icc,iccOff);return new Blob([head,comp],{type:'image/tiff'})}
/* ---- BMP, TGA ---- */
function encodeBMP(img,alpha){const{data,width:w,height:h}=img;if(alpha){const hs=14+108,sz=hs+w*h*4,o=new Uint8Array(sz),v=new DataView(o.buffer);o[0]=66;o[1]=77;v.setUint32(2,sz,true);v.setUint32(10,hs,true);
    v.setUint32(14,108,true);v.setInt32(18,w,true);v.setInt32(22,-h,true);v.setUint16(26,1,true);v.setUint16(28,32,true);v.setUint32(30,3,true);v.setUint32(34,w*h*4,true);v.setUint32(38,11811,true);v.setUint32(42,11811,true);
    v.setUint32(54,0x00FF0000,true);v.setUint32(58,0x0000FF00,true);v.setUint32(62,0x000000FF,true);v.setUint32(66,0xFF000000,true);v.setUint32(70,0x73524742,true);
    let p=hs;for(let i=0;i<w*h;i++){const s=i*4;o[p++]=data[s+2];o[p++]=data[s+1];o[p++]=data[s];o[p++]=data[s+3]}return new Blob([o],{type:'image/bmp'})}
  const row=(w*3+3)&~3,sz=54+row*h,o=new Uint8Array(sz),v=new DataView(o.buffer);o[0]=66;o[1]=77;v.setUint32(2,sz,true);v.setUint32(10,54,true);v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,h,true);v.setUint16(26,1,true);v.setUint16(28,24,true);v.setUint32(34,row*h,true);v.setUint32(38,11811,true);v.setUint32(42,11811,true);
  for(let y=0;y<h;y++){let p=54+(h-1-y)*row;for(let x=0;x<w;x++){const s=(y*w+x)*4;o[p++]=data[s+2];o[p++]=data[s+1];o[p++]=data[s]}}return new Blob([o],{type:'image/bmp'})}
function encodeTGA(img){const{data,width:w,height:h}=img,o=new Uint8Array(18+w*h*4+26);o[2]=2;o[12]=w&255;o[13]=w>>8;o[14]=h&255;o[15]=h>>8;o[16]=32;o[17]=0x28;let p=18;
  for(let i=0;i<w*h;i++){const s=i*4;o[p++]=data[s+2];o[p++]=data[s+1];o[p++]=data[s];o[p++]=data[s+3]}o.set([...'TRUEVISION-XFILE.'].map(c=>c.charCodeAt(0)),p+8);o[p+25]=0;return new Blob([o],{type:'image/x-tga'})}
/* ---- GIF: median-cut palette, optional Floyd–Steinberg dithering, LZW ---- */
async function encodeGIF(img,ncol,dither,o={}){const{data,width:W,height:H}=img,N=W*H;let trans=false;for(let i=3;i<data.length;i+=4)if(data[i]<128){trans=true;break}
  const K=Math.max(2,Math.min(256,ncol)-(trans?1:0)),hist=new Uint32Array(32768);for(let i=0;i<N;i++){const s=i*4;if(data[s+3]<128)continue;hist[((data[s]>>3)<<10)|((data[s+1]>>3)<<5)|(data[s+2]>>3)]++}
  const cols=[];for(let i=0;i<32768;i++)if(hist[i])cols.push(i);
  const box=a=>{let mn=[31,31,31],mx=[0,0,0];for(const c of a){const r=c>>10,g=(c>>5)&31,b=c&31;if(r<mn[0])mn[0]=r;if(r>mx[0])mx[0]=r;if(g<mn[1])mn[1]=g;if(g>mx[1])mx[1]=g;if(b<mn[2])mn[2]=b;if(b>mx[2])mx[2]=b}let n=0;for(const c of a)n+=hist[c];return{a,mn,mx,n}};
  let boxes=cols.length?[box(cols)]:[];while(boxes.length<K){let bi=-1,bs=0;boxes.forEach((b,i)=>{const s=Math.max(b.mx[0]-b.mn[0],b.mx[1]-b.mn[1],b.mx[2]-b.mn[2]);if(b.a.length>1&&s*Math.sqrt(b.n)>bs){bs=s*Math.sqrt(b.n);bi=i}});if(bi<0)break;
    const b=boxes[bi],ax=[0,1,2].reduce((m,k)=>b.mx[k]-b.mn[k]>b.mx[m]-b.mn[m]?k:m,0),key=c=>ax===0?c>>10:ax===1?(c>>5)&31:c&31;b.a.sort((x,y)=>key(x)-key(y));let half=b.n/2,acc=0,cut=1;for(let i=0;i<b.a.length-1;i++){acc+=hist[b.a[i]];if(acc>=half){cut=i+1;break}}
    boxes.splice(bi,1,box(b.a.slice(0,cut)),box(b.a.slice(cut)))}
  const pal=boxes.map(b=>{let r=0,g=0,bb=0,n=0;for(const c of b.a){const w=hist[c];r+=((c>>10)*8+4)*w;g+=(((c>>5)&31)*8+4)*w;bb+=((c&31)*8+4)*w;n+=w}return[r/n|0,g/n|0,bb/n|0]});if(!pal.length)pal.push([0,0,0]);
  const lut=new Int16Array(32768).fill(-1),near=(r,g,b)=>{let bi=0,bd=1e9;for(let i=0;i<pal.length;i++){const p=pal[i],d=(p[0]-r)**2*2+(p[1]-g)**2*4+(p[2]-b)**2*3;if(d<bd){bd=d;bi=i}}return bi};
  const look=(r,g,b)=>{const k=((r>>3)<<10)|((g>>3)<<5)|(b>>3);let v=lut[k];if(v<0)v=lut[k]=near((r&~7)+4,(g&~7)+4,(b&~7)+4);return v};
  const TI=pal.length;const idx=new Uint8Array(N);let e0=new Float32Array((W+2)*3),e1=new Float32Array((W+2)*3);
  for(let y=0;y<H;y++){e1.fill(0);for(let x=0;x<W;x++){const i=y*W+x,s=i*4;if(trans&&data[s+3]<128){idx[i]=TI;continue}
      let r=data[s],g=data[s+1],b=data[s+2];if(dither){const e=(x+1)*3;r=clamp(r+e0[e],0,255);g=clamp(g+e0[e+1],0,255);b=clamp(b+e0[e+2],0,255)}
      const k=look(r|0,g|0,b|0);idx[i]=k;if(dither){const p=pal[k],er=r-p[0],eg=g-p[1],eb=b-p[2],e=(x+1)*3;e0[e+3]+=er*7/16;e0[e+4]+=eg*7/16;e0[e+5]+=eb*7/16;e1[e-3]+=er*3/16;e1[e-2]+=eg*3/16;e1[e-1]+=eb*3/16;e1[e]+=er*5/16;e1[e+1]+=eg*5/16;e1[e+2]+=eb*5/16;e1[e+3]+=er/16;e1[e+4]+=eg/16;e1[e+5]+=eb/16}}
    const t=e0;e0=e1;e1=t;if((y&255)===255){o.progress&&o.progress(0.5*y/H);await tick()}}
  const total=TI+(trans?1:0);let bitsN=1;while((1<<bitsN)<total)bitsN++;bitsN=Math.max(2,bitsN);const gsize=1<<bitsN;
  const out=[];const hdr=[...'GIF89a'].map(c=>c.charCodeAt(0));out.push(new Uint8Array([...hdr,...le16(W),...le16(H),0xF0|(bitsN-1),0,0]));const gct=new Uint8Array(gsize*3);pal.forEach((p,i)=>gct.set(p,i*3));out.push(gct);
  if(trans)out.push(new Uint8Array([0x21,0xF9,4,1,0,0,TI,0]));out.push(new Uint8Array([0x2C,0,0,0,0,...le16(W),...le16(H),0,bitsN]));
  /* LZW */const clear=1<<bitsN,eoi=clear+1;let cw=bitsN+1,next=eoi+1,acc=0,nb=0;let blk=new Uint8Array(1<<20),bp=0;const wb=b=>{if(bp>=blk.length){const n=new Uint8Array(blk.length*2);n.set(blk);blk=n}blk[bp++]=b};
  const put=c=>{acc|=c<<nb;nb+=cw;while(nb>=8){wb(acc&255);acc>>>=8;nb-=8}};const dict=new Map();put(clear);let pre=idx[0];
  for(let i=1;i<N;i++){const k=idx[i],key=pre*4096+k,hit=dict.get(key);if(hit!==undefined){pre=hit;continue}put(pre);if(next<4096){dict.set(key,next++);if(next>(1<<cw)&&cw<12)cw++}else{put(clear);dict.clear();next=eoi+1;cw=bitsN+1}pre=k;if((i&1048575)===0){o.progress&&o.progress(0.5+0.5*i/N);await tick()}}
  put(pre);put(eoi);if(nb>0)wb(acc&255);const sub=[];for(let p=0;p<bp;p+=255){const n=Math.min(255,bp-p);sub.push(new Uint8Array([n]),blk.subarray(p,p+n))}out.push(...sub,new Uint8Array([0,0x3B]));
  return new Blob(out,{type:'image/gif'})}
/* ---- ICO with PNG images ---- */
async function encodeICO(c){const sizes=[16,24,32,48,64,128,256],ims=[];for(const s of sizes){const t=mk(s,s),g=cx(t);g.imageSmoothingQuality='high';let src=c;
    while(Math.max(src.width,src.height)>s*2){const h=mk(Math.ceil(src.width/2),Math.ceil(src.height/2)),hg=cx(h);hg.imageSmoothingQuality='high';hg.drawImage(src,0,0,h.width,h.height);src=h}
    const f=Math.min(s/src.width,s/src.height),w=src.width*f,h=src.height*f;g.drawImage(src,(s-w)/2,(s-h)/2,w,h);ims.push(new Uint8Array(await(await toBlob(srgbC(t),'image/png')).arrayBuffer()))}
  const head=[0,0,1,0,...le16(sizes.length)];let off=6+16*sizes.length;const dir=[];sizes.forEach((s,i)=>{dir.push(s>=256?0:s,s>=256?0:s,0,0,1,0,32,0,...le32(ims[i].length),...le32(off));off+=ims[i].length});
  return new Blob([new Uint8Array([...head,...dir]),...ims],{type:'image/x-icon'})}
/* ---- PDF: one page, JPEG image with its ICC profile, page size from 300 dpi ---- */
async function encodePDF(jpeg,w,h,space){const enc=new TextEncoder(),icc=space==='display-p3'?ICC.p3():ICC.srgb(),pw=(w*72/300).toFixed(2),ph=(h*72/300).toFixed(2),parts=[],offs=[];let pos=0;
  const add=x=>{const u=typeof x==='string'?enc.encode(x):x;parts.push(u);pos+=u.length};const obj=(n,body,stream)=>{offs[n]=pos;add(`${n} 0 obj\n${body}\n`);if(stream){add('stream\n');add(stream);add('\nendstream\n')}add('endobj\n')};
  add('%PDF-1.6\n%\xE2\xE3\xCF\xD3\n'.replace(/[\x80-\xff]/g,'~'));const cont=`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4,`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace [/ICCBased 6 0 R] /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,jpeg);obj(5,`<< /Length ${cont.length} >>`,enc.encode(cont));obj(6,`<< /N 3 /Alternate /DeviceRGB /Length ${icc.length} >>`,icc);
  obj(7,`<< /Producer (Prism) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}) >>`);
  const xref=pos;add(`xref\n0 8\n0000000000 65535 f \n${offs.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 8 /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts,{type:'application/pdf'})}
/* ---- AVIF through libavif (wasm), in a worker when the page allows it ---- */
async function encodeAVIF(px,w,h,opts){const o={quality:50,qualityAlpha:-1,denoiseLevel:0,tileColsLog2:0,tileRowsLog2:0,speed:6,subsample:1,chromaDeltaQ:false,sharpness:0,tune:0,enableSharpYUV:false,bitDepth:8,lossless:false,...opts};
  const bytes=new Uint8Array(px.buffer,px.byteOffset,px.byteLength);
  const viaWorker=()=>new Promise((res,rej)=>{let wk;try{wk=new Worker(asset('avif/worker.js'),{type:'module'})}catch(e){rej(e);return}const t=setTimeout(()=>{wk.terminate();rej(new Error('worker timeout'))},600000);
    wk.onerror=e=>{clearTimeout(t);wk.terminate();rej(new Error('worker'))};wk.onmessage=e=>{clearTimeout(t);wk.terminate();e.data.ok?res(e.data.out):rej(Object.assign(new Error(e.data.err),{enc:true}))};wk.postMessage({data:bytes,w,h,opts:o})});
  try{return await viaWorker()}catch(e){if(e.enc)throw e;console.warn('avif worker',e)}
  if(!FMT.avif){const ns=await import(asset('avif/avif_enc.js'));FMT.avif=await ns.default({noInitialRun:true})}await tick();const out=FMT.avif.encode(bytes,w,h,o);if(!out)throw new Error('encodage AVIF impossible');return new Uint8Array(out)}

