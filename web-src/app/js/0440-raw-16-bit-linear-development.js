/* ================= RAW: 16-bit linear development ================= */
const M3={mul:(A,B)=>A.map((r,i)=>B[0].map((_,j)=>r.reduce((s,_,k)=>s+A[i][k]*B[k][j],0))),inv(m){const[a,b,c]=m[0],[d,e,f]=m[1],[g,h,i]=m[2],A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,det=a*A+b*B+c*C;
  return[[A/det,-(b*i-c*h)/det,(b*f-c*e)/det],[B/det,(a*i-c*g)/det,-(a*f-c*d)/det],[C/det,-(a*h-b*g)/det,(a*e-b*d)/det]]}};
const PRO2SRGB=M3.inv([[0.529317,0.330092,0.140588],[0.098368,0.873465,0.028169],[0.016879,0.117663,0.865457]]),SRGB2P3=[[0.8224621,0.177538,0],[0.0331941,0.9668058,0],[0.0170827,0.0723974,0.9105199]],PRO2P3=M3.mul(SRGB2P3,PRO2SRGB);
const ENC=(()=>{const N=8192,t=new Float32Array(N+2);for(let i=0;i<=N+1;i++){const v=Math.min(1,i/N);t[i]=(v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055)*255}return t})();
const RAW_DEF=()=>Object.assign({wb:'camera',ev:0,hl:35,sh:0,space:'srgb'},PREF.get('rawDef',{}));
let RAWC=null;/* last decoded RAW: {key,data:Uint16Array,w,h,meta,white} */
async function rawDecode16(file,wb){busy(true,'Développement du fichier RAW (16 bits)…',null);let raw=null;try{const mod=await import(asset('raw/index.js'));raw=new mod.default();const buf=new Uint8Array(await file.arrayBuffer());
    await raw.open(buf,{useCameraWb:wb!=='auto',useAutoWb:wb==='auto',outputBps:16,outputColor:4,gamm:[1,1],noAutoBright:true,highlight:2,userQual:3});let meta={};try{meta=await raw.metadata()}catch(e){}const im=await raw.imageData();
    if(!im||!im.data||!im.width)throw new Error('format non pris en charge');const W=im.width,H=im.height,col=im.colors||3;let data=im.data;
    if(!(data instanceof Uint16Array)){if(data.BYTES_PER_ELEMENT===1&&data.length>=W*H*col*2){data=new Uint16Array(data.buffer,data.byteOffset,W*H*col)}else{const u=new Uint16Array(W*H*col);for(let i=0;i<u.length;i++)u[i]=data[i]*257;data=u}}
    if(col!==3){const u=new Uint16Array(W*H*3);for(let i=0,j=0;i<W*H;i++,j+=col){u[i*3]=data[j];u[i*3+1]=data[j+(col>1?1:0)];u[i*3+2]=data[j+(col>2?2:0)]}data=u}
    const hist=[new Uint32Array(1024),new Uint32Array(1024),new Uint32Array(1024)];const step=Math.max(1,Math.floor(W*H/400000));let cnt=0;for(let i=0;i<W*H;i+=step){hist[0][data[i*3]>>6]++;hist[1][data[i*3+1]>>6]++;hist[2][data[i*3+2]>>6]++;cnt++}
    let white=0;for(let c=0;c<3;c++){let tot=0,v=1023;for(;v>0;v--){tot+=hist[c][v];if(tot>cnt*0.01)break}white=Math.max(white,(v+1)/1024)}
    const bits=[];const mk_=meta.camera_make||meta.make,md_=meta.camera_model||meta.model;if(mk_||md_)bits.push([mk_,md_].filter(Boolean).join(' ').trim());if(meta.iso_speed)bits.push('ISO '+Math.round(meta.iso_speed));if(meta.shutter)bits.push(meta.shutter>=1?meta.shutter+' s':'1/'+Math.round(1/meta.shutter)+' s');if(meta.aperture)bits.push('f/'+(+meta.aperture).toFixed(1));if(meta.focal_len)bits.push(Math.round(meta.focal_len)+' mm');
    /* what the lens profile needs: camera, lens, focal length, aperture (the lens name comes from the file's EXIF when it is TIFF-based) */
    const info={make:mk_||'',model:md_||'',focal:+meta.focal_len||0,fn:+meta.aperture||0,lens:''};try{const T=tiffRead(buf),s=T&&exifSummary(T);if(s){info.lens=s.lens||'';if(!info.focal&&s.focal)info.focal=s.focal}}catch(e){}
    return{data,w:W,h:H,meta:bits.join(' · '),white:clamp(white,1/16,1),info}}
  finally{try{raw&&raw.dispose&&raw.dispose()}catch(e){}busy(false)}}
