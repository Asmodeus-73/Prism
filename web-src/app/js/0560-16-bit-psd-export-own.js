/* ================= v8.2: 16-bit PSD export (own writer: ag-psd only writes 8 bits) ================= */
const PSD_KEY={'source-over':'norm','darken':'dark','multiply':'mul ','color-burn':'idiv','lighten':'lite','screen':'scrn','color-dodge':'div ','overlay':'over','soft-light':'sLit','hard-light':'hLit','difference':'diff','exclusion':'smud','hue':'hue ','saturation':'sat ','color':'colr','luminosity':'lum ','lighter':'lddg'};
async function encodePSD16(d,onP){const W=d.w,H=d.h,N=W*H,chunks=[];const prog=(p,m)=>onP&&onP(p,m);
  const hdr=n=>{const b=new Uint8Array(n);return{b,v:new DataView(b.buffer),p:0}};
  const asc=s=>{const o=[];for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);o.push(c<128&&c>=32?c:63)}return o};
  /* PackBits rows: the compression every PSD reader understands */
  const rle=(rows,rowLen)=>{/* rows: Uint8Array of H rows of rowLen bytes -> {counts:Uint16Array,data:Uint8Array} */const cap=rows.length+Math.ceil(rowLen/128)*H+H,out=new Uint8Array(cap),counts=new Uint16Array(H);let o=0;
    for(let y=0;y<H;y++){const b=y*rowLen,e=b+rowLen,start=o;let i=b;
      while(i<e){let run=1;while(i+run<e&&run<128&&rows[i+run]===rows[i])run++;
        if(run>=3){out[o++]=257-run;out[o++]=rows[i];i+=run}
        else{let j=i,lit=0;while(j<e&&lit<128){let r=1;while(j+r<e&&r<3&&rows[j+r]===rows[j])r++;if(r>=3)break;j++;lit++}if(lit<1)lit=1,j=i+1;out[o++]=lit-1;out.set(rows.subarray(i,i+lit),o);o+=lit;i+=lit}}
      counts[y]=o-start}return{counts,data:out.subarray(0,o)}};
  const tagRLE=(counts,data)=>{const o=new Uint8Array(2+counts.length*2+data.length),v=new DataView(o.buffer);v.setUint16(0,1);for(let i=0;i<counts.length;i++)v.setUint16(2+i*2,counts[i]);o.set(data,2+counts.length*2);return o};
  /* one channel plane (big-endian 16-bit) */
  const plane=async(get)=>{const u=new Uint8Array(N*2);for(let i=0;i<N;i++){const v=get(i);u[2*i]=v>>8;u[2*i+1]=v&255}const r=rle(u,W*2);return tagRLE(r.counts,r.data)};
  const layers=[];
  const pix=L=>{const e=effHi(L);if(e)return e;const a=rx(L.canvas).getImageData(0,0,W,H).data,o=new Uint16Array(a.length);for(let i=0;i<a.length;i++)o[i]=a[i]*257;return o};
  const pls=d.layers.filter(L=>L.kind==='pixel');let k=0;
  for(const L of pls){const hi=pix(L);const ch=[];for(const c of [0,1,2,3]){ch.push({id:c===3?-1:c,data:await plane(i=>hi[i*4+c])});await tick()}
    let mask=null;if(L.mask){const m=rx(L.mask).getImageData(0,0,W,H).data;mask=await plane(i=>m[i*4+3]*257);ch.push({id:-2,data:mask})}
    layers.push({name:L.name,blend:PSD_KEY[L.blend]||'norm',opacity:L.opacity,hidden:L.visible===false,ch,mask:!!L.mask});prog((++k)/(pls.length+2)*0.6,'Calques…')}
  const hasAdj=d.layers.some(L=>L.kind==='adjust'&&L.visible!==false&&!devIsId(L.dev));
  const full=await renderDoc16(1,{progress:p=>prog(0.6+p*0.2,'Rendu 16 bits…')});
  if(hasAdj){const ch=[];for(const c of [0,1,2,3]){ch.push({id:c===3?-1:c,data:await plane(i=>full.data[i*4+c])})}layers.push({name:'Rendu Prism (réglages appliqués)',blend:'norm',opacity:1,hidden:false,ch,mask:false})}
  prog(0.82,'Fichier…');
  /* layer records */
  const rec=[];const cnt=hdr(2);cnt.v.setInt16(0,layers.length);rec.push(cnt.b);
  for(const l of layers){const nm=asc(l.name).slice(0,200),pas=[nm.length,...nm];while(pas.length%4)pas.push(0);const uni=l.name,un=new Uint8Array(4+uni.length*2);new DataView(un.buffer).setUint32(0,uni.length);for(let i=0;i<uni.length;i++){un[4+2*i]=uni.charCodeAt(i)>>8;un[5+2*i]=uni.charCodeAt(i)&255}
    const unPad=(4-un.length%4)%4,luni=12+un.length+unPad;const maskLen=l.mask?20:0;const extra=4+maskLen+4+pas.length+luni;
    const h=hdr(16+2+l.ch.length*6+4+4+1+1+1+1+4);let p=0;const v=h.v;v.setInt32(p,0);v.setInt32(p+4,0);v.setInt32(p+8,H);v.setInt32(p+12,W);p+=16;v.setUint16(p,l.ch.length);p+=2;
    for(const c of l.ch){v.setInt16(p,c.id);v.setUint32(p+2,c.data.length);p+=6}
    h.b.set([56,66,73,77],p);p+=4;h.b.set(asc(l.blend),p);p+=4;h.b[p++]=Math.round(clamp(l.opacity,0,1)*255);h.b[p++]=0;h.b[p++]=l.hidden?2:0;h.b[p++]=0;v.setUint32(p,extra);p+=4;rec.push(h.b);
    const e=hdr(4+maskLen+4);e.v.setUint32(0,maskLen);if(l.mask){e.v.setInt32(4,0);e.v.setInt32(8,0);e.v.setInt32(12,H);e.v.setInt32(16,W);e.b[20]=0;e.b[21]=0}e.v.setUint32(4+maskLen,0);rec.push(e.b);rec.push(new Uint8Array(pas));
    const lh=hdr(12);lh.b.set([56,66,73,77,108,117,110,105],0);lh.v.setUint32(8,un.length+unPad);rec.push(lh.b,un,new Uint8Array(unPad))}
  const chData=[];for(const l of layers)for(const c of l.ch)chData.push(c.data);
  let lrLen=0;[...rec,...chData].forEach(b=>lrLen+=b.length);const lrPad=(4-lrLen%4)%4;
  /* header + resources */
  const H0=hdr(26);H0.b.set([56,66,80,83],0);H0.v.setUint16(4,1);H0.v.setUint16(12,3);H0.v.setUint32(14,H);H0.v.setUint32(18,W);H0.v.setUint16(22,16);H0.v.setUint16(24,3);chunks.push(H0.b);
  chunks.push(new Uint8Array(4));/* colour mode data */
  const icc=d.space==='display-p3'?ICC.p3():ICC.srgb(),iccPad=icc.length%2;const rs=hdr(12+icc.length+iccPad);rs.b.set([56,66,73,77],0);rs.v.setUint16(4,1039);rs.v.setUint16(6,0);rs.v.setUint32(8,icc.length);rs.b.set(icc,12);
  const rl=hdr(4);rl.v.setUint32(0,rs.b.length);chunks.push(rl.b,rs.b);
  /* layer & mask info: layer data lives in the Lr16 block, as Photoshop writes it */
  const blk=12+lrLen+lrPad;
  const lb=hdr(12);lb.b.set([56,66,73,77,76,114,49,54],0);lb.v.setUint32(8,lrLen+lrPad);
  const lmHead=hdr(12);lmHead.v.setUint32(0,4+4+blk);lmHead.v.setUint32(4,0);lmHead.v.setUint32(8,0);
  chunks.push(lmHead.b,lb.b,...rec,...chData,new Uint8Array(lrPad));
  /* merged image: planar, one ZIP stream */
  const mi=new Uint8Array(N*3*2);for(let c=0;c<3;c++){const o=c*N*2;for(let i=0;i<N;i++){const v=full.data[i*4+c];mi[o+2*i]=v>>8;mi[o+2*i+1]=v&255}}
  const parts3=[];const cnts=new Uint16Array(H*3);let tot=0;for(let c=0;c<3;c++){const r=rle(mi.subarray(c*N*2,(c+1)*N*2),W*2);cnts.set(r.counts,c*H);parts3.push(r.data);tot+=r.data.length;await tick()}
  const mh=new Uint8Array(2+H*3*2);const mv=new DataView(mh.buffer);mv.setUint16(0,1);for(let i=0;i<H*3;i++)mv.setUint16(2+i*2,cnts[i]);chunks.push(mh,...parts3);
  prog(1,'');return new Blob(chunks,{type:'image/vnd.adobe.photoshop'})}
const _exportPSD8=exportPSD;
exportPSD=async function(bits){const d=S.doc;if(!d)return;const b=bits||(docHasHi(d)||(PREC.on&&precOK())?16:8);if(b!==16)return _exportPSD8();
  busy(true,'Création du fichier Photoshop 16 bits…',0);
  try{const blob=await encodePSD16(d,(p,m)=>busy(true,m||'Création du fichier Photoshop 16 bits…',p));const base=(d.name||'photo').replace(/\.[a-z0-9]+$/i,'').replace(/[\\/:*?"<>|]+/g,'-');
    const z=await makeZip([{name:base+'.psd',data:new Uint8Array(await blob.arrayBuffer())}]);busy(false);await saveFile(z,base+'-psd.zip')}
  catch(e){busy(false);console.error(e);toast('Export PSD impossible : '+(e.message||e),5000)}};

/* 16-bit PSD import: own reader, because ag-psd flattens 16-bit data to 8 bits */
async function readPSD16(buf){const u=new Uint8Array(buf),v=new DataView(buf);if(String.fromCharCode(u[0],u[1],u[2],u[3])!=='8BPS')throw new Error('fichier PSD invalide');
  if(v.getUint16(4)!==1)throw new Error('les fichiers PSB 16 bits ne sont pas pris en charge');const H=v.getUint32(14),W=v.getUint32(18),depth=v.getUint16(22),mode=v.getUint16(24);
  if(depth!==16||mode!==3)throw new Error('seul le RGB 16 bits est lu ici');let p=26;p+=4+v.getUint32(p);const resLen=v.getUint32(p);p+=4;let icc=null;
  for(let q=p,e=p+resLen;q+12<=e;){const id=v.getUint16(q+4);let nl=u[q+6];nl=(nl+1)%2?nl+2:nl+1;const sz=v.getUint32(q+6+nl);if(id===1039)icc=u.subarray(q+10+nl,q+10+nl+sz);q+=10+nl+sz+(sz%2)}
  p+=resLen;const lmLen=v.getUint32(p);p+=4;const lmEnd=p+lmLen;let li=null;
  const liLen=v.getUint32(p);if(liLen>0)li={at:p+4,end:p+4+liLen};
  if(!li){/* Photoshop keeps 16-bit layers in an Lr16 / Lr32 block */let q=p+4+liLen;const gl=v.getUint32(q);q+=4+gl;while(q+12<=lmEnd){const key=String.fromCharCode(u[q+4],u[q+5],u[q+6],u[q+7]),len=v.getUint32(q+8);if(key==='Lr16'||key==='Lr32'){li={at:q+12,end:q+12+len};break}q+=12+len+(len%4?4-len%4:0)}}
  const unzip=async(b)=>unzlib(b);
  const unpred16=(a,w,h)=>{for(let y=0;y<h;y++){const r=y*w*2;for(let x=1;x<w;x++){const o=r+x*2,s=((a[o-2]<<8|a[o-1])+(a[o]<<8|a[o+1]))&65535;a[o]=s>>8;a[o+1]=s&255}}};
  const chanData=async(q,len,w,h)=>{/* -> Uint16Array w*h */const comp=v.getUint16(q);q+=2;len-=2;const out=new Uint16Array(w*h);if(!w||!h)return out;let bytes;
    if(comp===0)bytes=u.subarray(q,q+w*h*2);
    else if(comp===1){bytes=new Uint8Array(w*h*2);let d=q+h*2,o=0;for(let y=0;y<h;y++){const n=v.getUint16(q+y*2),e=d+n;let r=y*w*2;const re=r+w*2;while(d<e&&r<re){let c=u[d++];if(c>127)c-=256;if(c>=0){for(let k=0;k<=c&&r<re;k++)bytes[r++]=u[d++]}else if(c!==-128){const b=u[d++];for(let k=0;k<1-c&&r<re;k++)bytes[r++]=b}}d=e}}
    else if(comp===2||comp===3){bytes=await unzip(u.subarray(q,q+len));if(comp===3)unpred16(bytes,w,h)}else throw new Error('compression PSD inconnue ('+comp+')');
    for(let i=0;i<w*h;i++)out[i]=bytes[2*i]<<8|bytes[2*i+1];return out};
  const layers=[];
  if(li){let q=li.at;const count=Math.abs(v.getInt16(q));q+=2;const recs=[];
    for(let i=0;i<count;i++){const r={top:v.getInt32(q),left:v.getInt32(q+4),bottom:v.getInt32(q+8),right:v.getInt32(q+12)};q+=16;const nc=v.getUint16(q);q+=2;r.ch=[];for(let c=0;c<nc;c++){r.ch.push({id:v.getInt16(q),len:v.getUint32(q+2)});q+=6}
      r.blend=String.fromCharCode(u[q+4],u[q+5],u[q+6],u[q+7]);r.opacity=u[q+8]/255;r.hidden=!!(u[q+10]&2);const ex=v.getUint32(q+12);q+=16;const ee=q+ex;
      const ml=v.getUint32(q);q+=4;if(ml>=16){r.mask={top:v.getInt32(q),left:v.getInt32(q+4),bottom:v.getInt32(q+8),right:v.getInt32(q+12),def:u[q+16]};r.mask.disabled=!!(u[q+17]&2)}q+=ml;
      const bl=v.getUint32(q);q+=4+bl;const nl=u[q];r.name=String.fromCharCode(...u.subarray(q+1,q+1+nl));q+=1+nl;q+=(4-(1+nl)%4)%4;
      r.group=0;while(q+12<=ee){const key=String.fromCharCode(u[q+4],u[q+5],u[q+6],u[q+7]),len=v.getUint32(q+8);if(key==='luni'){const n=v.getUint32(q+12);let t='';for(let k=0;k<n;k++)t+=String.fromCharCode(v.getUint16(q+16+k*2));r.name=t}else if(key==='lsct')r.group=v.getUint32(q+12);else if(key==='clbl'||key==='infx'){}q+=12+len+(len%4?4-len%4:0)}
      q=ee;recs.push(r)}
    for(const r of recs){const w=Math.max(0,r.right-r.left),h=Math.max(0,r.bottom-r.top);r.px={};
      for(const c of r.ch){const isM=c.id===-2||c.id===-3;let cw=w,ch=h;if(isM&&r.mask){cw=Math.max(0,r.mask.right-r.mask.left);ch=Math.max(0,r.mask.bottom-r.mask.top)}
        if(c.len>2||(cw*ch===0&&c.len>=2)){r.px[c.id]=c.len>2?await chanData(q,c.len,cw,ch):null}q+=c.len}
      await tick()}
    layers.push(...recs)}
  return{W,H,layers,icc}}
async function importPSD16(file,name){busy(true,'Lecture du fichier Photoshop 16 bits…',null);const cs0=CS;try{const buf=await file.arrayBuffer();const P=await readPSD16(buf);const W=P.W,H=P.H;if(W*H>MAX_PX)throw new Error(`image trop grande (${W} × ${H})`);
    setCS(P.icc&&typeof wantP3==='function'&&wantP3(P.icc)&&P3_OK?'display-p3':'srgb');
    const layers=[],stack=[{hidden:false,op:1}];let skipped=0;
    const KEY=Object.fromEntries(Object.entries(PSD_KEY).map(([a,b])=>[b,a]));
    for(const r of P.layers){/* records run bottom to top; a group is delimited by a divider (3) below and its header (1 or 2) above */
      if(r.group===3){stack.push({idx:layers.length,div:true});continue}
      if(r.group===1||r.group===2){const g=stack.pop();if(g&&g.div)for(let i=g.idx;i<layers.length;i++){layers[i].opacity=clamp(layers[i].opacity*r.opacity,0,1);if(r.hidden)layers[i].visible=false}continue}
      const w=Math.max(0,r.right-r.left),h=Math.max(0,r.bottom-r.top);if(!w||!h||(!r.px[0]&&!r.px[1])){skipped++;continue}
      const hi=new Uint16Array(W*H*4),c8=mk(W,H),g8=rx(c8),id=g8.createImageData(W,H),o8=id.data;const R=r.px[0],G=r.px[1]||R,B=r.px[2]||R,A=r.px[-1];
      for(let y=0;y<h;y++){const yy=y+r.top;if(yy<0||yy>=H)continue;for(let x=0;x<w;x++){const xx=x+r.left;if(xx<0||xx>=W)continue;const s=y*w+x,d=(yy*W+xx)*4;hi[d]=R[s];hi[d+1]=G[s];hi[d+2]=B[s];hi[d+3]=A?A[s]:65535;o8[d]=(R[s]+128)/257;o8[d+1]=(G[s]+128)/257;o8[d+2]=(B[s]+128)/257;o8[d+3]=((A?A[s]:65535)+128)/257}}
      g8.putImageData(id,0,0);const L=newPixel(r.name||'Calque',c8);L.visible=!r.hidden;L.opacity=clamp(r.opacity,0,1);L.blend=KEY[r.blend]||'source-over';L.hi=hi;L.hiC=L.canvas;
      const M=r.px[-2];if(M&&r.mask&&!r.mask.disabled){const mw=r.mask.right-r.mask.left,mh=r.mask.bottom-r.mask.top,m=mk(W,H),mg=rx(m);if(r.mask.def>127){mg.fillStyle='#fff';mg.fillRect(0,0,W,H)}const t=mk(mw,mh),tg=rx(t),ti=tg.createImageData(mw,mh);for(let i=0;i<mw*mh;i++){ti.data[i*4]=ti.data[i*4+1]=ti.data[i*4+2]=255;ti.data[i*4+3]=(M[i]+128)/257}tg.putImageData(ti,0,0);mg.clearRect(r.mask.left,r.mask.top,mw,mh);mg.drawImage(t,r.mask.left,r.mask.top);L.mask=m}
      layers.push(L);await tick()}
    if(!layers.length)throw new Error('aucun calque lisible');layers.push(newAdjust('Réglages'));
    S.doc={w:W,h:H,name:(name||file.name||'photoshop.psd'),layers,active:layers.length-1,sel:null,pid:uid8(),sync:Cloud.ok&&PREF.get('autoSync',true),saved:false,space:CS};
    S.sample=false;S.meta='PSD 16 bits · '+(layers.length-1)+' calque'+(layers.length>2?'s':'');S.history=[];S.hi=-1;S.crop=null;S.cloneSrc=null;S.cloneOff=null;S.maxHist=clamp(Math.floor(HIST_BUDGET/(W*H*4)),3,40);AI.subjectCache=null;
    pushHistory('Ouverture du PSD');selChanged();markComp();fit(true);syncAll();$('#empty').hidden=true;updateDocName();busy(false);
    toast(`PSD 16 bits ouvert : ${layers.length-1} calque${layers.length>2?'s':''}${skipped?` (${skipped} calque${skipped>1?'s':''} de réglage ou vide${skipped>1?'s':''} ignoré${skipped>1?'s':''})`:''}`,5000);scheduleSave(500)}
  catch(e){setCS(cs0);busy(false);console.error(e);toast('Ce PSD n’a pas pu être lu : '+(e.message||e),6000)}}
const _importPSD8=importPSD;
importPSD=async function(file,name){let dp=8,md=3;try{const h=new Uint8Array(await file.slice(0,26).arrayBuffer());dp=h[22]*256+h[23];md=h[24]*256+h[25]}catch(e){}return dp===16&&md===3?importPSD16(file,name):_importPSD8(file,name)};