function rawProxy(R,maxS){const f=Math.max(1,Math.ceil(Math.max(R.w,R.h)/maxS));if(f===1)return R;const w=Math.floor(R.w/f),h=Math.floor(R.h/f),o=new Float32Array(w*h*3),D=R.data,k=1/(f*f);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let r=0,g=0,b=0;for(let j=0;j<f;j++){let p=((y*f+j)*R.w+x*f)*3;for(let i=0;i<f;i++,p+=3){r+=D[p];g+=D[p+1];b+=D[p+2]}}const q=(y*w+x)*3;o[q]=r*k;o[q+1]=g*k;o[q+2]=b*k}return{data:o,w,h,white:R.white}}
function rawDevelop(R,set,wantHi){const W=R.w,H=R.h,D=R.data,n=W*H,space=set.space==='display-p3'&&P3_OK?'display-p3':'srgb',M=space==='display-p3'?PRO2P3:PRO2SRGB;
  const c=document.createElement('canvas');c.width=W;c.height=H;if(space!=='srgb')c._cs=space;const g=rx(c),id=g.createImageData(W,H),o=id.data,HI=wantHi?new Uint16Array(n*4):null;
  const gain=Math.pow(2,set.ev)/(R.white*65535),m00=M[0][0]*gain,m01=M[0][1]*gain,m02=M[0][2]*gain,m10=M[1][0]*gain,m11=M[1][1]*gain,m12=M[1][2]*gain,m20=M[2][0]*gain,m21=M[2][1]*gain,m22=M[2][2]*gain;
  const knee=1-0.75*set.hl/100,kw=1-knee,shA=set.sh/100*1.8,N=8192;let seed=12345;
  for(let i=0,p=0,q=0;i<n;i++,p+=3,q+=4){const R0=D[p],G0=D[p+1],B0=D[p+2];let r=m00*R0+m01*G0+m02*B0,gg=m10*R0+m11*G0+m12*B0,b=m20*R0+m21*G0+m22*B0;if(r<0)r=0;if(gg<0)gg=0;if(b<0)b=0;
    let mx=r>gg?(r>b?r:b):(gg>b?gg:b);if(mx>knee&&set.hl>0){const nm=knee+kw*(1-Math.exp(-(mx-knee)/kw)),f=nm/mx;r*=f;gg*=f;b*=f;mx=nm}
    let er=r>=1?ENC[N]:ENC[(r*N)|0],eg=gg>=1?ENC[N]:ENC[(gg*N)|0],eb=b>=1?ENC[N]:ENC[(b*N)|0];
    if(shA>0){const m=(er>eg?(er>eb?er:eb):(eg>eb?eg:eb))/255;if(m>0.002){const u=1-m,f=1+shA*u*u*u*u*(m<0.08?m/0.08:1);er*=f;eg*=f;eb*=f}}
    if(HI){HI[q]=er>=255?65535:er*257+0.5|0;HI[q+1]=eg>=255?65535:eg*257+0.5|0;HI[q+2]=eb>=255?65535:eb*257+0.5|0;HI[q+3]=65535}
    seed=(seed*1103515245+12345)&0x7fffffff;const dz=(seed&1023)/1024;
    o[q]=er+dz>=255?255:(er+dz)|0;o[q+1]=eg+dz>=255?255:(eg+dz)|0;o[q+2]=eb+dz>=255?255:(eb+dz)|0;o[q+3]=255}
  g.putImageData(id,0,0);if(HI)c._hi=HI;return c}
/* replaces the 8-bit decoder: every RAW now goes through the 16-bit linear pipeline */
decodeRaw=async function(file,set){set=set||RAW_DEF();const R=await rawDecode16(file,set.wb);busy(true,'Développement du fichier RAW (16 bits)…',null);await tick();try{const c=rawDevelop(R,set,true);c._raw=true;RAWC={file,set,R};try{FMT.info.set(c,{meta:R.meta,sum:R.info})}catch(e){}return{c,meta:R.meta,set}}finally{busy(false)}};
async function attachRaw(file,set){const d=S.doc;if(!d)return;const key='raw_'+uid8();d.raw={key,name:file.name,set:{...set},w:d.w,h:d.h,file};try{await IDB.put('blobs',key,file)}catch(e){console.warn(e)}}
async function rawDialog(){const d=S.doc;if(!d||!d.raw){toast('Disponible pour les photos ouvertes depuis un fichier RAW');return}
  if(d.w!==d.raw.w||d.h!==d.raw.h){toast('Le RAW ne peut plus être redéveloppé après un recadrage, une rotation ou un redimensionnement. Annulez-les d’abord.',6000);return}
  const L=d.layers[0];if(!L||L.kind!=='pixel'){toast('Le calque d’arrière-plan a été supprimé');return}
  let file=d.raw.file;if(!file){try{file=await IDB.get('blobs',d.raw.key)}catch(e){}if(!file){toast('Le fichier RAW d’origine n’est pas sur cet appareil (il n’est pas synchronisé). Rouvrez le RAW pour le redévelopper.',6000);return}d.raw.file=file}
  const set={...RAW_DEF(),...d.raw.set};let R=RAWC&&RAWC.file===file&&RAWC.set.wb===set.wb?RAWC.R:null;
  try{if(!R){R=await rawDecode16(file,set.wb);RAWC={file,set:{...set},R}}}catch(e){console.error(e);toast('Lecture du RAW impossible : '+(e.message||e),5000);return}
  let P=rawProxy(R,1400),t=null,closed=false;const prevSpace=d.space||'srgb';
  const show=()=>{if(closed)return;const c=rawDevelop(P,set);const pv=mk(d.w,d.h),g=cx(pv);g.imageSmoothingQuality='high';g.drawImage(c,0,0,d.w,d.h);L.preview=pv;markComp()};
  const sched=()=>{clearTimeout(t);t=setTimeout(show,30)};const end=()=>{closed=true;clearTimeout(t);delete L.preview;markComp()};
  const p3=P3_OK?`<label class="field">Espace de couleur<select id="rwSp"><option value="srgb" ${set.space!=='display-p3'?'selected':''}>sRGB (web, standard)</option><option value="display-p3" ${set.space==='display-p3'?'selected':''}>Display P3 (gamut étendu)</option></select></label>`:'';
  dialog({title:'Développer le RAW',light:true,body:`<p class="muted">Développement en 16 bits linéaires depuis le fichier d’origine : vous récupérez les hautes lumières et les ombres que le JPEG aurait perdues. Remplace les pixels du calque « ${esc(L.name)} » ; vos calques de réglage sont conservés.</p>
    <label class="field">Balance des blancs<select id="rwWb"><option value="camera" ${set.wb!=='auto'?'selected':''}>Boîtier</option><option value="auto" ${set.wb==='auto'?'selected':''}>Automatique</option></select></label>
    ${rangeRow('rwEv','Exposition',-3,3,0.05,set.ev,' EV')}${rangeRow('rwHl','Récupération des hautes lumières',0,100,1,set.hl,'')}${rangeRow('rwSh','Déboucher les ombres',0,100,1,set.sh,'')}${p3}
    <label class="inline"><input type="checkbox" id="rwDef">Utiliser ces réglages pour les prochains RAW</label>`,
    onOpen:el=>{const num=(id,k,u,f=v=>v)=>{const i=$('#'+id,el);i.addEventListener('input',()=>{set[k]=+i.value;$('#'+id+'-o',el).textContent=f(+i.value)+u;sched()})};
      num('rwEv','ev',' EV',v=>(v>0?'+':'')+v.toFixed(2));num('rwHl','hl','');num('rwSh','sh','');
      const sp=$('#rwSp',el);if(sp)sp.onchange=()=>{set.space=sp.value;sched()};
      $('#rwWb',el).onchange=async e=>{set.wb=e.target.value;try{R=await rawDecode16(file,set.wb);RAWC={file,set:{...set},R};P=rawProxy(R,1400);show()}catch(err){toast('Lecture du RAW impossible')}};
      const s=$('#scrim');const oc=s._cancel;s._cancel=()=>{end();oc&&oc()};show()},
    buttons:[{label:'Annuler',onClick:end},{label:'Appliquer',primary:true,onClick:async el=>{closed=true;clearTimeout(t);if($('#rwDef',el).checked)PREF.set('rawDef',{...set});busy(true,'Développement en pleine résolution…',null);await tick();
      try{const c=rawDevelop(R,set,true);delete L.preview;const sp=c._cs||'srgb';if(sp!==prevSpace){setCS(sp);d.layers.forEach((X,i)=>{if(i>0&&X.canvas){const n=mk(X.canvas.width,X.canvas.height);cx(n).drawImage(X.canvas,0,0);X.canvas=n}});d.space=CS}
        let lc=c;if(c.width!==d.w||c.height!==d.h){lc=mk(d.w,d.h);const g=cx(lc);g.imageSmoothingQuality='high';g.drawImage(c,0,0,d.w,d.h)}else if((c._cs||'srgb')!==CS){lc=mk(d.w,d.h);cx(lc).drawImage(c,0,0)}
        L.canvas=lc;if(c._hi&&c.width===d.w&&c.height===d.h){L.hi=c._hi;L.hiP=null;L.hiC=lc}else{L.hi=null;L.hiP=null;L.hiC=null}d.raw.set={...set};markComp();pushHistory('Développement RAW');updateDocName();toast('RAW redéveloppé'+(sp==='display-p3'?' en Display P3':''))}
      catch(e){console.error(e);end();toast('Développement impossible : '+(e.message||e),5000)}finally{busy(false)}}}]})}

